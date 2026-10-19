import { Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { AlertController, MenuController, ToastController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { GameApiService, VictoryClaimReveal, VictoryClaimType } from '../core/game-realtime/game-api.service';
import { GameRealtimeService } from '../core/game-realtime/game-realtime.service';
import { GameStateDto } from '../core/game-realtime/game-realtime.models';
import { AuthService } from '../core/auth.service';
import { AccountApiService } from '../core/account-api.service';
import { GameVoiceService } from '../core/game-realtime/game-voice.service';
import { GameSoundService } from '../core/game-sound.service';
import {CardThemeService} from '../core/card-theme.service';
import {SocialApiService} from '../core/social-api.service';
import {ChampionshipFlowService} from '../core/championship-flow.service';
import {CampaignFlowService} from '../core/campaign-flow.service';
import {InsufficientFundsAlertService} from '../core/insufficient-funds-alert.service';
import {SpectatorResultService} from '../core/spectator-result.service';
import {GameShareService} from '../core/game-share.service';

interface BoardPlayer {
    id: string;
    userId: string;
    name: string;
    avatar: string;
    countryCode?: string;
    cardCount: number;
    isMe: boolean;
    connected: boolean;
    ready: boolean;
    seatNumber: number;
    waitlisted: boolean;
    isBot: boolean;
}

interface DealFlight {
    id: string;
    x: number;
    y: number;
    midX: number;
    midY: number;
    rotation: number;
    delay: number;
}

@Component({
    standalone: false,
    selector: 'app-game-board',
    templateUrl: './game-board.page.html',
    styleUrls: ['./game-board.page.scss'],
})
export class GameBoardPage implements OnInit, OnDestroy {
    cardsOnTablePlayer0: any[] = [];
    pastRoundCards: any[] = [];
    cardsInHandPlayer0: any[] = [];
    opponentBackCards: string[] = [];
    boardPlayers: BoardPlayer[] = [];
    waitlistPlayers: BoardPlayer[] = [];
    isWaitlisted = false;
    currentPlayerId: string | null = null;
    commanderId: string | null = null;

    selectedCard: any | null = null;
    playerSecondsRemaining = 60;
    playerTotalSeconds = 60;
    lastAction = 'Aucune action pour le moment';
    autoSort = true;
    soundEnabled = localStorage.getItem('fafap.sound.enabled') !== 'false';
    betAmount = 10000;
    globalPot = 0;
    balance = 0;
    private timer?: ReturnType<typeof setInterval>;
    private roundClearTimer?: ReturnType<typeof setTimeout>;
    private turnDeadlineAtMs: number | null = null;
    private pendingRoundCards: any[] = [];
    private pendingPastRoundCards: any[] = [];
    private roundAnimationToken = 0;
    private actionHistory: string[] = [];
    private readonly realtimeSubscriptions = new Subscription();
    gameId?: string;
    private playerId?: string;
    private pendingCardName: string | null = null;
    private premoveCardId: string | null = null;
    private premoveCardName: string | null = null;
    realtimeMode = false;
    spectating = false;
    spectatorCount = 0;
    gameStatus = '';
    readySubmitting = false;
    leavingGame = false;
    abandoningGame = false;
    currentPlayerReady = false;
    readyCount = 0;
    isGameCreator = false;
    isChampionshipDuel = false;
    isCampaignGame = false;
    championshipReadyDeadline = '';
    private championshipContextTicks = 0;
    dominantCardId: string | null = null;
    currentRequiredSuit: string | null = null;
    private terminalAnnounced = false;
    private gameStartSoundPlayed = false;
    private tableCardsInitialized = false;
    private knownTableCardIds = new Set<string>();
    private commanderSoundInitialized = false;
    private lastLowTimeAlertSecond: number | null = null;
    isCollectingTrick = false;
    isDealingCards = false;
    dealFlights: DealFlight[] = [];
    private dealAnimationTimer?: ReturnType<typeof setTimeout>;
    private rematchJoining = false;
    private gameSessionSubscriptions = new Subscription();
    voiceEnabled = false;
    voiceMuted = false;
    voiceActivating = false;
    voiceConnectedUserIds = new Set<string>();
    voiceMutedUserIds = new Set<string>();
    chatBubbles = new Map<string, string>();
    private chatBubbleTimers = new Map<string, ReturnType<typeof setTimeout>>();
    automaticMode = false;
    private automaticModeInitialized = false;
    private automaticModeOverride: boolean | null = null;
    private automationOverrideTimer?: ReturnType<typeof setTimeout>;
    private automaticServerSyncKey = '';
    automationSubmitting = false;
    private victoryCelebration?: HTMLElement;
    private victoryAnimationFrame?: number;
    private victoryCelebrationTimer?: ReturnType<typeof setTimeout>;
    claimReveal?: {winnerPlayerId:string;reason:string;hands:Array<{gamePlayerId:string;username:string;cards:any[]}>};
    koratReveal = false;
    private checkedClaimSignature='';
    private ignoredClaimSignature='';
    private claimDialogOpen=false;
    private claimSubmitting=false;
    postGameParticipants: BoardPlayer[] = [];
    friendUserIds = new Set<string>();
    outgoingFriendUserIds = new Set<string>();
    friendSubmittingUserIds = new Set<string>();

    constructor(
        private menu: MenuController,
        private alertController: AlertController,
        private toastController: ToastController,
        private route: ActivatedRoute,
        private router: Router,
        private gameApi: GameApiService,
        private realtime: GameRealtimeService,
        private voice: GameVoiceService,
        private sounds: GameSoundService,
        private cardTheme: CardThemeService,
        private auth: AuthService,
        private accounts: AccountApiService,
        private social: SocialApiService,
        private championshipFlow: ChampionshipFlowService,
        private campaignFlow: CampaignFlowService,
        private spectatorResults: SpectatorResultService,
        private insufficientFunds: InsufficientFundsAlertService,
        private sharing: GameShareService,
        private host: ElementRef<HTMLElement>
    ) {}

    ngOnInit() {
        this.autoSort = localStorage.getItem('fafap.auto.sort.enabled') !== 'false';
        this.startTimer();
        this.loadBalance();
        this.connectToBackendWhenRequested();
        this.realtimeSubscriptions.add(this.voice.enabled$.subscribe(enabled => this.voiceEnabled = enabled));
        this.realtimeSubscriptions.add(this.voice.muted$.subscribe(muted => this.voiceMuted = muted));
        this.realtimeSubscriptions.add(this.voice.connectedUsers$.subscribe(users => this.voiceConnectedUserIds = users));
        this.realtimeSubscriptions.add(this.voice.mutedUsers$.subscribe(users => this.voiceMutedUserIds = users));
        this.realtimeSubscriptions.add(this.voice.errors$.subscribe(message => void this.showVoiceMessage(message)));
    }

    get tableName(): string { return this.gameId ? `Partie ${this.gameId.slice(0, 6).toUpperCase()}` : 'Partie Njambo'; }
    get tableCode(): string { return this.gameId?.slice(0, 8).toUpperCase() || '—'; }
    get participantNames(): string { return this.boardPlayers.map(player => player.name).join(' • '); }
    get waitlistPosition(): number { return this.waitlistPlayers.findIndex(player => player.isMe) + 1; }
    get turnProgress(): number {
        if (this.playerTotalSeconds <= 0) return 0;
        return Math.max(0, Math.min(1, this.playerSecondsRemaining / this.playerTotalSeconds));
    }
    get displayAutomaticMode(): boolean { return this.automaticModeOverride ?? this.automaticMode; }
    get championshipCountdown(): string { if(!this.championshipReadyDeadline)return'';const seconds=Math.max(0,Math.ceil((new Date(this.championshipReadyDeadline).getTime()-Date.now())/1000));return`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`; }
    async inviteFriends(){if(!this.gameId||this.isChampionshipDuel||this.isCampaignGame)return;const result=await this.sharing.invite(this.gameId,this.tableName);if(result==='copied')await this.showVoiceMessage('Lien d’invitation copié.');}

    private loadBalance() {
        this.accounts.get().subscribe({ next: account => this.balance = account.availableBalance });
    }

    ngOnDestroy() {
        if (this.timer) clearInterval(this.timer);
        if (this.roundClearTimer) clearTimeout(this.roundClearTimer);
        if (this.dealAnimationTimer) clearTimeout(this.dealAnimationTimer);
        this.stopVictoryCelebration();
        this.realtimeSubscriptions.unsubscribe();
        this.realtime.disconnect();
        this.sounds.stopMusic();
        void this.voice.disable();
    }

    ionViewWillEnter() {
        this.loadBalance();
        document.documentElement.classList.add('game-board-active');
        const nextGameId = this.route.snapshot.queryParamMap.get('gameId') ?? undefined;
        if (nextGameId && nextGameId !== this.gameId) this.openRealtimeGame(nextGameId);
    }

    ionViewWillLeave() {
        document.documentElement.classList.remove('game-board-active');
        this.sounds.stopMusic();
        this.resetGameSession();
    }

    openMenu() {
        this.menu.open('main-menu');
    }

    async toggleVoice() {
        if (this.spectating || this.voiceActivating) return;
        if (this.voiceEnabled) {
            await this.voice.disable();
            return;
        }
        if (!this.gameId) return;
        this.voiceActivating = true;
        try {
            await this.voice.enable(this.gameId);
            await this.showVoiceMessage('Salon vocal activé.');
        } catch (error) {
            await this.showVoiceMessage(error instanceof Error ? error.message : 'Impossible d’activer le vocal.');
        } finally { this.voiceActivating = false; }
    }

    async toggleVoiceMute() {
        if (!this.voiceEnabled) return;
        try {
            const muted = await this.voice.toggleMute();
            await this.showVoiceMessage(muted ? 'Micro coupé.' : 'Micro activé.');
        } catch (error) {
            await this.showVoiceMessage(error instanceof Error ? error.message : 'Impossible d’activer le microphone.');
        }
    }

    togglePlayerVoiceMute(player: BoardPlayer, event: Event) {
        event.stopPropagation();
        if (player.isMe || !this.voiceConnected(player)) return;
        const muted = this.voice.toggleUserMute(player.userId);
        void this.showVoiceMessage(muted ? `${player.name} est en sourdine.` : `Vous écoutez de nouveau ${player.name}.`);
    }

    toggleAutomaticMode() {
        if (this.spectating || !this.gameId || this.automationSubmitting) return;
        const enabled = !this.displayAutomaticMode;
        this.automaticModeOverride = enabled;
        this.automationSubmitting = true;
        this.gameApi.automation(this.gameId, enabled).subscribe({
            next: state => {
                this.automationSubmitting = false;
                this.applyRealtimeState(state);
                this.scheduleAutomationResync();
                void this.showVoiceMessage(enabled ? 'Mode automatique activé.' : 'Mode manuel activé.');
            },
            error: error => {
                this.automationSubmitting = false;
                this.automaticModeOverride = null;
                void this.showRealtimeError(error?.error?.message || 'Impossible de modifier le mode de jeu.');
            }
        });
    }

    voiceConnected(player: BoardPlayer): boolean {
        return player.isMe ? this.voiceEnabled : this.voiceConnectedUserIds.has(player.userId);
    }

    private async showVoiceMessage(message: string) {
        const toast = await this.toastController.create({ message, duration: 2200, position: 'top' });
        await toast.present();
    }

    private async showAutomaticModeNotice() {
        const alert = await this.alertController.create({
            cssClass: 'fafap-game-alert automation-notice',
            header: 'Mode automatique activé',
            message: 'Après une longue inactivité, vous êtes passé en mode automatique.',
            backdropDismiss: false,
            buttons: [{
                text: 'Revenir au mode manuel',
                cssClass: 'game-alert-primary',
                handler: () => {
                    this.gameApi.automation(this.gameId!, false).subscribe({
                        next: state => this.applyRealtimeState(state),
                        error: () => void this.showRealtimeError('Impossible de revenir au mode manuel pour le moment.')
                    });
                }
            }]
        });
        await alert.present();
    }

    private async notifyLeftBehindByWaitlist() {
        const toast = await this.toastController.create({
            message: 'La partie a commencé sans toi. Découvre les tables disponibles !',
            duration: 3000,
            position: 'top'
        });
        await toast.present();
        await this.router.navigate(['/search'], { queryParams: { tab: 'a-venir' }, replaceUrl: true });
    }

    selectCard(card: any) {
        if (this.gameStatus === 'FINISHED' || this.gameStatus === 'CANCELLED') {
            void this.showRealtimeError('Cette partie est terminée. Ouvrez le replay pour revoir les actions.');
            return;
        }
        if (this.realtimeMode && this.currentPlayerId !== this.playerId && this.premoveCardId === card.id) {
            this.clearPremove();
            this.selectedCard = null;
            this.lastAction = `Pré-coup annulé : ${card.name}`;
            return;
        }
        if (this.isMyTurn && !this.isCardPlayable(card)) {
            void this.showRealtimeError('Cette carte ne peut pas être jouée : vous devez suivre la couleur demandée.');
            return;
        }
        const isAlreadySelected = this.selectedCard?.name === card.name;
        if (!isAlreadySelected) {
            this.selectedCard = card;
            this.lastAction = `Carte sélectionnée : ${card.name}`;
            this.sounds.selection();
            return;
        }

        if (this.realtimeMode && this.playerId && this.currentPlayerId !== this.playerId) {
            this.queuePremove(card);
            return;
        }
        this.playSelectedCard(card);
    }

    private playSelectedCard(card: any) {
        if (this.spectating) return;
        if (!this.realtimeMode) {
            this.selectedCard = null;
            this.cardsInHandPlayer0 = this.cardsInHandPlayer0.filter(item => item !== card);
            this.cardsOnTablePlayer0 = [...this.cardsOnTablePlayer0, card];
            this.lastAction = `Carte jouée : ${card.name}`;
            return;
        }
        if (!this.gameId || !this.playerId) return;
        if (this.currentPlayerId !== this.playerId) {
            this.lastAction = 'Attendez votre tour pour jouer cette carte';
            void this.showRealtimeError(this.lastAction);
            return;
        }
        if (this.pendingCardName) return;

        if (this.premoveCardId === card.id) this.clearPremove();
        this.pendingCardName = card.name;
        this.lastAction = `Envoi de la carte ${card.name}…`;
        this.gameApi.playCard(this.gameId, card.id, crypto.randomUUID()).subscribe({
            error: error => {
                this.pendingCardName = null;
                this.selectedCard = null;
                void this.showRealtimeError(error?.error?.message || 'Carte refusée.');
            }
        });
    }

    playAction(action: 'pass' | 'follow' | 'raise' | 'bet') {
        if (this.spectating) return;
        const labels = {
            pass: 'Passé',
            follow: 'Suivi',
            raise: 'Relancé',
            bet: 'Misé',
        };

        this.lastAction = action === 'bet' ? `${labels[action]} ${this.betAmount.toLocaleString('fr-FR')}` : labels[action];
        if (action === 'follow' && this.gameId && this.playerId && this.selectedCard) {
            this.gameApi.playCard(this.gameId, this.selectedCard.id, crypto.randomUUID()).subscribe({ error: error => void this.showRealtimeError(error?.error?.message || 'Carte refusée.') });
            this.lastAction = `Carte jouée : ${this.selectedCard.name}`;
        }
        this.actionHistory.unshift(this.lastAction);
        this.playerSecondsRemaining = this.playerTotalSeconds;
        if (action !== 'bet') {
            this.selectedCard = null;
        }
    }

    async confirmReady() {
        if (this.spectating || !this.gameId || this.isWaitlisted || this.currentPlayerReady || this.readySubmitting) return;
        // Unlock WebAudio while this button press is still a user gesture.
        // Mobile browsers otherwise may drop the start/deal sound emitted by
        // the realtime event that follows the ready request.
        // Audio is optional: never delay the ready request while a browser or
        // WebView is refusing to resume AudioContext.
        void this.sounds.unlock();
        this.readySubmitting = true;
        this.gameApi.ready(this.gameId).subscribe({
            next: () => {
                this.readySubmitting = false;
                this.currentPlayerReady = true;
                this.refreshChampionshipContext();
                this.gameApi.state(this.gameId!).subscribe(state => this.applyRealtimeState(state));
            },
            error: error => {
                this.readySubmitting = false;
                void this.showRealtimeError(error?.error?.message || 'Validation impossible.');
            }
        });
    }

    async kickPlayer(player: BoardPlayer) {
        if (!this.gameId || this.isChampionshipDuel || !this.isGameCreator || player.isMe || !['WAITING_FOR_PLAYERS', 'READY'].includes(this.gameStatus)) return;
        const alert = await this.alertController.create({
            cssClass: 'fafap-game-alert', header: 'Retirer ce joueur ?', message: `${player.name} devra rejoindre à nouveau la table.`,
            buttons: [{ text: 'Annuler', role: 'cancel' }, { text: 'Retirer', role: 'destructive', handler: () => {
                this.gameApi.kick(this.gameId!, player.id).subscribe({
                    next: () => this.gameApi.state(this.gameId!).subscribe(state => this.applyRealtimeState(state)),
                    error: error => void this.showRealtimeError(error?.error?.message || 'Impossible de retirer ce joueur.')
                });
            }}]
        });
        await alert.present();
    }

    changeBet(delta: number) {
        this.betAmount = Math.min(100000, Math.max(5000, Number(this.betAmount) + delta));
    }

    toggleAutoSort() {
        this.autoSort = !this.autoSort;
        localStorage.setItem('fafap.auto.sort.enabled', String(this.autoSort));
        if (this.autoSort) {
            this.cardsInHandPlayer0.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        }
    }

    async toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('fafap.sound.enabled', String(this.soundEnabled));
        if (this.soundEnabled) await this.sounds.unlock();
    }

    openRules() {
        void this.router.navigate(['/rules']);
    }

    openSettings() {
        void this.router.navigate(['/settings']);
    }

    async quitGame() {
        if (this.isChampionshipDuel || this.leavingGame) return;
        if (this.gameStatus === 'IN_PROGRESS') { await this.abandonGame(); return; }
        if (this.spectating) {
            this.realtime.disconnect();
            void this.router.navigate(['/home']);
            return;
        }
        if (!this.gameId) {
            void this.router.navigate(['/home']);
            return;
        }
        const beforeStart = ['WAITING_FOR_PLAYERS', 'READY'].includes(this.gameStatus);
        const creatorLeaving = beforeStart && this.isGameCreator;
        const alert = await this.alertController.create({
            header: creatorLeaving ? 'Annuler la partie' : 'Quitter la partie',
            message: creatorLeaving
                ? 'En tant que créateur, quitter maintenant annulera cette partie pour tous les joueurs.'
                : beforeStart ? 'Votre place sera libérée pour un autre joueur.' : 'Veux-tu vraiment quitter cette partie ?',
            buttons: [
                { text: 'Annuler', role: 'cancel' },
                {
                    text: 'Quitter',
                    cssClass: 'game-alert-primary',
                    handler: () => {
                        this.leavingGame = true;
                        this.gameApi.leave(this.gameId!).subscribe({
                            next: async () => {
                                this.realtime.disconnect();
                                await this.router.navigate(['/search'], { queryParams: { tab: 'a-venir' }, replaceUrl: true });
                            },
                            error: async error => {
                                this.leavingGame = false;
                                await this.showRealtimeError(error?.error?.message || 'Impossible de quitter la partie.');
                            }
                        });
                        return true;
                    }
                }
            ]
        });
        await alert.present();
    }

    async abandonGame() {
        if (!this.gameId || this.spectating || this.gameStatus !== 'IN_PROGRESS' || this.isChampionshipDuel || this.abandoningGame) return;
        const alert = await this.alertController.create({
            header: 'Abandonner la partie ?',
            message: 'Votre abandon sera définitif. En partie avec jetons, l’équivalent de votre mise sera perdu.',
            buttons: [
                { text: 'Continuer', role: 'cancel' },
                { text: 'Abandonner', role: 'destructive', handler: () => {
                    this.abandoningGame = true;
                    this.gameApi.abandon(this.gameId!).subscribe({
                        next: async () => { this.abandoningGame = false; },
                        error: async error => { this.abandoningGame = false; await this.showRealtimeError(error?.error?.message || 'Impossible d’abandonner la partie.'); }
                    });
                }}
            ]
        });
        await alert.present();
    }

    async openChat() {
        const alert = await this.alertController.create({
            cssClass: 'fafap-game-alert game-chat-alert',
            header: '🎮 Chat de la table',
            subHeader: 'Fais vivre la partie !',
            inputs: [{
                name: 'message',
                type: 'text',
                placeholder: 'Écris ton message…',
                attributes: { maxlength: 160, autocomplete: 'off', enterkeyhint: 'send' }
            }],
            buttons: [
                { text: 'Annuler', role: 'cancel', cssClass: 'game-alert-cancel' },
                { text: 'Envoyer', cssClass: 'game-alert-primary game-chat-send', handler: data => this.sendChat(data.message) }
            ]
        });
        await alert.present();
    }

    async showHistory() {
        const alert = await this.alertController.create({
            header: 'Historique',
            message: this.actionHistory.length ? this.actionHistory.join('<br>') : 'Aucune action jouée pour le moment.',
            buttons: ['Fermer']
        });
        await alert.present();
    }

    private async sendChat(message: string) {
        if (!message?.trim()) return false;
        if (!this.realtime.sendChat(message)) {
            await this.showVoiceMessage('Le chat est momentanément indisponible.');
            return false;
        }
        return true;
    }

    private showChatBubble(userId: string, message: string) {
        this.chatBubbles.set(userId, message);
        const previousTimer = this.chatBubbleTimers.get(userId);
        if (previousTimer) clearTimeout(previousTimer);
        this.chatBubbleTimers.set(userId, setTimeout(() => {
            this.chatBubbles.delete(userId);
            this.chatBubbleTimers.delete(userId);
        }, 5000));
    }

    private clearChatBubbles() {
        this.chatBubbleTimers.forEach(timer => clearTimeout(timer));
        this.chatBubbleTimers.clear();
        this.chatBubbles.clear();
    }

    private startTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            if (this.isChampionshipDuel && ['WAITING_FOR_PLAYERS', 'READY'].includes(this.gameStatus) && ++this.championshipContextTicks % 5 === 0) this.refreshChampionshipContext();
            if (this.turnDeadlineAtMs) {
                this.refreshTurnTimer();
                return;
            }

            if (this.gameStatus === 'IN_PROGRESS' && this.playerSecondsRemaining > 0) {
                this.playerSecondsRemaining = Math.max(0, this.playerSecondsRemaining - 1);
                this.checkLowTimeAlert();
            }
        }, 1000);
    }

    private connectToBackendWhenRequested() {
        this.realtimeSubscriptions.add(this.route.queryParamMap.subscribe(params => {
            const nextGameId = params.get('gameId') ?? undefined;
            this.spectating = params.get('spectate') === '1';
            if (nextGameId === this.gameId) return;
            this.openRealtimeGame(nextGameId);
        }));
    }

    private refreshChampionshipContext() {
        const gameId = this.gameId;
        if (!gameId) return;
        void this.championshipFlow.gameContext(gameId).then(context => {
            if (this.gameId !== gameId || !context) return;
            this.isChampionshipDuel = true;
            this.championshipReadyDeadline = context.readyDeadline || '';
        });
    }

    private openRealtimeGame(nextGameId?: string) {
        this.resetGameSession();
        if (!nextGameId) return;
        this.gameId = nextGameId;
        this.realtimeMode = true;
        if (!this.spectating) void this.voice.enable(this.gameId).catch(() => undefined);
        const openedGameId = this.gameId;
        void this.campaignFlow.checkGame(openedGameId).then(context => { if (this.gameId === openedGameId) this.isCampaignGame = !!context; });
        void this.championshipFlow.gameContext(openedGameId).then(context => {
            if (this.gameId === openedGameId) { this.isChampionshipDuel = !!context; this.championshipReadyDeadline = context?.readyDeadline || ''; }
        });
        this.gameSessionSubscriptions.add(this.realtime.state$.subscribe(state => {
            if (state?.gameId === this.gameId) this.applyRealtimeState(state);
        }));
        this.gameSessionSubscriptions.add(this.realtime.errors$.subscribe(error => {
            this.pendingCardName = null;
            console.error('[realtime error]', error.code, error.message);
            if (error.code === 'HAND_RESYNC_FAILED') { void this.recoverFromHandResyncFailure(error); return; }
            void this.showRealtimeError(this.getRealtimeErrorMessage(error));
        }));
        this.gameSessionSubscriptions.add(this.realtime.hand$.subscribe(hand => {
            this.cardsInHandPlayer0 = hand.map(card => this.toVisualCard(card.code, card.id));
            if (this.premoveCardId && !this.cardsInHandPlayer0.some(card => card.id === this.premoveCardId)) {
                this.clearPremove();
            }
            this.tryPlayPremove();
            this.checkVictoryClaims();
        }));
        this.gameSessionSubscriptions.add(this.realtime.chat$.subscribe(chat => {
            this.showChatBubble(chat.senderUserId, chat.message);
        }));
        this.gameSessionSubscriptions.add(this.realtime.spectatorCount$.subscribe(count => {
            this.spectatorCount = count;
        }));
        this.realtime.connect(this.gameId, this.spectating);
    }

    private resetGameSession() {
        void this.voice.disable();
        this.clearChatBubbles();
        this.gameSessionSubscriptions.unsubscribe();
        this.gameSessionSubscriptions = new Subscription();
        this.realtime.disconnect();
        this.gameId = undefined;
        this.realtimeMode = false;
        this.spectatorCount = 0;
        this.rematchJoining = false;
        this.currentPlayerId = null;
        this.commanderId = null;
        this.selectedCard = null;
        this.playerSecondsRemaining = 60;
        this.playerTotalSeconds = 60;
        this.turnDeadlineAtMs = null;
        this.lastAction = 'Aucune action pour le moment';
        this.cardsOnTablePlayer0 = [];
        this.pastRoundCards = [];
        this.cardsInHandPlayer0 = [];
        this.opponentBackCards = [];
        this.boardPlayers = [];
        this.waitlistPlayers = [];
        this.isWaitlisted = false;
        this.isChampionshipDuel = false;
        this.championshipReadyDeadline = '';
        this.championshipContextTicks = 0;
        this.pendingRoundCards = [];
        this.pendingPastRoundCards = [];
        this.roundAnimationToken++;
        this.pendingCardName = null;
        this.clearPremove();
        this.currentPlayerReady = false;
        this.readyCount = 0;
        this.dominantCardId = null;
        this.gameStatus = '';
        this.automaticMode = false;
        this.automaticModeInitialized = false;
        this.postGameParticipants = [];
        this.friendUserIds.clear();
        this.outgoingFriendUserIds.clear();
        this.friendSubmittingUserIds.clear();
        this.automaticModeOverride = null;
        this.automaticServerSyncKey = '';
        if (this.automationOverrideTimer) clearTimeout(this.automationOverrideTimer);
        this.automationOverrideTimer = undefined;
        this.automationSubmitting = false;
        this.tableCardsInitialized = false;
        this.knownTableCardIds.clear();
        this.gameStartSoundPlayed = false;
        this.terminalAnnounced = false;
        this.commanderSoundInitialized = false;
        this.lastLowTimeAlertSecond = null;
        this.isCollectingTrick = false;
        this.isDealingCards = false;
        this.claimReveal = undefined;
        this.checkedClaimSignature = '';
        this.ignoredClaimSignature = '';
        this.claimDialogOpen = false;
        this.claimSubmitting = false;
        this.dealFlights = [];
        if (this.dealAnimationTimer) {
            clearTimeout(this.dealAnimationTimer);
            this.dealAnimationTimer = undefined;
        }
        if (this.roundClearTimer) {
            clearTimeout(this.roundClearTimer);
            this.roundClearTimer = undefined;
        }
    }

    private applyRealtimeState(state: GameStateDto) {
        const previousStatus = this.gameStatus;
        const shouldAnimateDeal = state.status === 'IN_PROGRESS'
            && previousStatus !== 'IN_PROGRESS'
            && !this.gameStartSoundPlayed
            && state.tableCards.length === 0;
        const previousCurrentPlayerId = this.currentPlayerId;
        const previousCommanderId = this.commanderId;
        const incomingTableCards = state.tableCards;
        const incomingCardIds = new Set(incomingTableCards.map(card => card.id));
        const newlyPlayedCards = this.tableCardsInitialized
            ? incomingTableCards.filter(card => !this.knownTableCardIds.has(card.id))
            : [];
        this.knownTableCardIds = incomingCardIds;
        this.tableCardsInitialized = true;
        this.gameStatus = state.status;
        if (shouldAnimateDeal) {
            this.gameStartSoundPlayed = true;
            void this.notifyGameStarted();
        }
        this.currentPlayerId = state.currentPlayerId;
        if (previousCurrentPlayerId !== this.currentPlayerId) {
            this.lastLowTimeAlertSecond = null;
        }
        this.commanderId = state.commanderPlayerId;
        const currentUser = this.auth.currentUser();
        this.isGameCreator = state.createdByUserId === currentUser?.id;
        const me = state.players.find(player => player.userId === currentUser?.id)
            ?? state.players.find(player => player.username === currentUser?.username);
        this.playerId = me?.gamePlayerId;
        const previousAutomaticMode = this.automaticMode;
        const hadAutomaticModeState = this.automaticModeInitialized;
        this.automaticMode = me?.automaticMode === true;
        this.automaticModeInitialized = true;
        if (hadAutomaticModeState && !previousAutomaticMode && this.automaticMode && state.status === 'IN_PROGRESS') {
            void this.showAutomaticModeNotice();
        }
        if (newlyPlayedCards.length) {
            const opponentPlayed = newlyPlayedCards.some(card => card.playedByGamePlayerId !== this.playerId);
            this.sounds.card('FAFAP', opponentPlayed);
            const dominantOpeningCard = newlyPlayedCards.find(card =>
                card.id === state.currentRoundState?.openingCardId
                && card.playedByGamePlayerId === state.commanderPlayerId
            );
            if (dominantOpeningCard) this.sounds.family(dominantOpeningCard.suit);
        }
        if (state.status === 'IN_PROGRESS'
            && state.currentPlayerId === this.playerId
            && previousCurrentPlayerId !== state.currentPlayerId) {
            this.sounds.turn();
        }
        if (this.commanderSoundInitialized && previousCommanderId !== this.commanderId) {
            if (this.commanderId === this.playerId) this.sounds.commander(true);
            else if (previousCommanderId === this.playerId) this.sounds.commander(false);
        }
        this.commanderSoundInitialized = true;
        const wasWaitlisted = this.isWaitlisted;
        this.isWaitlisted = me?.status === 'WAITLISTED';
        if (wasWaitlisted && previousStatus !== 'IN_PROGRESS' && state.status === 'IN_PROGRESS'
            && me?.status !== 'READY' && me?.status !== 'ACTIVE') {
            this.realtime.disconnect();
            void this.notifyLeftBehindByWaitlist();
            return;
        }
        this.currentPlayerReady = !this.isWaitlisted && (me?.status === 'READY' || me?.status === 'ACTIVE');
        this.readyCount = state.players.filter(player => player.status !== 'WAITLISTED' && (player.status === 'READY' || player.status === 'ACTIVE')).length;
        const hasRoundMetadata = incomingTableCards.every(card => Number.isFinite(card.roundNumber));
        const nextRoundCards = incomingTableCards
            .filter(card => !hasRoundMetadata || card.roundNumber === state.currentRound)
            .map(card => this.toVisualCard(card.code, card.id, card.roundNumber, card.playedByGamePlayerId));
        const nextPastRoundCards = incomingTableCards
            .filter(card => hasRoundMetadata && card.roundNumber < state.currentRound)
            .map((card, index, pastCards) => this.toVisualCard(
                card.code,
                card.id,
                card.roundNumber,
                card.playedByGamePlayerId,
                pastCards.slice(0, index + 1).filter(item => item.roundNumber === card.roundNumber).length
            ));
        const displayedRound = this.cardsOnTablePlayer0.find(card => Number.isFinite(card.roundNumber))?.roundNumber;
        const roundHasAdvanced = Number.isFinite(displayedRound) && state.currentRound > displayedRound;
        if (this.roundClearTimer) {
            this.pendingRoundCards = nextRoundCards;
            this.pendingPastRoundCards = nextPastRoundCards;
        } else if (roundHasAdvanced) {
            this.pendingRoundCards = nextRoundCards;
            this.pendingPastRoundCards = nextPastRoundCards;
            this.cardsOnTablePlayer0 = incomingTableCards
                .filter(card => card.roundNumber === displayedRound)
                .map(card => this.toVisualCard(card.code, card.id, card.roundNumber, card.playedByGamePlayerId));
            this.isCollectingTrick = false;
            const animationToken = ++this.roundAnimationToken;
            this.roundClearTimer = setTimeout(() => {
                void this.animateCardsBackToPlayers(animationToken);
            }, 850);
        } else {
            this.cardsOnTablePlayer0 = nextRoundCards;
            this.pastRoundCards = nextPastRoundCards;
        }
        const requiredSuit = state.currentRoundState?.requiredSuit;
        this.currentRequiredSuit = requiredSuit ?? null;
        const dominant = requiredSuit
            ? incomingTableCards
                .filter(card => card.roundNumber === state.currentRound && card.suit === requiredSuit)
                .reduce<(typeof incomingTableCards)[number] | null>((best, card) => !best || card.value > best.value ? card : best, null)
            : null;
        this.dominantCardId = dominant?.id ?? state.currentRoundState?.openingCardId ?? null;
        this.opponentBackCards = state.players
            .filter(player => player.gamePlayerId !== this.playerId)
            .flatMap(player => Array.from({ length: player.remainingCardCount }, () => '../../assets/images/cards/green_back.png'));
        const players = state.players.map(player => ({
            id: player.gamePlayerId,
            userId: player.userId,
            name: player.username,
            avatar: player.gamePlayerId === this.playerId
                ? this.auth.currentUser()?.avatarUrl || player.avatarUrl
                : player.avatarUrl,
            countryCode: player.countryCode,
            cardCount: player.remainingCardCount,
            isMe: player.gamePlayerId === this.playerId,
            connected: player.connected,
            ready: player.status === 'READY' || player.status === 'ACTIVE',
            seatNumber: player.seatNumber,
            waitlisted: player.status === 'WAITLISTED',
            isBot: player.userType === 'AUTOMATIC',
        }));
        this.waitlistPlayers = players.filter(player => player.waitlisted);
        const seatedPlayers = players.filter(player => !player.waitlisted);
        this.boardPlayers = [
            ...seatedPlayers.filter(player => !player.isMe),
            ...seatedPlayers.filter(player => player.isMe),
        ];
        if (shouldAnimateDeal) {
            window.setTimeout(() => this.startDealAnimation(), 0);
        }
        this.betAmount = state.stakeAmount;
        const serverPot = Number(state.pot?.reservedAmount ?? state.pot?.finalDistributedAmount ?? 0);
        const activePlayerCount = state.players.filter(player => player.status !== 'WAITLISTED').length;
        this.globalPot = serverPot > 0 ? serverPot : state.stakeAmount * activePlayerCount;
        this.syncDeadline(state.currentTurnDeadline);
        this.lastAction = state.currentPlayerId === this.playerId ? 'À vous de jouer' : 'En attente d’un autre joueur';
        this.tryPlayPremove();
        this.checkVictoryClaims();
        if ((state.status === 'FINISHED' || state.status === 'CANCELLED') && !this.terminalAnnounced) {
            this.clearPremove();
            this.terminalAnnounced = true;
            this.preparePostGameParticipants();
            void this.showTerminalState(state);
        }
        if (this.pendingCardName && !this.cardsInHandPlayer0.some(card => card.name === this.pendingCardName)) {
            this.lastAction = `Carte jouée : ${this.pendingCardName}`;
            this.actionHistory.unshift(this.lastAction);
            this.pendingCardName = null;
            this.selectedCard = null;
        } else if (this.selectedCard && !this.cardsInHandPlayer0.some(card => card.name === this.selectedCard.name)) {
            this.selectedCard = null;
        }
    }

    private toVisualCard(code: string, id: string | number, roundNumber?: number, playedByGamePlayerId?: string, playOrderInRound?: number) {
        const suit: Record<string,string> = { BLACK: 'S', TCHAKA: 'C', KOUBI: 'H', ZINK: 'D' };
        const legacyCode = code.includes('-') ? `${code.split('-')[1]}${suit[code.split('-')[0]] || 'S'}` : code;
        const rank=legacyCode.slice(0,-1),suitCode=legacyCode.slice(-1);
        return { id, name: code, path_to_image: this.cardTheme.card(rank,suitCode), roundNumber, playedByGamePlayerId, playOrderInRound };
    }

    get isMyTurn(): boolean {
        return this.gameStatus === 'IN_PROGRESS' && !!this.playerId && this.currentPlayerId === this.playerId;
    }

    isCardPlayable(card: any): boolean {
        if (!this.currentRequiredSuit) return true;
        const hasRequiredSuit = this.cardsInHandPlayer0.some(item => this.cardSuit(item) === this.currentRequiredSuit);
        return !hasRequiredSuit || this.cardSuit(card) === this.currentRequiredSuit;
    }

    private cardSuit(card: any): string | null {
        const code = String(card?.name || '');
        if (code.includes('-')) return code.split('-')[0] || null;
        return ({ S: 'BLACK', C: 'TCHAKA', H: 'KOUBI', D: 'ZINK' } as Record<string,string>)[code.slice(-1)] || null;
    }

    pastCardsForPlayer(playerId: string) {
        return this.pastRoundCards.filter(card => card.playedByGamePlayerId === playerId);
    }

    myPastCards() {
        const me = this.boardPlayers.find(player => player.isMe);
        return me ? this.pastCardsForPlayer(me.id) : [];
    }

    cardPlayer(card: { playedByGamePlayerId?: string }) {
        return this.boardPlayers.find(player => player.id === card.playedByGamePlayerId);
    }

    dominantVisualCard() {
        return this.cardsOnTablePlayer0.find(card => card.id === this.dominantCardId) ?? null;
    }

    cardPlayerColor(card: { playedByGamePlayerId?: string }) {
        const seat = this.cardPlayer(card)?.seatNumber ?? 1;
        return `player-color-${(seat - 1) % 4}`;
    }

    private syncDeadline(deadline: string | null) {
        const turnLimit = 60;
        this.playerTotalSeconds = turnLimit;
        if (!deadline) {
            this.turnDeadlineAtMs = null;
            if (this.gameStatus !== 'IN_PROGRESS' && this.playerSecondsRemaining > turnLimit) {
                this.playerSecondsRemaining = turnLimit;
            }
            return;
        }

        this.turnDeadlineAtMs = new Date(deadline).getTime();
        this.refreshTurnTimer();
    }

    private refreshTurnTimer() {
        if (!this.turnDeadlineAtMs) {
            return;
        }
        const remaining = Math.max(0, Math.ceil((this.turnDeadlineAtMs - Date.now()) / 1000));
        this.playerSecondsRemaining = Math.min(remaining, this.playerTotalSeconds || 60);
        this.syncAutomaticModeAfterServerTimeout();
        this.checkLowTimeAlert();
    }

    private syncAutomaticModeAfterServerTimeout() {
        if (!this.gameId || this.gameStatus !== 'IN_PROGRESS' || this.currentPlayerId !== this.playerId
            || this.displayAutomaticMode || this.playerSecondsRemaining > 14) return;
        const key = `${this.currentPlayerId}:${this.turnDeadlineAtMs}`;
        if (this.automaticServerSyncKey === key) return;
        this.automaticServerSyncKey = key;
        this.gameApi.state(this.gameId).subscribe({
            next: state => this.applyRealtimeState(state),
            error: () => { this.automaticServerSyncKey = ''; }
        });
    }

    private scheduleAutomationResync() {
        if (this.automationOverrideTimer) clearTimeout(this.automationOverrideTimer);
        this.automationOverrideTimer = setTimeout(() => {
            const gameId = this.gameId;
            if (!gameId) return;
            this.gameApi.state(gameId).subscribe({
                next: state => {
                    this.automaticModeOverride = null;
                    this.applyRealtimeState(state);
                },
                error: () => { this.automaticModeOverride = null; }
            });
        }, 1200);
    }

    private checkLowTimeAlert() {
        const isMyTurn = !this.realtimeMode || this.currentPlayerId === this.playerId;
        if (!isMyTurn || this.gameStatus !== 'IN_PROGRESS' || this.playerSecondsRemaining <= 0) return;
        if (this.playerSecondsRemaining >= 20) {
            this.lastLowTimeAlertSecond = null;
            return;
        }
        const shouldAlert = (19 - this.playerSecondsRemaining) % 2 === 0;
        if (!shouldAlert || this.lastLowTimeAlertSecond === this.playerSecondsRemaining) return;
        this.lastLowTimeAlertSecond = this.playerSecondsRemaining;
        this.sounds.lowTime();
    }

    playerPosition(index: number): string {
        const player = this.boardPlayers[index];
        if (player?.isMe) return 'seat-bottom-right';
        const opponentIndex = this.boardPlayers.slice(0, index).filter(item => !item.isMe).length;
        const opponentCount = this.boardPlayers.filter(item => !item.isMe).length;
        if (opponentCount === 1) return 'seat-top-center';
        if (opponentCount === 2) return opponentIndex === 0 ? 'seat-middle-left' : 'seat-middle-right';
        if (opponentCount === 3) return ['seat-top-center', 'seat-middle-left', 'seat-middle-right'][opponentIndex] || 'seat-top-center';
        // Spectateur d'une table à 4 joueurs : personne n'est "moi", donc jusqu'à 4 adversaires
        // simultanés — on utilise les 4 coins plutôt que le trio prévu pour une vraie partie.
        return ['seat-top-left', 'seat-top-right', 'seat-middle-left', 'seat-middle-right'][opponentIndex] || 'seat-top-center';
    }

    playerColor(index: number): string { return ['green', 'red', 'purple', 'gold'][index % 4]; }

    trackCardById(_index: number, card: { id: string }) { return card.id; }
    trackDealFlight(_index: number, flight: DealFlight) { return flight.id; }
    isMyCard(card: { playedByGamePlayerId?: string }) { return card.playedByGamePlayerId === this.playerId; }
    isCardPending(card: { name: string }) { return card.name === this.pendingCardName; }
    isCardPremove(card: { id: string }) { return card.id === this.premoveCardId; }

    private queuePremove(card: { id: string; name: string }) {
        this.premoveCardId = card.id;
        this.premoveCardName = card.name;
        this.selectedCard = card;
        this.lastAction = `Pré-coup programmé : ${card.name}`;
    }

    private tryPlayPremove() {
        if (!this.premoveCardId || !this.premoveCardName || this.pendingCardName) return;
        if (this.gameStatus !== 'IN_PROGRESS' || this.currentPlayerId !== this.playerId) return;
        const card = this.cardsInHandPlayer0.find(item => item.id === this.premoveCardId);
        if (!card) {
            this.clearPremove();
            return;
        }
        this.lastAction = `Pré-coup exécuté : ${this.premoveCardName}`;
        this.clearPremove();
        this.playSelectedCard(card);
    }

    private clearPremove() {
        this.premoveCardId = null;
        this.premoveCardName = null;
    }

    private startDealAnimation() {
        if (this.isDealingCards || !this.boardPlayers.length) return;
        this.isDealingCards = true;
        this.dealFlights = [];

        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!this.isDealingCards) return;
            const origin = this.host.nativeElement.querySelector<HTMLElement>('.deal-origin');
            const originRect = origin?.getBoundingClientRect();
            if (!originRect) {
                this.isDealingCards = false;
                return;
            }
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                this.isDealingCards = false;
                return;
            }

            const originX = originRect.left + originRect.width / 2;
            const originY = originRect.top + originRect.height / 2;
            const playersBySeat = [...this.boardPlayers].sort((left, right) => left.seatNumber - right.seatNumber);
            const cardsPerPlayer = Math.max(1, ...playersBySeat.map(player => player.cardCount));
            const flights: DealFlight[] = [];
            let order = 0;

            for (let round = 0; round < cardsPerPlayer; round++) {
                for (const player of playersBySeat) {
                    if (round >= player.cardCount) continue;
                    const target = this.host.nativeElement.querySelector<HTMLElement>(
                        `.opponent[data-player-id="${player.id}"] .avatar-ring`
                    );
                    const targetRect = target?.getBoundingClientRect();
                    if (!targetRect) continue;
                    const x = targetRect.left + targetRect.width / 2 - originX + (round - 2) * 7;
                    const y = targetRect.top + targetRect.height / 2 - originY;
                    flights.push({
                        id: `${round}-${player.id}`,
                        x,
                        y,
                        midX: x * .48,
                        midY: y * .44 - 34,
                        rotation: (player.seatNumber % 2 ? -1 : 1) * (5 + round * 1.5),
                        delay: order++ * 180,
                    });
                }
            }

            this.dealFlights = flights;
            this.sounds.deal(flights.length, 180);
            const totalDuration = Math.max(950, (flights.length - 1) * 180 + 940);
            this.dealAnimationTimer = setTimeout(() => {
                this.isDealingCards = false;
                this.dealFlights = [];
                this.dealAnimationTimer = undefined;
            }, totalDuration);
        }));
    }

    private async animateCardsBackToPlayers(animationToken: number) {
        if (animationToken !== this.roundAnimationToken) return;
        this.isCollectingTrick = true;

        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const cardElements = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.center-cards .played-card'));
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        await Promise.all(cardElements.map(async (cardElement, index) => {
            await new Promise<void>(resolve => window.setTimeout(resolve, reducedMotion ? 0 : index * 260));
            if (animationToken !== this.roundAnimationToken) return;

            this.sounds.card('FAFAP');

            const playerId = cardElement.dataset.playedByPlayerId;
            const target = playerId === this.playerId
                ? this.host.nativeElement.querySelector<HTMLElement>('.my-played-history-target')
                : playerId
                    ? this.host.nativeElement.querySelector<HTMLElement>(`.opponent[data-player-id="${playerId}"] .avatar-ring`)
                    : null;
            const cardRect = cardElement.getBoundingClientRect();
            const targetRect = target?.getBoundingClientRect();
            const deltaX = targetRect ? targetRect.left + targetRect.width / 2 - (cardRect.left + cardRect.width / 2) : 0;
            const deltaY = targetRect ? targetRect.top + targetRect.height / 2 - (cardRect.top + cardRect.height / 2) : -90;

            const animation = cardElement.animate([
                { opacity: 1, translate: '0 0', scale: '1', rotate: '0deg' },
                { opacity: 1, translate: `${deltaX * .45}px ${deltaY * .42 - 22}px`, scale: '.9', rotate: `${index % 2 ? 5 : -5}deg`, offset: .52 },
                { opacity: .08, translate: `${deltaX}px ${deltaY}px`, scale: '.22', rotate: '0deg' }
            ], {
                duration: reducedMotion ? 1 : 680,
                easing: 'cubic-bezier(.42,0,.2,1)',
                fill: 'forwards'
            });
            await animation.finished.catch(() => undefined);
            target?.animate([
                { filter: 'brightness(1)' },
                { filter: 'brightness(1.45) drop-shadow(0 0 12px rgba(153,255,70,.72))' },
                { filter: 'brightness(1)' }
            ], { duration: reducedMotion ? 1 : 320, easing: 'ease-out' });
        }));

        if (animationToken !== this.roundAnimationToken) return;
        this.cardsOnTablePlayer0 = this.pendingRoundCards;
        this.pastRoundCards = this.pendingPastRoundCards;
        this.pendingRoundCards = [];
        this.pendingPastRoundCards = [];
        this.isCollectingTrick = false;
        this.roundClearTimer = undefined;
    }

    hiddenCards(player: BoardPlayer): string[] {
        if (player.isMe) return [];
        return Array.from({ length: player.cardCount }, () => '../../assets/images/cards/green_back.png');
    }

    hasTurn(player: BoardPlayer) { return player.id === this.currentPlayerId; }
    isCommander(player: BoardPlayer) { return player.id === this.commanderId; }

    private async showRealtimeError(message: string) {
        const toast = await this.toastController.create({ message, duration: 2500, position: 'top', color: 'danger' });
        await toast.present();
    }

    // Le tableau du championnat côté client peut être en retard de quelques secondes sur le
    // serveur (poll périodique) : un joueur peut ouvrir un gameId qui n'est déjà plus le sien
    // (manche déjà réglée, prochaine partie déjà créée). Plutôt que d'afficher une erreur sans
    // suite, on tente de retrouver le match de championnat en cours et d'y rediriger directement.
    private async recoverFromHandResyncFailure(error: { code: string; message: string }) {
        const currentGameId = this.gameId;
        if (currentGameId && await this.championshipFlow.recoverStaleGame(currentGameId)) return;
        void this.showRealtimeError(this.getRealtimeErrorMessage(error));
    }

    private getRealtimeErrorMessage(error: { code: string; message: string }) {
        const rawMessage = error.message || '';
        if (
            error.code === 'SOCKET_BROKER_ERROR'
            || rawMessage.includes('Failed to send message to ExecutorSubscribableChannel[clientInboundChannel]')
        ) {
            return 'Aucune connexion active avec cette partie.';
        }
        return rawMessage;
    }

    private async showTerminalState(state: GameStateDto) {
        if (this.spectating) { await this.showSpectatorResult(state); return; }
        // Le statut terminal est diffusé après le règlement du pot : recharge le
        // compte pour afficher immédiatement les jetons, la perte ou le remboursement.
        this.loadBalance();
        if(state.result?.victoryType?.startsWith('CLAIM_'))await this.showVictoryClaimReveal();
        if(this.isKoratVictory(state.result?.victoryType))await this.showKoratReveal();
        const winner = state.players.find(player => player.gamePlayerId === state.result?.winnerPlayerId);
        const won = winner?.gamePlayerId === this.playerId;
        const cancelled = state.status === 'CANCELLED';
        if (!cancelled) {
            const campaign = await this.campaignFlow.checkGame(state.gameId);
            if (campaign) { this.sounds.result(won); if (won) this.startVictoryCelebration(); await this.campaignFlow.presentResult(campaign); return; }
        }
        const championship = cancelled ? undefined : await this.championshipFlow.afterGame(state.gameId);
        // On iOS/PWA, AudioContext.resume() may remain pending when autoplay is
        // blocked. Never delay the result dialog while waiting for audio.
        if (!cancelled) this.sounds.result(won);
        if (!cancelled && championship?.nextGameId) {
            if (won) this.startVictoryCelebration();
            await this.championshipFlow.presentMancheTransition(championship, won);
            return;
        }
        let alert: any;
        alert = await this.alertController.create({
            cssClass: cancelled ? 'fafap-game-alert game-result-alert game-result-cancelled'
                : championship ? `fafap-game-alert championship-result-alert ${won ? 'manche-won' : 'manche-lost'}`
                : `fafap-game-alert game-result-alert ${won ? 'game-result-winner' : 'game-result-loser'}`,
            header: cancelled ? 'Partie annulée' : championship ? (won ? 'Duel remporté !' : 'Duel perdu') : undefined,
            message: cancelled ? 'Cette partie a été annulée.' : championship ? this.championshipFlow.finalMessage(championship, won) : '\u00a0',
            backdropDismiss: true,
            buttons: [
                ...(!cancelled && !championship && state.rematchGameId ? [{
                    text: 'Rejouer', cssClass: 'game-alert-replay',
                    handler: () => { this.joinRematch(state.gameId, alert); return false; }
                }] : []),
                {
                    text: 'Parties', cssClass: 'game-alert-cancel',
                    handler: () => { void this.leaveResultForTables(alert); return false; }
                },
                ...(!cancelled && !championship ? [
                    { text: 'Campagne', cssClass: 'game-alert-campaign', handler: () => void this.router.navigate(['/campaign']) },
                    { text: 'Championnat', cssClass: 'game-alert-championship', handler: () => void this.router.navigate(['/championships']) }
                ] : []),
                ...(cancelled || championship ? [{
                    text: championship ? 'Retourner au championnat' : 'Revoir',
                    cssClass: championship ? 'game-alert-primary' : 'game-alert-replay',
                    handler: () => championship ? void this.championshipFlow.returnToChampionship(championship) : void this.router.navigate(['/game-replay'], { queryParams: { gameId: state.gameId } })
                }] : [])
            ]
        });
        await alert.present();
        if (won && !cancelled) {
            this.startVictoryCelebration();
            void alert.onDidDismiss().then(() => this.stopVictoryCelebration());
        }
        if (championship) this.championshipFlow.scheduleAutoReturn(championship, alert);
        if (!cancelled) {
            const artwork = alert.querySelector('.alert-message');
            artwork?.setAttribute('role', 'button');
            artwork?.setAttribute('aria-label', 'Fermer le résultat');
            artwork?.addEventListener('click', () => { void alert.dismiss(); }, { once: true });
        }
    }

    private async leaveResultForTables(alert: HTMLIonAlertElement) {
        if (this.gameStatus === 'LEAVING_RESULT') return;
        this.gameStatus = 'LEAVING_RESULT';
        this.stopVictoryCelebration();
        const didDismiss = alert.onDidDismiss();
        await alert.dismiss(undefined, 'parties').catch(() => undefined);
        await didDismiss.catch(() => undefined);
        this.resetGameSession();
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        await this.router.navigate(['/search'], {
            queryParams: { tab: 'terminees' },
            replaceUrl: true
        });
    }

    // Un spectateur n'est ni gagnant ni perdant : on affiche le score final, jamais le popup victoire/défaite.
    private async showSpectatorResult(state: GameStateDto) {
        const cancelled = state.status === 'CANCELLED';
        if(cancelled){const alert=await this.alertController.create({cssClass:'fafap-game-alert game-result-alert game-result-spectator',header:'Partie annulée',message:'Cette partie a été annulée.',buttons:['Fermer']});await alert.present();return;}
        await this.spectatorResults.present(state.gameId,state.players.map(player=>({userId:player.userId,gamePlayerId:player.gamePlayerId,username:player.username,cardCount:player.remainingCardCount})),state.result?.winnerPlayerId?[state.result.winnerPlayerId]:[]);
    }

    participantFriendLabel(player: BoardPlayer) {
        if (this.friendUserIds.has(player.userId)) return 'Déjà ami';
        if (this.outgoingFriendUserIds.has(player.userId)) return 'Demande envoyée';
        return 'Ajouter';
    }

    canAddParticipant(player: BoardPlayer) {
        return !this.friendUserIds.has(player.userId) && !this.outgoingFriendUserIds.has(player.userId)
            && !this.friendSubmittingUserIds.has(player.userId);
    }

    addParticipantFriend(player: BoardPlayer) {
        if (!this.canAddParticipant(player)) return;
        this.friendSubmittingUserIds.add(player.userId);
        this.social.request(player.name).subscribe({
            next: async () => {
                this.friendSubmittingUserIds.delete(player.userId);
                this.outgoingFriendUserIds.add(player.userId);
                const toast = await this.toastController.create({message:`Demande envoyée à ${player.name}.`,duration:2200,color:'success',position:'top'});
                await toast.present();
            },
            error: error => {
                this.friendSubmittingUserIds.delete(player.userId);
                void this.showRealtimeError(error?.error?.message || `Impossible d’ajouter ${player.name}.`);
            }
        });
    }

    private preparePostGameParticipants() {
        this.postGameParticipants = this.boardPlayers.filter(player => !player.isMe);
        this.social.friends().subscribe({next: view => {
            this.friendUserIds = new Set(view.friends.map(friend => friend.userId));
            this.outgoingFriendUserIds = new Set(view.outgoing.map(friend => friend.userId));
        }});
    }

    private claimSignature(){return`${this.gameId}|${this.gameStatus}|${this.currentPlayerId}|${this.playerId}|${this.cardsInHandPlayer0.map(card=>card.id).sort().join(',')}`;}
    private checkVictoryClaims(){if(!this.gameId||this.gameStatus!=='IN_PROGRESS'||this.currentPlayerId!==this.playerId||!this.cardsInHandPlayer0.length||this.claimDialogOpen||this.claimSubmitting)return;const signature=this.claimSignature();if(signature===this.checkedClaimSignature||signature===this.ignoredClaimSignature)return;this.checkedClaimSignature=signature;this.gameApi.victoryClaims(this.gameId).subscribe({next:value=>{if(signature!==this.claimSignature()||!value.availableVictoryClaims.length)return;void this.openVictoryClaimDialog(value.availableVictoryClaims,signature);},error:()=>{if(this.checkedClaimSignature===signature)this.checkedClaimSignature='';}});}
    private async openVictoryClaimDialog(claims:VictoryClaimType[],signature:string){if(this.claimDialogOpen||signature!==this.claimSignature())return;this.claimDialogOpen=true;const labels:Record<VictoryClaimType,string>={LOW_SUM:'5 cartes — somme ≤ 21',THREE_THREES:'Au moins trois 3',THREE_SEVENS:'Au moins trois 7',FOUR_SEVENS:'Quatre 7 — KORAT direct',FOUR_OF_KIND:'Quatre cartes identiques',FIVE_SAME_SUIT:'Cinq cartes de la même enseigne'};const alert=await this.alertController.create({cssClass:'fafap-game-alert victory-claim-alert',header:'Revendication de victoire',message:'Votre main permet plusieurs revendications. Choisissez-en une pour gagner immédiatement, ou ignorez pour continuer.',backdropDismiss:false,buttons:[...claims.map(claim=>({text:labels[claim],cssClass:'victory-claim-choice',handler:()=>{this.submitVictoryClaim(claim,alert);return false;}})),{text:'Ignorer et continuer',role:'cancel',cssClass:'victory-claim-ignore',handler:()=>{this.ignoredClaimSignature=signature;}}]});await alert.present();await alert.onDidDismiss();this.claimDialogOpen=false;}
    private submitVictoryClaim(claimType:VictoryClaimType,alert:any){if(!this.gameId||this.claimSubmitting)return;this.claimSubmitting=true;this.gameApi.claimVictory(this.gameId,claimType).subscribe({next:()=>{this.claimSubmitting=false;void alert.dismiss();},error:error=>{this.claimSubmitting=false;void this.showRealtimeError(error?.error?.message||'La revendication n’est plus valide.');this.checkedClaimSignature='';void alert.dismiss();}});}
    private async showVictoryClaimReveal(){if(!this.gameId)return;try{const reveal:VictoryClaimReveal=await firstValueFrom(this.gameApi.victoryClaimReveal(this.gameId));this.claimReveal={winnerPlayerId:reveal.winnerPlayerId,reason:reveal.reason,hands:reveal.hands.map(hand=>({gamePlayerId:hand.gamePlayerId,username:hand.username,cards:hand.cards.map(card=>this.toVisualCard(card.code,card.id))}))};await new Promise<void>(resolve=>window.setTimeout(resolve,10000));}catch{}finally{this.claimReveal=undefined;}}

    private isKoratVictory(victoryType?: string | null) {
        return victoryType === 'KORAT' || victoryType === 'DOUBLE_KORAT' || victoryType === 'TRIPLE_KORAT';
    }

    private async showKoratReveal() {
        this.koratReveal = true;
        this.sounds.korat();
        try { await new Promise<void>(resolve => window.setTimeout(resolve, 10000)); }
        finally { this.koratReveal = false; }
    }

    private startVictoryCelebration() {
        this.stopVictoryCelebration();
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const celebration = document.createElement('div');
        celebration.className = `victory-celebration${reducedMotion ? ' reduced-motion' : ''}`;
        celebration.setAttribute('aria-hidden', 'true');
        celebration.innerHTML = '<div class="victory-rays"></div><div class="victory-glow"></div><div class="victory-stars"></div><canvas class="victory-confetti"></canvas>';
        const stars = celebration.querySelector<HTMLElement>('.victory-stars');
        const starCount = reducedMotion ? 10 : 26;
        for (let index = 0; index < starCount; index++) {
            const star = document.createElement('i');
            star.textContent = index % 3 === 0 ? '✦' : '★';
            star.style.setProperty('--star-x', `${6 + Math.random() * 88}vw`);
            star.style.setProperty('--star-y', `${5 + Math.random() * 86}vh`);
            star.style.setProperty('--star-size', `${10 + Math.random() * 24}px`);
            star.style.setProperty('--star-delay', `${Math.random() * 0.9}s`);
            star.style.setProperty('--star-duration', `${0.9 + Math.random() * 1.2}s`);
            stars?.appendChild(star);
        }
        document.body.appendChild(celebration);
        this.victoryCelebration = celebration;
        const canvas = celebration.querySelector<HTMLCanvasElement>('.victory-confetti');
        if (canvas) this.animateVictoryConfetti(canvas, reducedMotion);
        this.victoryCelebrationTimer = setTimeout(
            () => this.stopVictoryCelebration(),
            reducedMotion ? 1800 : 4800
        );
    }

    private animateVictoryConfetti(canvas: HTMLCanvasElement, reducedMotion: boolean) {
        const context = canvas.getContext('2d');
        if (!context) return;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        context.scale(pixelRatio, pixelRatio);
        const colors = ['#79ff32', '#f4c76b', '#ff4f87', '#53d8ff', '#ffffff', '#ff9f1c', '#a96cff'];
        const particleCount = reducedMotion ? 36 : Math.min(220, Math.max(130, Math.round(width / 5)));
        const particles = Array.from({length:particleCount}, (_, index) => {
            const fromLeft = index % 2 === 0;
            return {
                x: fromLeft ? width * 0.05 : width * 0.95,
                y: height * (0.88 + Math.random() * 0.08),
                vx: (fromLeft ? 1 : -1) * (2.8 + Math.random() * 7.4),
                vy: -(7.5 + Math.random() * 10.5),
                gravity: 0.13 + Math.random() * 0.09,
                drag: 0.988 + Math.random() * 0.007,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.35,
                width: 5 + Math.random() * 8,
                height: 3 + Math.random() * 6,
                color: colors[index % colors.length],
                circle: index % 7 === 0,
                opacity: 0.82 + Math.random() * 0.18
            };
        });
        const startedAt = performance.now();
        let previousAt = startedAt;
        const duration = reducedMotion ? 1200 : 4100;
        const draw = (now: number) => {
            const elapsed = now - startedAt;
            const step = Math.min(2, (now - previousAt) / 16.67);
            previousAt = now;
            context.clearRect(0, 0, width, height);
            for (const particle of particles) {
                particle.vx *= Math.pow(particle.drag, step);
                particle.vy += particle.gravity * step;
                particle.x += particle.vx * step;
                particle.y += particle.vy * step;
                particle.rotation += particle.rotationSpeed * step;
                const fade = elapsed > duration * 0.72 ? Math.max(0, 1 - (elapsed - duration * 0.72) / (duration * 0.28)) : 1;
                context.save();
                context.globalAlpha = particle.opacity * fade;
                context.translate(particle.x, particle.y);
                context.rotate(particle.rotation);
                context.fillStyle = particle.color;
                if (particle.circle) {
                    context.beginPath();
                    context.arc(0, 0, particle.width * 0.52, 0, Math.PI * 2);
                    context.fill();
                } else {
                    context.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
                }
                context.restore();
            }
            if (elapsed < duration) this.victoryAnimationFrame = requestAnimationFrame(draw);
        };
        this.victoryAnimationFrame = requestAnimationFrame(draw);
    }

    private stopVictoryCelebration() {
        if (this.victoryAnimationFrame !== undefined) cancelAnimationFrame(this.victoryAnimationFrame);
        if (this.victoryCelebrationTimer) clearTimeout(this.victoryCelebrationTimer);
        this.victoryAnimationFrame = undefined;
        this.victoryCelebrationTimer = undefined;
        this.victoryCelebration?.remove();
        this.victoryCelebration = undefined;
    }

    private joinRematch(parentGameId: string, alert: any) {
        if (this.rematchJoining) return;
        this.rematchJoining = true;
        this.gameApi.joinRematch(parentGameId).subscribe({
            next: rematch => {
                this.rematchJoining = false;
                void alert.dismiss();
                this.resetGameSession();
                void this.router.navigate(['/game-board'], {
                    queryParams: { gameId: rematch.gameId },
                    replaceUrl: true
                });
            },
            error: error => {
                this.rematchJoining = false;
                if (error?.error?.code === 'INSUFFICIENT_FUNDS') {
                    void this.insufficientFunds.present({ required: this.betAmount });
                    return;
                }
                void this.showRealtimeError(error?.error?.message || 'Impossible de rejoindre la revanche.');
            }
        });
    }

    private async notifyGameStarted() {
        const toast = await this.toastController.create({
            message: 'La partie commence !',
            duration: 2200,
            position: 'top',
            color: 'success',
            icon: 'game-controller'
        });
        await toast.present();
        this.sounds.start();
        if ('vibrate' in navigator) navigator.vibrate([80, 50, 120]);
    }

    getCenterCardTransform(_index: number): string {
        return 'translateY(0) rotate(0deg)';
    }

    getHandCardTransform(index: number): string {
        const count = this.cardsInHandPlayer0.length;
        if (count <= 1) return 'translateX(0) translateY(0) rotate(0deg)';

        const center = (count - 1) / 2;
        const distance = index - center;
        const normalizedDistance = distance / Math.max(center, 1);
        const maximumRotation = Math.min(13, 4 + count * 1.25);
        const rotation = normalizedDistance * maximumRotation;
        const lift = Math.pow(Math.abs(normalizedDistance), 1.65) * (count >= 6 ? 10 : 7);
        const horizontalCorrection = distance * (count <= 3 ? 4 : count <= 5 ? 2.5 : 1.5);

        return `translateX(${horizontalCorrection.toFixed(1)}px) translateY(${lift.toFixed(1)}px) rotate(${rotation.toFixed(1)}deg)`;
    }
}
