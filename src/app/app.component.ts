import { Component } from '@angular/core';
import {
    Platform, Config, ModalController,
    AlertController, MenuController
} from '@ionic/angular';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { AuthService, AuthUser } from './core/auth.service';
import { AccountApiService } from './core/account-api.service';
import { BUILD_INFO } from '../generated/build-info';
import {PwaUpdateService} from './core/pwa-update.service';
import {WebPushService} from './core/web-push.service';
import {ChampionshipFlowService} from './core/championship-flow.service';
import {PageAnalyticsService} from './core/page-analytics.service';
import {environment} from '../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { GameTutorialService } from './core/game-tutorial.service';
import { GameTutorialType } from './core/game-tutorial.config';

interface GoogleCredentialResponse { credential?: string; }
interface GoogleIdentityApi {
    accounts: {
        id: {
            initialize(options: {client_id: string; callback: (response: GoogleCredentialResponse) => void; auto_select?: boolean; cancel_on_tap_outside?: boolean}): void;
            prompt(callback?: (notification: {isNotDisplayed(): boolean; isSkippedMoment(): boolean}) => void): void;
        };
    };
}

interface PwaInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Component({
    standalone: false,
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss'],
})
export class AppComponent {
    username = 'Joueur';
    avatarUrl = '/assets/images/avatars/armel.png';
    balance = 0;
    showFacebookSupport=false;
    readonly facebookSupportLink='https://www.facebook.com/share/18uac1vKUv';
    private notificationPromptOpen=false;
    private invitedReminderShown=false;
    private googleAutoLoginStarted = false;
    private pwaInstallPrompt?: PwaInstallPromptEvent;
    private pwaInstallPromptOpen = false;
    private availableChallengesPromptShown = false;

    pages: any[];

    readonly appVersion = BUILD_INFO.version;
    readonly commitHash = BUILD_INFO.commit;

    constructor(platform: Platform,
        config: Config,
        private router: Router,
        private modalCtrl: ModalController,
        private menu: MenuController,
        private alertCtrl: AlertController,
        private auth: AuthService,
        private accounts: AccountApiService,
        private pwaUpdates:PwaUpdateService,
        private webPush:WebPushService,
        private championshipFlow:ChampionshipFlowService,
        private pageAnalytics:PageAnalyticsService,
        private http:HttpClient,
        private tutorials: GameTutorialService) {
        platform.ready().then(() => {
            // if(platform.is("ios"))
            //     config.set('backButtonText', '');
        });
        this.pages = [
            { title: 'Accueil', route: '/home', icon: 'fas fa-home' },
            { title: 'Profil', route: '/profile', icon: 'fas fa-user' },
            { title: 'Transactions', route: '/transactions', icon: 'fas fa-coins' },
            { title: 'Tables Live', route: '/search', icon: 'fas fa-signal' },
            { title: 'Championnats', route: '/championships', icon: 'fas fa-crown' },
            { title: 'Défis & primes', route: '/challenges', icon: 'fas fa-medal' },
            { title: 'Campagne', route: '/campaign', icon: 'fas fa-map' },
            { title: 'Classement ELO', route: '/leaderboard', icon: 'fas fa-trophy' },
            { title: 'Amis', route: '/friends', icon: 'fas fa-user-friends' },
            { title: 'Guildes', route: '/guilds', icon: 'fas fa-shield-alt' },
            { title: 'Parrainage', route: '/referral', icon: 'fas fa-gift' },
            { title: 'Abonnements', route: '/subscriptions', icon: 'fas fa-star' },
            { title: 'Paramètres', route: '/settings', icon: 'fas fa-cog' },
            { title: 'Règles du jeu', route: '/rules', icon: 'fas fa-scroll' },
            { title: 'Aide & Support', route: '/help', icon: 'fas fa-info-circle' },
        ]
        // Un overlay Ionic peut terminer son animation de fermeture après que
        // la route suivante est déjà affichée. Sur mobile, son backdrop alors
        // invisible continue à capter les taps. Toute navigation ferme donc
        // explicitement les overlays de la page que l'on quitte.
        this.router.events.subscribe(event => {
            if (event instanceof NavigationStart) void this.dismissNavigationOverlays();
            if (event instanceof NavigationEnd) {
                this.updateFacebookSupport(event.urlAfterRedirects);
                const tutorialType = this.tutorialTypeForUrl(event.urlAfterRedirects);
                if (tutorialType && new URL(event.urlAfterRedirects, window.location.origin).searchParams.has('gameId')) {
                    window.setTimeout(() => void this.tutorials.maybePresent(tutorialType), 350);
                }
                // Only once navigation has actually settled — presenting it earlier gets it
                // wiped by dismissNavigationOverlays() above, which runs on every navigation
                // (e.g. the guest-join redirect to /campaign right after login).
                const user = this.auth.currentUser();
                if (user) void this.maybeShowInvitedReminder(user);
            }
        });
        // Android Chrome emits this event only once per page load. Keep it
        // until the authenticated user explicitly chooses to install.
        window.addEventListener('beforeinstallprompt', event => {
            event.preventDefault();
            this.pwaInstallPrompt = event as PwaInstallPromptEvent;
        });
        window.addEventListener('appinstalled', () => {
            this.pwaInstallPrompt = undefined;
            localStorage.setItem('njambo.pwa.installed', '1');
        });
    }

    get currentTutorialType(): GameTutorialType | undefined {
        return this.tutorialTypeForUrl(this.router.url);
    }

    reviewCurrentTutorial() {
        const type = this.currentTutorialType;
        if (type) void this.tutorials.present(type);
    }

    reactivateTutorials() { void this.tutorials.reactivateAll(); }

    private tutorialTypeForUrl(url: string): GameTutorialType | undefined {
        const path = url.split(/[?#]/)[0];
        if (path === '/game-board') return 'FAFAP';
        if (path.startsWith('/games/check-games')) return 'CHECK_GAMES';
        if (path.startsWith('/games/cochon-gratte')) return 'COCHON_GRATTE';
        if (path.startsWith('/games/uno')) return 'UNO';
        if (path.startsWith('/games/21-direct')) return 'TCHIA_DIRECT';
        if (path.startsWith('/games/21-impot')) return 'TCHIA_IMPOT';
        if (path.startsWith('/games/21-garame')) return 'TCHIA_GARAME';
        return undefined;
    }

    private async dismissNavigationOverlays() {
        const alert = await this.alertCtrl.getTop().catch(() => undefined);
        if (alert) await alert.dismiss(undefined, 'navigation').catch(() => undefined);
        const modal = await this.modalCtrl.getTop().catch(() => undefined);
        if (modal) await modal.dismiss(undefined, 'navigation').catch(() => undefined);
        await this.menu.close('main-menu').catch(() => undefined);
    }

    ngOnInit() {
        this.pwaUpdates.start();
        this.pageAnalytics.start();
        this.auth.user$.subscribe(session=>{this.username=session?.user.username||'Joueur';this.avatarUrl=session?.user.avatarUrl||this.avatarUrl;if(session){this.accounts.get().subscribe(account=>{this.balance=account.availableBalance;void this.maybeShowLowBalanceCoachPrompt(session.user.id,account.availableBalance);});void this.showAvailableChallenges(session.user.id);void this.enableDefaultNotifications();void this.championshipFlow.checkPendingMatch();void this.maybePromptPwaInstall(session.user.id);}else{this.balance=0;this.availableChallengesPromptShown=false;}this.updateFacebookSupport(this.router.url);});
        void this.tryAutomaticGoogleLogin();
    }

    private updateFacebookSupport(url:string){const path=url.split(/[?#]/)[0];const gameBoard=/^\/(?:game-board|games\/(?:tcheck|check-games|uno|cochon-gratte|21-direct|21-impot|21-garame)|game-replay)(?:\/|$)/.test(path);const excluded=gameBoard||/^\/(?:login|register|forgot-password|search|new-table|filter-table)(?:\/|$)/.test(path)||/^\/championships\/[^/]+/.test(path);this.showFacebookSupport=!!this.auth.currentUser()&&!excluded;}

    private isPwaInstalled(): boolean {
        return localStorage.getItem('njambo.pwa.installed') === '1'
            || window.matchMedia?.('(display-mode: standalone)').matches === true
            || (navigator as Navigator & {standalone?: boolean}).standalone === true;
    }

    private async maybePromptPwaInstall(userId: string) {
        if (Capacitor.isNativePlatform() || this.pwaInstallPromptOpen || this.isPwaInstalled()) return;
        const userAgent = navigator.userAgent;
        const iosDevice = /iphone|ipad|ipod/i.test(userAgent) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(userAgent));
        const androidDevice = /android/i.test(userAgent);
        if (!iosDevice && !androidDevice) return;
        const key = `njambo.pwa.install-prompt.last-shown.${userId}`;
        const lastShown = Number(localStorage.getItem(key) || 0);
        if (Number.isFinite(lastShown) && Date.now() - lastShown < 24 * 60 * 60 * 1000) return;
        localStorage.setItem(key, String(Date.now()));
        this.pwaInstallPromptOpen = true;
        const ios = iosDevice;
        const android = androidDevice;
        const alert = await this.alertCtrl.create({
            cssClass: `fafap-game-alert pwa-install-alert ${ios ? 'pwa-install-alert-ios' : 'pwa-install-alert-android'}`,
            header: 'Installez Njambo',
            message: ios
                ? 'Ajoutez Njambo à votre écran d’accueil pour retrouver vos parties plus rapidement : appuyez sur Partager, puis « Sur l’écran d’accueil » et « Ajouter ».'
                : android
                    ? 'Installez Njambo sur votre écran d’accueil pour accéder plus rapidement à vos parties.'
                    : 'Ajoutez Njambo à votre écran d’accueil pour y accéder plus rapidement.',
            buttons: [
                { text: 'Plus tard', role: 'cancel', cssClass: 'game-alert-cancel' },
                { text: ios ? 'Voir les étapes' : 'Installer', cssClass: 'game-alert-primary', handler: () => { void this.installPwa(android); } }
            ]
        });
        await alert.present();
        await alert.onDidDismiss();
        this.pwaInstallPromptOpen = false;
    }

    private async installPwa(android: boolean) {
        if (this.pwaInstallPrompt) {
            const prompt = this.pwaInstallPrompt;
            this.pwaInstallPrompt = undefined;
            await prompt.prompt();
            const choice = await prompt.userChoice;
            if (choice.outcome === 'accepted') localStorage.setItem('njambo.pwa.installed', '1');
            return;
        }
        if (android) {
            const alert = await this.alertCtrl.create({cssClass: 'fafap-game-alert pwa-install-alert pwa-install-alert-android', header: 'Installer Njambo', message: 'Dans le menu du navigateur, choisissez « Ajouter à l’écran d’accueil » ou « Installer l’application ».', buttons: [{text: 'Compris', cssClass: 'game-alert-primary'}]});
            await alert.present();
        }
    }

    private async tryAutomaticGoogleLogin() {
        if (this.googleAutoLoginStarted || this.auth.currentUser() || !environment.googleClientId) return;
        this.googleAutoLoginStarted = true;
        try {
            await this.loadGoogleIdentity();
            const google = (window as Window & {google?: GoogleIdentityApi}).google;
            if (!google) return;
            if (this.auth.currentUser()) return;
            google.accounts.id.initialize({
                client_id: environment.googleClientId,
                auto_select: true,
                cancel_on_tap_outside: false,
                callback: response => {
                    const credential = response?.credential;
                    if (!credential || this.auth.currentUser()) return;
                    this.auth.googleLogin(credential).subscribe({
                        next: () => void this.router.navigate(['/home']),
                        error: () => undefined
                    });
                }
            });
            google.accounts.id.prompt();
        } catch {
            // L’absence du SDK Google ne doit jamais empêcher l’accès manuel à l’écran de connexion.
        }
    }

    private loadGoogleIdentity(): Promise<void> {
        if ((window as Window & {google?: GoogleIdentityApi}).google?.accounts?.id) return Promise.resolve();
        const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
        if (existing) return new Promise((resolve, reject) => { existing.addEventListener('load', () => resolve(), {once: true}); existing.addEventListener('error', () => reject(new Error('GOOGLE_SDK_LOAD_FAILED')), {once: true}); });
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.dataset['googleIdentity'] = 'true';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('GOOGLE_SDK_LOAD_FAILED'));
            document.head.appendChild(script);
        });
    }

    private async enableDefaultNotifications(){if(!this.webPush.available||await this.webPush.enabled()||this.webPush.permission==='denied'||this.notificationPromptOpen)return;if(this.webPush.permission==='granted'){await this.webPush.setEnabled(true).catch(()=>undefined);return;}this.notificationPromptOpen=true;const alert=await this.alertCtrl.create({header:'Restez informé de vos parties',message:'Activez les notifications pour savoir lorsqu’un joueur rejoint votre table et lorsque votre partie commence.',backdropDismiss:false,buttons:[{text:'Plus tard',role:'cancel'},{text:'Activer les notifications',cssClass:'game-alert-primary',handler:()=>{void this.webPush.setEnabled(true);}}]});await alert.present();await alert.onDidDismiss();this.notificationPromptOpen=false;}

    private async maybeShowLowBalanceCoachPrompt(userId:string,balance:number){
        if(balance>=100)return;
        const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        const key=`fafap.low-balance-coach-prompt.${userId}.${day}`;
        if(localStorage.getItem(key))return;
        localStorage.setItem(key,'1');
        const alert=await this.alertCtrl.create({
            cssClass:'fafap-game-alert',
            header:'Ton solde fait une pause, pas ta progression 🎯',
            message:'Affronte les coachs virtuels dans la Campagne : gagne des badges, monte de niveau et prépare tes prochaines victoires — sans miser un centime.',
            buttons:[
                {text:'Plus tard',role:'cancel'},
                {text:'Voir la Campagne',cssClass:'game-alert-primary',handler:()=>{void this.router.navigateByUrl('/campaign');}}
            ]
        });
        await alert.present();
    }

    private async showDailyQuest(userId:string){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const key=`fafap.daily-quest.${userId}.${day}`;if(localStorage.getItem(key))return;this.http.get<{active:boolean;name:string;reward:number;claimedToday:boolean}>(`${environment.apiBaseUrl}/api/promotions/daily-quest`).subscribe({next:async quest=>{if(!quest.active||quest.claimedToday)return;localStorage.setItem(key,'1');const alert=await this.alertCtrl.create({header:'Quête quotidienne',message:`Jouez une partie classée avec partie avec jetons aujourd’hui et recevez ${quest.reward} JETONS de récompense. Une seule fois par jour.`,buttons:[{text:'Compris',cssClass:'game-alert-primary'}]});await alert.present();},error:()=>undefined});}

    private async showAvailableChallenges(userId:string){
        if(this.availableChallengesPromptShown)return;
        this.availableChallengesPromptShown=true;
        this.http.get<Array<{name:string;reward:number;eligible:boolean;claimed:boolean}>>(`${environment.apiBaseUrl}/api/challenges`).subscribe({
            next: async challenges=>{
                const available=challenges.filter(challenge=>challenge.eligible&&!challenge.claimed);
                if(!available.length)return;
                const names=available.slice(0,4).map(challenge=>`${challenge.name} (+${challenge.reward} F)`).join('\n');
                const more=available.length>4?`\n… et ${available.length-4} autre${available.length-4>1?'s':''}`:'';
                const alert=await this.alertCtrl.create({
                    cssClass:'fafap-game-alert available-challenges-alert',
                    header:`${available.length} prime${available.length>1?'s':''} disponible${available.length>1?'s':''}`,
                    message:`Tu peux réclamer :\n${names}${more}`,
                    buttons:[
                        {text:'Plus tard',role:'cancel'},
                        {text:'Voir mes primes',cssClass:'game-alert-primary',handler:()=>{void this.router.navigateByUrl('/challenges');}}
                    ]
                });
                await alert.present();
            },
            error:()=>{this.availableChallengesPromptShown=false;}
        });
    }

    private async maybeShowInvitedReminder(user: AuthUser) {
        if (user.status !== 'INVITED' || this.invitedReminderShown) return;
        this.invitedReminderShown = true;
        this.http.get<number>(`${environment.apiBaseUrl}/api/promotions/signup-bonus`).subscribe({
            next: async bonus => {
                const reward = bonus > 0 ? ` et recevez ${bonus} JETONS de bonus de bienvenue` : '';
                const alert = await this.alertCtrl.create({
                    header: 'Confirmez votre email',
                    message: `Validez le lien reçu par email${reward}. Sans confirmation, ce compte d’essai sera désactivé.`,
                    buttons: [
                        { text: 'Plus tard', role: 'cancel' },
                        { text: 'Renvoyer l’email', cssClass: 'game-alert-primary', handler: () => { this.auth.resendVerification(user.email).subscribe(); } }
                    ]
                });
                await alert.present();
            },
            error: () => { this.invitedReminderShown = false; }
        });
    }

    closeMenu() {
        this.menu.close('main-menu');
    }

    async onLogout() {
        const confirm = await this.alertCtrl.create({
            header: 'Attention, Déconnexion !',
            message: 'Êtes-vous sûr(e) de vouloir vous déconnecter ?',
            buttons: [
                {
                    text: 'Non',
                    handler: () => { }
                },
                {
                    text: 'Oui',
                    handler: () => { this.logout(); }
                }
            ]
        });
        confirm.present();
    }

    logout() {
        this.auth.logout();
        this.menu.enable(false, 'main-menu');
        this.router.navigate(['/login']);
    }
}
