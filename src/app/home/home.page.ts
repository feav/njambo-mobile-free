import { Component, OnInit } from '@angular/core';
import { MenuController, NavController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AccountApiService } from '../core/account-api.service';
import { GameApiService, GameReplayDto, GameSummaryDto } from '../core/game-realtime/game-api.service';
import { catchError, forkJoin, map, of } from 'rxjs';
import { FriendRow, SocialApiService } from '../core/social-api.service';

interface RecentTable {
    gameId: string;
    title: string;
    subtitle: string;
    status: string;
    statusClass: string;
    amount: string;
    image: string;
    players: string[];
    extraPlayers: number;
}

@Component({
    standalone: false,
    selector: 'app-home',
    templateUrl: 'home.page.html',
    styleUrls: ['home.page.scss'],
    styles: [`
      .promo-slider--legacy .promo-card{min-height:146px;padding:16px 18px;display:flex;align-items:center;justify-content:flex-start;background:linear-gradient(90deg,rgba(2,12,7,.96) 0%,rgba(2,12,7,.78) 34%,rgba(2,12,7,.08) 62%),var(--promo-background);background-position:center;background-repeat:no-repeat;background-size:cover}
      .promo-slider--legacy .promo-copy{position:relative;z-index:1}
      .promo-slider--legacy .promo-title{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:#f4c76b;font-size:1rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 0 12px rgba(244,199,107,.22)}
      .promo-slider--legacy .promo-title i{color:#ffd83d;font-size:.72rem;filter:drop-shadow(0 0 6px rgba(255,216,61,.42))}
      .promo-slider--legacy .promo-copy p{margin:0 0 14px;color:rgba(255,248,234,.92);font-size:.8rem;line-height:1.45;white-space:pre-line}
      .promo-slider--legacy .promo-copy button{min-height:40px;padding:0 16px;border:1px solid #79ff32;border-radius:14px;background:radial-gradient(circle at 50% 0%,rgba(137,255,74,.4),transparent 58%),linear-gradient(180deg,#238b20,#0d4f14);box-shadow:inset 0 1px rgba(220,255,198,.42),0 0 10px rgba(117,255,63,.48),0 0 22px rgba(117,255,63,.2);color:#fff;font-size:.66rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
    `],
})
export class HomePage implements OnInit {
    username = '';
    avatarUrl = '/assets/images/avatars/armel.png';
    balance = 0;
    activePromo = 0;
    activeRecentSlide = 0;
    recentLoading = false;
    friends: FriendRow[] = [];

    quickActions = [
        { label: 'Défis & primes', subtitle: 'Relève les défis', cta: 'Gagner', image: '../../assets/images/home/quick-actions/defis.png', route: '/challenges', tone: 'gold' },
        { label: 'Championnats', subtitle: 'Compétitions en cours', cta: 'Reprendre', image: '../../assets/images/home/quick-actions/tournois.png', route: '/championships', tone: 'gold' },
        { label: 'Campagne', subtitle: 'Continue ton parcours', cta: 'Continuer', image: '../../assets/images/home/quick-actions/missions.png', route: '/campaign', tone: 'purple' },
        { label: 'Classement', subtitle: 'Découvre ta position', cta: 'Voir', image: '../../assets/images/home/quick-actions/classement.png', route: '/leaderboard', tone: 'cyan' },
    ];

    recentTables: RecentTable[] = [];

    promoSlides = [
        {
            title: 'Triple Kora',
            description: 'Plus tu enchaînes,\nplus tu gagnes !',
            background: '../../assets/images/home/savoirplus.webp',
        },
        {
            title: 'Tables Live',
            description: 'Affronte les meilleurs\nen temps réel !',
            background: '../../assets/images/home/feature-cards/tables-live.webp',
        },
        {
            title: 'Partie rapide',
            description: 'Une table, des joueurs,\nla partie commence !',
            background: '../../assets/images/home/feature-cards/partie-rapide.webp',
        },
    ];

    get recentTableSlides() {
        const slides: RecentTable[][] = [];
        for (let index = 0; index < this.recentTables.length; index += 3) {
            slides.push(this.recentTables.slice(index, index + 3));
        }
        return slides;
    }

    constructor(
        private router: Router,
        private nav: NavController,
        private menu: MenuController,
        private auth: AuthService,
        private accounts: AccountApiService,
        private games: GameApiService,
        private social: SocialApiService,
    ) {}

    ngOnInit(){this.auth.user$.subscribe(session=>{this.username=session?.user.username||'Joueur';this.avatarUrl=session?.user.avatarUrl||this.avatarUrl;});if(!this.auth.accessToken()||!this.auth.hasRefreshToken())return;this.accounts.get().subscribe(account=>this.balance=account.availableBalance);this.social.friends().subscribe({next:view=>this.friends=view.friends,error:()=>this.friends=[]});this.loadRecentGames();}

    get friendPreview() { return this.friends.slice(0, 6); }
    trackFriend(_index:number,friend:FriendRow){return friend.userId;}
    trackRecentTable(_index:number,table:RecentTable){return table.gameId;}
    trackQuickAction(_index:number,action:{route:string}){return action.route;}
    trackPromo(_index:number,promo:{title:string}){return promo.title;}

    goToProfilePage() {
        void this.nav.navigateRoot('/profile', { replaceUrl: true });
    }

    goToGameBoardPage(event?: Event) {
        if (event?.type === 'keydown') {
            event.preventDefault();
        }
        (event?.currentTarget as HTMLElement | null)?.blur?.();
        (document.activeElement as HTMLElement | null)?.blur?.();
        void this.nav.navigateRoot('/search', { queryParams: { tab: 'a-venir', quickMatch: '1' }, replaceUrl: true });
    }

    openRecentGame(gameId: string, event?: Event) {
        event?.stopPropagation();
        void this.router.navigate(['/game-replay'], { queryParams: { gameId } });
    }

    private loadRecentGames() {
        this.recentLoading = true;
        this.games.list().subscribe({
            next: games => {
                const recent = games
                    .filter(game => game.status === 'FINISHED' || game.status === 'CANCELLED')
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 9);
                if (!recent.length) { this.recentTables = []; this.recentLoading = false; return; }
                forkJoin(recent.map(game => game.status === 'FINISHED'
                    ? this.games.replay(game.gameId).pipe(map(replay => this.toRecentTable(game, replay)), catchError(() => of(this.toRecentTable(game))))
                    : of(this.toRecentTable(game))
                )).subscribe({
                    next: tables => { this.recentTables = tables; this.recentLoading = false; },
                    error: () => { this.recentTables = recent.map(game => this.toRecentTable(game)); this.recentLoading = false; }
                });
            },
            error: () => { this.recentTables = []; this.recentLoading = false; }
        });
    }

    private toRecentTable(game: GameSummaryDto, replay?: GameReplayDto): RecentTable {
        const currentUserId = this.auth.currentUser()?.id;
        const me = game.players.find(player => player.userId === currentUserId);
        const won = !!replay?.result && replay.result.winnerPlayerId === me?.gamePlayerId;
        const status = game.status === 'CANCELLED' ? 'Annulée' : won ? 'Victoire' : 'Défaite';
        const images = ['premium.png', 'high-roller.png', 'cup.png', 'lounge.png'];
        return {
            gameId: game.gameId,
            title: `Partie ${game.gameId.slice(0, 6).toUpperCase()}`,
            subtitle: new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(game.createdAt)),
            status,
            statusClass: game.status === 'CANCELLED' ? 'cancelled' : won ? 'victory' : 'defeat',
            amount: `${game.stakeAmount.toLocaleString('fr-FR')} JETONS`,
            image: `../../assets/images/home/recent-games/${images[this.hash(game.gameId) % images.length]}`,
            players: game.players.slice(0, 3).map(player => player.avatarUrl),
            extraPlayers: Math.max(0, game.players.length - 3)
        };
    }

    private hash(value: string) { let hash = 0; for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0; return hash >>> 0; }
    goToTransactionsPage() {
        void this.nav.navigateRoot('/transactions', { replaceUrl: true });
    }

    goToWaitingTablesPage(event?: Event) {
        event?.stopPropagation();
        (event?.currentTarget as HTMLElement | null)?.blur?.();
        void this.nav.navigateRoot('/search', { queryParams: { tab: 'a-venir', quickMatch: '1' }, replaceUrl: true });
    }

    onPromoScroll(event: Event) {
        const slider = event.currentTarget as HTMLElement;
        const slideWidth = slider.clientWidth;
        this.activePromo = slideWidth ? Math.round(slider.scrollLeft / slideWidth) : 0;
    }

    onRecentScroll(event: Event) {
        const slider = event.currentTarget as HTMLElement;
        const slideWidth = slider.clientWidth;
        this.activeRecentSlide = slideWidth ? Math.round(slider.scrollLeft / slideWidth) : 0;
    }

    openMenu() {
        this.menu.open('main-menu');
    }
}
