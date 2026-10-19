import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Client, StompSubscription } from '@stomp/stompjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth.service';

export interface TableChatMessage{gameId:string;senderUserId:string;message:string;sentAt:string}
@Injectable({providedIn:'root'})
export class GameChatService{
  private client?:Client;private subscription?:StompSubscription;private gameId?:string;private messagesSubject=new Subject<TableChatMessage>();readonly messages$=this.messagesSubject.asObservable();
  constructor(private auth:AuthService){}
  connect(gameId:string){this.disconnect();const token=this.auth.accessToken();this.gameId=gameId;this.client=new Client({brokerURL:`${environment.apiBaseUrl.replace(/^http/,'ws')}/ws-native`,connectHeaders:token?{Authorization:`Bearer ${token}`}:{},reconnectDelay:2500,heartbeatIncoming:10000,heartbeatOutgoing:10000,debug:()=>undefined});this.client.onConnect=()=>{this.subscription=this.client?.subscribe(`/topic/games/${gameId}/chat`,message=>{try{const value=JSON.parse(message.body)as TableChatMessage;if(value.gameId===gameId)this.messagesSubject.next(value);}catch{}});};this.client.activate();}
  send(message:string){const clean=message.trim().slice(0,160);if(!clean||!this.client?.connected||!this.gameId)return false;this.client.publish({destination:`/app/games/${this.gameId}/chat`,body:JSON.stringify({message:clean})});return true;}
  disconnect(){this.subscription?.unsubscribe();this.subscription=undefined;if(this.client?.active)void this.client.deactivate();this.client=undefined;this.gameId=undefined;}
}
