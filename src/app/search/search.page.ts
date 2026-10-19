import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { firstValueFrom, interval, Subscription } from 'rxjs';
import { GameApiService, GamePageDto, GameSummaryDto, GameType } from '../core/game-realtime/game-api.service';
import { GameBoardNavigationService } from '../core/game-board-navigation.service';
import { AuthService } from '../core/auth.service';
import { AccountApiService } from '../core/account-api.service';
import { InsufficientFundsAlertService } from '../core/insufficient-funds-alert.service';
import { RankedLocationService } from '../core/ranked-location.service';
import { QuickMatchModalComponent } from '../shared/quick-match-modal/quick-match-modal.component';
import { CampaignApiService, PlayerExperience } from '../core/campaign-api.service';

@Component({ standalone: false, selector: 'app-search', templateUrl: './search.page.html', styleUrls: ['./search.page.scss'] })
export class SearchPage implements OnInit, OnDestroy {
  activeTab = 'a-venir';
  games: GameSummaryDto[] = [];
  loading = false;
  loadingMore = false;
  searchOpen = false;
  searchQuery = '';
  filterOpen = false;
  selectedPlayerCount: number | null = null;
  selectedGameType: GameType | null = null;
  selectedAccessType: 'PUBLIC' | 'PRIVATE' | null = null;
  readonly gameTypes: GameType[] = ['FAFAP', 'PRESIDENT', 'UNO', 'COCHON_GRATTE', 'CHECK_GAMES', 'TCHIA_DIRECT', 'TCHIA_IMPOT', 'TCHIA_GARAME'];
  private readonly tablePageSize = 10;
  private currentPage = 0;
  private loadGeneration = 0;
  private gameIdFilter = '';
  hasMoreTables = false;
  readonly tabTotals: Record<string, number> = {'a-venir': 0, 'en-cours': 0, terminees: 0};
  username = '';
  avatarUrl = '/assets/images/avatars/armel.png';
  balance = 0;
  private experience?: PlayerExperience;
  private readonly subscriptions = new Subscription();

  constructor(private route: ActivatedRoute, private router: Router, private api: GameApiService,
              private toast: ToastController, private alerts: AlertController,
              private auth: AuthService, private accounts: AccountApiService,
              private boardNavigation:GameBoardNavigationService,
              private insufficientFunds: InsufficientFundsAlertService,
              private rankedLocation:RankedLocationService,
              private modalCtrl: ModalController,
              private campaigns: CampaignApiService) {
    this.subscriptions.add(this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab');
      if (tab && ['en-cours', 'a-venir', 'terminees'].includes(tab)) this.activeTab = tab;
      const gameId = params.get('gameId') || params.get('inviteGameId');
      if (gameId) {
        this.gameIdFilter = gameId.trim();
        this.activeTab = 'a-venir';
      }
    }));
  }

  ngOnInit() {
    this.subscriptions.add(this.auth.user$.subscribe(session => {
      this.username = session?.user.username || 'Joueur';
      this.avatarUrl = session?.user.avatarUrl || this.avatarUrl;
    }));
    this.accounts.get().subscribe(account => this.balance = account.availableBalance);
    this.campaigns.experience().subscribe({ next: experience => this.experience = experience, error: () => undefined });
    this.loadGames();
    this.subscriptions.add(interval(20_000).subscribe(() => {
      if (!this.loading && !this.loadingMore) this.loadGames(true);
    }));
    if (this.route.snapshot.queryParamMap.get('quickMatch') === '1') {
      window.setTimeout(() => void this.openQuickMatch(), 0);
    }
  }

  ngOnDestroy() { this.subscriptions.unsubscribe(); }

  get tables() {
    return this.games
      .filter(game => this.matchesTab(game))
      .filter(game => !this.gameIdFilter || game.gameId.toLowerCase() === this.gameIdFilter.toLowerCase())
      .filter(game => this.matchesSearch(game))
      .filter(game => this.selectedGameType === null || (game.gameType || 'FAFAP') === this.selectedGameType)
      .filter(game => this.selectedPlayerCount === null || game.requiredPlayerCount === this.selectedPlayerCount)
      .filter(game => this.selectedAccessType === null || game.accessType === this.selectedAccessType)
      .sort((left, right) => {
        const creatorPriority = Number(this.isHumanCreated(right)) - Number(this.isHumanCreated(left));
        if (creatorPriority !== 0) return creatorPriority;
        return Number(this.isParticipant(right)) - Number(this.isParticipant(left));
      })
      .map(game => this.toTable(game));
  }
  get visibleTables() { return this.tables; }
  trackTable(_index: number, table: ReturnType<SearchPage['toTable']>) { return table.game.gameId; }
  trackPlayerAvatar(index: number, avatarUrl: string) { return `${avatarUrl}|${index}`; }
  count(status: string) { return this.games.filter(game => game.status === status).length; }
  get platformInProgressCount() {
    return this.tabTotals['en-cours'];
  }
  setTab(tab: string) { this.activeTab = tab; this.loadGames(); }
  toggleSearch() {
    this.searchOpen = !this.searchOpen;
    if (!this.searchOpen) this.clearSearch();
    else window.setTimeout(() => document.querySelector<HTMLIonInputElement>('#game-search')?.setFocus(), 120);
  }
  setSearchQuery(value: string | null | undefined) { this.searchQuery = value || ''; this.resetInfiniteScroll(); }
  clearSearch() { this.searchQuery = ''; this.resetInfiniteScroll(); }
  toggleFilters() { this.filterOpen = !this.filterOpen; }
  setPlayerCountFilter(count: number | null) { this.selectedPlayerCount = count; this.resetInfiniteScroll(); }
  setGameTypeFilter(type: GameType | null) { this.selectedGameType = type; this.resetInfiniteScroll(); }
  setAccessTypeFilter(type: 'PUBLIC' | 'PRIVATE' | null) { this.selectedAccessType = type; this.resetInfiniteScroll(); }
  resetFilters() { this.selectedPlayerCount = null; this.selectedGameType = null; this.selectedAccessType = null; this.resetInfiniteScroll(); }

  loadMoreTables(event: Event) {
    const infiniteScroll = event.target as HTMLIonInfiniteScrollElement;
    if (!this.hasMoreTables || this.loadingMore) { void infiniteScroll.complete(); return; }
    const generation = this.loadGeneration;
    const tab = this.activeTab;
    const nextPage = this.currentPage + 1;
    this.loadingMore = true;
    this.api.listPage(this.statusesForTab(tab), nextPage, this.tablePageSize, this.gameIdFilter || undefined).subscribe({
      next: rawResult => {
        const result = this.normalizePage(rawResult, nextPage);
        if (generation !== this.loadGeneration || tab !== this.activeTab) { void infiniteScroll.complete(); return; }
        this.currentPage = result.page;
        this.games = [...this.games, ...result.content];
        this.hasMoreTables = !result.last;
        this.tabTotals[tab] = result.totalElements;
        this.loadingMore = false;
        void infiniteScroll.complete();
      },
      error: () => {
        if (generation === this.loadGeneration) this.loadingMore = false;
        void infiniteScroll.complete();
        if (generation === this.loadGeneration && tab === this.activeTab) void this.showError('Impossible de charger les parties suivantes.');
      }
    });
  }

  async openQuickMatch() {
    const modal = await this.modalCtrl.create({
      component: QuickMatchModalComponent,
      cssClass: 'quick-match-modal',
      componentProps: {
        onMatchFound: (game: GameSummaryDto) => void this.joinTable(this.toTable(game)),
        onGameCreated: (game: { gameId: string }) => void this.boardNavigation.open(game.gameId),
      },
      breakpoints: [0, 0.7],
      initialBreakpoint: 0.7
    });
    await modal.present();
    await modal.onDidDismiss();
  }

  async joinTable(table: ReturnType<SearchPage['toTable']>) {
    const game = table.game;
    if (game.status === 'FINISHED' || game.status === 'CANCELLED') {
      void this.router.navigate(['/game-replay'], { queryParams: { gameId: game.gameId, gameType: game.gameType || 'FAFAP' } });
      return;
    }
    if (table.isParticipant) {
      void this.boardNavigation.open(game.gameId);
      return;
    }
    if (game.status !== 'WAITING_FOR_PLAYERS') {
      void this.boardNavigation.open(game.gameId);
      return;
    }
    if (game.availableSeats === 0 && game.waitlistAvailable > 0) {
      const accepted = await this.confirmWaitlist(game.waitlistCount + 1);
      if (!accepted) return;
    }
    const password = game.accessType === 'PRIVATE' ? await this.askGamePassword() : undefined;
    if (game.accessType === 'PRIVATE' && password === null) return;
    const location=await this.rankedLocation.capture(game.stakeAmount);
    if(location===null)return;
    this.api.join(game.gameId, password ?? undefined,location).subscribe({
      next: () => void this.boardNavigation.open(game.gameId),
      error: async error => {
        if (error?.error?.code === 'RANKED_EXPERIENCE_REQUIRED') {
          const playAnyway = await this.showRankedExperienceRequired(table.game.gameType);
          if (playAnyway) this.api.join(game.gameId, password ?? undefined, location, true).subscribe({next: () => void this.boardNavigation.open(game.gameId), error: retryError => void this.showJoinError(retryError, table)});
          return;
        }
        void this.showJoinError(error, table);
      }
    });
  }

  private async confirmWaitlist(position: number): Promise<boolean> {
    const alert = await this.alerts.create({
      cssClass: 'fafap-game-alert',
      header: 'Table complète',
      subHeader: `Position ${position} dans la file d’attente`,
      message: 'Vous rejoindrez la salle et pourrez discuter avec les joueurs. Si une place se libère avant le démarrage, vous serez automatiquement ajouté à la table.',
      buttons: [{ text: 'Annuler', role: 'cancel' }, { text: 'Rejoindre la file', role: 'confirm', cssClass: 'game-alert-primary' }]
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    return result.role === 'confirm';
  }

  private async askGamePassword(): Promise<string | null> {
    const alert = await this.alerts.create({
      cssClass: 'fafap-game-alert', header: 'Partie privée', subHeader: 'Mot de passe requis',
      inputs: [{ name: 'password', type: 'password', placeholder: 'Mot de passe', attributes: { autocomplete: 'current-password' } }],
      buttons: [{ text: 'Annuler', role: 'cancel' }, { text: 'Rejoindre', role: 'confirm' }]
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    return result.role === 'confirm' ? String(result.data?.values?.password || '') : null;
  }

  loadGames(merge = false) {
    const generation = ++this.loadGeneration;
    const tab = this.activeTab;
    this.loading = true;
    this.loadingMore = false;
    this.currentPage = 0;
    this.hasMoreTables = false;
    this.api.listPage(this.statusesForTab(tab), 0, this.tablePageSize, this.gameIdFilter || undefined).subscribe({
      next: rawResult => {
        const result = this.normalizePage(rawResult, 0);
        if (generation !== this.loadGeneration || tab !== this.activeTab) return;
        if (merge && tab === this.activeTab) this.mergeFirstPage(result.content);
        else this.games = result.content;
        this.currentPage = result.page;
        this.hasMoreTables = !result.last;
        this.tabTotals[tab] = result.totalElements;
        this.loading = false;
      },
      error: () => {
        if (generation !== this.loadGeneration || tab !== this.activeTab) return;
        this.games = [];
        this.loading = false;
        void this.showError('La liste des parties est momentanément indisponible. Réessayez dans un instant.');
      }
    });
  }
  private mergeFirstPage(incoming: GameSummaryDto[]) {
    const incomingIds = new Set(incoming.map(game => game.gameId));
    const tail = this.games.slice(this.tablePageSize).filter(game => !incomingIds.has(game.gameId));
    const existingById = new Map(this.games.map(game => [game.gameId, game]));
    const firstPage = incoming.map(game => {
      const previous = existingById.get(game.gameId);
      if (!previous) return game;
      Object.assign(previous, game);
      return previous;
    });
    this.games.splice(0, Math.min(this.tablePageSize, this.games.length), ...firstPage);
    const visibleIds = new Set(this.games.map(game => game.gameId));
    this.games.push(...tail.filter(game => !visibleIds.has(game.gameId)));
  }
  private normalizePage(result: GamePageDto | GameSummaryDto[], fallbackPage: number): GamePageDto {
    if (Array.isArray(result)) return {content: result, page: fallbackPage, size: result.length, totalElements: result.length, last: true};
    return {content: Array.isArray(result?.content) ? result.content : [], page: result?.page ?? fallbackPage, size: result?.size ?? this.tablePageSize, totalElements: result?.totalElements ?? 0, last: result?.last ?? true};
  }
  private resetInfiniteScroll() {}
  private statusesForTab(tab = this.activeTab) {
    if (tab === 'terminees') return ['FINISHED', 'CANCELLED'];
    if (tab === 'en-cours') return ['IN_PROGRESS', 'SETTLING'];
    return ['WAITING_FOR_PLAYERS', 'READY', 'STARTING'];
  }
  private matchesTab(game: GameSummaryDto) {
    if (this.activeTab === 'terminees') return game.status === 'FINISHED' || game.status === 'CANCELLED';
    if (this.activeTab === 'a-venir') return ['WAITING_FOR_PLAYERS', 'READY', 'STARTING'].includes(game.status);
    return ['IN_PROGRESS', 'SETTLING'].includes(game.status) && this.isParticipant(game);
  }
  private matchesSearch(game: GameSummaryDto) {
    const query = this.normalizeSearch(this.searchQuery);
    if (!query) return true;
    const gameType = this.gameName(game.gameType || 'FAFAP');
    const access = game.accessType === 'PRIVATE' ? 'privee prive mot de passe' : 'publique public';
    const searchable = [
      game.gameId,
      game.gameId.slice(0, 8),
      gameType,
      access,
      game.status,
      String(game.stakeAmount),
      String(game.requiredPlayerCount),
      ...game.players.map(player => player.username)
    ].join(' ');
    return this.normalizeSearch(searchable).includes(query);
  }
  private normalizeSearch(value: string) {
    return value.trim().toLocaleLowerCase('fr-FR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  private isParticipant(game: GameSummaryDto) {
    const currentUser = this.auth.currentUser();
    return game.players.some(player => player.userId === currentUser?.id || player.username === currentUser?.username);
  }
  private isHumanCreated(game: GameSummaryDto) {
    return game.players.find(player => player.seatNumber === 1)?.userType === 'HUMAN';
  }
  private toTable(game: GameSummaryDto) {
    const open = game.status === 'WAITING_FOR_PLAYERS' && game.availableSeats > 0;
    const queueOpen = game.status === 'WAITING_FOR_PLAYERS' && game.availableSeats === 0 && game.waitlistAvailable > 0;
    const isParticipant = this.isParticipant(game);
    const gameType = game.gameType || 'FAFAP';
    return {
      game, isParticipant, title: `Partie ${game.gameId.slice(0, 6)}`, code: game.gameId.slice(0, 8).toUpperCase(), blinds: game.stakeAmount.toLocaleString('fr-FR'),
      pot: (game.stakeAmount * game.playerCount).toLocaleString('fr-FR'), time: game.status === 'WAITING_FOR_PLAYERS' ? 'En attente' : `Version ${game.version}`,
      players: game.players.filter(player => player.status !== 'WAITLISTED').slice(0, 3).map(player => player.avatarUrl),
      extraPlayers: Math.max(0, game.playerCount - 3), icon: this.gameIcon(gameType), gameName: this.gameName(gameType), gameClass: gameType.toLowerCase(),
      label: game.accessType === 'PRIVATE' ? 'Table privée' : 'Table Njambo', status: open ? (game.accessType === 'PRIVATE' ? 'Privée' : 'Ouverte') : queueOpen ? `File ${game.waitlistCount}/4` : game.status === 'IN_PROGRESS' ? 'En cours' : game.status === 'FINISHED' ? 'Terminée' : game.status === 'CANCELLED' ? 'Annulée' : 'Complète',
      statusClass: open ? 'open' : game.status === 'IN_PROGRESS' ? 'running' : 'full', action: game.status === 'FINISHED' || game.status === 'CANCELLED' ? 'Revoir' : isParticipant ? 'Entrer' : open ? 'Rejoindre' : queueOpen ? `File d’attente · ${game.waitlistCount + 1}/4` : game.status === 'IN_PROGRESS' ? 'Voir la table' : 'Complet',
      actionDisabled: !isParticipant && game.status === 'WAITING_FOR_PLAYERS' && !open && !queueOpen
    };
  }
  private gameIcon(type:GameSummaryDto['gameType']){const asset=type==='FAFAP'?'fafap.webp':type==='CHECK_GAMES'?'check-games.webp':type==='PRESIDENT'?'tcheck.webp':type==='UNO'?'uno.webp':type==='TCHIA_DIRECT'?'21-direct.webp':type==='TCHIA_IMPOT'?'21-impot.webp':type==='TCHIA_GARAME'?'21-garame.webp':'cochon-gratte.webp';return `assets/images/game-types/${asset}`;}
  private gameName(type:GameSummaryDto['gameType']){return type==='FAFAP'?'FAFAP':type==='PRESIDENT'?'Président (Trou du cul)':type==='UNO'?'UNO':type==='CHECK_GAMES'?'Tcheck Game':type==='TCHIA_DIRECT'?'21 Direct':type==='TCHIA_IMPOT'?'21 Impot':type==='TCHIA_GARAME'?'21 Garame':'Cochon Gratté';}
  private async showJoinError(error: any, table: ReturnType<SearchPage['toTable']>) {
    const code = error?.error?.code || 'JOIN_FAILED';
    if (code === 'RANKED_EXPERIENCE_REQUIRED') {
      await this.showRankedExperienceRequired(table.game.gameType);
      return;
    }
    if (code === 'INSUFFICIENT_FUNDS') {
      await this.insufficientFunds.present({ required: table.game.stakeAmount });
      return;
    }
    const content = this.joinErrorContent(code, error?.error?.message, table);
    const alert = await this.alerts.create({
      cssClass: 'fafap-game-alert',
      header: content.header,
      subHeader: content.subHeader,
      message: content.message,
      buttons: [{ text: 'Fermer', role: 'cancel', cssClass: 'game-alert-cancel' }]
    });
    await alert.present();
  }
  private async showRankedExperienceRequired(gameType: GameType): Promise<boolean> {
    const gameName = this.gameName(gameType);
    const experience = this.experience || await firstValueFrom(this.campaigns.experience()).catch(() => undefined);
    if (experience) this.experience = experience;
    if (!experience?.lowExperienceOverrideEnabled) {
      const alert = await this.alerts.create({
        cssClass: 'fafap-game-alert',
        header: 'Encore un peu d’expérience',
        message: 'Vous devez atteindre le seuil d’expérience requis pour rejoindre cette partie classée.',
        buttons: [
          { text: 'Fermer', role: 'cancel', cssClass: 'game-alert-cancel' },
          { text: 'Ouvrir la campagne', role: 'campaign', cssClass: 'game-alert-primary' }
        ]
      });
      await alert.present();
      const result = await alert.onDidDismiss();
      if (result.role === 'campaign') await this.router.navigateByUrl('/campaign');
      return false;
    }
    const currentXp = experience?.games.find(game => game.gameType === gameType)?.xp || 0;
    const remainingXp = Math.max(0, (experience?.rankedXpThreshold ?? 40) - currentXp);
    const alert = await this.alerts.create({
      cssClass: 'fafap-game-alert ranked-experience-alert',
      header: 'Encore un peu d’expérience',
      subHeader: `Partie classée · ${gameName}`,
      message: `Vous n’avez pas encore assez d’expérience pour jouer une partie classée ${gameName}. Il vous reste ${remainingXp} XP pour pouvoir jouer des parties classées. Gagnez de l’expérience en progressant dans la campagne et en remportant des parties.`,
      buttons: [
        { text: 'Fermer', role: 'cancel', cssClass: 'game-alert-cancel' },
        { text: 'JOUER QUAND MÊME', role: 'confirm', cssClass: 'game-alert-primary' },
        { text: 'Ouvrir la campagne', role: 'campaign', cssClass: 'game-alert-primary' }
      ]
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    if (result.role === 'campaign') {
      await this.router.navigateByUrl('/campaign');
      return false;
    }
    return result.role === 'confirm';
  }
  private joinErrorContent(code: string, backendMessage: string | undefined,
                           table: ReturnType<SearchPage['toTable']>) {
    const messages: Record<string, { header: string; subHeader: string; message: string }> = {
      GAME_FULL: {
        header: 'Table complète',
        subHeader: 'Toutes les places sont occupées',
        message: 'Cette partie vient d’être complétée par d’autres joueurs. Choisissez une autre table disponible.'
      },
      WAITLIST_FULL: {
        header: 'File d’attente complète',
        subHeader: 'Les quatre places supplémentaires sont occupées',
        message: 'Choisissez une autre table ou actualisez la liste pour vérifier si une place vient de se libérer.'
      },
      PLAYER_ALREADY_JOINED: {
        header: 'Déjà inscrit',
        subHeader: 'Vous participez déjà à cette partie',
        message: 'Ouvrez directement le plateau pour retrouver cette partie.'
      },
      GAME_NOT_JOINABLE: {
        header: 'Partie indisponible',
        subHeader: 'Les inscriptions sont terminées',
        message: 'Cette partie a déjà commencé, a été annulée ou n’accepte plus de nouveaux joueurs.'
      },
      BOTS_NOT_ALLOWED: {
        header: 'Accès refusé',
        subHeader: 'Cette partie est réservée aux joueurs invités',
        message: 'Le créateur de ce TERRE a désactivé la participation des joueurs automatiques.'
      }
    };
    return messages[code] || {
      header: 'Connexion impossible',
      subHeader: 'La table n’a pas pu être rejointe',
      message: backendMessage || 'Une erreur est survenue. Actualisez la liste puis réessayez.'
    };
  }
  private async showError(message: string) { const toast = await this.toast.create({ message, duration: 2500, color: 'danger', position: 'top' }); await toast.present(); }
}
