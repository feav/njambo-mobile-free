import {Injectable,NgZone} from '@angular/core';
import {SwUpdate,VersionEvent} from '@angular/service-worker';
import {Router,NavigationEnd} from '@angular/router';
import {AlertController} from '@ionic/angular';
import {filter} from 'rxjs/operators';

@Injectable({providedIn:'root'})
export class PwaUpdateService{
  private started=false;
  private updating=false;
  private updatePending=false;
  private interval?:number;

  constructor(private updates:SwUpdate,private router:Router,private zone:NgZone,private alerts:AlertController){}

  start(){
    if(this.started||!this.updates.isEnabled)return;
    this.started=true;
    if(localStorage.getItem('fafap.pwa.update-notice-pending')==='1'){
      localStorage.removeItem('fafap.pwa.update-notice-pending');
      window.setTimeout(()=>void this.showUpdateNotice(),700);
    }
    this.updates.versionUpdates.pipe(filter((event:VersionEvent)=>event.type==='VERSION_READY')).subscribe(()=>this.queueUpdate());
    this.updates.unrecoverable.subscribe(()=>this.queueUpdate());
    this.router.events.pipe(filter((event):event is NavigationEnd=>event instanceof NavigationEnd)).subscribe(()=>this.applyIfSafe());
    const check=()=>void this.check();
    window.addEventListener('online',check);
    window.addEventListener('focus',check);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
    this.zone.runOutsideAngular(()=>this.interval=window.setInterval(check,5*60*1000));
    window.setTimeout(check,1200);
  }

  private async check(){
    try{await this.updates.checkForUpdate();}catch{/* Une absence de réseau ne doit pas bloquer le jeu. */}
  }

  private queueUpdate(){
    this.updatePending=true;
    this.applyIfSafe();
  }

  private applyIfSafe(){
    if(!this.updatePending||this.updating||this.isActiveGame())return;
    void this.activateUpdate();
  }

  private isActiveGame(){
    const path=this.router.url.split(/[?#]/)[0];
    return /^\/(?:game-board|games\/(?:tcheck|check-games|uno|cochon-gratte))(?:\/|$)/.test(path);
  }

  private async activateUpdate(){
    if(this.updating)return;
    this.updating=true;
    try{
      const activation=this.withTimeout(this.updates.activateUpdate(),12000);
      await activation;
      localStorage.setItem('fafap.pwa.last-update',new Date().toISOString());
      localStorage.setItem('fafap.pwa.update-notice-pending','1');
      this.updatePending=false;
      window.location.reload();
    }catch{
      this.updating=false;
    }
  }

  private withTimeout<T>(operation:Promise<T>,durationMs:number):Promise<T>{
    return new Promise<T>((resolve,reject)=>{
      const timer=window.setTimeout(()=>reject(new Error('PWA_UPDATE_TIMEOUT')),durationMs);
      operation.then(value=>{window.clearTimeout(timer);resolve(value);},error=>{window.clearTimeout(timer);reject(error);});
    });
  }

  private async showUpdateNotice(){
    const alert=await this.alerts.create({cssClass:'fafap-game-alert update-notice-alert',header:'Mise à jour reçue',message:'Vous avez reçu une mise à jour.',buttons:[{text:'Merci',cssClass:'game-alert-primary'}]});
    await alert.present();
  }
}
