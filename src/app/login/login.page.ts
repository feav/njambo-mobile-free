import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
    LoadingController, AlertController, MenuController, ModalController, Platform
} from "@ionic/angular";
import { ActivatedRoute, Router } from '@angular/router';
import { Validators, FormControl, FormGroup, FormBuilder } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { GuestJoinModalComponent } from '../shared/guest-join-modal/guest-join-modal.component';
import { environment } from '../../environments/environment';

interface GoogleCredentialResponse { credential?: string; }
interface GoogleIdentityApi {
    accounts: { id: {
        initialize(options: { client_id: string; callback: (response: GoogleCredentialResponse) => void; ux_mode?: string }): void;
        prompt(callback?: (notification: { isNotDisplayed(): boolean; isSkippedMoment(): boolean }) => void): void;
        renderButton(parent: HTMLElement, options: { theme: string; size: string; shape: string; text: string; width: number; locale: string }): void;
    }};
}

declare global { interface Window { google?: GoogleIdentityApi; } }

@Component({
    standalone: false,
    selector: 'app-login',
    templateUrl: './login.page.html',
    styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit, AfterViewInit {

    @ViewChild('googleButton') googleButton?: ElementRef<HTMLElement>;

    app_version: string;

    last_email: string = "";
    last_password: string = "";

    userCredentialsFormGroup: FormGroup;

    passwordType: string = 'password';
    passwordIconName: string = 'eye';
    socialLoginLoading = false;
    private googleScript?: Promise<void>;

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private platform: Platform,
        private formBuilder: FormBuilder,
        private menu: MenuController,
        private alertCtrl: AlertController,
        private loadingCtrl: LoadingController,
        private modalCtrl: ModalController,
        private auth: AuthService) {

        this.last_email = localStorage.getItem("last_email");

        this.userCredentialsFormGroup = this.formBuilder.group({
            'email': new FormControl(this.last_email, [Validators.required, Validators.email]),
            'password': new FormControl('', [Validators.required, Validators.minLength(8)]),
        });
    }

    ngOnInit() {}

    ngAfterViewInit() { void this.renderGoogleButton(); }

    changePasswordType() {
        if (this.passwordType == 'password') {
            this.passwordType = 'text';
            this.passwordIconName = 'eye-off';
        } else {
            this.passwordType = 'password';
            this.passwordIconName = 'eye';
        }
    }

    async openGuestJoin(event: Event) {
        event.preventDefault();
        const modal = await this.modalCtrl.create({ component: GuestJoinModalComponent, cssClass: 'guest-join-modal', breakpoints: [0, 0.6], initialBreakpoint: 0.6 });
        await modal.present();
    }

    async login(){
        if (this.userCredentialsFormGroup.invalid) { this.userCredentialsFormGroup.markAllAsTouched(); return; }
        const loading = await this.loadingCtrl.create({ message: 'Connexion…' });
        await loading.present();
        const { email, password } = this.userCredentialsFormGroup.value;
        this.auth.login(email, password).subscribe({
            next: async () => { localStorage.setItem('last_email', email); await loading.dismiss(); await this.menu.enable(true, 'main-menu'); await this.router.navigateByUrl(this.returnUrl()); },
            error: async error => { await loading.dismiss(); if(error?.error?.message==='EMAIL_NOT_VERIFIED'){const alert=await this.alertCtrl.create({header:'Email non confirmé',message:'Confirmez votre adresse email avec le lien reçu avant de vous connecter.',buttons:[{text:'Renvoyer le lien',handler:()=>{this.auth.resendVerification(email).subscribe();return false;}},{text:'Fermer',role:'cancel'}]});await alert.present();return;} const alert = await this.alertCtrl.create({ header: 'Connexion impossible', message: error?.error?.message || 'Identifiants incorrects.', buttons: ['Fermer'] }); await alert.present(); }
        });
    }

    private async renderGoogleButton() {
        try {
            await this.loadGoogleIdentity();
            window.google!.accounts.id.initialize({
                client_id: environment.googleClientId,
                ux_mode: 'popup',
                callback: response => void this.completeGoogleLogin(response)
            });
            if (!this.googleButton) return;
            const width = Math.max(180, Math.min(400, this.googleButton.nativeElement.clientWidth || 280));
            window.google!.accounts.id.renderButton(this.googleButton.nativeElement, {
                theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width, locale: 'fr'
            });
        } catch {
            await this.showGoogleError('Le service Google est momentanément indisponible.');
        }
    }

    private async completeGoogleLogin(response: GoogleCredentialResponse) {
        if (!response.credential) {
            this.socialLoginLoading = false;
            await this.showGoogleError('Google n’a pas retourné de preuve de connexion.');
            return;
        }
        const loading = await this.loadingCtrl.create({ message: 'Connexion avec Google…' });
        await loading.present();
        this.auth.googleLogin(response.credential).subscribe({
            next: async () => {
                this.socialLoginLoading = false;
                await loading.dismiss();
                await this.menu.enable(true, 'main-menu');
                await this.router.navigateByUrl(this.returnUrl());
            },
            error: async error => {
                this.socialLoginLoading = false;
                await loading.dismiss();
                const code = error?.error?.message;
                const message = code === 'SOCIAL_ACCOUNT_LINK_REQUIRED'
                    ? 'Un compte Njambo existe déjà avec cette adresse. Connectez-vous avec votre mot de passe pour le moment.'
                    : 'La connexion Google a échoué. Veuillez réessayer.';
                await this.showGoogleError(message);
            }
        });
    }

    private returnUrl(){const value=this.route.snapshot.queryParamMap.get('returnUrl');return value?.startsWith('/')&&!value.startsWith('//')?value:'/home';}

    private loadGoogleIdentity(): Promise<void> {
        if (window.google?.accounts?.id) return Promise.resolve();
        if (this.googleScript) return this.googleScript;
        this.googleScript = new Promise((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
            if (existing) {
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.dataset['googleIdentity'] = 'true';
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);
        });
        return this.googleScript;
    }

    private async showGoogleError(message: string) {
        const alert = await this.alertCtrl.create({ header: 'Connexion Google impossible', message, buttons: ['Fermer'] });
        await alert.present();
    }

}
