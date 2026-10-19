import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {AlertController, ToastController} from '@ionic/angular';
import {merge, Subject, Subscription, timer} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {AuthService} from '../core/auth.service';
import {ChampionshipApiService, ChampionshipDetail, ChampionshipMatch} from '../core/championship-api.service';
import {GameBoardNavigationService} from '../core/game-board-navigation.service';

const CHAMPIONSHIP_ERROR_MESSAGES: Record<string, string> = {
  CHAMPIONSHIP_GAME_IN_PROGRESS: 'Termine d’abord la partie en cours avant d’abandonner.',
  CHAMPIONSHIP_NO_RUNNING_MATCH: 'Aucun duel en cours pour ce championnat.',
  CHAMPIONSHIP_NOT_IN_REGISTRATION: 'Les inscriptions sont déjà closes.',
  CHAMPIONSHIP_NOT_IN_PROGRESS: 'Ce championnat n’est pas en cours.',
  CHAMPIONSHIP_CREATOR_REQUIRED: 'Seul le créateur peut annuler ce championnat.',
  CHAMPIONSHIP_FULL: 'Ce championnat est complet.',
  INSUFFICIENT_FUNDS: 'Solde insuffisant pour payer l’inscription.'
};

@Component({
  standalone: false,
  selector: 'app-championship-detail',
  templateUrl: './championship-detail.page.html',
  styleUrls: ['./championships.page.scss']
})
export class ChampionshipDetailPage implements OnInit, OnDestroy {
  detail?: ChampionshipDetail;
  loading = true;
  refreshing = false;
  actionBusy = false;
  error = '';
  private championshipId = '';
  private refresh?: Subscription;
  private manualRefresh = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private api: ChampionshipApiService,
    private auth: AuthService,
    private navigation: GameBoardNavigationService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading = false; this.error = 'Championnat introuvable.'; return; }
    this.championshipId = id;
    this.refresh = merge(timer(0, 30000), this.manualRefresh).pipe(switchMap(() => this.api.get(id))).subscribe({
      next: value => { this.detail = value; this.loading = false; this.refreshing = false; this.error = ''; },
      error: error => { this.loading = false; this.refreshing = false; this.error = error?.error?.message || 'Impossible de charger ce championnat.'; }
    });
  }

  ngOnDestroy() { this.refresh?.unsubscribe(); }

  refreshNow() { this.refreshing = true; this.manualRefresh.next(); }
  trackRound(_index:number,column:{round:number}) { return column.round; }
  trackMatch(_index:number,node:{position:number;match?:ChampionshipMatch}) { return node.match?.id ?? node.position; }

  get myParticipant() {
    const userId = this.auth.currentUser()?.id;
    return this.detail?.participants.find(player => player.userId === userId);
  }

  get bracketRounds() {
    const levels = this.detail?.championship.levels || 0;
    return Array.from({length: levels}, (_, index) => {
      const round = index + 1;
      const count = 1 << (levels - round);
      return {
        round,
        name: this.roundName(round),
        matches: Array.from({length: count}, (_, position) => {
          const match = this.detail?.matches.find(value => value.round === round && value.position === position);
          const first = match?.participantOneId || (round === 1 ? this.detail?.participants[position * 2]?.id : undefined);
          const second = match?.participantTwoId || (round === 1 ? this.detail?.participants[position * 2 + 1]?.id : undefined);
          return {position, match, first, second};
        })
      };
    });
  }

  player(id?: string) { return this.detail?.participants.find(player => player.id === id); }
  roundName(round: number) { const left = (this.detail?.championship.levels || 1) - round; return left === 0 ? 'Finale' : left === 1 ? 'Demi-finale' : left === 2 ? 'Quart de finale' : `Tour ${round}`; }
  outcome(match?: ChampionshipMatch, participantId?: string) { return !match || match.status !== 'FINISHED' || !participantId ? '' : match.winnerParticipantId === participantId ? 'victory' : 'defeat'; }
  score(match: ChampionshipMatch | undefined, side: 1 | 2) { return match ? side === 1 ? match.scoreOne : match.scoreTwo : 0; }
  estimatedChampionGain() { const c = this.detail?.championship; if (!c) return 0; let wallet = c.entryFee; for (let round = 1; round < c.levels; round++) wallet *= 2 * (1 - c.feePercentage / 100); return Math.max(0, wallet * 2 * (1 - c.feePercentage / 100) - c.entryFee / 2); }
  estimatedFinalistGain() { const c = this.detail?.championship; return c ? c.entryFee / 2 : 0; }
  gameName(type: string) { return type === 'FAFAP' ? 'FAFAP' : type === 'PRESIDENT' ? 'Président' : type === 'UNO' ? 'UNO' : type === 'CHECK_GAMES' ? 'Tcheck Games' : 'Cochon Gratté'; }
  get statusMessage() {
    const status = this.detail?.championship.status;
    if (status === 'REGISTRATION') return `${this.detail?.participants.length || 0} joueur(s) inscrit(s). Le tableau attend ses prochains challengers.`;
    if (status === 'IN_PROGRESS') return this.myCurrentGame ? 'Ton prochain duel est prêt.' : 'Le championnat est en cours. Suis la progression du tableau.';
    if (status === 'FINISHED') return 'Le championnat est terminé. Le champion est entré dans la légende.';
    return 'Ce championnat a été annulé.';
  }
  get myMatch() { const me=this.myParticipant; return this.detail?.matches.find(value=>value.status==='RUNNING'&&(value.participantOneId===me?.id||value.participantTwoId===me?.id)); }
  get myCurrentGame() { return this.myMatch?.games.find(value=>!['FINISHED','CANCELLED'].includes(value.status)); }
  get readinessMessage() { const match=this.myMatch,me=this.myParticipant;if(!match||!me)return'';const mine=match.participantOneId===me.id?match.participantOneReadyAt:match.participantTwoReadyAt;const other=match.participantOneId===me.id?match.participantTwoReadyAt:match.participantOneReadyAt;if(mine&&!other&&match.readyDeadline)return`La partie démarrera à ${new Date(match.readyDeadline).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}, même sans votre adversaire.`;if(!mine&&other&&match.readyDeadline)return`Rejoignez avant ${new Date(match.readyDeadline).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}. Ensuite, la partie démarrera automatiquement.`;if(!mine&&!other)return'Le duel attend la confirmation d’un joueur.';return''; }
  openCurrentGame() {
    const me = this.myParticipant;
    const match = this.detail?.matches.find(value => value.status === 'RUNNING' && (value.participantOneId === me?.id || value.participantTwoId === me?.id));
    const game = match?.games.find(value => !['FINISHED','CANCELLED'].includes(value.status));
    if (game) void this.navigation.open(game.gameId);
  }

  get canLeaveRegistration() { return this.detail?.championship.status === 'REGISTRATION' && this.myParticipant?.status === 'ACTIVE'; }
  get canJoinRegistration() {
    return this.detail?.championship.status === 'REGISTRATION' && !this.myParticipant;
  }
  get canCancelRegistration() { return this.detail?.championship.canCancel === true; }
  get canAbandon() { return this.detail?.championship.status === 'IN_PROGRESS' && this.myParticipant?.status === 'ACTIVE' && !!this.myMatch; }

  async confirmJoin() {
    if (this.actionBusy || !this.canJoinRegistration) return;
    const fee = this.detail?.championship.entryFee || 0;
    const alert = await this.alertController.create({
      header: 'S’inscrire au championnat',
      message: fee > 0
        ? `L’inscription demande ${fee.toLocaleString('fr-FR')} JETONS. Confirmer ?`
        : 'Confirmer ton inscription à ce championnat ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'S’inscrire', cssClass: 'game-alert-primary', handler: () => { void this.doJoin(); return true; } }
      ]
    });
    await alert.present();
  }

  private doJoin() {
    if (!this.championshipId) return;
    this.actionBusy = true;
    this.api.join(this.championshipId).subscribe({
      next: value => { this.actionBusy = false; this.detail = value; void this.notice('Inscription confirmée.'); },
      error: async error => { this.actionBusy = false; await this.notice(this.errorMessage(error), 'danger'); }
    });
  }

  liveGame(match?: ChampionshipMatch) { return match?.games.find(value => value.status === 'IN_PROGRESS'); }
  spectate(match?: ChampionshipMatch, event?: Event) {
    event?.stopPropagation();
    const game = this.liveGame(match);
    if (game) void this.navigation.open(game.gameId, false, true);
  }

  async confirmLeave() {
    if (this.actionBusy) return;
    const alert = await this.alertController.create({
      header: 'Se désinscrire',
      message: 'Tes jetons seront rendus intégralement. Confirmer la désinscription ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Se désinscrire', cssClass: 'game-alert-primary', handler: () => { void this.doLeave(); return true; } }
      ]
    });
    await alert.present();
  }

  private async doLeave() {
    if (!this.championshipId) return;
    this.actionBusy = true;
    this.api.leave(this.championshipId).subscribe({
      next: value => { this.actionBusy = false; this.detail = value; void this.notice('Désinscription confirmée, jetons rendus.'); },
      error: async error => { this.actionBusy = false; await this.notice(this.errorMessage(error), 'danger'); }
    });
  }

  async confirmCancel() {
    if (this.actionBusy) return;
    const alert = await this.alertController.create({
      header: 'Annuler le championnat',
      message: 'Le championnat sera annulé et les jetons des participants seront rendus. Cette action est définitive.',
      buttons: [
        { text: 'Retour', role: 'cancel' },
        { text: 'Annuler le championnat', cssClass: 'game-alert-primary', handler: () => { void this.doCancel(); return true; } }
      ]
    });
    await alert.present();
  }

  private async doCancel() {
    if (!this.championshipId) return;
    this.actionBusy = true;
    this.api.cancel(this.championshipId).subscribe({
      next: value => { this.actionBusy = false; this.detail = value; void this.notice('Championnat annulé, les jetons ont été rendus.'); },
      error: async error => { this.actionBusy = false; await this.notice(this.errorMessage(error), 'danger'); }
    });
  }

  async confirmAbandon() {
    if (this.actionBusy) return;
    const alert = await this.alertController.create({
      header: 'Abandonner le championnat',
      message: 'Ton adversaire remportera le duel et tu seras éliminé du tournoi. Cette action est définitive.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Abandonner', cssClass: 'game-alert-primary', handler: () => { void this.doAbandon(); return true; } }
      ]
    });
    await alert.present();
  }

  private async doAbandon() {
    if (!this.championshipId) return;
    this.actionBusy = true;
    this.api.abandon(this.championshipId).subscribe({
      next: value => { this.actionBusy = false; this.detail = value; void this.notice('Tu as abandonné le championnat.'); },
      error: async error => { this.actionBusy = false; await this.notice(this.errorMessage(error), 'danger'); }
    });
  }

  private errorMessage(error: any) { const code = error?.error?.code || error?.error?.message; return CHAMPIONSHIP_ERROR_MESSAGES[code] || error?.error?.message || 'Action impossible.'; }

  private async notice(message: string, color = 'success') {
    const toast = await this.toastController.create({ message, color, duration: 2500, position: 'top' });
    await toast.present();
  }
}
