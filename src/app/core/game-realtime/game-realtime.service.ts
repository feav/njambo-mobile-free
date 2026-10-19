import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { environment } from '../../../environments/environment';
import { GameStateDto, PrivateHandDto, RealtimeGameError, VersionedGameEvent } from './game-realtime.models';
import { AuthService } from '../auth.service';
import { GameApiService } from './game-api.service';

export interface GameChatMessage {
    gameId: string;
    senderUserId: string;
    message: string;
    sentAt: string;
}

@Injectable({ providedIn: 'root' })
export class GameRealtimeService implements OnDestroy {
    private client?: Client;
    private resyncTimer?: number;
    private subscriptions: StompSubscription[] = [];
    private activeGame?: { gameId: string; spectating: boolean };
    private readonly stateSubject = new BehaviorSubject<GameStateDto | null>(null);
    private readonly errorSubject = new Subject<RealtimeGameError>();
    private readonly connectionSubject = new BehaviorSubject(false);
    private readonly handSubject = new BehaviorSubject<PrivateHandDto['cards']>([]);
    private readonly chatSubject = new Subject<GameChatMessage>();
    private readonly spectatorCountSubject = new BehaviorSubject(0);
    private readonly eventIds = new Set<string>();
    private lastEventVersion: number | null = null;

    readonly state$: Observable<GameStateDto | null> = this.stateSubject.asObservable();
    readonly errors$: Observable<RealtimeGameError> = this.errorSubject.asObservable();
    readonly connected$: Observable<boolean> = this.connectionSubject.asObservable();
    readonly hand$: Observable<PrivateHandDto['cards']> = this.handSubject.asObservable();
    readonly chat$: Observable<GameChatMessage> = this.chatSubject.asObservable();
    readonly spectatorCount$: Observable<number> = this.spectatorCountSubject.asObservable();

    constructor(private auth: AuthService, private api: GameApiService) {}

    connect(gameId: string, spectating = false) {
        this.disconnect();
        this.activeGame = { gameId, spectating };
        const brokerURL = `${environment.apiBaseUrl.replace(/^http/, 'ws')}/ws-native`;
        this.client = new Client({
            brokerURL,
            connectHeaders: this.auth.accessToken() ? { Authorization: `Bearer ${this.auth.accessToken()}` } : {},
            reconnectDelay: 2500,
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            connectionTimeout: 8000,
            debug: () => undefined,
        });
        this.client.onConnect = () => {
            this.connectionSubject.next(true);
            this.subscribe(gameId);
            this.resync(gameId);
        };
        this.client.onDisconnect = () => {
            this.connectionSubject.next(false);
            this.resync(gameId, true);
        };
        this.client.onWebSocketClose = () => {
            this.connectionSubject.next(false);
            this.resync(gameId, true);
        };
        this.client.onStompError = frame => {
            this.connectionSubject.next(false);
            this.resync(gameId, true);
            this.errorSubject.next({
                code: 'SOCKET_BROKER_ERROR',
                message: frame.headers['message'] || 'Erreur WebSocket',
                occurredAt: new Date().toISOString()
            });
        };
        // L'interface de lobby et le bouton READY ne doivent pas dépendre de la
        // réussite immédiate du WebSocket. Le canal HTTP reste la source de
        // vérité et permet d'afficher la partie puis de valider le joueur.
        this.resync(gameId, true);
        this.resyncTimer = window.setInterval(() => {
            if (this.activeGame?.gameId === gameId && !this.client?.connected) this.resync(gameId, true);
        }, 5000);
        this.client.activate();
    }

    disconnect() {
        if (this.resyncTimer !== undefined) window.clearInterval(this.resyncTimer);
        this.resyncTimer = undefined;
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
        this.subscriptions = [];
        if (this.client?.active) void this.client.deactivate();
        this.client = undefined;
        this.activeGame = undefined;
        this.eventIds.clear();
        this.lastEventVersion = null;
        this.stateSubject.next(null);
        this.handSubject.next([]);
        this.spectatorCountSubject.next(0);
        this.connectionSubject.next(false);
    }

    ngOnDestroy() { this.disconnect(); }

    sendChat(message: string): boolean {
        const cleanMessage = message.trim().slice(0, 160);
        if (!cleanMessage || !this.client?.connected || !this.activeGame) return false;
        this.client.publish({
            destination: `/app/games/${this.activeGame.gameId}/chat`,
            body: JSON.stringify({ message: cleanMessage })
        });
        return true;
    }

    private subscribe(gameId: string) {
        if (!this.client) return;
        const spectating = this.activeGame?.spectating === true;
        this.subscriptions.push(
            this.client.subscribe(`/topic/games/${gameId}`, message => this.consumeEvent(gameId, message, false)),
            this.client.subscribe(`/topic/games/${gameId}/spectators`, message => {
                const value = this.parse<{ gameId: string; count: number }>(message);
                if (value?.gameId === gameId) this.spectatorCountSubject.next(value.count);
            })
        );
        if (spectating) return;
        this.subscriptions.push(
            this.client.subscribe(`/topic/games/${gameId}/chat`, message => {
                const chat = this.parse<GameChatMessage>(message);
                if (chat?.gameId === gameId) this.chatSubject.next(chat);
            }),
            this.client.subscribe(`/user/queue/games/${gameId}`, message => {
                this.consumeEvent(gameId, message, true);
            }),
            this.client.subscribe('/user/queue/errors', message => {
                const error = this.parse<RealtimeGameError>(message);
                if (error) this.errorSubject.next(error);
            })
        );
    }

    private consumeEvent(gameId: string, message: IMessage, personal: boolean) {
        if (this.activeGame?.gameId !== gameId) return;
        const event = this.parse<VersionedGameEvent<GameStateDto | PrivateHandDto | { cards?: PrivateHandDto['cards'] }>>(message);
        if (!event || this.eventIds.has(event.eventId)) return;
        if (this.lastEventVersion !== null && event.gameVersion > this.lastEventVersion + 1) {
            this.resync(gameId);
        }
        if (this.lastEventVersion !== null && event.gameVersion < this.lastEventVersion) return;
        this.eventIds.add(event.eventId);
        this.lastEventVersion = Math.max(this.lastEventVersion ?? event.gameVersion, event.gameVersion);
        if (!personal && event.eventType === 'GAME_STATE_UPDATED') {
            this.stateSubject.next(event.payload as GameStateDto);
        }
        if (personal && event.eventType === 'PRIVATE_HAND_UPDATED') {
            const payload = event.payload as PrivateHandDto | { cards?: PrivateHandDto['cards'] };
            if (payload.cards) this.handSubject.next(payload.cards);
        }
    }

    private resync(gameId: string, silent = false) {
        this.api.state(gameId).subscribe({
            next: state => {
                if (this.activeGame?.gameId === gameId && state.gameId === gameId) this.stateSubject.next(state);
            },
            error: () => {
                if (!silent) {
                    this.errorSubject.next({ code: 'STATE_RESYNC_FAILED', message: 'Impossible de recharger l’état de la partie.', occurredAt: new Date().toISOString() });
                }
            }
        });
        if (this.activeGame?.spectating) return;
        this.api.myHand(gameId).subscribe({
            next: hand => {
                if (this.activeGame?.gameId === gameId) this.handSubject.next(hand);
            },
            error: () => {
                if (!silent) {
                    this.errorSubject.next({ code: 'HAND_RESYNC_FAILED', message: 'Impossible de recharger votre main.', occurredAt: new Date().toISOString() });
                }
            }
        });
    }

    private parse<T>(message: IMessage): T | null {
        try {
            return JSON.parse(message.body) as T;
        } catch {
            this.errorSubject.next({ code: 'INVALID_SOCKET_MESSAGE', message: 'Message temps réel invalide.', occurredAt: new Date().toISOString() });
            return null;
        }
    }
}
