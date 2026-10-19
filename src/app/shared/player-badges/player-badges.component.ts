import {CommonModule} from '@angular/common';
import {Component,Input,OnChanges} from '@angular/core';
import {CampaignApiService,PlayerCampaignBadge} from '../../core/campaign-api.service';

@Component({
  selector:'app-player-badges',standalone:true,imports:[CommonModule],
  template:`<span class="badge-row" *ngIf="countryCode||visibleBadges.length" aria-label="Badges du joueur"><i *ngIf="countryCode" class="country" [attr.aria-label]="'Pays '+countryCode" [title]="countryCode">{{flag}}</i><img *ngFor="let badge of visibleBadges" [src]="api.badgeUrl(badge.levelId)" [alt]="badge.gameType+' '+badge.tierName" [title]="badge.gameType+' · '+badge.tierName"></span>`,
  styles:[`:host{display:block}.badge-row{display:flex;justify-content:center;align-items:center;gap:2px;margin-top:3px}.badge-row img,.country{width:18px;height:18px;border:1px solid rgba(255,214,65,.75);border-radius:50%;object-fit:cover;background:#071009;box-shadow:0 0 6px rgba(255,210,50,.28)}.country{display:grid;place-items:center;font-size:12px;font-style:normal;line-height:1}@media(max-width:480px){.badge-row img,.country{width:15px;height:15px;font-size:10px}}`]
})
export class PlayerBadgesComponent implements OnChanges{
  @Input() userId?:string;@Input() countryCode?:string;@Input() gameType?:string;badges:PlayerCampaignBadge[]=[];
  get visibleBadges(){const type=this.gameType||this.routeGameType();return type?this.badges.filter(badge=>badge.gameType===type).slice(0,1):this.badges.slice(0,1);}
  private routeGameType(){const path=location.pathname;return path.includes('/check-games')?'CHECK_GAMES':path.includes('/uno')?'UNO':path.includes('/cochon')?'COCHON_GRATTE':path.includes('/tcheck')?'PRESIDENT':path.includes('/game')?'FAFAP':undefined;}
  get flag(){return(this.countryCode||'').toUpperCase().replace(/./g,char=>String.fromCodePoint(127397+char.charCodeAt(0)))}
  constructor(public api:CampaignApiService){}
  ngOnChanges(){if(!this.userId){this.badges=[];return}this.api.playerBadges(this.userId).subscribe({next:value=>this.badges=value,error:()=>this.badges=[]})}
}
