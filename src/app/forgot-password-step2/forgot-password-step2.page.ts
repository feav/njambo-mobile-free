import { Component, OnInit } from '@angular/core';
import {
    LoadingController, AlertController, MenuController, Platform
} from "@ionic/angular";
import { Router } from '@angular/router';
import { Validators, FormControl, FormGroup, FormBuilder } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';import { AuthService } from '../core/auth.service';

@Component({
    standalone: false,
    selector: 'app-forgot-password-step2',
    templateUrl: './forgot-password-step2.page.html',
    styleUrls: ['./forgot-password-step2.page.scss'],
})
export class ForgotPasswordStep2Page implements OnInit {

    app_version: string;

    forgotPasswordStep2FormGroup: FormGroup;

    passwordType: string = 'password';
    passwordIconName: string = 'eye';

    constructor(
        private router: Router,
        private platform: Platform,
        private formBuilder: FormBuilder,
        private menu: MenuController,
        private alertCtrl: AlertController,
        private loadingCtrl: LoadingController,private route:ActivatedRoute,private auth:AuthService) {

        this.forgotPasswordStep2FormGroup = this.formBuilder.group({
            'email': new FormControl('', [Validators.required,Validators.email]),
            'code': new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]),
            'password': new FormControl('', [Validators.required, Validators.minLength(8)]),
            'confirmPassword': new FormControl('', [Validators.required, Validators.minLength(8)]),
        });
    }

    ngOnInit() {const email=this.route.snapshot.queryParamMap.get('email');if(email)this.forgotPasswordStep2FormGroup.patchValue({email});}

    changePasswordType() {
        if (this.passwordType == 'password') {
            this.passwordType = 'text';
            this.passwordIconName = 'eye-off';
        } else {
            this.passwordType = 'password';
            this.passwordIconName = 'eye';
        }
    }

    async reset(){
        if(this.forgotPasswordStep2FormGroup.invalid){this.forgotPasswordStep2FormGroup.markAllAsTouched();return;}const {email,code,password,confirmPassword}=this.forgotPasswordStep2FormGroup.value;if(password!==confirmPassword){const alert=await this.alertCtrl.create({header:'Vérification',message:'Les deux mots de passe ne correspondent pas.',buttons:['Fermer']});await alert.present();return;}const loading=await this.loadingCtrl.create({message:'Modification…'});await loading.present();this.auth.resetPassword(email.trim(),code.trim(),password,confirmPassword).subscribe({next:async()=>{await loading.dismiss();const alert=await this.alertCtrl.create({header:'Mot de passe modifié',message:'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',buttons:[{text:'Se connecter',handler:()=>void this.router.navigate(['/login'])}]});await alert.present();},error:async error=>{await loading.dismiss();const alert=await this.alertCtrl.create({header:'Code refusé',message:error?.error?.message||'Ce code est invalide ou expiré.',buttons:['Fermer']});await alert.present();}});
    }

}
