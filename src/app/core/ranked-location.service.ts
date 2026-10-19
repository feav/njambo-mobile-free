import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';

export interface PlayerLocation { latitude:number; longitude:number; }

@Injectable({providedIn:'root'})
export class RankedLocationService {
  constructor(private alerts:AlertController){}

  async capture(stakeAmount:number,retryAttempt=false):Promise<PlayerLocation|undefined|null>{
    if(!(stakeAmount>0))return undefined;
    if(!navigator.geolocation){await this.blocked('La géolocalisation n’est pas disponible sur cet appareil.');return null;}
    const permission=await this.permissionState();
    if(permission==='prompt'&&!await this.explain())return null;
    if(permission==='denied'&&!retryAttempt&&!await this.retryPermission())return null;
    try{
      let position:GeolocationPosition;
      try{
        position=await this.currentPosition(true,15000,0);
      }catch(firstError){
        const code=(firstError as GeolocationPositionError)?.code;
        if(code!==2&&code!==3)throw firstError;
        position=await this.currentPosition(false,20000,60000);
      }
      return {latitude:position.coords.latitude,longitude:position.coords.longitude};
    }catch(error){
      const denied=(error as GeolocationPositionError)?.code===1;
      const message=denied?'Vous avez refusé l’accès à votre position. Autorisez-la dans les réglages, puis réessayez pour rejoindre une partie classée.':'Votre position actuelle n’a pas pu être déterminée. Vérifiez votre connexion ou votre signal GPS, puis réessayez.';
      if(!retryAttempt&&await this.retryPermission(message))return this.capture(stakeAmount,true);
      await this.blocked(message);
      return null;
    }
  }

  private currentPosition(enableHighAccuracy:boolean,timeout:number,maximumAge:number):Promise<GeolocationPosition>{
    return new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy,timeout,maximumAge}));
  }

  private async permissionState():Promise<PermissionState|'unknown'>{
    try{return (await navigator.permissions?.query({name:'geolocation'})).state||'unknown';}catch{return'unknown';}
  }
  private async explain(){const alert=await this.alerts.create({cssClass:'fafap-game-alert',header:'Position requise',message:'Njambo utilise votre position uniquement au moment de rejoindre une partie classée afin de prévenir la fraude et protéger les joueurs.',backdropDismiss:false,buttons:[{text:'Annuler',role:'cancel'},{text:'Continuer',role:'confirm',cssClass:'game-alert-primary'}]});await alert.present();return(await alert.onDidDismiss()).role==='confirm';}
  private async retryPermission(message='La position est nécessaire pour rejoindre une partie classée.'):Promise<boolean>{const alert=await this.alerts.create({cssClass:'fafap-game-alert',header:'Position requise',message,backdropDismiss:false,buttons:[{text:'Annuler',role:'cancel'},{text:'Réessayer',role:'confirm',cssClass:'game-alert-primary'}]});await alert.present();return(await alert.onDidDismiss()).role==='confirm';}
  private async blocked(message:string){const alert=await this.alerts.create({cssClass:'fafap-game-alert',header:'Partie classée inaccessible',message,buttons:['Compris']});await alert.present();}
}
