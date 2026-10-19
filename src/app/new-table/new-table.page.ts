import { Component, OnInit } from '@angular/core';
import { AlertController, MenuController, ModalController, ToastController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { GameApiService, GameDescriptor, GameType, TerreDto } from '../core/game-realtime/game-api.service';
import { AuthService } from '../core/auth.service';
import { AccountApiService } from '../core/account-api.service';
import { GameBoardNavigationService } from '../core/game-board-navigation.service';
import { InsufficientFundsAlertService } from '../core/insufficient-funds-alert.service';
import { FriendRow, SocialApiService } from '../core/social-api.service';
import { RankedLocationService } from '../core/ranked-location.service';
import { CampaignApiService, PlayerExperience } from '../core/campaign-api.service';

type KoraMode = 'simple' | 'double' | 'triple';
type CreationStage = 'game' | 'stake' | 'kora' | 'players';
type PartyMode = 'staked' | 'casual';

@Component({
    standalone: false,
    selector: 'app-new-table',
    templateUrl: './new-table.page.html',
    styleUrls: ['./new-table.page.scss','./game-picker.scss','./new-table.mobile-games.scss'],
})
export class NewTablePage implements OnInit {
    readonly minimumStake = 25;
    creating = false;
    username = '';
    avatarUrl = '/assets/images/avatars/armel.png';
    balance = 0;

    stake: string = "25.00";
    number_of_players: number = 4;
    koraMode: KoraMode = 'simple';
    accessType: 'PUBLIC' | 'PRIVATE' = 'PUBLIC';
    privatePassword = '';
    friends: FriendRow[] = [];
    selectedFriendIds = new Set<string>();
    stage: CreationStage = 'game';
    selectedGameType:GameType='FAFAP';
    // A direct visit to /new-table opens the paid flow with the default stake.
    // The player can explicitly switch to a friendly game from the mode selector.
    partyMode: PartyMode = 'staked';
    casualTerres: TerreDto[] = [];
    private experience?: PlayerExperience;
    private autoCreateRequested = false;
    private autoCreateStarted = false;
    private requestedPlayerCount?: number;
    private readonly defaultGameTypes:GameDescriptor[]=[
        {type:'FAFAP',name:'FAFAP',description:'Le jeu de plis camerounais',minPlayers:2,maxPlayers:4,playable:true,boardRoute:'/game-board'},
        {type:'CHECK_GAMES',name:'Tcheck Game',description:'Le jeu officiel FapFap / Check Games',minPlayers:2,maxPlayers:10,playable:true,boardRoute:'/games/check-games'},
        {type:'UNO',name:'UNO',description:'Associez couleurs, valeurs et cartes d’action',minPlayers:2,maxPlayers:10,playable:true,boardRoute:'/games/uno'},
        {type:'COCHON_GRATTE',name:'Cochon Gratté',description:'Faites circuler la cinquième carte et reformez une famille',minPlayers:3,maxPlayers:13,playable:true,boardRoute:'/games/cochon-gratte'}
        ,{type:'TCHIA_DIRECT',name:'21 Direct',description:'Construisez la meilleure main sans dépasser 21',minPlayers:2,maxPlayers:6,playable:true,boardRoute:'/games/21-direct'}
        ,{type:'TCHIA_IMPOT',name:'21 Impôt',description:'Atteignez le meilleur total et évitez le KORAT',minPlayers:2,maxPlayers:6,playable:true,boardRoute:'/games/21-impot'}
        ,{type:'TCHIA_GARAME',name:'21 Garame',description:'Construisez la meilleure main avec les cartes du tapis',minPlayers:2,maxPlayers:5,playable:true,boardRoute:'/games/21-garame'}
    ];
    gameTypes:GameDescriptor[]=[...this.defaultGameTypes];
    constructor(
    private router: Router,
        private route: ActivatedRoute,
        private menu: MenuController,
        private modalCtrl: ModalController,
        private alertCtrl: AlertController,
        private games: GameApiService,
        private auth: AuthService,
        private accounts: AccountApiService,
        private boardNavigation: GameBoardNavigationService,
        private social: SocialApiService,
        private insufficientFunds: InsufficientFundsAlertService,
        private rankedLocation: RankedLocationService,
        private toast: ToastController,
        private campaigns: CampaignApiService) { }

    ngOnInit() {
        this.applyQuickMatchCriteria();
        this.auth.user$.subscribe(session=>{this.username=session?.user.username||'Joueur';this.avatarUrl=session?.user.avatarUrl||this.avatarUrl;});
        this.accounts.get().subscribe(account=>{this.balance=account.availableBalance;});
        this.campaigns.experience().subscribe({next:experience=>this.experience=experience,error:()=>undefined});
        this.games.gameTypes().subscribe({next:types=>{this.gameTypes=this.defaultGameTypes.map(fallback=>types.find(game=>game.type===fallback.type)||fallback);this.tryAutoCreate();},error:()=>{this.gameTypes=[...this.defaultGameTypes];this.tryAutoCreate();}});
        this.games.terres().subscribe({next:list=>{this.casualTerres=list.filter(terre=>terre.casual);this.tryAutoCreate();},error:()=>{this.casualTerres=[];this.tryAutoCreate();}});
        this.social.friends().subscribe({next:view=>this.friends=view.friends.filter(friend=>friend.userType==='HUMAN'),error:()=>this.friends=[]});
    }

    private applyQuickMatchCriteria() {
        const params = this.route.snapshot.queryParamMap;
        const gameType = params.get('gameType') as GameType | null;
        const players = Number(params.get('players'));
        const stake = Number(params.get('stake'));
        this.autoCreateRequested = params.get('autoCreate') === '1';
        if (gameType && this.defaultGameTypes.some(game => game.type === gameType)) this.selectedGameType = gameType;
        if (Number.isInteger(players) && players >= 2 && players <= 13) {
            this.requestedPlayerCount = players;
            this.number_of_players = players;
        }
        // A stake in the URL is only an internal parameter of the quick-match
        // fallback flow. A normal /new-table navigation must keep the in-code
        // default and must not receive a stake from the address bar.
        if (this.autoCreateRequested && Number.isFinite(stake) && stake >= 0) {
            this.stake = String(stake);
            this.partyMode = stake === 0 ? 'casual' : 'staked';
        }
        if (this.selectedGameType === 'COCHON_GRATTE' && this.number_of_players === 2) this.number_of_players = 3;
    }

    get koraMultiplier() {
        if (this.selectedGameType === 'TCHIA_DIRECT' || this.selectedGameType === 'TCHIA_IMPOT' || this.selectedGameType === 'TCHIA_GARAME') return 2;
        if (this.selectedGameType !== 'FAFAP') return 1;
        return this.koraMode === 'triple' ? 8 : this.koraMode === 'double' ? 4 : 2;
    }

    get selectedGame() {
        return this.gameTypes.find(game => game.type === this.selectedGameType) || this.gameTypes[0];
    }

    get playerCounts() {
        const game = this.selectedGame;
        if (!game) return [2, 3, 4];
        return Array.from({ length: game.maxPlayers - game.minPlayers + 1 }, (_, index) => game.minPlayers + index);
    }

    get gameIllustrationClass() {
        return `game-art ${this.selectedGameType.toLowerCase()}`;
    }

    get stages(): CreationStage[] {
        if (this.partyMode === 'casual') return ['game', 'players'];
        return this.selectedGameType === 'FAFAP' ? ['game', 'kora', 'stake', 'players'] : ['game', 'stake', 'players'];
    }

    get casualTerreForSelectedGame() {
        return this.casualTerres.find(terre => terre.gameType === this.selectedGameType);
    }

    setPartyMode(mode: PartyMode) {
        this.partyMode = mode;
        if (mode === 'staked' && Number(this.stake) < this.minimumStake) this.stake = String(this.minimumStake);
    }

    get stageNumber() {
        return this.stages.indexOf(this.stage) + 1;
    }

    get progressStages() {
        return this.partyMode === 'casual'
            ? ['game', 'players', 'summary']
            : ['game', 'stake', 'players', 'summary'];
    }
    get progressNumber() {
        if (this.stage === 'game') return 1;
        if (this.stage === 'players') return this.partyMode === 'casual' ? 2 : 3;
        return 2;
    }

    get isLastStage() {
        return this.stageNumber === this.stages.length;
    }

    get requiredBalance() {
        const stake = Number(this.stake) || 0;
        return stake * this.koraMultiplier;
    }

    private tryAutoCreate() {
        if (!this.autoCreateRequested || this.autoCreateStarted || !this.selectedGame) return;
        if (this.partyMode === 'casual' && !this.casualTerreForSelectedGame) return;
        if (this.requestedPlayerCount !== undefined
            && this.requestedPlayerCount >= this.selectedGame.minPlayers
            && this.requestedPlayerCount <= this.selectedGame.maxPlayers) {
            this.number_of_players = this.requestedPlayerCount;
        }
        this.autoCreateStarted = true;
        void this.create();
    }

    setKoraMode(mode: KoraMode) {
        this.koraMode = mode;
    }

    toggleFriend(userId: string) {
        if (this.selectedFriendIds.has(userId)) this.selectedFriendIds.delete(userId);
        else this.selectedFriendIds.add(userId);
        this.selectedFriendIds = new Set(this.selectedFriendIds);
    }

    selectGame(game:GameDescriptor){
        if (!game.playable) return;
        this.selectedGameType = game.type;
        if (this.number_of_players < game.minPlayers || this.number_of_players > game.maxPlayers) {
            this.number_of_players = Math.min(4, game.maxPlayers);
        }
        void this.nextStage();
    }

    async nextStage() {
        if (this.stage === 'stake' && Number(this.stake) < this.minimumStake) {
            const alert = await this.alertCtrl.create({ header: 'Participation invalide', message: `Le minimum est de ${this.minimumStake} JETONS.`, buttons: ['Compris'] });
            await alert.present();
            return;
        }
        const index = this.stages.indexOf(this.stage);
        if (index < this.stages.length - 1) this.stage = this.stages[index + 1];
    }

    previousStage() {
        const index = this.stages.indexOf(this.stage);
        if (index > 0) this.stage = this.stages[index - 1];
        else this.goBack();
    }

    async dismiss() {
        const dismissed = await this.modalCtrl.dismiss({ dismissed: true });
        if (!dismissed) {
            await this.router.navigate(['/home']);
        }
    }

    goBack() {
        this.router.navigate(['/search']);
    }

    openMenu() {
        this.menu.open('main-menu');
    }

    async create() {
        const game = this.selectedGame;
        if (!game || this.number_of_players < game.minPlayers || this.number_of_players > game.maxPlayers) {
            const alert = await this.alertCtrl.create({ header: 'Nombre invalide', message: `${game?.name || 'Ce jeu'} se joue de ${game?.minPlayers || 2} à ${game?.maxPlayers || 4} joueurs.`, buttons: ['Compris'] });
            await alert.present(); return;
        }
        if (this.partyMode === 'casual') { await this.createCasual(); return; }
        if (!(await this.hasRankedExperience())) return;
        if (Number(this.stake) < this.minimumStake) {
            const alert = await this.alertCtrl.create({
                cssClass: 'new-table-alert',
                header: 'Participation invalide',
                message: `Le minimum est de ${this.minimumStake} JETONS.`,
                buttons: ['Compris'],
            });
            await alert.present();
            return;
        }
        if (this.balance < this.requiredBalance) {
            await this.insufficientFunds.present({ required: this.requiredBalance });
            return;
        }
        if (this.accessType === 'PRIVATE' && this.privatePassword.trim().length < 4) {
            const alert = await this.alertCtrl.create({ header: 'Mot de passe requis', message: 'Choisis un mot de passe d’au moins 4 caractères.', buttons: ['Compris'] });
            await alert.present(); return;
        }
        const location=await this.rankedLocation.capture(Number(this.stake));
        if(location===null)return;

        this.creating = true;
        this.games.directCreate({
            gameType: this.selectedGameType,
            requiredPlayerCount: this.number_of_players,
            stakeAmount: Number(this.stake),
            maximumLossMultiplier: this.koraMultiplier,
            accessType: this.accessType,
            password: this.accessType === 'PRIVATE' ? this.privatePassword.trim() : undefined,
            playAnyway: this.rankedOverrideRequested
        }, location).subscribe({
            next: game => { this.creating = false; void this.inviteThenEnter(game.gameId); },
            error: async error => { this.creating = false; const alert = await this.alertCtrl.create({ header: 'Création impossible', message: error?.error?.message || 'Le service est momentanément indisponible. Réessayez dans un instant.', buttons: ['Fermer'] }); await alert.present(); }
        });
    }

    private rankedOverrideRequested = false;

    private async hasRankedExperience() {
        this.rankedOverrideRequested = false;
        const experience = this.experience || await this.campaigns.experience().toPromise().catch(() => undefined);
        if (experience) this.experience = experience;
        const currentXp = experience?.games.find(game => game.gameType === this.selectedGameType)?.xp || 0;
        const threshold = experience?.rankedXpThreshold ?? 40;
        const remainingXp = Math.max(0, threshold - currentXp);
        if (remainingXp === 0) return true;
        const gameName = this.selectedGame?.name || 'ce jeu';
        const buttons: any[] = [{ text: 'Fermer', role: 'cancel', cssClass: 'game-alert-cancel' }];
        if (experience?.lowExperienceOverrideEnabled) {
            buttons.push({ text: 'JOUER QUAND MÊME', role: 'confirm', cssClass: 'game-alert-primary' });
        }
        buttons.push({ text: 'Ouvrir la campagne', role: 'campaign', cssClass: 'game-alert-primary' });
        const alert = await this.alertCtrl.create({
            cssClass: 'fafap-game-alert ranked-experience-alert',
            header: 'Encore un peu d’expérience',
            subHeader: `Partie classée · ${gameName}`,
            message: `Vous n’avez pas encore assez d’expérience pour créer une partie classée ${gameName}. Il vous reste ${remainingXp} XP pour pouvoir jouer des parties classées. Gagnez de l’expérience en progressant dans la campagne et en remportant des parties.`,
            buttons
        });
        await alert.present();
        const result = await alert.onDidDismiss();
        if (result.role === 'campaign') await this.router.navigateByUrl('/campaign');
        this.rankedOverrideRequested = result.role === 'confirm';
        return this.rankedOverrideRequested;
    }

    private async createCasual() {
        if (this.accessType === 'PRIVATE' && this.privatePassword.trim().length < 4) {
            const alert = await this.alertCtrl.create({ header: 'Mot de passe requis', message: 'Choisis un mot de passe d’au moins 4 caractères.', buttons: ['Compris'] });
            await alert.present(); return;
        }
        this.creating = true;
        this.games.directCreate({ gameType: this.selectedGameType, requiredPlayerCount: this.number_of_players, stakeAmount: 0, maximumLossMultiplier: 0, accessType: this.accessType, password: this.accessType === 'PRIVATE' ? this.privatePassword.trim() : undefined }).subscribe({
            next: game => { this.creating = false; void this.inviteThenEnter(game.gameId); },
            error: async error => { this.creating = false; const alert = await this.alertCtrl.create({ header: 'Création impossible', message: error?.error?.message || 'Le service est momentanément indisponible. Réessayez dans un instant.', buttons: ['Fermer'] }); await alert.present(); }
        });
    }

    private async inviteThenEnter(gameId: string | undefined) {
        if (!gameId || !this.selectedFriendIds.size) { await this.enterCreatedGame(gameId); return; }
        this.games.inviteFriends(gameId, [...this.selectedFriendIds]).subscribe({
            next: async result => {
                const count = result.notifiedFriends;
                const notice = await this.toast.create({ message: `${count} invitation${count > 1 ? 's' : ''} envoyée${count > 1 ? 's' : ''}`, duration: 2200, position: 'top', color: 'success', icon: 'notifications-outline' });
                await notice.present(); await this.enterCreatedGame(gameId);
            },
            error: async () => {
                const notice = await this.toast.create({ message: 'Partie créée, mais certaines invitations n’ont pas pu être envoyées.', duration: 2600, position: 'top', color: 'warning' });
                await notice.present(); await this.enterCreatedGame(gameId);
            }
        });
    }

    private async enterCreatedGame(gameId: string | undefined) {
        if (!gameId) {
            const alert = await this.alertCtrl.create({
                header: 'Partie créée',
                message: 'La partie a été créée, mais son identifiant est absent de la réponse du serveur. Retrouvez-la dans vos parties en cours.',
                buttons: ['Fermer']
            });
            await alert.present();
            return;
        }

        await this.menu.close();
        const openModal = await this.modalCtrl.getTop();
        if (openModal) await openModal.dismiss();

        try {
            const redirected = await this.boardNavigation.open(gameId, true);
            if (redirected) return;
        } catch {
            // Une navigation navigateur garantit l'ouverture de la partie si Ionic refuse la transition.
        }
        window.location.assign(this.router.serializeUrl(this.router.createUrlTree(['/game-board'], { queryParams: { gameId } })));
    }
}
