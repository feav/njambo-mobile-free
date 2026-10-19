import{Injectable}from'@angular/core';import{HttpClient}from'@angular/common/http';import{environment}from'../../environments/environment';import{GameType}from'./game-realtime/game-api.service';
export interface CampaignLevel{id:string;sequenceOrder:number;worldName:string;tierName:string;gameType:GameType;totalPlayers:number;educationalBotCount:number;difficulty:number;pointsReward:number;description:string;objectiveType:'WIN'|'WIN_WITH_KORAT';sceneKey:string;mapImageUrl:string;unlocked:boolean;completed:boolean;stars:number;hasBadge:boolean}
export interface CampaignState{levels:CampaignLevel[];points:number;completedLevelsCount:number;goldThemeUnlocked:boolean;inProgressGameId?:string}
export interface CampaignStartResult{gameId:string}
export interface PlayerGameExperience{gameType:string;name:string;xp:number}
export interface PlayerExperience{totalXp:number;games:PlayerGameExperience[];rankedXpThreshold?:number;lowExperienceOverrideEnabled?:boolean}
export interface CampaignGameContext{levelId:string;worldName:string;tierName:string;sequenceOrder:number;status:'IN_PROGRESS'|'WON'|'LOST';pointsReward:number;alreadyRewarded:boolean}
export interface PlayerCampaignBadge{levelId:string;gameType:GameType;worldName:string;tierName:string;level:number;stars:number}
@Injectable({providedIn:'root'})export class CampaignApiService{
  private url=`${environment.apiBaseUrl}/api/campaign`;
  constructor(private http:HttpClient){}
  state(){return this.http.get<CampaignState>(this.url)}
  experience(){return this.http.get<PlayerExperience>(`${this.url}/experience`)}
  start(levelId:string){return this.http.post<CampaignStartResult>(`${this.url}/levels/${levelId}/start`,{})}
  gameContext(gameId:string){return this.http.get<CampaignGameContext>(`${this.url}/games/${gameId}`)}
  badgeUrl(levelId:string){return `${this.url}/levels/${levelId}/badge`}
  playerBadges(userId:string){return this.http.get<PlayerCampaignBadge[]>(`${this.url}/users/${userId}/badges`)}
}
