import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LobbyGameEvent } from './game-realtime.models';

@Injectable({ providedIn: 'root' })
export class GameLobbyService implements OnDestroy {
    private client?: Client;
    private subscription?: StompSubscription;
    private readonly eventsSubject = new Subject<LobbyGameEvent>();
    readonly events$: Observable<LobbyGameEvent> = this.eventsSubject.asObservable();

    connect() {
        if (this.client?.active) return;
        this.client = new Client({
            brokerURL: `${environment.apiBaseUrl.replace(/^http/, 'ws')}/ws-native`,
            reconnectDelay: 2500,
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            debug: () => undefined,
        });
        this.client.onConnect = () => {
            this.subscription = this.client?.subscribe('/topic/games', message => this.consume(message));
        };
        this.client.activate();
    }

    disconnect() {
        this.subscription?.unsubscribe();
        this.subscription = undefined;
        if (this.client?.active) void this.client.deactivate();
        this.client = undefined;
    }

    ngOnDestroy() { this.disconnect(); }

    private consume(message: IMessage) {
        try { this.eventsSubject.next(JSON.parse(message.body) as LobbyGameEvent); }
        catch { /* Le prochain chargement REST resynchronisera le lobby. */ }
    }
}
