import {Directive,HostListener,Input} from '@angular/core';
import {AlertController,ModalController,ToastController} from '@ionic/angular';
import {CampaignApiService} from '../../core/campaign-api.service';
import {PlayerProfileView,SocialApiService} from '../../core/social-api.service';
import {PlayerProfileModalComponent} from '../player-profile-modal/player-profile-modal.component';

@Directive({selector:'[appPlayerProfile]',standalone:true})
export class PlayerProfileTriggerDirective{
 @Input()appPlayerProfile?:any;
 private lastOpen=0;
 constructor(private alerts:AlertController,private modal:ModalController,private toast:ToastController,private social:SocialApiService,private campaigns:CampaignApiService){}
 @HostListener('click',['$event'])open(event:Event){this.activate(event);}
 @HostListener('pointerup',['$event'])pointerOpen(event:Event){this.activate(event);}
 private activate(event:Event){if(Date.now()-this.lastOpen<450)return;const target=event.target as HTMLElement|null;const host=event.currentTarget as HTMLElement|null;const nestedButton=target?.closest('button');if(nestedButton&&nestedButton!==host)return;const p=this.appPlayerProfile;if(!p?.userId)return;this.lastOpen=Date.now();event.stopPropagation();this.social.profile(p.userId).subscribe({next:profile=>void this.present(profile),error:()=>void this.presentFallback(p)});}
 private async present(profile:PlayerProfileView){const sheet=await this.modal.create({component:PlayerProfileModalComponent,componentProps:{profile},cssClass:'player-profile-modal',breakpoints:[0,.72,.96],initialBreakpoint:.96});await sheet.present();}
 private add(profile:PlayerProfileView){this.social.request(profile.username).subscribe({next:()=>void this.notice(`Demande envoyée à ${profile.username}.`),error:e=>void this.notice(e?.error?.message||'Impossible d’ajouter ce joueur.')});}
 private async presentFallback(p:{username?:string;avatarUrl?:string;countryCode?:string}){const alert=await this.alerts.create({header:p.username||'Joueur',message:'Profil momentanément indisponible.',buttons:['Fermer']});await alert.present();}
 private async notice(message:string){const t=await this.toast.create({message,duration:2200,position:'top'});await t.present();}
 private flag(code?:string){return(code||'').toUpperCase().replace(/./g,c=>String.fromCodePoint(127397+c.charCodeAt(0)))}
 private escape(value:string){return(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));}
}
