import {CommonModule} from '@angular/common';
import {Component,Input} from '@angular/core';
import {IonicModule,ModalController,ToastController} from '@ionic/angular';
import {CampaignApiService,PlayerCampaignBadge} from '../../core/campaign-api.service';
import {PlayerProfileView,SocialApiService} from '../../core/social-api.service';
import {Router,RouterModule} from '@angular/router';
import {environment} from '../../../environments/environment';

@Component({selector:'app-player-profile-modal',standalone:true,imports:[CommonModule,IonicModule,RouterModule],templateUrl:'./player-profile-modal.component.html',styleUrls:['./player-profile-modal.component.scss']})
export class PlayerProfileModalComponent{
 @Input()profile!:PlayerProfileView;
 busy=false;
 constructor(private modal:ModalController,private social:SocialApiService,private campaigns:CampaignApiService,private toast:ToastController,private router:Router){}
 get total(){return(this.profile?.wins||0)+(this.profile?.losses||0)+(this.profile?.draws||0)}
 get winRate(){return this.total?Math.round(this.profile.wins*1000/this.total)/10:0}
 get lossRate(){return this.total?Math.round(this.profile.losses*1000/this.total)/10:0}
 get rankLabel(){const r=this.profile?.rating||0;return r>=2800?'Diamant':r>=2400?'Or III':r>=2000?'Argent': 'Bronze'}
 get isEducationalBot(){return this.profile?.userType==='AUTOMATIC'}
 get canAdd(){return !this.isEducationalBot&&(this.profile?.friendshipStatus==='NONE'||this.profile?.friendshipStatus==='DECLINED')}
 get campaignBadges(){const groups=new Map<string,PlayerCampaignBadge[]>();for(const badge of this.profile?.badges||[])groups.set(badge.gameType,[...(groups.get(badge.gameType)||[]),badge]);return [...groups.entries()].map(([gameType,badges])=>{const ordered=[...badges].sort((a,b)=>b.level-a.level);return {gameType,name:this.gameName(gameType),badge:ordered[0],completed:badges.length,stars:badges.reduce((sum,badge)=>sum+(badge.stars||0),0)}})}
 get badgeStars(){return(this.profile?.badges||[]).reduce((sum,badge)=>sum+(badge.stars||0),0)}
 flag(code?:string){return(code||'').toUpperCase().replace(/./g,c=>String.fromCodePoint(127397+c.charCodeAt(0)))}
 close(){void this.modal.dismiss()}
 openProfile(){const profile=this.profile;void this.modal.dismiss().then(()=>this.router.navigate(['/players'],{queryParams:{userId:profile.userId,username:profile.username,avatarUrl:profile.avatarUrl}}))}
 addFriend(){if(!this.canAdd||this.busy)return;this.busy=true;this.social.request(this.profile.username).subscribe({next:async()=>{this.busy=false;await this.notice('Demande d’ami envoyée');await this.modal.dismiss({friendRequested:true})},error:async e=>{this.busy=false;await this.notice(e?.error?.message||'Impossible d’ajouter ce joueur.')}})}
 private async notice(message:string){const t=await this.toast.create({message,duration:2400,position:'top',color:'danger'});await t.present()}
 badgeUrl(levelId:string){return this.campaigns.badgeUrl(levelId)}
 gameName(type:string){return type==='FAFAP'?'FapFap':type==='UNO'?'UNO':type==='CHECK_GAMES'?'Tcheck Game':'Cochon Gratté'}
 guildImage(path?:string){return path?.startsWith('http')?path:`${environment.apiBaseUrl}${path||''}`}
}
