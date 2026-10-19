import {Injectable} from '@angular/core';

@Injectable({providedIn:'root'})
export class GameShareService{
  async invite(gameId:string,tableName='une partie Njambo'):Promise<'shared'|'copied'|'cancelled'>{
    // Ouvre la partie dans la liste : le joueur suit ensuite le parcours
    // normal pour rejoindre (mot de passe éventuel, file d'attente, etc.).
    const url=`${window.location.origin}/search?gameId=${encodeURIComponent(gameId)}`;
    const text=`Rejoins-moi sur ${tableName}. La partie va bientôt commencer !`;
    try{
      if(navigator.share){await navigator.share({title:'Invitation Njambo',text,url});return'shared';}
      await navigator.clipboard.writeText(`${text}\n${url}`);return'copied';
    }catch(error){
      if(error instanceof DOMException&&error.name==='AbortError')return'cancelled';
      const input=document.createElement('textarea');input.value=`${text}\n${url}`;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();document.execCommand('copy');input.remove();return'copied';
    }
  }
}
