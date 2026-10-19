import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GameStateDto, PrivateHandDto } from './game-realtime.models';
import { PlayerLocation } from '../ranked-location.service';

export type GameType = 'FAFAP' | 'PRESIDENT' | 'UNO' | 'COCHON_GRATTE' | 'CHECK_GAMES' | 'TCHIA_DIRECT' | 'TCHIA_IMPOT' | 'TCHIA_GARAME';
export interface GameDescriptor { type:GameType;name:string;description:string;minPlayers:number;maxPlayers:number;playable:boolean;boardRoute:string; }
export interface GameMetadata { gameId:string;gameType:GameType;boardRoute:string;version:number; }
export type VictoryClaimType='LOW_SUM'|'THREE_THREES'|'THREE_SEVENS'|'FOUR_OF_KIND'|'FOUR_SEVENS'|'FIVE_SAME_SUIT';
export interface VictoryClaimAvailability{participantId:string;availableVictoryClaims:VictoryClaimType[]}
export interface VictoryClaimResult{claimed:boolean;winnerPlayerId:string;claimType:VictoryClaimType;reason:string}
export interface VictoryClaimReveal{winnerPlayerId:string;claimType:VictoryClaimType;reason:string;hands:Array<{gamePlayerId:string;username:string;cards:Array<{id:string;suit:string;value:number;code:string}>}>}

export interface CreateRealtimeGame {
    terreId: string;
    requiredPlayerCount: number;
    accessType: 'PUBLIC' | 'PRIVATE';
    password?: string;
    playAnyway?: boolean;
}
export interface DirectCreateGame {
    gameType: GameType;
    requiredPlayerCount: number;
    stakeAmount: number;
    maximumLossMultiplier?: number;
    accessType?: 'PUBLIC' | 'PRIVATE';
    password?: string;
    playAnyway?: boolean;
}

export interface CreateTerre { name: string; stakeAmount: number; minPlayers: number; maxPlayers: number; turnDurationSeconds: number; maximumLossMultiplier: number; botsAllowed: boolean; gameType:GameType; }
export interface TerreDto { id: string; createdByUserId: string | null; name: string; gameType:GameType; stakeAmount: number; minPlayers: number; maxPlayers: number; turnDurationSeconds: number; maximumLossMultiplier: number; botsAllowed: boolean; status: string; casual: boolean; }
export interface GameSummaryDto { gameId: string; gameType: GameType; accessType: 'PUBLIC' | 'PRIVATE'; status: string; requiredPlayerCount: number; playerCount: number; availableSeats: number; waitlistCount: number; waitlistAvailable: number; stakeAmount: number; version: number; createdAt: string; players: GameStateDto['players']; }
export interface GamePageDto { content: GameSummaryDto[]; page: number; size: number; totalElements: number; last: boolean; }
export interface GameReplayDto {
    gameId: string; gameType: GameType; status: string; stakeAmount: number; createdAt: string; startedAt: string | null; finishedAt: string | null;
    players: GameStateDto['players'];
    actions: Array<{ order: number; round: number; playedAt: string; gamePlayerId: string; username: string; card: { id: string; suit: string; value: number; code: string } }>;
    rounds: Array<{ roundNumber: number; commanderPlayerId: string; winnerPlayerId: string | null; requiredSuit: string | null; status: string }>;
    result: { winnerPlayerId: string; victoryType: string } | null;
}

@Injectable({ providedIn: 'root' })
export class GameApiService {
    private readonly gamesUrl = `${environment.apiBaseUrl}/api/games`;
    constructor(private http: HttpClient) {}

    create(command: CreateRealtimeGame, location?:PlayerLocation): Observable<GameStateDto> {
        return this.http.post<GameStateDto>(this.gamesUrl, command, {headers:this.locationHeaders(location)});
    }
    quickCreate(command: { gameType: GameType; requiredPlayerCount: number; maxStake: number; playAnyway?: boolean }, location?:PlayerLocation): Observable<GameStateDto> {
        return this.http.post<GameStateDto>(`${this.gamesUrl}/quick-create`, command, {headers:this.locationHeaders(location)});
    }
    directCreate(command: DirectCreateGame, location?:PlayerLocation): Observable<{gameId:string;gameType:GameType;status:string;stakeAmount:number}> {
        return this.http.post<{gameId:string;gameType:GameType;status:string;stakeAmount:number}>(`${this.gamesUrl}/direct-create`, command, {headers:this.locationHeaders(location)});
    }

    join(gameId: string, password?: string, location?:PlayerLocation, playAnyway=false): Observable<unknown> {
        return this.http.post(`${this.gamesUrl}/${gameId}/join`, { password, playAnyway }, {headers:this.locationHeaders(location)});
    }

    inviteFriends(gameId:string,userIds:string[]):Observable<{notifiedFriends:number}>{return this.http.post<{notifiedFriends:number}>(`${this.gamesUrl}/${gameId}/invitations`,{userIds});}
    acceptInvitation(gameId:string,location?:PlayerLocation):Observable<unknown>{return this.http.post(`${this.gamesUrl}/${gameId}/invitations/accept`,{},{headers:this.locationHeaders(location)});}

    joinRematch(parentGameId: string): Observable<GameStateDto> {
        return this.http.post<GameStateDto>(`${this.gamesUrl}/${parentGameId}/rematch/join`, {});
    }

    state(gameId: string): Observable<GameStateDto> {
        return this.http.get<GameStateDto>(`${this.gamesUrl}/${gameId}/state`);
    }

    list(): Observable<GameSummaryDto[]> {
        return this.http.get<GameSummaryDto[]>(this.gamesUrl);
    }

    listPage(statuses: string[], page: number, size = 10, gameId?: string): Observable<GamePageDto | GameSummaryDto[]> {
        let params = new HttpParams().set('page', page).set('size', size);
        statuses.forEach(status => params = params.append('statuses', status));
        if (gameId) params = params.set('gameId', gameId);
        return this.http.get<GamePageDto | GameSummaryDto[]>(this.gamesUrl, { params });
    }

    gameTypes():Observable<GameDescriptor[]>{return this.http.get<GameDescriptor[]>(`${environment.apiBaseUrl}/api/game-types`);}
    metadata(gameId:string):Observable<GameMetadata>{return this.http.get<GameMetadata>(`${this.gamesUrl}/${gameId}/metadata`);}

    playCard(gameId: string, cardId: string, actionId: string): Observable<unknown> {
        return this.http.post(`${this.gamesUrl}/${gameId}/actions/play-card`, { cardId, actionId });
    }
    victoryClaims(gameId:string):Observable<VictoryClaimAvailability>{return this.http.get<VictoryClaimAvailability>(`${this.gamesUrl}/${gameId}/victory-claims`);}
    claimVictory(gameId:string,claimType:VictoryClaimType):Observable<VictoryClaimResult>{return this.http.post<VictoryClaimResult>(`${this.gamesUrl}/${gameId}/actions/claim-victory`,{claimType});}
    victoryClaimReveal(gameId:string):Observable<VictoryClaimReveal>{return this.http.get<VictoryClaimReveal>(`${this.gamesUrl}/${gameId}/victory-claim-reveal`);}

    myHand(gameId: string): Observable<PrivateHandDto['cards']> { return this.http.get<PrivateHandDto['cards']>(`${this.gamesUrl}/${gameId}/my-hand`); }
    leave(gameId: string): Observable<unknown> { return this.http.post(`${this.gamesUrl}/${gameId}/leave`, {}); }
    abandon(gameId: string): Observable<GameStateDto> { return this.http.post<GameStateDto>(`${this.gamesUrl}/${gameId}/abandon`, {}); }
    ready(gameId: string): Observable<unknown> { return this.http.post(`${this.gamesUrl}/${gameId}/ready`, {}); }
    automation(gameId: string, enabled: boolean): Observable<GameStateDto> {
        return this.http.patch<GameStateDto>(`${this.gamesUrl}/${gameId}/automation`, { enabled });
    }
    start(gameId: string): Observable<unknown> { return this.http.post(`${this.gamesUrl}/${gameId}/start`, {}); }
    kick(gameId: string, gamePlayerId: string): Observable<unknown> { return this.http.delete(`${this.gamesUrl}/${gameId}/players/${gamePlayerId}`); }
    terres(): Observable<TerreDto[]> { return this.http.get<TerreDto[]>(`${environment.apiBaseUrl}/api/terres`); }
    createTerre(command: CreateTerre): Observable<TerreDto> { return this.http.post<TerreDto>(`${environment.apiBaseUrl}/api/terres`, command); }
    replay(gameId: string): Observable<GameReplayDto> { return this.http.get<GameReplayDto>(`${this.gamesUrl}/${gameId}/replay`); }
    private locationHeaders(location?:PlayerLocation):Record<string,string>{return location?{'X-Player-Latitude':String(location.latitude),'X-Player-Longitude':String(location.longitude)}:{};}
}
