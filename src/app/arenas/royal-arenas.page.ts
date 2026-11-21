import{Component,OnDestroy,OnInit}from'@angular/core';
import{Router}from'@angular/router';
import{ToastController}from'@ionic/angular';
import{Subscription}from'rxjs';
import{GameType}from'../core/game-realtime/game-api.service';
import{AuthService}from'../core/auth.service';
import{RoyalArenaApiService,RoyalArenaDetail,RoyalArenaMatch,RoyalArenaParticipant,RoyalArenaSummary}from'../core/royal-arena-api.service';

@Component({standalone:false,selector:'app-royal-arenas',templateUrl:'./royal-arenas.page.html',styleUrls:['./royal-arenas.page.scss','./royal-arenas-tabs.scss']})
export class RoyalArenasPage implements OnInit,OnDestroy{
  arenas:RoyalArenaSummary[]=[];detail?:RoyalArenaDetail;loading=true;creating=false;busy=false;activeTab:'all'|'current'|'past'='all';detailTab:'mine'|'players'='mine';now=Date.now();private poll?:number;private subscriptions=new Subscription();
  form={name:'Arène Royale',gameType:'FAFAP' as GameType,entryFee:1000,matchStake:100,maxParticipants:null as number|null,durationMinutes:120,startsAt:this.localDateTime(new Date(Date.now()+3600000))};
  constructor(private api:RoyalArenaApiService,private router:Router,private toast:ToastController,public auth:AuthService){}
  ngOnInit(){this.reload();this.poll=window.setInterval(()=>{this.now=Date.now();this.reload(false);if(this.detail)this.open(this.detail.arena.id,false);},5000);}
  ngOnDestroy(){if(this.poll)window.clearInterval(this.poll);this.subscriptions.unsubscribe();}
  get filtered(){return this.arenas.filter(a=>this.activeTab==='all'?a.status==='REGISTRATION':this.activeTab==='current'?a.status==='IN_PROGRESS':a.status==='FINISHED'||a.status==='CANCELLED');}
  get myParticipant(){const id=this.auth.currentUser()?.id;return this.detail?.participants.find(p=>p.userId===id);}
  get myMatch(){return this.detail?.matches.find(m=>m.status==='RUNNING'&&(m.participantOneId===this.myParticipant?.id||m.participantTwoId===this.myParticipant?.id));}
  get displayedMatch(){return this.detailTab==='mine'?this.myMatch:undefined;}
  reload(showLoading=true){if(showLoading)this.loading=true;this.api.list().subscribe({next:v=>{this.arenas=v;this.loading=false;},error:()=>this.loading=false});}
  open(id:string,showLoading=true){if(showLoading){this.detail=undefined;this.detailTab='mine';}this.api.get(id).subscribe({next:v=>{this.detail=v;this.loading=false;},error:()=>this.loading=false});}
  create(){if(this.busy||this.form.entryFee<=0||this.form.matchStake<=0||this.form.matchStake>=this.form.entryFee||this.form.durationMinutes<10||!this.form.startsAt)return;this.busy=true;this.api.create({...this.form,startsAt:new Date(this.form.startsAt).toISOString(),maxParticipants:this.form.maxParticipants||undefined}).subscribe({next:v=>{this.busy=false;this.creating=false;this.detail=v;this.reload(false);void this.notice('Arène Royale créée');},error:e=>{this.busy=false;void this.notice(this.message(e));}});}
  join(){const a=this.detail?.arena;if(!a||this.busy)return;this.busy=true;this.api.join(a.id).subscribe({next:v=>{this.detail=v;this.reload(false);},error:e=>{this.busy=false;void this.notice(this.message(e));},complete:()=>this.busy=false});}
  leave(){const a=this.detail?.arena;if(!a||this.busy)return;this.busy=true;this.api.leave(a.id).subscribe({next:v=>{this.detail=v;this.reload(false);},error:e=>{this.busy=false;void this.notice(this.message(e));},complete:()=>this.busy=false});}
  abandon(){const a=this.detail?.arena;if(!a||this.busy)return;this.busy=true;this.api.abandon(a.id).subscribe({next:v=>{this.detail=v;this.reload(false);},error:e=>{this.busy=false;void this.notice(this.message(e));},complete:()=>this.busy=false});}
  cancel(){const a=this.detail?.arena;if(!a||this.busy)return;this.busy=true;this.api.cancel(a.id).subscribe({next:v=>{this.detail=v;this.reload(false);},error:e=>{this.busy=false;void this.notice(this.message(e));},complete:()=>this.busy=false});}
  ready(){const gameId=this.myMatch?.gameId;if(!gameId)return;this.busy=true;this.api.ready(gameId).subscribe({next:()=>{this.busy=false;this.openGame(gameId);},error:e=>{this.busy=false;void this.notice(this.message(e));}});}
  openGame(gameId?:string){if(!gameId)return;const type=this.detail?.arena.gameType;const route=type==='UNO'?'/games/uno':type==='CHECK_GAMES'?'/games/check-games':type==='COCHON_GRATTE'?'/games/cochon-gratte':type==='TCHIA_DIRECT'||type==='TCHIA_IMPOT'?'/games/21-direct':type==='TCHIA_GARAME'?'/games/21-garame':type==='PRESIDENT'?'/games/tcheck':'/game-board';void this.router.navigate([route],{queryParams:{gameId}});}
  hasReady(m:RoyalArenaMatch,p:RoyalArenaParticipant){return m.participantOneId===p.id?!!m.participantOneReadyAt:!!m.participantTwoReadyAt;}
  playerName(id:string){return this.detail?.participants.find(p=>p.id===id)?.username||'Joueur';}
  isMyMatch(m:RoyalArenaMatch){return m.participantOneId===this.myParticipant?.id||m.participantTwoId===this.myParticipant?.id;}
  winnerName(id?:string){return this.detail?.participants.find(p=>p.userId===id)?.username||'—';}
  statusLabel(p:RoyalArenaParticipant){return p.status==='PLAYING'?'En partie':p.status==='QUEUED'?(this.detail?.arena.status==='REGISTRATION'?'Inscrit · départ à venir':'En attente de match'):p.status==='ELIMINATED'?'Éliminé':p.status==='PAID_OUT'?'Remboursé':p.status==='ABANDONED'?'A abandonné':'Inscrit';}
  gameName(t:GameType){return t==='FAFAP'?'FapFap':t==='UNO'?'UNO':t==='PRESIDENT'?'Président':t==='COCHON_GRATTE'?'Cochon Gratté':t==='CHECK_GAMES'?'Tcheck Game':t==='TCHIA_DIRECT'?'21 Direct':t==='TCHIA_IMPOT'?'21 Impôt':'21 Garamé';}
  statusName(s:string){return s==='REGISTRATION'?'Inscriptions ouvertes':s==='IN_PROGRESS'?'En cours':s==='FINISHED'?'Terminée':'Annulée';}
  date(value:string){return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
  countdown(value:string){const seconds=Math.max(0,Math.floor((new Date(value).getTime()-this.now)/1000));if(seconds===0)return'Bientôt';const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60);return h?`${h} h ${m} min`:`${m} min`;}
  rank(index:number){return index+1;}
  isFull(a:RoyalArenaSummary){return a.maxParticipants!=null&&a.participantCount>=a.maxParticipants;}
  private localDateTime(d:Date){const o=d.getTimezoneOffset()*60000;return new Date(d.getTime()-o).toISOString().slice(0,16);}
  private async notice(message:string){const t=await this.toast.create({message,duration:2600,position:'top'});await t.present();}
  private message(e:any){return e?.error?.message||e?.error?.code||'Une erreur est survenue.';}
}
