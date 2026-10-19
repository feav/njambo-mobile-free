import {Injectable} from '@angular/core';
import {Router} from '@angular/router';
import {AlertController} from '@ionic/angular';
import {firstValueFrom} from 'rxjs';
import {CampaignApiService, CampaignGameContext} from './campaign-api.service';
import {GameBoardNavigationService} from './game-board-navigation.service';

@Injectable({providedIn:'root'})
export class CampaignFlowService {
  constructor(private api:CampaignApiService,private alerts:AlertController,private router:Router,private navigation:GameBoardNavigationService){}

  /** Une partie de campagne peut avoir ete jouee sur ce gameId : renvoie son contexte si c'est le cas. */
  async checkGame(gameId:string):Promise<CampaignGameContext|undefined>{
    try{return await firstValueFrom(this.api.gameContext(gameId));}catch{return undefined;}
  }

  async presentResult(context:CampaignGameContext):Promise<void>{
    const won=context.status==='WON';
    const header=won?'Niveau reussi !':'Niveau perdu';
    const message=won
      ?(context.alreadyRewarded
        ?`Bien joue ! Vous aviez deja complete ${context.worldName} — ${context.tierName}.`
        :`Bien joue ! Vous avez complete ${context.worldName} — ${context.tierName} et gagne ${context.pointsReward} points de campagne.`)
      :`Vous avez perdu ${context.worldName} — ${context.tierName}. Retentez votre chance !`;
    const alert=await this.alerts.create({
      cssClass:`fafap-game-alert campaign-result-alert ${won?'manche-won':'manche-lost'}`,
      header,
      message,
      backdropDismiss:true,
      buttons:[
        {text:'Jouer plus tard',role:'cancel',cssClass:'game-alert-cancel'},
        {text:'Rejouer',cssClass:'game-alert-primary',handler:async()=>{const result=await firstValueFrom(this.api.start(context.levelId));await this.navigation.open(result.gameId,true);}},
        {text:'Retour à la campagne',cssClass:'game-alert-primary',handler:()=>{void this.router.navigate(['/campaign']);}}
      ]
    });
    await alert.present();
  }
}
