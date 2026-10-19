import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type CardGameSound = 'FAFAP' | 'PRESIDENT' | 'UNO' | 'COCHON' | 'CHECK_GAMES';
type SampleName = 'card-1' | 'card-2' | 'special' | 'draw' | 'turn' | 'low-time' | 'victory' | 'defeat' | 'tcheck' | 'games' | 'uno' | 'korat' | 'penalty-2' | 'joker' | 'penalty-4' | 'jack-command' | 'ace' | 'family-black' | 'family-tchaka' | 'family-koubi' | 'family-zink';

@Injectable({ providedIn: 'root' })
export class GameSoundService {
    private context?: AudioContext;
    private output?: GainNode;
    private musicOutput?: GainNode;
    private readonly musicSources = new Set<OscillatorNode>();
    private musicTimer?: ReturnType<typeof setInterval>;
    private musicPlaying = false;
    private musicSource?: AudioBufferSourceNode;
    private musicBuffer?: AudioBuffer;
    private musicTrack?: CardGameSound;
    private musicLoading?: Promise<void>;
    private handsRevealSource?: AudioBufferSourceNode;
    private handsRevealGain?: GainNode;
    private handsRevealRequest = 0;
    private readonly fileBuffers = new Map<string, AudioBuffer>();
    private readonly fileLoading = new Map<string, Promise<void>>();
    // The game can start from a realtime event after the user gesture that
    // unlocked WebAudio. Keep the request until the context is actually ready.
    private musicPending = false;
    private readonly buffers = new Map<SampleName, AudioBuffer>();
    private readonly loading = new Map<SampleName, Promise<void>>();
    private readonly samples: SampleName[] = ['card-1', 'card-2', 'special', 'draw', 'turn', 'low-time', 'victory', 'defeat', 'tcheck', 'games', 'uno', 'korat', 'penalty-2', 'joker', 'penalty-4', 'jack-command', 'ace', 'family-black', 'family-tchaka', 'family-koubi', 'family-zink'];
    private unlocked = false;
    private unlockPromise?: Promise<void>;
    private activeUtterance?: SpeechSynthesisUtterance;
    // True when sound is turned on by the player but the browser audio session
    // isn't actually running (e.g. suspended by the OS after a call/notification
    // on iOS, or the initial unlock gesture never went through). Lets the UI warn
    // the player and offer a one-tap retry instead of silently playing nothing.
    private readonly silentSubject = new BehaviorSubject(false);
    readonly silent$ = this.silentSubject.asObservable();

    constructor() {
        // Mobile browsers only allow WebAudio after a user gesture. Keep game
        // effects independent from the WebRTC voice channel and unlock them on
        // the first interaction made on the board (ready, play, chat, etc.).
        const unlock = () => void this.unlock();
        // Ne pas utiliser `once`: si le son était coupé lors du premier geste,
        // le navigateur doit encore pouvoir déverrouiller WebAudio plus tard.
        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('touchend', unlock, { passive: true });
        window.addEventListener('keydown', unlock);
        // iOS commonly suspends the audio session while the app is backgrounded (call,
        // notification, screen lock) and never resumes it on its own. Without this, the
        // only way back was closing and reopening the app entirely.
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') unlock();
        });
    }

    async unlock(): Promise<void> {
        if (this.unlockPromise) return this.unlockPromise;
        this.unlockPromise = this.performUnlock().finally(() => { this.unlockPromise = undefined; });
        return this.unlockPromise;
    }

    private async performUnlock(): Promise<void> {
        if (!this.enabled && !this.musicEnabled) { this.silentSubject.next(false); return; }
        const context = this.audio();
        if (!context) { this.silentSubject.next(true); return; }
        if (this.unlocked && context.state === 'running') { this.silentSubject.next(false); return; }
        if (context.state === 'suspended') {
            // Certains WebViews mobiles laissent resume() en attente indéfiniment
            // lorsqu'aucune activation audio n'est encore autorisée. Ne bloquez
            // jamais l'action de jeu (Prêt/Jouer) dans ce cas.
            await Promise.race([
                context.resume().catch(() => undefined),
                new Promise<void>(resolve => window.setTimeout(resolve, 700)),
            ]);
        }
        if (context.state !== 'running') { this.silentSubject.next(true); return; }
        this.unlocked = true;
        this.silentSubject.next(false);
        if (this.enabled) this.samples.forEach(sample => this.load(sample, context));
        // A silent buffer commits the audio session on iOS without producing a sound.
        const source = context.createBufferSource();
        source.buffer = context.createBuffer(1, 1, context.sampleRate);
        source.connect(this.destination(context));
        source.start();
        if (this.musicPending) this.startMusic();
    }

    /** Manual "refresh sound" action: recreate the audio session from scratch and confirm with an audible cue. */
    async retry(): Promise<void> {
        this.musicPlaying = false;
        this.musicPending = false;
        try { this.musicSource?.stop(); } catch { /* already stopped */ }
        this.musicSource = undefined;
        this.musicBuffer = undefined;
        this.musicTrack = undefined;
        this.musicLoading = undefined;
        this.fileBuffers.clear();
        this.fileLoading.clear();
        if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = undefined; }
        this.musicSources.forEach(source => { try { source.stop(); } catch { /* already stopped */ } });
        this.musicSources.clear();
        try { await this.context?.close(); } catch { /* ignore */ }
        this.context = undefined;
        this.output = undefined;
        this.musicOutput = undefined;
        this.unlocked = false;
        this.buffers.clear();
        await this.unlock();
        if (!this.silentSubject.value) this.card('FAFAP');
    }

    card(game: CardGameSound, special = false) {
        if (!this.enabled) return;
        this.playFile('push_card', .7);
        if (special) {
            this.playFile('sound_before_special_card', .45);
            window.setTimeout(() => this.playSample('special', () => this.notes(game === 'UNO' ? [523, 784] : [440, 659], 0.07, 0.065), 1, .5), 180);
        }
    }
    specialCue() { this.playFile('sound_before_special_card', .45); }

    draw() { this.playSample('draw', () => this.notes([330, 294], 0.065, 0.065), .98 + Math.random() * .05, .72); }
    deal(cardCount: number, intervalMs = 100, game: CardGameSound = 'FAFAP') {
        if (!this.enabled || cardCount < 1) return;
        const audibleCards = Math.min(14, cardCount);
        const step = cardCount <= audibleCards ? intervalMs : Math.max(intervalMs, Math.round(cardCount * intervalMs / audibleCards));
        for (let index = 0; index < audibleCards; index++) {
            window.setTimeout(() => this.card(game), index * step);
        }
    }
    turn(game: CardGameSound = this.gameFromLocation()) {
        if (game === 'FAFAP') { this.playFile('fapfap_get_ahead_of_partie', .55); return; }
        this.playSample('turn', () => this.notes([740, 988], 0.075, 0.09), 1, .76);
    }
    selection() { this.playSample('special', () => this.notes([660], 0.04, 0.045), 1.18, .22, .12); }
    start() {
        this.startAmbientMusic(this.gameFromLocation());
        this.playSample('turn', () => this.notes([392, 523.25, 659.25], 0.16, 0.12), .92, .82);
    }
    startHandsRevealBackground() {
        if (!this.enabled) return;
        const context = this.audio();
        if (!context || context.state !== 'running') { this.silentSubject.next(true); return; }
        const request = ++this.handsRevealRequest;
        const start = (buffer: AudioBuffer) => {
            if (request !== this.handsRevealRequest || this.handsRevealSource) return;
            const source = context.createBufferSource();
            const gainNode = context.createGain();
            source.buffer = buffer;
            source.loop = true;
            gainNode.gain.setValueAtTime(.0001, context.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(.42, context.currentTime + .25);
            source.connect(gainNode).connect(this.destination(context));
            source.start();
            this.handsRevealSource = source;
            this.handsRevealGain = gainNode;
        };
        const buffer = this.fileBuffers.get('sound_before_special_card');
        if (buffer) { start(buffer); return; }
        if (!this.fileLoading.has('sound_before_special_card')) {
            const loading = fetch('assets/audio/game/sound_before_special_card.mp3')
                .then(response => { if (!response.ok) throw new Error(`SOUND_${response.status}`); return response.arrayBuffer(); })
                .then(data => context.decodeAudioData(data))
                .then(decoded => { this.fileBuffers.set('sound_before_special_card', decoded); })
                .catch(() => undefined)
                .finally(() => this.fileLoading.delete('sound_before_special_card'));
            this.fileLoading.set('sound_before_special_card', loading);
        }
        void this.fileLoading.get('sound_before_special_card')?.then(() => {
            const loaded = this.fileBuffers.get('sound_before_special_card');
            if (loaded) start(loaded);
        });
    }
    stopHandsRevealBackground() {
        ++this.handsRevealRequest;
        try { this.handsRevealSource?.stop(); } catch { /* already stopped */ }
        this.handsRevealSource = undefined;
        this.handsRevealGain = undefined;
    }
    /** Request ambient music without making audio a prerequisite for the app. */
    startAmbientMusic(game: CardGameSound = this.gameFromLocation()) { this.startMusic(game); }
    stopMusic() {
        this.musicPending = false;
        try { this.musicSource?.stop(); } catch { /* already stopped */ }
        this.musicSource = undefined;
        if (!this.musicPlaying) return;
        this.musicPlaying = false;
        if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = undefined; }
        const context = this.context;
        const output = this.musicOutput;
        if (!context || !output) { this.musicSources.clear(); return; }
        const now = context.currentTime;
        output.gain.cancelScheduledValues(now);
        output.gain.setValueAtTime(Math.max(.0001, output.gain.value), now);
        output.gain.exponentialRampToValueAtTime(.0001, now + .35);
        window.setTimeout(() => {
            this.musicSources.forEach(source => { try { source.stop(); } catch { /* already stopped */ } });
            this.musicSources.clear();
        }, 400);
    }
    commander(gained: boolean) {
        gained
            ? this.playSample('special', () => this.notes([523.25, 659.25, 783.99, 1046.5], 0.11, 0.11), .94, .8)
            : this.playSample('defeat', () => this.notes([392, 329.63, 261.63, 196], 0.14, 0.08), 1.12, .5);
    }
    lowTime() { this.playSample('low-time', () => this.notes([740, 620], 0.12, 0.075), 1, .68); }
    result(won: boolean) { won ? this.playSample('victory', () => this.victoryFanfare(), 1, .88) : this.playFile('fapfap_get_ahead_of_partie', .55); }
    uno() { this.playSample('uno', () => this.announce('UNO', [392, 196]), 1, 1); }
    penaltyTwo() { this.playSample('penalty-2', () => this.notes([523, 659], .13, .14), 1, 1); }
    joker(withPenaltyFour = false) {
        this.playSample('joker', () => this.notes([392, 523, 659], .12, .13), 1, 1);
        if (withPenaltyFour) this.playSample('penalty-4', () => this.notes([659, 523], .14, .14), 1, 1, undefined, 1.24);
    }
    penaltyFour() { this.playSample('penalty-4', () => this.notes([659, 523], .14, .14), 1, 1); }
    jackCommand() { this.playSample('jack-command', () => this.notes([440, 587, 698], .14, .14), 1, 1); }
    ace() { this.playSample('ace', () => this.notes([698, 523], .14, .14), 1, 1); }
    family(suit: string) {
        const sampleBySuit: Record<string, SampleName> = {
            BLACK: 'family-black',
            TCHAKA: 'family-tchaka',
            KOUBI: 'family-koubi',
            ZINK: 'family-zink',
        };
        const sample = sampleBySuit[suit.toUpperCase()];
        if (sample) this.playSample(sample, () => this.notes([523, 659], .12, .12), 1, 1);
    }
    tcheck() { this.playSample('tcheck', () => this.announce('TCHEK', [330, 165]), 1, 1); }
    games() { this.playSample('games', () => this.announce('GAMES', [523.25, 783.99]), 1, 1); }
    korat() {
        if (!this.enabled) return;
        this.playSample('korat', () => this.announce('KORAT', [261.63, 130.81], 1000), 1, 1, 1);
        this.koratCeremony();
    }

    private announce(text: 'UNO' | 'TCHEK' | 'GAMES' | 'KORAT', fallbackNotes: number[], maxDurationMs?: number) {
        if (!this.enabled) return;
        try {
            const speech = window.speechSynthesis;
            if (!speech || typeof SpeechSynthesisUtterance === 'undefined') {
                this.notes(fallbackNotes, .18, .14);
                return;
            }
            const speak = (voices: SpeechSynthesisVoice[]) => {
                const utterance = new SpeechSynthesisUtterance(text === 'UNO' ? 'Ounoooooo !' : text === 'TCHEK' ? 'Tchèque !' : text === 'GAMES' ? 'Games !' : 'Kooooooooorat !');
                utterance.lang = text === 'GAMES' ? 'en-US' : 'fr-FR';
                utterance.rate = text === 'UNO' ? .7 : text === 'KORAT' ? .55 : .78;
                utterance.pitch = text === 'UNO' ? 1.65 : .68;
                utterance.volume = 1;
                this.activeUtterance = utterance;
                utterance.onend = () => { if (this.activeUtterance === utterance) this.activeUtterance = undefined; };
                utterance.onerror = () => { if (this.activeUtterance === utterance) this.activeUtterance = undefined; this.notes(fallbackNotes, .18, .14); };
                if (maxDurationMs) window.setTimeout(() => {
                    if (this.activeUtterance !== utterance) return;
                    speech.cancel();
                    this.activeUtterance = undefined;
                }, maxDurationMs);
                const frenchVoices = voices.filter(voice => voice.lang.toLowerCase().startsWith('fr'));
                const femaleName = /amélie|audrey|aurélie|léa|marie|virginie|julie|alice|céline|chloé|samantha|victoria|karen|zira|susan|ava|female|femme/i;
                const maleName = /thomas|jacques|daniel|henri|paul|nicolas|male|homme/i;
                utterance.voice = text === 'UNO'
                    ? frenchVoices.find(voice => femaleName.test(voice.name))
                        || voices.find(voice => femaleName.test(voice.name))
                        || frenchVoices.find(voice => !maleName.test(voice.name))
                        || null
                    : frenchVoices.find(voice => maleName.test(voice.name)) || frenchVoices[0] || null;
                speech.cancel();
                speech.resume();
                speech.speak(utterance);
            };
            const voices = speech.getVoices();
            if (voices.length) speak(voices);
            else {
                // Chrome Android et certaines WebViews chargent les voix après le premier accès.
                // Attendre cet événement évite de retomber sur leur voix masculine par défaut.
                let spoken = false;
                const whenReady = () => {
                    if (spoken) return;
                    const loadedVoices = speech.getVoices();
                    if (!loadedVoices.length) return;
                    spoken = true;
                    speech.removeEventListener('voiceschanged', whenReady);
                    speak(loadedVoices);
                };
                speech.addEventListener('voiceschanged', whenReady);
                window.setTimeout(()=>{
                    if(spoken)return;
                    const loadedVoices=speech.getVoices();
                    spoken=true;
                    speech.removeEventListener('voiceschanged',whenReady);
                    speak(loadedVoices);
                },700);
            }
        } catch {
            this.notes(fallbackNotes, .18, .14);
        }
    }

    private cardFallback(game: CardGameSound) {
        const context = this.audio();
        if (!context) return;
        const now = context.currentTime;
        const duration = game === 'PRESIDENT' ? 0.16 : 0.13;
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let index = 0; index < samples.length; index++) {
            const progress = index / samples.length;
            samples[index] = (Math.random() * 2 - 1) * Math.sin(Math.PI * progress) * (1 - progress);
        }
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gainNode = context.createGain();
        source.buffer = buffer;
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(game === 'UNO' ? 1450 : game === 'PRESIDENT' ? 1050 : game === 'COCHON' ? 1250 : 1750, now);
        filter.frequency.exponentialRampToValueAtTime(game === 'UNO' ? 2600 : 2100, now + duration);
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(0.045, now + 0.022);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        source.connect(filter).connect(gainNode).connect(this.destination(context));
        source.start(now);
    }

    private playSample(name: SampleName, fallback: () => void, playbackRate = 1, volume = .8, maxDurationSeconds?: number, delaySeconds = 0) {
        if (!this.enabled) return;
        const context = this.audio();
        if (!context) { fallback(); return; }
        if (context.state !== 'running') {
            this.silentSubject.next(true);
            return;
        }
        const buffer = this.buffers.get(name);
        if (!buffer) {
            fallback();
            this.load(name, context);
            this.samples.filter(sample => sample !== name).forEach(sample => this.load(sample, context));
            return;
        }
        const source = context.createBufferSource();
        const gainNode = context.createGain();
        source.buffer = buffer;
        source.playbackRate.value = playbackRate;
        const now = context.currentTime + delaySeconds;
        const cardMovement = name === 'card-1' || name === 'card-2';
        gainNode.gain.setValueAtTime(cardMovement ? .0001 : volume, now);
        if (cardMovement) {
            const filter = context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2350, now);
            filter.Q.value = .55;
            const audibleDuration = Math.max(.07, buffer.duration / playbackRate);
            gainNode.gain.exponentialRampToValueAtTime(volume, now + .024);
            gainNode.gain.setValueAtTime(volume, now + Math.max(.03, audibleDuration - .055));
            gainNode.gain.exponentialRampToValueAtTime(.0001, now + audibleDuration);
            source.connect(filter).connect(gainNode).connect(this.destination(context));
        } else {
            source.connect(gainNode).connect(this.destination(context));
        }
        source.start(now);
        if (maxDurationSeconds) source.stop(now + maxDurationSeconds);
    }

    private load(name: SampleName, context: AudioContext) {
        if (this.buffers.has(name) || this.loading.has(name)) return;
        const request = fetch(`assets/audio/game/${name}.wav`)
            .then(response => { if (!response.ok) throw new Error(`SOUND_${response.status}`); return response.arrayBuffer(); })
            .then(data => context.decodeAudioData(data))
            .then(buffer => { this.buffers.set(name, buffer); })
            .catch(() => undefined)
            .finally(() => this.loading.delete(name));
        this.loading.set(name, request);
    }

    private playFile(name: string, volume: number, delaySeconds = 0) {
        if (!this.enabled) return;
        const context = this.audio();
        if (!context || context.state !== 'running') { this.silentSubject.next(true); return; }
        const buffer = this.fileBuffers.get(name);
        if (!buffer) {
            if (!this.fileLoading.has(name)) {
                const request = fetch(`assets/audio/game/${name}.mp3`)
                    .then(response => { if (!response.ok) throw new Error(`SOUND_${response.status}`); return response.arrayBuffer(); })
                    .then(data => context.decodeAudioData(data))
                    .then(decoded => { this.fileBuffers.set(name, decoded); })
                    .catch(() => undefined)
                    .finally(() => this.fileLoading.delete(name));
                this.fileLoading.set(name, request);
            }
            void this.fileLoading.get(name)?.then(() => {
                if (this.fileBuffers.has(name)) this.playFile(name, volume, delaySeconds);
            });
            return;
        }
        const source = context.createBufferSource();
        const gainNode = context.createGain();
        const now = context.currentTime + delaySeconds;
        source.buffer = buffer;
        gainNode.gain.setValueAtTime(.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(volume, now + .015);
        gainNode.gain.setValueAtTime(volume, now + Math.max(.02, buffer.duration - .06));
        gainNode.gain.exponentialRampToValueAtTime(.0001, now + buffer.duration);
        source.connect(gainNode).connect(this.destination(context));
        source.start(now);
    }

    private victoryFanfare() {
        if (!this.enabled) return;
        const context = this.audio();
        if (!context) return;
        const now = context.currentTime;
        const notes = [523.25, 659.25, 783.99, 659.25, 783.99, 1046.5];
        const starts = [0, .13, .26, .5, .64, .79];
        notes.forEach((frequency, index) => {
            const start = now + starts[index];
            const duration = index === notes.length - 1 ? .72 : .2;
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            oscillator.type = index < 3 ? 'triangle' : 'sine';
            oscillator.frequency.setValueAtTime(frequency, start);
            gainNode.gain.setValueAtTime(.0001, start);
            gainNode.gain.exponentialRampToValueAtTime(index === notes.length - 1 ? .19 : .13, start + .018);
            gainNode.gain.exponentialRampToValueAtTime(.0001, start + duration);
            oscillator.connect(gainNode).connect(this.destination(context));
            oscillator.start(start); oscillator.stop(start + duration + .02);
        });
    }

    private koratCeremony() {
        const context = this.audio();
        if (!context) return;
        const now = context.currentTime;
        const chords = [[130.81, 196, 261.63, 329.63], [146.83, 220, 293.66, 369.99]];
        chords.forEach((chord, chordIndex) => chord.forEach((frequency, noteIndex) => {
            const start = now + chordIndex * .42;
            const stop = now + 1;
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            oscillator.type = noteIndex < 2 ? 'sine' : 'triangle';
            oscillator.frequency.setValueAtTime(frequency, start);
            gainNode.gain.setValueAtTime(.0001, start);
            gainNode.gain.exponentialRampToValueAtTime(noteIndex === 0 ? .075 : .038, start + .08);
            gainNode.gain.setValueAtTime(noteIndex === 0 ? .075 : .038, Math.max(start + .09, stop - .18));
            gainNode.gain.exponentialRampToValueAtTime(.0001, stop);
            oscillator.connect(gainNode).connect(this.destination(context));
            oscillator.start(start);
            oscillator.stop(stop + .02);
        }));
    }

    private notes(frequencies: number[], spacing: number, volume: number) {
        if (!this.enabled) return;
        const context = this.audio();
        if (!context) return;
        const now = context.currentTime;
        frequencies.forEach((frequency, index) => {
            const start = now + index * spacing;
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            oscillator.type = index % 2 ? 'triangle' : 'sine';
            oscillator.frequency.setValueAtTime(frequency, start);
            gainNode.gain.setValueAtTime(0.0001, start);
            gainNode.gain.exponentialRampToValueAtTime(volume, start + 0.012);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
            oscillator.connect(gainNode).connect(this.destination(context));
            oscillator.start(start);
            oscillator.stop(start + 0.17);
        });
    }

    private audio() {
        try {
            if (!this.context) {
                this.context = new AudioContext();
                this.silentSubject.next(this.enabled && this.context.state !== 'running');
                this.context.addEventListener('statechange', () => {
                    if (!this.enabled) return;
                    this.silentSubject.next(this.context?.state !== 'running');
                });
            }
            if (this.context.state === 'suspended' && this.unlocked) void this.context.resume().catch(() => undefined);
            return this.context;
        } catch { this.silentSubject.next(this.enabled); return undefined; }
    }

    private destination(context: AudioContext) {
        if (!this.output) {
            const compressor = context.createDynamicsCompressor();
            compressor.threshold.value = -12;
            compressor.knee.value = 18;
            compressor.ratio.value = 5;
            compressor.attack.value = .004;
            compressor.release.value = .16;
            this.output = context.createGain();
            this.output.gain.value = .78;
            this.output.connect(compressor).connect(context.destination);
        }
        return this.output;
    }

    private startMusic(game: CardGameSound = this.gameFromLocation()) {
        if (!this.musicEnabled) { this.musicPending = false; return; }
        if (this.musicTrack && this.musicTrack !== game) {
            this.stopMusic();
            this.musicBuffer = undefined;
            this.musicLoading = undefined;
        }
        this.musicTrack = game;
        this.musicPending = true;
        if (this.musicPlaying) return;
        const context = this.audio();
        if (!context || context.state !== 'running') return;
        if (!this.musicBuffer) {
            if (!this.musicLoading) {
                const track = this.musicFile(game);
                this.musicLoading = fetch(`assets/audio/game/${track}.mp3`)
                    .then(response => { if (!response.ok) throw new Error(`MUSIC_${response.status}`); return response.arrayBuffer(); })
                    .then(data => context.decodeAudioData(data))
                    .then(buffer => { this.musicBuffer = buffer; })
                    .catch(() => undefined)
                    .finally(() => { this.musicLoading = undefined; });
            }
            void this.musicLoading.then(() => {
                if (this.musicPending && this.musicTrack === game) this.startMusic(game);
            });
            return;
        }
        const output = this.musicDestination(context);
        output.gain.cancelScheduledValues(context.currentTime);
        output.gain.setValueAtTime(.0001, context.currentTime);
        output.gain.exponentialRampToValueAtTime(.72, context.currentTime + .8);
        const source = context.createBufferSource();
        const gainNode = context.createGain();
        source.buffer = this.musicBuffer;
        source.loop = true;
        gainNode.gain.setValueAtTime(.0001, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(.32, context.currentTime + .8);
        source.connect(gainNode).connect(output);
        source.start();
        this.musicSource = source;
        this.musicPlaying = true;
        this.musicPending = false;
    }

    private gameFromLocation(): CardGameSound {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('check-games')) return 'CHECK_GAMES';
        if (path.includes('tcheck')) return 'PRESIDENT';
        if (path.includes('cochon')) return 'COCHON';
        if (path.includes('uno')) return 'UNO';
        return 'FAFAP';
    }

    private musicFile(game: CardGameSound) {
        // NJAMBO is the official ambient track shared by every game. The
        // game argument remains part of the API so existing boards can keep
        // selecting their sound context without changing their callers.
        return 'NJAMBO_compresse';
    }

    private musicDestination(context: AudioContext) {
        if (!this.musicOutput) {
            this.musicOutput = context.createGain();
            this.musicOutput.gain.value = .0001;
            this.musicOutput.connect(this.destination(context));
        }
        return this.musicOutput;
    }

    private get enabled() { return localStorage.getItem('fafap.sound.enabled') !== 'false'; }
    private get musicEnabled() { return localStorage.getItem('fafap.music.enabled') !== 'false'; }
}
