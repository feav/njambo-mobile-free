import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertController, IonicModule, LoadingController, ModalController, MenuController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
    selector: 'app-guest-join-modal',
    standalone: true,
    imports: [CommonModule, IonicModule, ReactiveFormsModule],
    templateUrl: './guest-join-modal.component.html',
    styleUrls: ['./guest-join-modal.component.scss'],
})
export class GuestJoinModalComponent {
    signupBonusAmount = 0;
    form = new FormGroup({
        email: new FormControl('', [Validators.required, Validators.email]),
    });

    constructor(
        private modal: ModalController,
        private auth: AuthService,
        private router: Router,
        private menu: MenuController,
        private alertCtrl: AlertController,
        private loadingCtrl: LoadingController) {
        this.auth.signupBonus().subscribe({ next: bonus => this.signupBonusAmount = Number(bonus) || 0, error: () => undefined });
    }

    close() { void this.modal.dismiss(); }

    async join() {
        if (this.form.invalid) { this.form.markAllAsTouched(); return; }
        const { email } = this.form.value;
        const loading = await this.loadingCtrl.create({ message: 'Création de votre accès…' });
        await loading.present();
        this.auth.guestJoin(email!).subscribe({
            next: async () => {
                await loading.dismiss();
                await this.menu.enable(true, 'main-menu');
                await this.modal.dismiss({ joined: true });
                await this.router.navigateByUrl('/campaign');
            },
            error: async error => {
                await loading.dismiss();
                const alert = await this.alertCtrl.create({
                    header: 'Impossible de continuer',
                    message: error?.error?.message || 'Cette adresse email ne peut pas être utilisée pour l’instant.',
                    buttons: ['Fermer'],
                });
                await alert.present();
            }
        });
    }
}
