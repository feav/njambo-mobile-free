import{Component,OnInit}from'@angular/core';
import{ActivatedRoute}from'@angular/router';
import{AlertController}from'@ionic/angular';
import{SocialApiService,FriendGameRow,PlayerProfileView}from'../core/social-api.service';import{environment}from'../../environments/environment';
import{GameBoardNavigationService}from'../core/game-board-navigation.service';
import{GameApiService,GameType}from'../core/game-realtime/game-api.service';
import{RankedLocationService}from'../core/ranked-location.service';
import{CampaignApiService,PlayerCampaignBadge}from'../core/campaign-api.service';

@Component({standalone:false,selector:'app-player-profile',templateUrl:'./player-profile.page.html',styleUrls:['./player-profile.page.scss']})
export class PlayerProfilePage implements OnInit{
  userId='';username='Joueur';avatarUrl='';games:FriendGameRow[]=[];profile?:PlayerProfileView;loading=true;
  constructor(private route:ActivatedRoute,private social:SocialApiService,private navigation:GameBoardNavigationService,private gamesApi:GameApiService,private alerts:AlertController,private rankedLocation:RankedLocationService,private campaigns:CampaignApiService){}
  ngOnInit(){this.userId=this.route.snapshot.queryParamMap.get('userId')||'';this.username=this.route.snapshot.queryParamMap.get('username')||this.username;this.avatarUrl=this.route.snapshot.queryParamMap.get('avatarUrl')||'';this.reload();}
  ionViewWillEnter(){this.reload();}
  reload(){if(!this.userId)return;this.loading=true;this.social.profile(this.userId).subscribe({next:p=>{this.profile=p;this.username=p.username;this.avatarUrl=p.avatarUrl},error:()=>undefined});this.social.friendGames(this.userId).subscribe({next:v=>{this.games=v;this.loading=false},error:()=>this.loading=false});}
  guildImage(path?:string){return path?.startsWith('http')?path:`${environment.apiBaseUrl}${path||''}`}
  spectate(game:FriendGameRow){void this.navigation.open(game.gameId,false,true);}
  async join(game:FriendGameRow){const password=game.accessType==='PRIVATE'?await this.askPassword():undefined;if(game.accessType==='PRIVATE'&&password===null)return;const location=await this.rankedLocation.capture(game.stakeAmount);if(location===null)return;this.gamesApi.join(game.gameId,password??undefined,location).subscribe({next:()=>void this.navigation.open(game.gameId),error:e=>void this.showError(e?.error?.message||'Impossible de rejoindre cette partie.')});}
  canJoin(game:FriendGameRow){return game.status==='WAITING_FOR_PLAYERS'}
  canSpectate(game:FriendGameRow){return['STARTING','IN_PROGRESS','SETTLING'].includes(game.status)}
  trackGame(_index:number,game:FriendGameRow){return game.gameId;}
  gameName(type:GameType){return type==='FAFAP'?'FapFap':type==='PRESIDENT'?'Président':type==='UNO'?'UNO':type==='CHECK_GAMES'?'Tcheck Game':type==='COCHON_GRATTE'?'Cochon Gratté':type==='TCHIA_DIRECT'?'Tchia Direct':type==='TCHIA_IMPOT'?'Tchia Impôt':'Tchia Garame';}
  get campaignBadges(){const groups=new Map<string,PlayerCampaignBadge[]>();for(const badge of this.profile?.badges||[])groups.set(badge.gameType,[...(groups.get(badge.gameType)||[]),badge]);return [...groups.entries()].map(([gameType,badges])=>{const ordered=[...badges].sort((a,b)=>b.level-a.level);return{gameType,name:this.gameName(gameType as GameType),badge:ordered[0],completed:badges.length,stars:badges.reduce((sum,badge)=>sum+(badge.stars||0),0)}})}
  get badgeStars(){return(this.profile?.badges||[]).reduce((sum,badge)=>sum+(badge.stars||0),0)}
  badgeUrl(levelId:string){return this.campaigns.badgeUrl(levelId)}
  winRate(){const p=this.profile;return p&&p.gamesPlayed?Math.round(p.wins/p.gamesPlayed*1000)/10:0;}
  memberSince(){return this.profile?.registeredAt;}
  statusLabel(status:string){return status==='IN_PROGRESS'?'En cours':status==='SETTLING'?'Se termine…':status==='WAITING_FOR_PLAYERS'?'En attente de joueurs':'Sur le point de commencer';}
  private async askPassword(){const alert=await this.alerts.create({cssClass:'fafap-game-alert',header:'Partie privée',subHeader:'Mot de passe requis',inputs:[{name:'password',type:'password',placeholder:'Mot de passe',attributes:{autocomplete:'current-password'}}],buttons:[{text:'Annuler',role:'cancel'},{text:'Rejoindre',role:'confirm'}]});await alert.present();const result=await alert.onDidDismiss();return result.role==='confirm'?String(result.data?.values?.password||''):null;}
  private async showError(message:string){const alert=await this.alerts.create({cssClass:'fafap-game-alert',header:'Partie inaccessible',message,buttons:['Fermer']});await alert.present();}
}
