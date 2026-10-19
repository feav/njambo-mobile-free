import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../core/auth.service';
import {CardTheme,CardThemeService} from '../core/card-theme.service';
import {WebPushService} from '../core/web-push.service';
import {firstValueFrom} from 'rxjs';

@Component({
    standalone: false,
    selector: 'app-settings',
    templateUrl: './settings.page.html',
    styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
    avatarUrl = '/assets/images/avatars/armel.png';

    minimumStake: number = 0.0;
    maximumStake: number = 100.000;
    simpleKora: boolean = true;
    doubleKora: boolean = false;
    tripleKora: boolean = false;
    darkMode: boolean = false;
    notifications: boolean = localStorage.getItem('fafap.notifications.enabled') !== 'false';
    soundEnabled: boolean = true;
    musicEnabled: boolean = true;
    autoSortEnabled: boolean = true;
    language: string = "fr";
    cardTheme: CardTheme = 'normal';

    saving = false;
    constructor(private router: Router, private auth: AuthService, public cards: CardThemeService, private toast:ToastController,private push:WebPushService) { }

    ngOnInit() {
        this.soundEnabled = localStorage.getItem('fafap.sound.enabled') !== 'false';
        this.musicEnabled = localStorage.getItem('fafap.music.enabled') !== 'false';
        this.autoSortEnabled = localStorage.getItem('fafap.auto.sort.enabled') !== 'false';
        this.cardTheme = this.cards.current;
        void this.push.enabled().then(enabled=>{if(enabled)this.notifications=true;else if(this.push.permission==='denied')this.notifications=false;});
        this.auth.user$.subscribe(session => {this.avatarUrl=session?.user.avatarUrl||this.avatarUrl;if(session?.user.cardTheme)this.cardTheme=session.user.cardTheme;});
    }
    
    goToSettingsPage(){
        this.router.navigate(['/settings']);
    }

    goToTransactionsPage() {
        this.router.navigate(['/transactions']);
    }

    resetSettings() {
        this.minimumStake = 0;
        this.maximumStake = 100;
        this.simpleKora = true;
        this.doubleKora = false;
        this.tripleKora = false;
        this.darkMode = false;
        this.notifications = true;
        this.soundEnabled = true;
        this.musicEnabled = true;
        this.autoSortEnabled = true;
        this.language = 'fr';
        this.cardTheme = 'normal';
    }

    async saveSettings() {
        if(this.saving)return;
        localStorage.setItem('fafap.sound.enabled', String(this.soundEnabled));
        localStorage.setItem('fafap.music.enabled', String(this.musicEnabled));
        localStorage.setItem('fafap.auto.sort.enabled', String(this.autoSortEnabled));
        this.cards.current = this.cardTheme;
        this.saving=true;
        try{await this.push.setEnabled(this.notifications);await firstValueFrom(this.auth.updateCardTheme(this.cardTheme));const toast=await this.toast.create({message:'Paramètres enregistrés avec succès',duration:2200,position:'bottom',color:'success',icon:'checkmark-circle-outline'});await toast.present();}
        catch(error){this.notifications=await this.push.enabled();const message=error instanceof Error?error.message:'Impossible d’enregistrer les paramètres';const toast=await this.toast.create({message,duration:3200,position:'bottom',color:'danger'});await toast.present();}
        finally{this.saving=false;}
    }

}
