import {Injectable} from '@angular/core';
import {Router} from '@angular/router';
import {AlertController,IonicSafeString} from '@ionic/angular';
import {firstValueFrom} from 'rxjs';
import {ChampionshipApiService,ChampionshipGameContext,MyPendingMatch} from './championship-api.service';
import {GameBoardNavigationService} from './game-board-navigation.service';

const MANCHE_COUNTDOWN_SECONDS=10;
const FINAL_REDIRECT_SECONDS=5;

@Injectable({providedIn:'root'})
export class ChampionshipFlowService {
  constructor(private api:ChampionshipApiService,private navigation:GameBoardNavigationService,private router:Router,private alerts:AlertController){}

  async afterGame(gameId:string):Promise<ChampionshipGameContext|undefined>{
    for(let attempt=0;attempt<6;attempt++){
      try{
        const context=await firstValueFrom(this.api.gameContext(gameId));
        if(context.gamesCompleted>=context.gameNumber||context.matchStatus==='FINISHED')return context;
      }catch{return undefined;}
      await new Promise(resolve=>window.setTimeout(resolve,350));
    }
    try{return await firstValueFrom(this.api.gameContext(gameId));}catch{return undefined;}
  }

  finalMessage(context:ChampionshipGameContext,won:boolean){
    const score=`${context.scoreOne} - ${context.scoreTwo}`;
    return won?`Duel remporté · score ${score}. Vous êtes qualifié pour la suite du championnat, vos récompenses sont crédités dans votre réserve de championnat.`:`Duel perdu · score ${score}. Vous êtes éliminé du championnat.`;
  }

  /** Manche terminée mais duel pas encore décidé : affiche le résultat + un décompte, puis enchaîne automatiquement. */
  async presentMancheTransition(context:ChampionshipGameContext,won:boolean):Promise<void>{
    const tie=context.scoreOne===context.scoreTwo;
    const header=tie?'Égalité !':won?'Manche remportée':'Manche perdue';
    const detail=tie?`Score ${context.scoreOne} - ${context.scoreTwo} · manche décisive à suivre`:`Score ${context.scoreOne} - ${context.scoreTwo}`;
    let remaining=MANCHE_COUNTDOWN_SECONDS;
    const alert=await this.alerts.create({
      cssClass:`fafap-game-alert manche-transition-alert ${won?'manche-won':'manche-lost'}`,
      header,
      message:new IonicSafeString(this.countdown(detail,remaining)),
      backdropDismiss:false
    });
    await alert.present();
    await new Promise<void>(resolve=>{
      const timer=window.setInterval(()=>{
        remaining--;
        if(remaining<=0){
          window.clearInterval(timer);
          void alert.dismiss().then(()=>resolve());
          return;
        }
        const el=alert.querySelector('.alert-message');
        if(el)el.innerHTML=this.countdown(detail,remaining);
      },1000);
    });
    await this.openNext(context);
  }

  /** Ajoute un décompte de redirection automatique vers le championnat sur une alerte de résultat final déjà affichée. */
  scheduleAutoReturn(context:ChampionshipGameContext,alert:any):void{
    let remaining=FINAL_REDIRECT_SECONDS;
    const base=alert.querySelector('.alert-message')?.innerHTML||'';
    const update=()=>{const el=alert.querySelector('.alert-message');if(el)el.innerHTML=`${base}<br><br>Retour au championnat dans <strong>${remaining}</strong> s…`;};
    update();
    const timer=window.setInterval(()=>{
      remaining--;
      if(remaining<=0){
        window.clearInterval(timer);
        void alert.dismiss().then(()=>void this.returnToChampionship(context));
        return;
      }
      update();
    },1000);
    void alert.onDidDismiss().then(()=>window.clearInterval(timer));
  }

  private countdown(detail:string,remaining:number){return`${detail}<br><br>Manche suivante dans <strong>${Math.max(0,remaining)}</strong> s…`;}

  /**
   * Récupération après un échec de rechargement de main (HAND_RESYNC_FAILED) : le joueur a été
   * ouvert sur un gameId qui n'est plus (ou pas encore) le sien — le tableau du championnat côté
   * client peut être en retard de quelques secondes sur l'avancement réel du match côté serveur.
   * Si un match de championnat en attente pointe vers une autre partie, on y redirige silencieusement
   * au lieu de laisser le joueur bloqué sur un plateau vide. Renvoie true si une redirection a eu lieu.
   */
  async recoverStaleGame(currentGameId:string):Promise<boolean>{
    let match:MyPendingMatch|null;
    try{match=await firstValueFrom(this.api.myPendingMatch());}catch{return false;}
    if(!match||match.gameId===currentGameId)return false;
    await this.navigation.open(match.gameId,true);
    return true;
  }

  /** Un duel de championnat ne doit jamais pouvoir être quitté depuis le salon d'attente. */
  async isChampionshipGame(gameId:string):Promise<boolean>{
    return !!await this.gameContext(gameId);
  }

  async gameContext(gameId:string):Promise<ChampionshipGameContext|undefined>{
    try{return await firstValueFrom(this.api.gameContext(gameId));}catch{return undefined;}
  }

  async checkPendingMatch():Promise<void>{
    let match:MyPendingMatch|null;
    try{match=await firstValueFrom(this.api.myPendingMatch());}catch{return;}
    if(!match)return;
    await this.presentPendingMatch(match);
  }

  async presentPendingMatch(match:MyPendingMatch):Promise<void>{
    const alert=await this.alerts.create({
      cssClass:'fafap-game-alert pending-match-alert',
      header:'Votre duel vous attend',
      subHeader:'Quête Njambo · Championnat',
      message:new IonicSafeString(`<span class="pending-match-eyebrow">MATCH DISPONIBLE</span><strong>${this.escapeHtml(match.championshipName)}</strong><small>Rejoignez la table maintenant ou revenez jouer plus tard.</small>`),
      backdropDismiss:true,
      buttons:[
        {text:'Jouer plus tard',role:'cancel',cssClass:'game-alert-cancel pending-later'},
        {text:'Voir le championnat',cssClass:'game-alert-cancel pending-championship',handler:()=>{void this.router.navigate(['/championships',match.championshipId]);}},
        {text:'Lancer la partie',cssClass:'game-alert-primary',handler:()=>{void this.navigation.open(match.gameId);}}
      ]
    });
    await alert.present();
  }

  openNext(context:ChampionshipGameContext){return context.nextGameId?this.navigation.open(context.nextGameId,true):Promise.resolve(false);}
  returnToChampionship(context:ChampionshipGameContext){return this.router.navigate(['/championships',context.championshipId]);}
  private escapeHtml(value:string){return value.replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]||character));}
}
