import {Injectable} from '@angular/core';

export type CardTheme='normal'|'gold';

@Injectable({providedIn:'root'})
export class CardThemeService{
  static readonly storageKey='fafap.card.theme';
  get current():CardTheme{return localStorage.getItem(CardThemeService.storageKey)==='gold'?'gold':'normal';}
  set current(theme:CardTheme){localStorage.setItem(CardThemeService.storageKey,theme);}
  card(rank:string,suit='S'){return `assets/images/card-themes/${this.current}/${rank}${suit}.webp`;}
  joker(color:'BLACK'|'RED'){return `assets/images/card-themes/${this.current}/${color==='RED'?'jocker-blanc':'joker-rnoir'}.png`;}
}
