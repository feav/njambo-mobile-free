import { Component, OnInit } from '@angular/core';
import {
    LoadingController, AlertController, MenuController, Platform
} from "@ionic/angular";
import { Router } from '@angular/router';
import { Validators, FormControl, FormGroup, FormBuilder } from '@angular/forms';
import { AuthService } from '../core/auth.service';

@Component({
    standalone: false,
    selector: 'app-forgot-password-step1',
    templateUrl: './forgot-password-step1.page.html',
    styleUrls: ['./forgot-password-step1.page.scss'],
})
export class ForgotPasswordStep1Page implements OnInit {

    app_version: string;

    forgotPasswordStep1FormGroup: FormGroup;

    passwordType: string = 'password';
    passwordIconName: string = 'eye';

    constructor(
        private router: Router,
        private platform: Platform,
        private formBuilder: FormBuilder,
        private menu: MenuController,
        private alertCtrl: AlertController,
        private loadingCtrl: LoadingController,private auth:AuthService) {

        this.forgotPasswordStep1FormGroup = this.formBuilder.group({
            'email': new FormControl('', [Validators.required, Validators.email])
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

    async checkEmail(){
        if(this.forgotPasswordStep1FormGroup.invalid){this.forgotPasswordStep1FormGroup.markAllAsTouched();return;}
        const email=this.forgotPasswordStep1FormGroup.value.email.trim(),loading=await this.loadingCtrl.create({message:'Envoi du code…'});await loading.present();
        this.auth.forgotPassword(email).subscribe({next:async()=>{await loading.dismiss();const alert=await this.alertCtrl.create({header:'Consultez votre boîte mail',message:'Si cette adresse correspond à un compte, un code valable 15 minutes vient d’être envoyé.',buttons:[{text:'Saisir le code',handler:()=>void this.router.navigate(['/forgot-password-step2'],{queryParams:{email}})}]});await alert.present();},error:async()=>{await loading.dismiss();const alert=await this.alertCtrl.create({header:'Envoi impossible',message:'Le service e-mail est momentanément indisponible.',buttons:['Fermer']});await alert.present();}});
    }

}
