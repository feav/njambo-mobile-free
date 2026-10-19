import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AlertController, IonicSafeString } from '@ionic/angular';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SpectatorResultPlayer {
  userId: string;
  gamePlayerId: string;
  username: string;
  cardCount?: number;
}

interface ChampionshipContext { championshipId: string; championshipName: string; }

@Injectable({providedIn:'root'})
export class SpectatorResultService {
  constructor(private http:HttpClient,private alerts:AlertController,private router:Router){}

  async present(gameId:string,players:SpectatorResultPlayer[],winnerIds:string[]){
    const championship=await firstValueFrom(this.http.get<ChampionshipContext|null>(`${environment.apiBaseUrl}/api/championships/games/${gameId}/spectator-context`)).catch(()=>undefined);
    const winners=players.filter(player=>winnerIds.includes(player.gamePlayerId)).map(player=>player.username).join(', ');
    const standings=[...players].sort((a,b)=>(a.cardCount??0)-(b.cardCount??0)).map(player=>`${this.escape(player.username)}${player.cardCount==null?'':` — ${player.cardCount} carte${player.cardCount>1?'s':''}`}`).join('<br>');
    const buttons:any[]=[...players.map(player=>({text:`Voir le profil · ${player.username}`,cssClass:'spectator-profile-action',handler:()=>void this.router.navigate(['/players',player.userId])}))];
    if(championship)buttons.push({text:`Ouvrir le championnat · ${championship.championshipName}`,cssClass:'game-alert-primary',handler:()=>void this.router.navigate(['/championships',championship.championshipId])});
    buttons.push({text:'Fermer',role:'cancel',cssClass:'game-alert-cancel',handler:()=>void this.router.navigate(['/search'])});
    const message=winners?`Vainqueur${winnerIds.length>1?'s':''} : ${this.escape(winners)}<br><br>${standings}`:standings;
    const alert=await this.alerts.create({cssClass:'fafap-game-alert game-result-alert game-result-spectator spectator-result-actions',header:'Partie terminée',message:new IonicSafeString(message),backdropDismiss:true,buttons});
    await alert.present();
  }

  private escape(value:string){return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
}
