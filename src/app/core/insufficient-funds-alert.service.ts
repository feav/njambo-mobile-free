import{Injectable}from'@angular/core';
import{AlertController,IonicSafeString}from'@ionic/angular';
import{Router}from'@angular/router';
import{firstValueFrom}from'rxjs';
import{AccountApiService}from'./account-api.service';

@Injectable({providedIn:'root'})export class InsufficientFundsAlertService{
  constructor(private alerts:AlertController,private router:Router,private accounts:AccountApiService){}
  async present(opts:{required?:number}={}){
    let balance:number|undefined;
    try{balance=(await firstValueFrom(this.accounts.get())).availableBalance;}catch{balance=undefined;}
    const fr=(value:number)=>value.toLocaleString('fr-FR',{maximumFractionDigits:2});
    const missing=opts.required!==undefined&&balance!==undefined?Math.max(0,opts.required-balance):undefined;
    const message=missing!==undefined
      ?`Il te manque <strong>${fr(missing)} JETONS</strong> pour continuer.\n\nTon solde : ${fr(balance!)} F\nMontant requis : ${fr(opts.required!)} JETONS`
      :balance!==undefined
        ?`Ton solde actuel (<strong>${fr(balance)} JETONS</strong>) ne couvre pas cette action.`
        :'Ton solde ne couvre pas cette action.';
    const alert=await this.alerts.create({
      cssClass:'fafap-game-alert insufficient-funds-alert',
      header:'Fonds insuffisants',
      subHeader:'Recharge pour continuer à jouer',
      message:new IonicSafeString(message.replace(/\n/g,'<br>')),
      buttons:[
        {text:'Plus tard',role:'cancel',cssClass:'game-alert-cancel'},
        {text:'Recharger mon compte',cssClass:'game-alert-primary',handler:()=>{void this.router.navigate(['/transactions'],{queryParams:{action:'deposit'}});}}
      ]
    });
    await alert.present();
  }
}
