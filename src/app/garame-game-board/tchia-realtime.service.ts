import {Injectable,OnDestroy} from '@angular/core';
import {BehaviorSubject,Observable,Subject} from 'rxjs';
import {Client,IMessage,StompSubscription} from '@stomp/stompjs';
import {environment} from '../../environments/environment';
import {AuthService} from '../core/auth.service';
interface SocketEvent<T>{eventType:string;gameId:string;payload:T}
@Injectable({providedIn:'root'}) export class TchiaRealtimeService implements OnDestroy{
 private client?:Client;private subscription?:StompSubscription;private readonly stateSubject=new Subject<unknown>();private readonly connectedSubject=new BehaviorSubject(false);private readonly errorSubject=new Subject<string>();
 readonly state$:Observable<unknown>=this.stateSubject.asObservable();readonly connected$=this.connectedSubject.asObservable();readonly errors$:Observable<string>=this.errorSubject.asObservable();
 constructor(private auth:AuthService){}
 connect(gameId:string){this.disconnect();const token=this.auth.accessToken();this.client=new Client({brokerURL:`${environment.apiBaseUrl.replace(/^http/,'ws')}/ws-native`,connectHeaders:token?{Authorization:`Bearer ${token}`}:{},reconnectDelay:1800,heartbeatIncoming:10000,heartbeatOutgoing:10000,connectionTimeout:8000,debug:()=>undefined});this.client.onConnect=()=>{this.connectedSubject.next(true);this.subscription=this.client?.subscribe(`/user/queue/games/${gameId}`,message=>this.consume(gameId,message));this.client?.publish({destination:`/app/games/${gameId}/tchia/sync`,body:'{}'});};this.client.onWebSocketClose=()=>this.connectedSubject.next(false);this.client.onDisconnect=()=>this.connectedSubject.next(false);this.client.onStompError=frame=>{this.connectedSubject.next(false);this.errorSubject.next(frame.headers['message']||'Connexion temps réel indisponible');};this.client.activate();}
 disconnect(){this.subscription?.unsubscribe();this.subscription=undefined;if(this.client?.active)void this.client.deactivate();this.client=undefined;this.connectedSubject.next(false);}
 ngOnDestroy(){this.disconnect();}
 private consume(gameId:string,message:IMessage){try{const event=JSON.parse(message.body)as SocketEvent<unknown>;if(event.gameId===gameId&&event.eventType==='TCHIA_STATE_UPDATED')this.stateSubject.next(event.payload);}catch{this.errorSubject.next('Événement Tchia invalide');}}
}
