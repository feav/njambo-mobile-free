import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth.service';
import { GameSoundService } from '../game-sound.service';

type VoiceSignalType = 'JOIN' | 'LEAVE' | 'OFFER' | 'ANSWER' | 'ICE';
interface VoiceSignal {
    type: VoiceSignalType;
    gameId: string;
    senderUserId: string;
    targetUserId?: string;
    payload: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
}
interface PeerState {
    connection: RTCPeerConnection;
    audio: HTMLAudioElement;
    candidates: RTCIceCandidateInit[];
    makingOffer: boolean;
    ignoreOffer: boolean;
}

@Injectable({ providedIn: 'root' })
export class GameVoiceService implements OnDestroy {
    private client?: Client;
    private subscription?: StompSubscription;
    private localStream?: MediaStream;
    private gameId?: string;
    private userId?: string;
    private peers = new Map<string, PeerState>();
    private readonly enabledSubject = new BehaviorSubject(false);
    private readonly mutedSubject = new BehaviorSubject(true);
    private readonly mutedUsersSubject = new BehaviorSubject<Set<string>>(new Set());
    private readonly connectedUsersSubject = new BehaviorSubject<Set<string>>(new Set());
    private readonly errorSubject = new Subject<string>();

    readonly enabled$ = this.enabledSubject.asObservable();
    readonly muted$ = this.mutedSubject.asObservable();
    readonly mutedUsers$ = this.mutedUsersSubject.asObservable();
    readonly connectedUsers$ = this.connectedUsersSubject.asObservable();
    readonly errors$ = this.errorSubject.asObservable();

    constructor(private auth: AuthService, private sounds: GameSoundService) {}

    async enable(gameId: string): Promise<void> {
        if (this.enabledSubject.value && this.gameId === gameId) return;
        await this.disable();
        if (!window.RTCPeerConnection) {
            throw new Error('Le chat vocal n’est pas pris en charge sur cet appareil.');
        }
        const userId = this.auth.currentUser()?.id;
        const token = this.auth.accessToken();
        if (!userId || !token) throw new Error('Authentification requise pour activer le vocal.');

        try {
            this.gameId = gameId;
            this.userId = userId;
            this.mutedSubject.next(true);
            this.mutedUsersSubject.next(new Set());
            const brokerURL = `${environment.apiBaseUrl.replace(/^http/, 'ws')}/ws-native`;
            this.client = new Client({
                brokerURL,
                connectHeaders: { Authorization: `Bearer ${token}` },
                reconnectDelay: 0,
                heartbeatIncoming: 10000,
                heartbeatOutgoing: 10000,
                connectionTimeout: 8000,
                debug: () => undefined
            });
            this.client.onConnect = () => {
                if (!this.client || this.gameId !== gameId) return;
                this.subscription = this.client.subscribe(`/topic/games/${gameId}/voice`, message => void this.consume(message));
                this.enabledSubject.next(true);
                this.publish('JOIN');
            };
            this.client.onStompError = frame => {
                this.errorSubject.next(frame.headers['message'] || 'Connexion vocale refusée.');
                void this.disable(false);
            };
            this.client.onWebSocketClose = () => {
                if (this.enabledSubject.value) this.errorSubject.next('Connexion vocale interrompue.');
                void this.disable(false);
            };
            this.client.activate();
        } catch (error) {
            await this.disable(false);
            throw error;
        }
    }

    async disable(notify = true): Promise<void> {
        if (notify && this.client?.connected) this.publish('LEAVE');
        this.enabledSubject.next(false);
        this.subscription?.unsubscribe();
        this.subscription = undefined;
        for (const userId of [...this.peers.keys()]) this.closePeer(userId);
        this.localStream?.getTracks().forEach(track => track.stop());
        this.localStream = undefined;
        const client = this.client;
        this.client = undefined;
        if (client?.active) await client.deactivate();
        this.gameId = undefined;
        this.userId = undefined;
        this.mutedSubject.next(true);
        this.mutedUsersSubject.next(new Set());
        this.connectedUsersSubject.next(new Set());
    }

    async toggleMute(): Promise<boolean> {
        if (!this.mutedSubject.value) {
            this.localStream?.getAudioTracks().forEach(track => track.enabled = false);
            this.mutedSubject.next(true);
            return true;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Le microphone n’est pas pris en charge sur cet appareil.');
        }
        try {
            if (!this.localStream) {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                    video: false
                });
                // Granting the microphone reliably kicks iOS's shared audio session back into
                // gear even when our own AudioContext still reports "running" while actually
                // silent — piggyback on it instead of leaving that fix to chance.
                void this.sounds.retry();
                const track = this.localStream.getAudioTracks()[0];
                for (const [userId, peer] of this.peers) {
                    const transceiver = peer.connection.getTransceivers()
                        .find(item => item.receiver.track.kind === 'audio');
                    if (transceiver) {
                        await transceiver.sender.replaceTrack(track);
                        transceiver.direction = 'sendrecv';
                    } else {
                        peer.connection.addTrack(track, this.localStream);
                    }
                    await this.offer(userId);
                }
            }
            this.localStream.getAudioTracks().forEach(track => track.enabled = true);
            this.mutedSubject.next(false);
            return false;
        } catch (error) {
            if (error instanceof DOMException && error.name === 'NotAllowedError') {
                throw new Error('Autorisation du microphone refusée.');
            }
            throw error;
        }
    }

    toggleUserMute(userId: string): boolean {
        const next = new Set(this.mutedUsersSubject.value);
        const muted = !next.has(userId);
        muted ? next.add(userId) : next.delete(userId);
        const peer = this.peers.get(userId);
        if (peer) peer.audio.muted = muted;
        this.mutedUsersSubject.next(next);
        return muted;
    }

    isUserConnected(userId: string): boolean { return this.connectedUsersSubject.value.has(userId); }
    isUserMuted(userId: string): boolean { return this.mutedUsersSubject.value.has(userId); }
    ngOnDestroy() { void this.disable(); }

    private async consume(message: IMessage) {
        let signal: VoiceSignal;
        try { signal = JSON.parse(message.body) as VoiceSignal; } catch { return; }
        if (!this.enabledSubject.value || signal.gameId !== this.gameId || signal.senderUserId === this.userId) return;
        if (signal.targetUserId && signal.targetUserId !== this.userId) return;
        try {
            if (signal.type === 'JOIN') await this.offer(signal.senderUserId);
            if (signal.type === 'LEAVE') this.closePeer(signal.senderUserId);
            if (signal.type === 'OFFER' && signal.payload.sdp) await this.receiveOffer(signal.senderUserId, signal.payload.sdp);
            if (signal.type === 'ANSWER' && signal.payload.sdp) await this.receiveAnswer(signal.senderUserId, signal.payload.sdp);
            if (signal.type === 'ICE' && signal.payload.candidate) await this.receiveCandidate(signal.senderUserId, signal.payload.candidate);
        } catch {
            this.errorSubject.next('Impossible de connecter un participant au salon vocal.');
            this.closePeer(signal.senderUserId);
        }
    }

    private async offer(remoteUserId: string) {
        const peer = this.peer(remoteUserId);
        try {
            peer.makingOffer = true;
            await peer.connection.setLocalDescription(await peer.connection.createOffer());
            this.publish('OFFER', remoteUserId, { sdp: peer.connection.localDescription?.toJSON() });
        } finally { peer.makingOffer = false; }
    }

    private async receiveOffer(remoteUserId: string, sdp: RTCSessionDescriptionInit) {
        const peer = this.peer(remoteUserId);
        const collision = peer.makingOffer || peer.connection.signalingState !== 'stable';
        const polite = (this.userId || '').localeCompare(remoteUserId) > 0;
        peer.ignoreOffer = !polite && collision;
        if (peer.ignoreOffer) return;
        if (collision) await peer.connection.setLocalDescription({ type: 'rollback' });
        await peer.connection.setRemoteDescription(sdp);
        await this.flushCandidates(peer);
        await peer.connection.setLocalDescription(await peer.connection.createAnswer());
        this.publish('ANSWER', remoteUserId, { sdp: peer.connection.localDescription?.toJSON() });
    }

    private async receiveAnswer(remoteUserId: string, sdp: RTCSessionDescriptionInit) {
        const peer = this.peer(remoteUserId);
        await peer.connection.setRemoteDescription(sdp);
        await this.flushCandidates(peer);
    }

    private async receiveCandidate(remoteUserId: string, candidate: RTCIceCandidateInit) {
        const peer = this.peer(remoteUserId);
        if (peer.ignoreOffer) return;
        if (!peer.connection.remoteDescription) peer.candidates.push(candidate);
        else await peer.connection.addIceCandidate(candidate);
    }

    private peer(remoteUserId: string): PeerState {
        const existing = this.peers.get(remoteUserId);
        if (existing) return existing;
        const connection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        const localTrack = this.localStream?.getAudioTracks()[0];
        if (localTrack && this.localStream) connection.addTrack(localTrack, this.localStream);
        else connection.addTransceiver('audio', { direction: 'recvonly' });
        audio.muted = this.mutedUsersSubject.value.has(remoteUserId);
        connection.onicecandidate = event => {
            if (event.candidate) this.publish('ICE', remoteUserId, { candidate: event.candidate.toJSON() });
        };
        connection.ontrack = event => {
            audio.srcObject = event.streams[0] || new MediaStream([event.track]);
            void audio.play().catch(() => this.errorSubject.next('Touchez l’écran pour autoriser la lecture audio.'));
            this.markConnected(remoteUserId, true);
        };
        connection.onconnectionstatechange = () => {
            if (connection.connectionState === 'connected') this.markConnected(remoteUserId, true);
            if (['failed', 'closed', 'disconnected'].includes(connection.connectionState)) this.closePeer(remoteUserId);
        };
        const peer = { connection, audio, candidates: [], makingOffer: false, ignoreOffer: false };
        this.peers.set(remoteUserId, peer);
        return peer;
    }

    private async flushCandidates(peer: PeerState) {
        for (const candidate of peer.candidates.splice(0)) await peer.connection.addIceCandidate(candidate);
    }

    private closePeer(userId: string) {
        const peer = this.peers.get(userId);
        if (!peer) return;
        peer.audio.pause();
        peer.audio.srcObject = null;
        peer.connection.onconnectionstatechange = null;
        peer.connection.close();
        this.peers.delete(userId);
        this.markConnected(userId, false);
    }

    private markConnected(userId: string, connected: boolean) {
        const next = new Set(this.connectedUsersSubject.value);
        connected ? next.add(userId) : next.delete(userId);
        this.connectedUsersSubject.next(next);
    }

    private publish(type: VoiceSignalType, targetUserId?: string, payload: VoiceSignal['payload'] = {}) {
        if (!this.client?.connected || !this.gameId) return;
        this.client.publish({ destination: `/app/games/${this.gameId}/voice`, body: JSON.stringify({ type, targetUserId, payload }) });
    }
}
