import { Component, OnInit } from '@angular/core';
import {
    LoadingController, AlertController, MenuController, Platform
} from "@ionic/angular";
import { Router } from '@angular/router';
import { Validators, FormControl, FormGroup, FormBuilder } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { AccountApiService } from '../core/account-api.service';
import { SocialApiService, PlayerProfileView } from '../core/social-api.service';

@Component({
    standalone: false,
    selector: 'app-profile',
    templateUrl: './profile.page.html',
    styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {
    username = '';
    avatarUrl = '/assets/images/avatars/armel.png';
    balance = 0;
    createdAt?: string;
    avatarGenerating = false;
    profileStats?: PlayerProfileView;
    avatarQuality: 'LOW'|'MEDIUM'|'HIGH' = 'LOW';
    readonly avatarQualities = [{value:'LOW' as const,label:'Low',price:0,description:'Rapide et gratuite'},{value:'MEDIUM' as const,label:'Medium',price:100,description:'Plus nette et détaillée'},{value:'HIGH' as const,label:'High',price:250,description:'Qualité maximale'}];

    profileFormGroup: FormGroup;
    readonly phonePattern = /^\+[1-9]\d{7,16}$/;

    constructor(
        private router: Router,
        private platform: Platform,
        private formBuilder: FormBuilder,
        private menu: MenuController,
        private alertCtrl: AlertController,
        private loadingCtrl: LoadingController,
        private auth: AuthService,
        private accounts: AccountApiService,
        private social: SocialApiService) {

        this.profileFormGroup = this.formBuilder.group({
            'name': new FormControl('', [Validators.required, Validators.minLength(3)]),
            'birthdate': new FormControl(''),
            'telephone': new FormControl('', [Validators.pattern(this.phonePattern)]),
            'email': new FormControl('', [Validators.required, Validators.email]),
            'sex': new FormControl('NON_DECLARE', [Validators.required]),
        });
    }

    ngOnInit() { this.resetForm(); this.accounts.get().subscribe(account=>this.balance=account.availableBalance); const user=this.auth.currentUser(); if(user) this.social.profile(user.id).subscribe({next:value=>this.profileStats=value}); }

    cancel(){ this.resetForm(); }

    async save(){
        if(this.profileFormGroup.invalid){this.profileFormGroup.markAllAsTouched();return;}
        const loading=await this.loadingCtrl.create({message:'Enregistrement…'});await loading.present();
        const telephone = (this.profileFormGroup.value.telephone || '').replace(/\s+/g, '');
        this.auth.updateProfile(this.profileFormGroup.value.name,this.profileFormGroup.value.email,telephone,this.profileFormGroup.value.sex,this.profileFormGroup.value.birthdate).subscribe({next:async user=>{this.username=user.username;this.avatarUrl=user.avatarUrl||this.avatarUrl;this.createdAt=user.createdAt;this.resetForm();if(user.id)this.social.profile(user.id).subscribe({next:value=>this.profileStats=value});await loading.dismiss();const alert=await this.alertCtrl.create({header:'Profil enregistré',message:'Vos informations ont été mises à jour.',buttons:['Fermer']});await alert.present();},error:async error=>{await loading.dismiss();const alert=await this.alertCtrl.create({header:'Modification impossible',message:error?.error?.message||'Veuillez réessayer.',buttons:['Fermer']});await alert.present();}});
    }

    async uploadAvatar(event: Event) {
        const input = event.target as HTMLInputElement;
        const photo = input.files?.[0];
        if (!photo || this.avatarGenerating) return;
        if (photo.size > 10 * 1024 * 1024) {
            const alert = await this.alertCtrl.create({header:'Photo trop volumineuse',message:'Choisissez une image JPEG, PNG ou WebP de moins de 10 Mo.',buttons:['Fermer']});
            await alert.present();
            input.value = '';
            return;
        }
        this.avatarGenerating = true;
        const loading = await this.loadingCtrl.create({message:'Création de votre avatar…'});
        await loading.present();
        this.auth.generateAvatar(photo, this.avatarQuality).subscribe({
            next: async user => {
                this.avatarUrl = user.avatarUrl || this.avatarUrl;
                this.avatarGenerating = false;
                input.value = '';
                await loading.dismiss();
                const price=this.avatarQualities.find(value=>value.value===this.avatarQuality)?.price||0;this.balance=Math.max(0,this.balance-price);
                const alert = await this.alertCtrl.create({header:'Avatar créé',message:price?`Votre avatar est prêt. ${price} JETONS ont été débités.`:'Votre nouvelle photo de profil est prête gratuitement.',buttons:['Fermer']});
                await alert.present();
            },
            error: async error => {
                this.avatarGenerating = false;
                input.value = '';
                await loading.dismiss();
                const message = error?.status === 413
                    ? 'La photo est trop volumineuse pour être envoyée. Choisissez une autre image.'
                    : error?.error?.message === 'INSUFFICIENT_FUNDS'
                        ? 'Votre solde est insuffisant pour cette qualité.'
                    : error?.message === 'AVATAR_IMAGE_INVALID'
                        ? 'Cette image ne peut pas être lue. Choisissez une photo JPEG, PNG ou WebP.'
                        : error?.error?.message || 'La création de l’avatar a échoué. Réessayez.';
                const alert = await this.alertCtrl.create({header:'Génération impossible',message,buttons:['Fermer']});
                await alert.present();
            }
        });
    }

    private resetForm(){const user=this.auth.currentUser();this.username=user?.username||'Joueur';this.avatarUrl=user?.avatarUrl||this.avatarUrl;this.createdAt=user?.createdAt;this.profileFormGroup.patchValue({name:user?.username||'',birthdate:user?.birthdate||'',email:user?.email||'',telephone:(user?.phoneNumber||'').replace(/\s+/g,''),sex:user?.sex||'NON_DECLARE'});}

}
