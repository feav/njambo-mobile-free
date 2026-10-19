import {Component,OnDestroy,OnInit} from '@angular/core';
import {ActivatedRoute,Router} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {AlertController} from '@ionic/angular';
import {Subscription} from 'rxjs';
import {environment} from '../../environments/environment';
import {GameApiService} from '../core/game-realtime/game-api.service';
import {GameSoundService} from '../core/game-sound.service';
import {VictoryCelebrationService} from '../core/victory-celebration.service';
import {CochonRealtimeService} from './cochon-realtime.service';
import {CardThemeService} from '../core/card-theme.service';
import {ChampionshipFlowService} from '../core/championship-flow.service';
import {CampaignFlowService} from '../core/campaign-flow.service';
import {SpectatorResultService} from '../core/spectator-result.service';

type Phase='SELECTING'|'CARDS_CENTER'|'TRANSFERRING'|'FINAL_REVEAL';
interface Card{id:string;rank:string;locked:boolean}
interface Player{gamePlayerId:string;userId:string;username:string;avatarUrl:string;countryCode?:string;seatNumber:number;selected:boolean;cardCount:number;automaticMode:boolean}
interface Choice{cardId:string;fromPlayerId:string;toPlayerId:string}
interface RevealedHand{playerId:string;cards:Card[]}
interface State{gameId:string;status:string;myPlayerId:string;currentPlayerId?:string;round:number;phase:Phase;deadline?:string;phaseEndsAt?:string;players:Player[];hand:Card[];tableChoices:Choice[];revealedHands:RevealedHand[];winnerPlayerIds:string[];rematchGameId?:string;meAutomaticMode:boolean}
interface Point{x:number;y:number}

@Component({
  selector: 'app-cochon-game-board',
  templateUrl: './cochon-game-board.page.html',
  styleUrls: ['./cochon-game-board.page.scss'],
  standalone: false
})
export class CochonGameBoardPage implements OnInit, OnDestroy {
  readonly backImage='assets/images/cards/green_back.png';
  id='';state?:State;busy=false;message='';socketConnected=false;automationEnabled=false;spectating=false;spectatorCount=0;private subscriptions=new Subscription();private resultShown=false;private resultTimer?:number;private soundInitialized=false;private pendingSelectedCardId?:string;private automaticModeOverride:boolean|null=null;private automationOverrideTimer?:number;
  get displayAutomaticMode(){return this.automaticModeOverride??this.automationEnabled;}
  constructor(private route:ActivatedRoute,private router:Router,private http:HttpClient,private games:GameApiService,private sounds:GameSoundService,private alerts:AlertController,private celebration:VictoryCelebrationService,private realtime:CochonRealtimeService,private cardTheme:CardThemeService,private championshipFlow:ChampionshipFlowService,private campaignFlow:CampaignFlowService,private spectatorResults:SpectatorResultService){}
  ngOnInit(){this.subscriptions.add(this.realtime.state$.subscribe(value=>{const state=value as State;if(state?.gameId===this.id){this.applyState(state);this.message='';}}));this.subscriptions.add(this.realtime.connected$.subscribe(value=>this.socketConnected=value));this.subscriptions.add(this.realtime.errors$.subscribe(message=>this.message=message));this.subscriptions.add(this.realtime.spectatorCount$.subscribe(count=>this.spectatorCount=count));this.subscriptions.add(this.route.queryParamMap.subscribe(params=>{const nextId=params.get('gameId')||'';if(!nextId){void this.router.navigate(['/home']);return;}this.spectating=params.get('spectate')==='1';if(nextId!==this.id)this.openGame(nextId);}));}
  private openGame(gameId:string){this.realtime.disconnect();this.celebration.stop();if(this.resultTimer)window.clearTimeout(this.resultTimer);this.id=gameId;this.state=undefined;this.busy=false;this.message='';this.automationEnabled=false;this.automaticModeOverride=null;if(this.automationOverrideTimer)window.clearTimeout(this.automationOverrideTimer);this.resultShown=false;this.soundInitialized=false;this.pendingSelectedCardId=undefined;this.games.metadata(gameId).subscribe(m=>{if(this.id!==gameId)return;if(m.gameType!=='COCHON_GRATTE')void this.router.navigate([m.boardRoute],{queryParams:{gameId,...(this.spectating?{spectate:'1'}:{})},replaceUrl:true});else{if(this.spectating)this.http.get<State>(`${environment.apiBaseUrl}/api/games/${gameId}/cochon/spectate`).subscribe({next:s=>this.applyState(s),error:()=>void this.router.navigate(['/home'])});this.realtime.connect(gameId,this.spectating);}});}
  ionViewWillLeave(){this.sounds.stopMusic();this.cleanupGame();}
  private cleanupGame(){this.realtime.disconnect();this.celebration.stop();if(this.resultTimer)window.clearTimeout(this.resultTimer);if(this.automationOverrideTimer)window.clearTimeout(this.automationOverrideTimer);this.resultTimer=undefined;this.automationOverrideTimer=undefined;this.id='';this.state=undefined;this.busy=false;this.pendingSelectedCardId=undefined;}
  ngOnDestroy(){this.subscriptions.unsubscribe();this.realtime.disconnect();this.sounds.stopMusic();if(this.resultTimer)window.clearTimeout(this.resultTimer);if(this.automationOverrideTimer)window.clearTimeout(this.automationOverrideTimer);this.celebration.stop();}
  select(card:Card){if(card.locked||this.spectating||this.busy||!this.isMyTurn||this.me?.selected||this.state?.status!=='IN_PROGRESS'||this.state.phase!=='SELECTING')return;this.sounds.selection();this.busy=true;this.pendingSelectedCardId=card.id;this.http.post(`${environment.apiBaseUrl}/api/games/${this.id}/cochon/actions/select`,{cardId:card.id}).subscribe({next:()=>{this.busy=false;this.message='';},error:e=>{this.busy=false;this.pendingSelectedCardId=undefined;this.message=e?.error?.message||'Action impossible';}});}
  automation(){if(this.spectating)return;const enabled=!this.displayAutomaticMode;this.automaticModeOverride=enabled;this.http.patch(`${environment.apiBaseUrl}/api/games/${this.id}/automation`,{enabled}).subscribe({next:()=>{this.automationEnabled=enabled;if(this.automationOverrideTimer)window.clearTimeout(this.automationOverrideTimer);this.automationOverrideTimer=window.setTimeout(()=>this.automaticModeOverride=null,1500);if(enabled)void this.showAutomaticModeNotice();},error:e=>{this.automaticModeOverride=null;this.message=e?.error?.message||'Mode automatique indisponible';}});}
  private async showAutomaticModeNotice(){const alert=await this.alerts.create({cssClass:'fafap-game-alert automation-notice',header:'Mode automatique activé',message:'Après une longue inactivité ou une activation volontaire, vous êtes passé en mode automatique.',backdropDismiss:false,buttons:[{text:'Revenir au mode manuel',cssClass:'game-alert-primary',handler:()=>{this.http.patch(`${environment.apiBaseUrl}/api/games/${this.id}/automation`,{enabled:false}).subscribe({error:e=>{this.message=e?.error?.message||'Impossible de revenir au mode manuel pour le moment';}});}}]});await alert.present();}
  async ready(){if(this.spectating)return;void this.sounds.unlock();this.simple('ready')}async start(){if(this.spectating)return;void this.sounds.unlock();this.simple('start')}
  goToGames(){void this.router.navigate(['/search']);}
  rematch(){if(this.busy)return;this.busy=true;this.games.joinRematch(this.id).subscribe({next:game=>{this.busy=false;void this.router.navigate(['/games/cochon-gratte'],{queryParams:{gameId:game.gameId},replaceUrl:true});},error:e=>{this.busy=false;this.message=e?.error?.message||'Revanche indisponible';}});}
  private applyState(next:State){next.phase||='SELECTING';next.tableChoices||=[];next.revealedHands||=[];next.winnerPlayerIds||=[];this.automationEnabled=next.meAutomaticMode===true;const previous=this.state;if(next.phase==='SELECTING'&&next.round!==previous?.round)this.pendingSelectedCardId=undefined;this.state=next;if(next.status==='IN_PROGRESS')this.sounds.startAmbientMusic('COCHON');if(!this.soundInitialized){this.soundInitialized=true;if(next.status==='IN_PROGRESS'&&next.round===1&&next.tableChoices.length===0)this.sounds.start();if(next.phase==='FINAL_REVEAL')this.scheduleResult(next);return;}if(previous?.phase!==next.phase){if(next.phase==='CARDS_CENTER')this.sounds.card('COCHON');if(next.phase==='TRANSFERRING')this.sounds.card('COCHON');if(next.phase==='SELECTING'&&next.round!==previous?.round){this.sounds.draw();this.sounds.turn();if(next.currentPlayerId===next.myPlayerId)this.sounds.specialCue();}if(next.phase==='FINAL_REVEAL'){if(next.revealedHands.some(hand=>hand.cards.length>=4))this.sounds.specialCue();this.scheduleResult(next);}}}
  private scheduleResult(state:State){if(this.resultShown)return;if(this.resultTimer)window.clearTimeout(this.resultTimer);const wait=Math.max(0,new Date(state.phaseEndsAt||Date.now()).getTime()-Date.now());this.resultTimer=window.setTimeout(()=>void this.showResult(state),wait);}
  private async showSpectatorResult(state:State){await this.spectatorResults.present(state.gameId,state.players,state.winnerPlayerIds);}
  private async showResult(state:State){if(this.resultShown)return;this.resultShown=true;if(this.spectating){await this.showSpectatorResult(state);return;}const won=state.winnerPlayerIds.includes(state.myPlayerId);this.sounds.result(won);const campaign=await this.campaignFlow.checkGame(state.gameId);if(campaign){if(won)this.celebration.start();await this.campaignFlow.presentResult(campaign);return;}const championship=await this.championshipFlow.afterGame(state.gameId);if(championship?.nextGameId){if(won)this.celebration.start();await this.championshipFlow.presentMancheTransition(championship,won);return;}const buttons=championship?[{text:'Retourner au championnat',cssClass:'game-alert-cancel',handler:()=>void this.championshipFlow.returnToChampionship(championship)}]:[{text:'Rejouer',cssClass:'game-alert-replay',handler:()=>this.rematch()},{text:'Parties',cssClass:'game-alert-cancel',handler:()=>void this.router.navigate(['/search'])},{text:'Campagne',cssClass:'game-alert-campaign',handler:()=>void this.router.navigate(['/campaign'])},{text:'Championnat',cssClass:'game-alert-championship',handler:()=>void this.router.navigate(['/championships'])}];const alert=await this.alerts.create({cssClass:championship?`fafap-game-alert championship-result-alert ${won?'manche-won':'manche-lost'}`:`fafap-game-alert game-result-alert ${won?'game-result-winner':'game-result-loser'}`,header:championship?(won?'Duel remporté !':'Duel perdu'):undefined,message:championship?this.championshipFlow.finalMessage(championship,won):'\u00a0',backdropDismiss:true,buttons});await alert.present();if(won){this.celebration.start();void alert.onDidDismiss().then(()=>this.celebration.stop());}if(championship)this.championshipFlow.scheduleAutoReturn(championship,alert);}
  private simple(action:string){this.http.post(`${environment.apiBaseUrl}/api/games/${this.id}/${action}`,{}).subscribe({error:e=>this.message=e?.error?.message||'Action impossible'});}
  get me(){return this.state?.players.find(player=>player.gamePlayerId===this.state?.myPlayerId)}
  get opponents(){return this.state?.players.filter(player=>player.gamePlayerId!==this.state?.myPlayerId)||[]}
  visibleBacks(player:Player){return Array.from({length:Math.min(5,Math.max(0,player.cardCount))});}
  extraCards(player:Player){return Math.max(0,player.cardCount-5);}
  get visibleHand(){return(this.state?.hand||[]).filter(card=>card.id!==this.pendingSelectedCardId&&!this.isChosen(card)).sort((a,b)=>this.rankValue(a.rank)-this.rankValue(b.rank))}private rankValue(rank:string){const numeric=Number(rank);if(Number.isFinite(numeric))return numeric;return {J:11,Q:12,K:13,A:14,JOKER:99}[rank]??100;}
  get isMyTurn(){return this.state?.phase==='SELECTING'&&this.state?.currentPlayerId===this.state?.myPlayerId}
  get currentPlayer(){return this.state?.players.find(player=>player.gamePlayerId===this.state?.currentPlayerId)}
  get ceremonyLabel(){switch(this.state?.phase){case'CARDS_CENTER':return'La carte choisie est verrouillée…';case'TRANSFERRING':return'La carte passe au joueur suivant !';case'FINAL_REVEAL':return'Révélation des mains';default:return this.isMyTurn?'À vous : donnez une carte parmi vos cinq cartes':`${this.currentPlayer?.username||'Le joueur suivant'} choisit la carte à donner…`;}}
  get revealSeconds(){return Math.max(0,Math.ceil((new Date(this.state?.phaseEndsAt||Date.now()).getTime()-Date.now())/1000));}
  playerStyle(index:number,total:number){const point=this.opponentPoint(index,total);return{left:`${point.x}%`,top:`${point.y}%`};}
  exchangeStyle(choice:Choice){const from=this.point(choice.fromPlayerId),to=this.point(choice.toPlayerId),fromCenter=this.inner(from),toCenter=this.inner(to);const transferring=this.state?.phase==='TRANSFERRING';const start=transferring?fromCenter:from,end=transferring?toCenter:fromCenter;return{'--start-x':`${start.x}%`,'--start-y':`${start.y}%`,'--end-x':`${end.x}%`,'--end-y':`${end.y}%`};}
  playerFor(id:string){return this.state?.players.find(player=>player.gamePlayerId===id)}
  revealedFor(id:string){return this.state?.revealedHands.find(hand=>hand.playerId===id)?.cards||[]}
  isWinner(id:string){return this.state?.winnerPlayerIds.includes(id)}
  isChosen(card:Card){return this.state?.tableChoices.some(choice=>choice.fromPlayerId===this.state?.myPlayerId&&choice.cardId===card.id)}
  handCardTransform(index:number,total:number){const center=(total-1)/2;const offset=index-center;return`translateY(${Math.abs(offset)*2}px) rotate(${offset*5}deg)`;}
  cardImage(card:Card){return card.rank==='JOKER'?this.cardTheme.joker('BLACK'):this.cardTheme.card(card.rank,'S');}
  trackCard(_index:number,card:Card){return card.id}
  trackChoice(_index:number,choice:Choice){return choice.cardId}
  trackPlayer(_index:number,player:Player){return player.gamePlayerId}
  private point(playerId:string):Point{if(playerId===this.state?.myPlayerId)return{x:90,y:82};const index=Math.max(0,this.opponents.findIndex(player=>player.gamePlayerId===playerId));return this.opponentPoint(index,this.opponents.length);}
  private opponentPoint(index:number,total:number):Point{const angle=(205+(130/Math.max(total-1,1))*index)*Math.PI/180;return{x:50+42*Math.cos(angle),y:50+42*Math.sin(angle)};}
  private inner(point:Point):Point{return{x:50+(point.x-50)*.58,y:50+(point.y-50)*.58};}
}
