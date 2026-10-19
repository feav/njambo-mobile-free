import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import {
  ChampionshipApiService,
  ChampionshipSummary,
  MyChampionshipInvitation,
} from '../core/championship-api.service';
import { GameType } from '../core/game-realtime/game-api.service';
import { InsufficientFundsAlertService } from '../core/insufficient-funds-alert.service';
type ChampionshipTab = 'past' | 'current' | 'waiting';
@Component({
  standalone: false,
  selector: 'app-championships',
  templateUrl: './championships.page.html',
  styleUrls: ['./championships.page.scss'],
})
export class ChampionshipsPage implements OnInit, OnDestroy {
  items: ChampionshipSummary[] = [];
  invitations: MyChampionshipInvitation[] = [];
  loading = true;
  creating = false;
  busy = false;
  invitationBusy = false;
  activeTab: ChampionshipTab = 'waiting';
  now = Date.now();
  private countdownTimer = window.setInterval(
    () => (this.now = Date.now()),
    1000,
  );
  form = {
    name: 'Championnat Njambo',
    gameType: 'FAFAP' as GameType,
    levels: 3,
    entryFee: 1000,
    bestOf: 3,
    durationMinutes: 60,
    startMode: 'IMMEDIATE' as 'IMMEDIATE' | 'SCHEDULED',
    scheduledStartAt: '',
  };
  minScheduledStart = this.toLocalDateTime(new Date(Date.now() + 3600000));
  constructor(
    private api: ChampionshipApiService,
    private router: Router,
    private toast: ToastController,
    private insufficientFunds: InsufficientFundsAlertService,
  ) {}
  ngOnInit() {
    this.reload();
  }
  ngOnDestroy() {
    window.clearInterval(this.countdownTimer);
  }
  ionViewWillEnter() {
    this.activeTab = 'waiting';
    this.reload();
  }
  get participants() {
    return 1 << this.form.levels;
  }
  get filteredItems() {
    return this.items.filter((item) =>
      this.activeTab === 'past'
        ? item.status === 'FINISHED' || item.status === 'CANCELLED'
        : this.activeTab === 'current'
          ? item.status === 'IN_PROGRESS'
          : item.status === 'REGISTRATION',
    );
  }
  tabCount(tab: ChampionshipTab) {
    return this.items.filter((item) =>
      tab === 'past'
        ? item.status === 'FINISHED' || item.status === 'CANCELLED'
        : tab === 'current'
          ? item.status === 'IN_PROGRESS'
          : item.status === 'REGISTRATION',
    ).length;
  }
  reload() {
    this.loading = true;
    this.api.list().subscribe({
      next: (v) => {
        this.items = v;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
    this.api
      .invitations()
      .subscribe({
        next: (v) => (this.invitations = v),
        error: () => undefined,
      });
  }
  open(item: ChampionshipSummary) {
    void this.router.navigate(['/championships', item.id]);
  }
  get scheduledInvalid() {
    return this.form.startMode === 'SCHEDULED' && !this.form.scheduledStartAt;
  }
  private toLocalDateTime(date: Date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }
  trackChampionship(_index: number, item: ChampionshipSummary) {
    return item.id;
  }
  trackInvitation(_index: number, item: MyChampionshipInvitation) {
    return item.id;
  }
  countdown(item: ChampionshipSummary) {
    const left = Math.max(
      0,
      new Date(item.scheduledStartAt || 0).getTime() - this.now,
    );
    if (left <= 0) return 'Démarrage en cours';
    const total = Math.ceil(left / 1000),
      days = Math.floor(total / 86400),
      hours = Math.floor((total % 86400) / 3600),
      minutes = Math.floor((total % 3600) / 60),
      seconds = total % 60;
    return days > 0
      ? `${days}j ${hours}h ${minutes}min`
      : hours > 0
        ? `${hours}h ${minutes}min ${seconds}s`
        : `${minutes}min ${seconds}s`;
  }
  formattedParisStart(item: ChampionshipSummary) {
    if (!item.scheduledStartAt) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(item.scheduledStartAt));
  }
  estimatedChampionGain(item: ChampionshipSummary) {
    return this.estimatedPayout(item.entryFee, item.levels, item.feePercentage)
      .champion;
  }
  estimatedFinalistGain(item: ChampionshipSummary) {
    return this.estimatedPayout(item.entryFee, item.levels, item.feePercentage)
      .finalist;
  }
  private estimatedPayout(
    entryFee: number,
    levels: number,
    feePercentage: number,
  ) {
    let wallet = entryFee;
    for (let round = 1; round < levels; round++)
      wallet = wallet * 2 * (1 - feePercentage / 100);
    const distributable = wallet * 2 * (1 - feePercentage / 100);
    return {
      champion: Math.max(0, distributable - entryFee / 2),
      finalist: Math.min(entryFee / 2, distributable),
    };
  }
  gameName(type: GameType) {
    return type === 'FAFAP'
      ? 'FAFAP'
      : type === 'PRESIDENT'
        ? 'Président (Trou du cul)'
        : type === 'UNO'
          ? 'UNO'
          : type === 'CHECK_GAMES'
            ? 'Tcheck Game'
            : 'Cochon Gratté';
  }
  create() {
    if (
      this.form.entryFee <= 0 ||
      this.form.durationMinutes < 10 ||
      this.form.durationMinutes > 1440 ||
      this.scheduledInvalid
    )
      return;
    this.busy = true;
    this.api
      .create({
        name: this.form.name,
        gameType: this.form.gameType,
        levels: this.form.levels,
        entryFee: this.form.entryFee,
        bestOf: this.form.bestOf,
        durationMinutes: this.form.durationMinutes,
        startMode: this.form.startMode,
        scheduledStartAt:
          this.form.startMode === 'SCHEDULED'
            ? new Date(this.form.scheduledStartAt).toISOString()
            : undefined,
      })
      .subscribe({
        next: (v) => {
          this.busy = false;
          this.creating = false;
          void this.notice('Championnat créé');
          void this.router.navigate(['/championships', v.championship.id]);
        },
        error: (e) => {
          this.busy = false;
          void this.notice(
            e?.error?.message || 'Création impossible',
            'danger',
          );
        },
      });
  }
  join(item: ChampionshipSummary, event?: Event) {
    event?.stopPropagation();
    this.busy = true;
    this.api.join(item.id).subscribe({
      next: (v) => {
        this.busy = false;
        void this.notice('Inscription confirmée');
        void this.router.navigate(['/championships', v.championship.id]);
      },
      error: (e) => {
        this.busy = false;
        void this.notice(
          e?.error?.message || 'Inscription impossible',
          'danger',
        );
      },
    });
  }
  acceptInvitation(invitation: MyChampionshipInvitation, event?: Event) {
    event?.stopPropagation();
    if (this.invitationBusy) return;
    this.invitationBusy = true;
    this.api.acceptInvitation(invitation.id).subscribe({
      next: (v) => {
        this.invitationBusy = false;
        this.invitations = this.invitations.filter(
          (i) => i.id !== invitation.id,
        );
        void this.notice('Inscription confirmée');
        void this.router.navigate(['/championships', v.championship.id]);
      },
      error: (e) => {
        this.invitationBusy = false;
        if (e?.error?.code === 'INSUFFICIENT_FUNDS')
          void this.insufficientFunds.present({
            required: invitation.entryFee,
          });
        else
          void this.notice(
            e?.error?.message || 'Acceptation impossible',
            'danger',
          );
      },
    });
  }
  declineInvitation(invitation: MyChampionshipInvitation, event?: Event) {
    event?.stopPropagation();
    if (this.invitationBusy) return;
    this.invitationBusy = true;
    this.api.declineInvitation(invitation.id).subscribe({
      next: () => {
        this.invitationBusy = false;
        this.invitations = this.invitations.filter(
          (i) => i.id !== invitation.id,
        );
      },
      error: (e) => {
        this.invitationBusy = false;
        void this.notice(e?.error?.message || 'Refus impossible', 'danger');
      },
    });
  }
  private async notice(message: string, color = 'success') {
    const t = await this.toast.create({
      message,
      color,
      duration: 2200,
      position: 'top',
    });
    await t.present();
  }
}
