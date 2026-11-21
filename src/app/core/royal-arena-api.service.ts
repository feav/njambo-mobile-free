import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { GameType } from './game-realtime/game-api.service';

export type RoyalArenaStatus='REGISTRATION'|'IN_PROGRESS'|'FINISHED'|'CANCELLED';
export interface RoyalArenaSummary{id:string;name:string;gameType:GameType;entryFee:number;matchStake:number;maxParticipants?:number;participantCount:number;durationMinutes:number;feePercentage:number;startsAt:string;endsAt:string;status:RoyalArenaStatus;winnerUserId?:string;joined:boolean;canCancel:boolean;}
export interface RoyalArenaParticipant{id:string;userId:string;username:string;avatarUrl?:string;reserveBalance:number;status:'ACTIVE'|'QUEUED'|'PLAYING'|'ELIMINATED'|'PAID_OUT'|'ABANDONED'|'REMOVED';queuePosition?:number;joinedAt:string;}
export interface RoyalArenaMatch{id:string;participantOneId:string;participantTwoId:string;gameId?:string;status:'WAITING'|'RUNNING'|'FINISHED'|'CANCELLED';createdAt:string;participantOneReadyAt?:string;participantTwoReadyAt?:string;winnerParticipantId?:string;}
export interface RoyalArenaDetail{arena:RoyalArenaSummary;participants:RoyalArenaParticipant[];matches:RoyalArenaMatch[];}

@Injectable({providedIn:'root'})
export class RoyalArenaApiService{
  private readonly url=`${environment.apiBaseUrl}/api/arenas`;
  constructor(private http:HttpClient){}
  list(){return this.http.get<RoyalArenaSummary[]>(this.url);}
  get(id:string){return this.http.get<RoyalArenaDetail>(`${this.url}/${id}`);}
  create(value:{name:string;gameType:GameType;entryFee:number;matchStake:number;maxParticipants?:number;durationMinutes:number;startsAt:string}){return this.http.post<RoyalArenaDetail>(this.url,value);}
  join(id:string){return this.http.post<RoyalArenaDetail>(`${this.url}/${id}/join`,{});}
  leave(id:string){return this.http.delete<RoyalArenaDetail>(`${this.url}/${id}/leave`);}
  cancel(id:string){return this.http.post<RoyalArenaDetail>(`${this.url}/${id}/cancel`,{});}
  abandon(id:string){return this.http.post<RoyalArenaDetail>(`${this.url}/${id}/abandon`,{});}
  ready(gameId:string){return this.http.post<unknown>(`${this.url}/games/${gameId}/ready`,{});}
}
