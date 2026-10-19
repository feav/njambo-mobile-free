import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertController, ToastController } from '@ionic/angular';
import { ContactRequestService } from './contact-request.service';

@Component({
    standalone: false,
    selector: 'app-help',
    templateUrl: './help.page.html',
    styleUrls: ['./help.page.scss'],
})
export class HelpPage implements OnInit {
    contactForm: FormGroup;
    isSubmitting = false;
    expandedFaq: number | null = 0;

    constructor(
        private formBuilder: FormBuilder,
        private contactRequestService: ContactRequestService,
        private toastController: ToastController,
        private alertController: AlertController
    ) {
        this.contactForm = this.buildForm();
    }

    ngOnInit() {
        this.prefillContactForm();
    }

    private buildForm(): FormGroup {
        return this.formBuilder.group({
            fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
            email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
            phone: ['', [Validators.maxLength(30)]],
            subject: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
            message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
        });
    }

    private prefillContactForm() {
        this.contactForm.patchValue({
            fullName: localStorage.getItem('last_name') || localStorage.getItem('display_name') || '',
            email: localStorage.getItem('last_email') || '',
        });
    }

    toggleFaq(index: number) {
        this.expandedFaq = this.expandedFaq === index ? null : index;
    }

    isInvalid(controlName: string) {
        const control = this.contactForm.get(controlName);
        return Boolean(control?.invalid && (control.dirty || control.touched));
    }

    async startChat() {
        const alert = await this.alertController.create({
            header: 'Chat en direct',
            message: 'Un conseiller va rejoindre la conversation. En attendant, décris brièvement ta demande.',
            inputs: [{ name: 'message', type: 'textarea', placeholder: 'Écris ton message…' }],
            buttons: [
                { text: 'Annuler', role: 'cancel' },
                {
                    text: 'Démarrer',
                    handler: async data => {
                        if (!data.message?.trim()) {
                            return false;
                        }
                        const toast = await this.toastController.create({
                            message: 'Demande de chat envoyée. Un conseiller te répondra bientôt.',
                            duration: 2500,
                            position: 'bottom',
                            color: 'success'
                        });
                        await toast.present();
                        return true;
                    }
                }
            ]
        });
        await alert.present();
    }

    async submit() {
        if (this.contactForm.invalid) {
            this.contactForm.markAllAsTouched();
            const toast = await this.toastController.create({
                message: 'Complète les champs obligatoires.',
                duration: 2200,
                position: 'bottom',
                color: 'warning'
            });
            await toast.present();
            return;
        }

        this.isSubmitting = true;
        const payload = this.contactForm.getRawValue();

        this.contactRequestService.submit(payload).subscribe({
            next: async response => {
                this.isSubmitting = false;
                this.contactForm.reset({
                    fullName: payload.fullName,
                    email: payload.email,
                    phone: '',
                    subject: '',
                    message: '',
                });
                const alert = await this.alertController.create({
                    header: 'Demande envoyée',
                    message: `Ta demande est enregistrée avec le statut ${response.contactRequest.status}.`,
                    buttons: ['OK']
                });
                await alert.present();
            },
            error: async () => {
                this.isSubmitting = false;
                const toast = await this.toastController.create({
                    message: 'Impossible d’envoyer la demande pour le moment.',
                    duration: 2400,
                    position: 'bottom',
                    color: 'danger'
                });
                await toast.present();
            }
        });
    }
}
