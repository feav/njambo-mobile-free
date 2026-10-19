import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { GameType } from './game-realtime/game-api.service';
export interface ChampionshipSummary {
  id: string;
  name: string;
  gameType: GameType;
  levels: number;
  requiredParticipants: number;
  joinedParticipants: number;
  entryFee: number;
  bestOf: number;
  durationMinutes: number;
  feePercentage: number;
  status: 'REGISTRATION' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
  winnerUserId?: string;
  joined: boolean;
  canCancel: boolean;
  createdAt: string;
  startMode: 'IMMEDIATE' | 'SCHEDULED';
  scheduledStartAt?: string;
}
export interface ChampionshipParticipant {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  seed: number;
  walletBalance: number;
  status: string;
}
export interface ChampionshipGame {
  gameId: string;
  gameNumber: number;
  winnerParticipantId?: string;
  stakeAmount: number;
  status: string;
}
export interface ChampionshipMatch {
  id: string;
  round: number;
  position: number;
  participantOneId?: string;
  participantTwoId?: string;
  scoreOne: number;
  scoreTwo: number;
  gamesCompleted: number;
  status: string;
  winnerParticipantId?: string;
  participantOneReadyAt?: string;
  participantTwoReadyAt?: string;
  readyDeadline?: string;
  games: ChampionshipGame[];
}
export interface ChampionshipInvitationEntry {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  type: 'ASSIGNED' | 'INVITED';
  status: 'WAITLISTED' | 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
}
export interface ChampionshipDetail {
  championship: ChampionshipSummary;
  participants: ChampionshipParticipant[];
  matches: ChampionshipMatch[];
  invitations: ChampionshipInvitationEntry[];
}
export interface ChampionshipGameContext {
  championshipId: string;
  matchId: string;
  gameNumber: number;
  gamesCompleted: number;
  scoreOne: number;
  scoreTwo: number;
  matchStatus: 'WAITING' | 'RUNNING' | 'FINISHED';
  winnerParticipantId?: string;
  nextGameId?: string;
  readyDeadline?: string;
}
export interface MyChampionshipInvitation {
  id: string;
  championshipId: string;
  championshipName: string;
  gameType: GameType;
  entryFee: number;
  createdAt: string;
}
export interface MyPendingMatch {
  championshipId: string;
  championshipName: string;
  gameType: GameType;
  gameId: string;
}
@Injectable({ providedIn: 'root' })
export class ChampionshipApiService {
  private url = `${environment.apiBaseUrl}/api/championships`;
  constructor(private http: HttpClient) {}
  list() {
    return this.http.get<ChampionshipSummary[]>(this.url);
  }
  get(id: string) {
    return this.http.get<ChampionshipDetail>(`${this.url}/${id}`);
  }
  gameContext(gameId: string) {
    return this.http.get<ChampionshipGameContext>(
      `${this.url}/games/${gameId}`,
    );
  }
  create(value: {
    name: string;
    gameType: GameType;
    levels: number;
    entryFee: number;
    bestOf: number;
    durationMinutes: number;
    startMode: 'IMMEDIATE' | 'SCHEDULED';
    scheduledStartAt?: string;
  }) {
    return this.http.post<ChampionshipDetail>(this.url, value);
  }
  join(id: string) {
    return this.http.post<ChampionshipDetail>(`${this.url}/${id}/join`, {});
  }
  leave(id: string) {
    return this.http.delete<ChampionshipDetail>(`${this.url}/${id}/leave`);
  }
  cancel(id: string) {
    return this.http.post<ChampionshipDetail>(`${this.url}/${id}/cancel`, {});
  }
  abandon(id: string) {
    return this.http.post<ChampionshipDetail>(`${this.url}/${id}/abandon`, {});
  }
  invitations() {
    return this.http.get<MyChampionshipInvitation[]>(`${this.url}/invitations`);
  }
  acceptInvitation(id: string) {
    return this.http.post<ChampionshipDetail>(
      `${this.url}/invitations/${id}/accept`,
      {},
    );
  }
  declineInvitation(id: string) {
    return this.http.post<void>(`${this.url}/invitations/${id}/decline`, {});
  }
  myPendingMatch() {
    return this.http.get<MyPendingMatch | null>(`${this.url}/my-pending-match`);
  }
}
