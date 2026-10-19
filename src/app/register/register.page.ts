import { Component, OnInit } from '@angular/core';
import {
    LoadingController, AlertController, MenuController, Platform
} from "@ionic/angular";
import { Router } from '@angular/router';
import { Validators, FormControl, FormGroup, FormBuilder } from '@angular/forms';
import { AuthService } from '../core/auth.service';

@Component({
    standalone: false,
    selector: 'app-register',
    templateUrl: './register.page.html',
    styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {

    app_version: string;

    registerFormGroup: FormGroup;

    passwordType: string = 'password';
    passwordIconName: string = 'eye';

    constructor(
        private router: Router,
        private platform: Platform,
        private formBuilder: FormBuilder,
        private menu: MenuController,
        private alertCtrl: AlertController,
        private loadingCtrl: LoadingController,
        private auth: AuthService) {

        this.registerFormGroup = this.formBuilder.group({
            'name': new FormControl('', [Validators.required]),
            'pseudo': new FormControl('', [Validators.required]),
            'telephone': new FormControl('', [Validators.required]),
            'email': new FormControl('', [Validators.required, Validators.email]),
            'password': new FormControl('', [Validators.required, Validators.minLength(8)]),
        });
    }

    ngOnInit() {}

    changePasswordType() {
        if (this.passwordType == 'password') {
            this.passwordType = 'text';
            this.passwordIconName = 'eye-off';
        } else {
            this.passwordType = 'password';
            this.passwordIconName = 'eye';
        }
    }

    async register(){
        if (this.registerFormGroup.invalid) { this.registerFormGroup.markAllAsTouched(); return; }
        const loading = await this.loadingCtrl.create({ message: 'Création du compte…' });
        await loading.present();
        const { pseudo, email, password } = this.registerFormGroup.value;
        this.auth.register(pseudo, email, password).subscribe({
            next: async () => { await loading.dismiss(); this.auth.logout(); const alert=await this.alertCtrl.create({header:'Confirmez votre adresse email',message:'Votre compte est créé, mais vous devez confirmer votre adresse avant de vous connecter. Consultez votre boîte mail puis cliquez sur le lien reçu.',backdropDismiss:false,buttons:[{text:'Renvoyer le lien',handler:()=>{this.auth.resendVerification(email).subscribe(); return false;}},{text:'J’ai compris',role:'cancel'}]});await alert.present(); },
            error: async error => { await loading.dismiss(); const alert = await this.alertCtrl.create({ header: 'Inscription impossible', message: error?.error?.message || 'Vérifiez les informations saisies.', buttons: ['Fermer'] }); await alert.present(); }
        });
    }

}
