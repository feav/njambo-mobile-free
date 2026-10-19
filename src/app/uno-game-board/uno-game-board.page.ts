import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { GameApiService, GameMetadata } from '../core/game-realtime/game-api.service';
import { GameSoundService } from '../core/game-sound.service';
import { VictoryCelebrationService } from '../core/victory-celebration.service';
import { AlertController } from '@ionic/angular';
import { UnoRealtimeService } from './uno-realtime.service';
import {ChampionshipFlowService} from '../core/championship-flow.service';
import {CampaignFlowService} from '../core/campaign-flow.service';
import {SpectatorResultService} from '../core/spectator-result.service';

type Color='RED'|'YELLOW'|'GREEN'|'BLUE'|'WILD';
type Effect='NUMBER'|'SKIP'|'REVERSE'|'DRAW_TWO'|'WILD'|'WILD_DRAW_FOUR';
interface Card{id:string;color:Color;effect:Effect;number?:number}
interface Player{gamePlayerId:string;userId:string;username:string;avatarUrl:string;countryCode?:string;seatNumber:number;cardCount:number;current:boolean;automaticMode:boolean}
interface State{gameId:string;status:string;meGamePlayerId:string;currentPlayerId?:string;currentTurnDeadline?:string;activeColor?:Color;direction:number;players:Player[];hand:Card[];topCard?:Card;discardCards:Card[];drawPileCount:number;unoDeclaredPlayerId?:string;winnerPlayerId?:string;rematchGameId?:string;meAutomaticMode:boolean}
interface CardFlight{id:number;tx:string;ty:string;delay:number;duration:number}

@Component({standalone:false,selector:'app-uno-game-board',templateUrl:'./uno-game-board.page.html',styleUrls:['./uno-game-board.page.scss']})
export class UnoGameBoardPage implements OnInit,OnDestroy{
  metadata?:GameMetadata;state?:State;busy=false;message='';wild?:Card;flights:CardFlight[]=[];automationEnabled=false;spectating=false;spectatorCount=0;unoCallout?:string;calloutWord:'UNO'|'+2'|'+4'='UNO';
  private calloutTimer?:number;
  private lastPenaltyAlert='';
  private automaticModeOverride:boolean|null=null;
  get displayAutomaticMode(){return this.automaticModeOverride??this.automationEnabled;}
  private id='';private subscriptions=new Subscription();private soundInitialized=false;private flightSequence=0;private flightTimer?:number;private resultShown=false;private automationOverrideTimer?:number;private staleCheckTimer?:number;private lastResyncedDeadline='';
  constructor(private route:ActivatedRoute,private router:Router,private games:GameApiService,private http:HttpClient,private sounds:GameSoundService,private alerts:AlertController,private celebration:VictoryCelebrationService,private realtime:UnoRealtimeService,private championshipFlow:ChampionshipFlowService,private campaignFlow:CampaignFlowService,private spectatorResults:SpectatorResultService){}
  ngOnInit(){this.subscriptions.add(this.realtime.state$.subscribe(value=>{const state=value as State;if(state?.gameId===this.id){this.applyState(state);this.message='';}}));this.subscriptions.add(this.realtime.errors$.subscribe(message=>this.message=message));this.subscriptions.add(this.realtime.spectatorCount$.subscribe(count=>this.spectatorCount=count));this.subscriptions.add(this.route.queryParamMap.subscribe(params=>{const nextId=params.get('gameId')||'';if(!nextId){void this.router.navigate(['/home']);return;}this.spectating=params.get('spectate')==='1';if(nextId!==this.id)this.openGame(nextId);}));this.staleCheckTimer=window.setInterval(()=>this.checkStaleState(),4000);}
  private openGame(gameId:string){this.realtime.disconnect();this.celebration.stop();if(this.flightTimer)window.clearTimeout(this.flightTimer);this.id=gameId;this.metadata=undefined;this.state=undefined;this.busy=false;this.message='';this.wild=undefined;this.flights=[];this.automationEnabled=false;this.automaticModeOverride=null;if(this.automationOverrideTimer)window.clearTimeout(this.automationOverrideTimer);this.lastResyncedDeadline='';this.unoCallout=undefined;this.calloutWord='UNO';this.lastPenaltyAlert='';if(this.calloutTimer)window.clearTimeout(this.calloutTimer);this.soundInitialized=false;this.resultShown=false;this.games.metadata(gameId).subscribe({next:m=>{if(this.id!==gameId)return;if(m.gameType!=='UNO')void this.router.navigate([m.boardRoute],{queryParams:{gameId,...(this.spectating?{spectate:'1'}:{})},replaceUrl:true});else{this.metadata=m;if(this.spectating)this.http.get<State>(`${environment.apiBaseUrl}/api/games/${gameId}/uno/spectate`).subscribe({next:s=>this.applyState(s),error:()=>void this.router.navigate(['/home'])});this.realtime.connect(gameId,this.spectating);}},error:()=>void this.router.navigate(['/home'])});}
  ionViewWillEnter(){if(!this.staleCheckTimer)this.staleCheckTimer=window.setInterval(()=>this.checkStaleState(),4000);}
  ionViewWillLeave(){this.sounds.stopMusic();this.cleanupGame();}
  private cleanupGame(){this.realtime.disconnect();this.celebration.stop();if(this.flightTimer)window.clearTimeout(this.flightTimer);if(this.automationOverrideTimer)window.clearTimeout(this.automationOverrideTimer);if(this.staleCheckTimer)window.clearInterval(this.staleCheckTimer);if(this.calloutTimer)window.clearTimeout(this.calloutTimer);this.flightTimer=undefined;this.automationOverrideTimer=undefined;this.calloutTimer=undefined;this.id='';this.state=undefined;this.metadata=undefined;this.busy=false;this.flights=[];this.wild=undefined;this.lastResyncedDeadline='';}
  ngOnDestroy(){this.subscriptions.unsubscribe();this.realtime.disconnect();this.sounds.stopMusic();if(this.flightTimer)window.clearTimeout(this.flightTimer);if(this.automationOverrideTimer)window.clearTimeout(this.automationOverrideTimer);if(this.staleCheckTimer)window.clearInterval(this.staleCheckTimer);if(this.calloutTimer)window.clearTimeout(this.calloutTimer);this.celebration.stop();}
  // Filet de sécurité : si l'échéance du tour est largement dépassée sans qu'aucune mise à jour
  // temps réel ne soit arrivée (connexion WebSocket bloquée en silence), on force une resynchronisation
  // via REST plutôt que de laisser l'affichage figé sur un tour obsolète.
  private checkStaleState(){
    if(this.spectating||!this.state||this.state.status!=='IN_PROGRESS'||!this.id)return;
    const deadline=this.state.currentTurnDeadline;
    if(!deadline||this.lastResyncedDeadline===deadline)return;
    const overdueMs=Date.now()-new Date(deadline).getTime();
    if(overdueMs<6000)return;
    this.lastResyncedDeadline=deadline;
    this.http.get<State>(`${environment.apiBaseUrl}/api/games/${this.id}/uno/state`).subscribe({next:s=>this.applyState(s),error:()=>undefined});
  }
  async play(card:Card){if(this.spectating||!this.myTurn||this.busy)return;void this.sounds.unlock();if(card.color==='WILD'){this.wild=card;return;}this.sendPlay(card);}
  async choose(color:Color){if(this.spectating)return;void this.sounds.unlock();if(this.wild)this.sendPlay(this.wild,color);this.wild=undefined;}
  async draw(){if(this.spectating)return;void this.sounds.unlock();this.action('draw',{});}
  automation(){if(this.spectating)return;this.busy=true;const enabled=!this.displayAutomaticMode;this.automaticModeOverride=enabled;this.http.patch(`${environment.apiBaseUrl}/api/games/${this.id}/automation`,{enabled}).subscribe({next:()=>{this.automationEnabled=enabled;this.busy=false;if(this.automationOverrideTimer)window.clearTimeout(this.automationOverrideTimer);this.automationOverrideTimer=window.setTimeout(()=>this.automaticModeOverride=null,1500);if(enabled)void this.showAutomaticModeNotice();},error:e=>{this.automaticModeOverride=null;this.fail(e);}});}
  private async showAutomaticModeNotice(){const alert=await this.alerts.create({cssClass:'fafap-game-alert automation-notice',header:'Mode automatique activé',message:'Après une longue inactivité ou une activation volontaire, vous êtes passé en mode automatique.',backdropDismiss:false,buttons:[{text:'Revenir au mode manuel',cssClass:'game-alert-primary',handler:()=>{this.http.patch(`${environment.apiBaseUrl}/api/games/${this.id}/automation`,{enabled:false}).subscribe({error:e=>this.fail(e)});}}]});await alert.present();}
  async ready(){if(this.spectating)return;void this.sounds.unlock();this.simple('ready');}async start(){if(this.spectating)return;void this.sounds.unlock();this.simple('start');}
  visibleBacks(player:Player){return Array.from({length:Math.min(4,player.cardCount)});}
  extraCards(player:Player){return Math.max(0,player.cardCount-4);}
  trackCard(_index:number,card:Card){return card.id;}
  trackPlayer(_index:number,player:Player){return player.gamePlayerId;}
  isPlayable(card:Card){const state=this.state,top=state?.topCard,active=state?.activeColor;if(!state||!top||!active)return false;if(card.effect==='WILD')return true;if(card.effect==='WILD_DRAW_FOUR')return !state.hand.some(value=>value.color===active);if(card.color===active)return true;if(card.effect!=='NUMBER'&&card.effect===top.effect)return true;return card.effect==='NUMBER'&&top.effect==='NUMBER'&&card.number===top.number;}
  private sendPlay(card:Card,chosenColor?:Color){this.action('play',{cardId:card.id,chosenColor});}
  private action(name:string,body:unknown){this.busy=true;this.http.post<State>(`${environment.apiBaseUrl}/api/games/${this.id}/uno/actions/${name}`,body).subscribe({next:s=>{this.applyState(s);this.busy=false;this.message='';},error:e=>this.fail(e)});}
  private applyState(s:State){s.discardCards||=(s.topCard?[s.topCard]:[]);this.automationEnabled=s.meAutomaticMode===true;const previous=this.state;this.state=s;if(s.status==='IN_PROGRESS')this.sounds.startAmbientMusic('UNO');if(!this.soundInitialized){this.soundInitialized=true;if(s.status==='IN_PROGRESS'&&s.discardCards.length===1){this.sounds.start();this.animateDistribution(s);}if(s.status==='FINISHED'&&s.winnerPlayerId)void this.showResult(s);return;}if(s.unoDeclaredPlayerId&&s.unoDeclaredPlayerId!==previous?.unoDeclaredPlayerId)this.announceUnoDeclaration(s);if(s.topCard?.id&&s.topCard.id!==previous?.topCard?.id){this.sounds.card('UNO');this.announceSpecialCard(s.topCard,previous,s);}else if(previous&&s.drawPileCount!==previous.drawPileCount)this.sounds.draw();if(previous)this.animateDraws(previous,s);if(previous&&!this.spectating)void this.checkPenalty(previous,s);if(previous?.currentPlayerId!==s.currentPlayerId&&s.currentPlayerId===s.meGamePlayerId)this.sounds.turn();if(s.status==='FINISHED'&&s.winnerPlayerId&&!this.resultShown)void this.showResult(s);}
  private announceSpecialCard(card:Card,previous?:State,next?:State){if(card.effect==='DRAW_TWO'){this.sounds.penaltyTwo();this.showCallout('+2',previous?.currentPlayerId,next);}else if(card.effect==='WILD')this.sounds.joker();else if(card.effect==='WILD_DRAW_FOUR'){this.sounds.penaltyFour();this.showCallout('+4',previous?.currentPlayerId,next);}}
  get sortedHand(){return[...(this.state?.hand||[])].sort((a,b)=>this.cardValue(a)-this.cardValue(b));}
  private cardValue(card:Card){if(card.effect==='NUMBER')return card.number??0;return {SKIP:10,REVERSE:11,DRAW_TWO:12,WILD:13,WILD_DRAW_FOUR:14}[card.effect]??99;}
  private announceUnoDeclaration(state:State){
    const player=state.players.find(value=>value.gamePlayerId===state.unoDeclaredPlayerId);
    this.showCallout('UNO',player?.gamePlayerId,state);
    this.sounds.uno();
  }
  private showCallout(word:'UNO'|'+2'|'+4',playerId?:string,state?:State){
    const player=state?.players.find(value=>value.gamePlayerId===playerId);
    this.calloutWord=word;
    this.unoCallout=player?.gamePlayerId===state?.meGamePlayerId?'Vous':player?.username||'Un joueur';
    if(this.calloutTimer)window.clearTimeout(this.calloutTimer);
    this.calloutTimer=window.setTimeout(()=>this.unoCallout=undefined,2600);
  }
  private async checkPenalty(previous:State,next:State){
    const before=previous.players.find(player=>player.gamePlayerId===previous.meGamePlayerId)?.cardCount??previous.hand.length;
    const after=next.players.find(player=>player.gamePlayerId===next.meGamePlayerId)?.cardCount??next.hand.length;
    const added=after-before;
    const topChanged=!!next.topCard?.id&&next.topCard.id!==previous.topCard?.id;
    let title='',message='',cards=0;
    if(topChanged&&previous.currentPlayerId!==previous.meGamePlayerId&&next.topCard?.effect==='DRAW_TWO'&&added>=2){
      title='Carte +2 reçue';cards=2;const opponent=previous.players.find(player=>player.gamePlayerId===previous.currentPlayerId)?.username||'Votre adversaire';message=`${opponent} a joué un +2. Vous recevez deux cartes et votre tour est passé.`;
    }else if(topChanged&&previous.currentPlayerId!==previous.meGamePlayerId&&next.topCard?.effect==='WILD_DRAW_FOUR'&&added>=4){
      title='Carte +4 reçue';cards=4;const opponent=previous.players.find(player=>player.gamePlayerId===previous.currentPlayerId)?.username||'Votre adversaire';message=`${opponent} a joué un +4. Vous recevez quatre cartes et votre tour est passé.`;
    }
    if(!cards)return;
    const signature=`${next.topCard?.id}:${title}:${after}`;
    if(signature===this.lastPenaltyAlert)return;
    this.lastPenaltyAlert=signature;
    const alert=await this.alerts.create({cssClass:'fafap-game-alert uno-penalty-alert',header:title,message,backdropDismiss:true,buttons:[{text:'J’ai compris',cssClass:'game-alert-primary'}]});
    await alert.present();
  }
  private async showSpectatorResult(s:State){await this.spectatorResults.present(s.gameId,s.players,s.winnerPlayerId?[s.winnerPlayerId]:[]);}
  private async showResult(s:State){if(this.resultShown)return;this.resultShown=true;if(this.spectating){await this.showSpectatorResult(s);return;}const won=s.winnerPlayerId===s.meGamePlayerId;this.sounds.result(won);const campaign=await this.campaignFlow.checkGame(s.gameId);if(campaign){if(won)this.celebration.start();await this.campaignFlow.presentResult(campaign);return;}const championship=await this.championshipFlow.afterGame(s.gameId);if(championship?.nextGameId){if(won)this.celebration.start();await this.championshipFlow.presentMancheTransition(championship,won);return;}const buttons=championship?[{text:'Retourner au championnat',cssClass:'game-alert-cancel',handler:()=>void this.championshipFlow.returnToChampionship(championship)}]:[{text:'Rejouer',cssClass:'game-alert-replay',handler:()=>this.joinRematch()},{text:'Parties',cssClass:'game-alert-cancel',handler:()=>void this.router.navigate(['/search'])},{text:'Campagne',cssClass:'game-alert-campaign',handler:()=>void this.router.navigate(['/campaign'])},{text:'Championnat',cssClass:'game-alert-championship',handler:()=>void this.router.navigate(['/championships'])}];const alert=await this.alerts.create({cssClass:championship?`fafap-game-alert championship-result-alert ${won?'manche-won':'manche-lost'}`:`fafap-game-alert game-result-alert ${won?'game-result-winner':'game-result-loser'}`,header:championship?(won?'Duel remporté !':'Duel perdu'):undefined,message:championship?this.championshipFlow.finalMessage(championship,won):'\u00a0',backdropDismiss:true,buttons});await alert.present();if(won){this.celebration.start();void alert.onDidDismiss().then(()=>this.celebration.stop());}if(championship)this.championshipFlow.scheduleAutoReturn(championship,alert);}
  private joinRematch(){this.games.joinRematch(this.id).subscribe({next:game=>void this.router.navigate(['/games/uno'],{queryParams:{gameId:game.gameId},replaceUrl:true}),error:e=>{this.resultShown=false;this.message=e?.error?.message||'Revanche indisponible';}});}
  private animateDistribution(s:State){const flights:CardFlight[]=[];for(let round=0;round<7;round++)s.players.forEach((player,index)=>flights.push(this.flightTo(player,index,s.players.length,(round*s.players.length+index)*90,520)));this.sounds.deal(flights.length,90,'UNO');this.showFlights(flights);}
  private animateDraws(previous:State,next:State){const flights:CardFlight[]=[];next.players.forEach((player,index)=>{const old=previous.players.find(value=>value.gamePlayerId===player.gamePlayerId)?.cardCount||0;const added=Math.min(4,Math.max(0,player.cardCount-old));for(let card=0;card<added;card++)flights.push(this.flightTo(player,index,next.players.length,card*110,460));});if(flights.length)this.showFlights(flights);}
  private flightTo(player:Player,_index:number,_total:number,delay:number,duration:number):CardFlight{
    if(player.gamePlayerId===this.state?.meGamePlayerId)return{id:++this.flightSequence,tx:'7vw',ty:'42vh',delay,duration};
    const opponents=this.state?.players.filter(value=>value.gamePlayerId!==this.state?.meGamePlayerId)||[];
    const index=Math.max(0,opponents.findIndex(value=>value.gamePlayerId===player.gamePlayerId));
    const target=this.playerCoordinates(index,opponents.length);
    return{id:++this.flightSequence,tx:`${target.left-43}vw`,ty:`${target.top-50}vh`,delay,duration};
  }
  private showFlights(flights:CardFlight[]){this.flights=flights;if(this.flightTimer)window.clearTimeout(this.flightTimer);const end=Math.max(...flights.map(flight=>flight.delay+flight.duration))+120;this.flightTimer=window.setTimeout(()=>this.flights=[],end);}
  flightStyle(flight:CardFlight){return{'--tx':flight.tx,'--ty':flight.ty,'--delay':`${flight.delay}ms`,'--duration':`${flight.duration}ms`};}
  discardStyle(index:number,total:number){const offset=index-(total-1);return{transform:`translate(${offset*5}px,${offset*2}px) rotate(${offset*7+4}deg)`,zIndex:index+1};}
  private simple(name:string){this.busy=true;this.http.post(`${environment.apiBaseUrl}/api/games/${this.id}/${name}`,{}).subscribe({next:()=>this.busy=false,error:e=>this.fail(e)});}
  private fail(e:any){this.busy=false;this.message=e?.error?.message||'Action impossible';}
  get myTurn(){return this.state?.status==='IN_PROGRESS'&&this.state.currentPlayerId===this.state.meGamePlayerId;}get me(){return this.state?.players.find(p=>p.gamePlayerId===this.state?.meGamePlayerId);}get opponents(){return this.state?.players.filter(p=>p.gamePlayerId!==this.state?.meGamePlayerId)||[];}
  get suggestDraw(){return this.myTurn&&!this.state?.hand.some(card=>this.isPlayable(card));}
  label(c?:Card){if(!c)return'';return c.effect==='NUMBER'?String(c.number):({SKIP:'⊘',REVERSE:'↻',DRAW_TWO:'+2',WILD:'★',WILD_DRAW_FOUR:'+4'}as Record<Effect,string>)[c.effect];}css(c?:Card){return(c?.color||'WILD').toLowerCase();}
  playerStyle(i:number,total:number){
    const position=this.playerCoordinates(i,total);
    return{left:`${position.left}%`,top:`${position.top}%`};
  }
  private playerCoordinates(i:number,total:number){
    if(this.spectating){
      if(total===1)return{left:50,top:23};
      if(total===2)return i===0?{left:27,top:39}:{left:73,top:39};
      if(total===3)return[{left:50,top:20},{left:76,top:52},{left:24,top:52}][i];
      const angle=(-90+(360/total)*i)*Math.PI/180;
      return{left:50+31*Math.cos(angle),top:43+24*Math.sin(angle)};
    }
    if(total===1)return{left:50,top:20};
    if(total===2)return i===0?{left:30,top:25}:{left:70,top:25};
    if(total===3)return[{left:22,top:46},{left:50,top:19},{left:78,top:46}][i];
    const a=(205+(130/Math.max(total-1,1))*i)*Math.PI/180;
    return{left:50+32*Math.cos(a),top:43+25*Math.sin(a)};
  }
}
