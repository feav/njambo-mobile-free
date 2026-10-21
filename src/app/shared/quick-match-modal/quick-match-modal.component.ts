import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { GameApiService, GameSummaryDto, GameType } from '../../core/game-realtime/game-api.service';
import { GameStateDto } from '../../core/game-realtime/game-realtime.models';
import { RankedLocationService } from '../../core/ranked-location.service';

type Phase = 'picking' | 'searching';

@Component({
    selector: 'app-quick-match-modal',
    standalone: true,
    imports: [CommonModule, IonicModule],
    templateUrl: './quick-match-modal.component.html',
    styleUrls: ['./quick-match-modal.component.scss'],
})
export class QuickMatchModalComponent implements OnDestroy {
    // Called with the matching game as soon as one is found; the caller (search page) owns the
    // actual join flow (GPS capture, waitlist, navigation) so it isn't duplicated here.
    @Input() onMatchFound!: (game: GameSummaryDto) => void;
    // Creation is performed by the games API; the caller only owns navigation after
    // the backend has returned the new game id.
    @Input() onGameCreated!: (game: GameStateDto) => void;

    readonly gameTypes: { type: GameType; label: string }[] = [
        { type: 'FAFAP', label: 'FapFap' },
        { type: 'CHECK_GAMES', label: 'Tcheck Game' },
        { type: 'UNO', label: 'UNO' },
        { type: 'COCHON_GRATTE', label: 'Cochon Gratté' },
        { type: 'TCHIA_DIRECT', label: '21 Direct' },
        { type: 'TCHIA_IMPOT', label: '21 Impôt' },
        { type: 'TCHIA_GARAME', label: '21 Garame' },
    ];
    readonly stakeTiers = [0, 25, 50, 100, 500, 1000, 2000, 5000, 10000];
    selectedGameType: GameType = 'FAFAP';
    selectedPlayerCount = 4;
    selectedStake = 25;
    phase: Phase = 'picking';
    creationError = '';

    private readonly searchTimeoutMs = 10 * 1000;
    private readonly pollIntervalMs = 4000;
    private readonly preferencesKey = 'njambo.quick-match.preferences.v3';
    private pollTimer?: ReturnType<typeof setInterval>;
    private deadlineTimer?: ReturnType<typeof setTimeout>;
    private cancelled = false;

    get playerCounts() {
        const maxPlayers = this.selectedGameType === 'TCHIA_GARAME' ? 5
            : this.selectedGameType === 'TCHIA_DIRECT' || this.selectedGameType === 'TCHIA_IMPOT' ? 6
            : this.selectedGameType === 'COCHON_GRATTE' ? 13
            : this.selectedGameType === 'UNO' || this.selectedGameType === 'CHECK_GAMES' ? 10 : 4;
        const minPlayers = this.selectedGameType === 'COCHON_GRATTE' ? 3 : 2;
        return Array.from({ length: maxPlayers - minPlayers + 1 }, (_, index) => minPlayers + index);
    }

    constructor(private modal: ModalController, private api: GameApiService, private router: Router, private rankedLocation: RankedLocationService) {
        this.restorePreferences();
    }

    get selectedGameLabel() { return this.gameTypes.find(option => option.type === this.selectedGameType)?.label || ''; }

    selectGameType(type: GameType) {
        this.selectedGameType = type;
        if (!this.playerCounts.includes(this.selectedPlayerCount)) this.selectedPlayerCount = this.playerCounts[this.playerCounts.length - 1];
        this.savePreferences();
    }
    selectPlayerCount(value: number) {
        if (!this.playerCounts.includes(value)) return;
        this.selectedPlayerCount = value;
        this.savePreferences();
    }
    selectStake(value: number) {
        this.selectedStake = this.stakeTiers.includes(value) ? value : 25;
        this.savePreferences();
    }

    startSearch() {
        this.savePreferences();
        this.phase = 'searching';
        this.creationError = '';
        this.cancelled = false;
        this.attempt();
        this.pollTimer = setInterval(() => this.attempt(), this.pollIntervalMs);
        this.deadlineTimer = setTimeout(() => {
            if (this.cancelled) return;
            this.clearTimers();
            this.createTable();
        }, this.searchTimeoutMs);
    }

    async createTable() {
        this.clearTimers();
        this.cancelled = true;
        const location = await this.rankedLocation.capture(this.selectedStake);
        if (location === null) {
            this.creationError = 'La position est nécessaire pour créer cette partie avec mise.';
            return;
        }
        this.api.quickCreate({
            gameType: this.selectedGameType,
            requiredPlayerCount: this.selectedPlayerCount,
            maxStake: this.selectedStake,
            playAnyway: false,
        }, location).subscribe({
            next: game => {
                this.onGameCreated?.(game);
                void this.modal.dismiss();
            },
            error: () => {
                this.cancelled = false;
                this.creationError = 'La création a échoué temporairement. Nouvelle tentative automatique…';
                this.retryAutomaticCreation();
            },
        });
    }

    private retryAutomaticCreation() {
        this.deadlineTimer = setTimeout(() => {
            if (!this.cancelled && this.phase === 'searching') void this.createTable();
        }, 5000);
    }

    goTo(route: string) {
        void this.modal.dismiss().then(() => this.router.navigateByUrl(route));
    }

    close() {
        this.cancelled = true;
        this.clearTimers();
        void this.modal.dismiss();
    }

    private attempt() {
        this.api.listPage(['WAITING_FOR_PLAYERS'], 0, 50).subscribe({
            next: result => {
                if (this.cancelled || this.phase !== 'searching') return;
                const games: GameSummaryDto[] = Array.isArray(result) ? result : (result?.content || []);
                const match = games.find(game => game.gameType === this.selectedGameType
                    && game.accessType === 'PUBLIC'
                    && game.requiredPlayerCount <= this.selectedPlayerCount
                    && (this.selectedStake === 0 ? game.stakeAmount === 0 : game.stakeAmount > 0 && game.stakeAmount <= this.selectedStake)
                    && (game.availableSeats > 0 || game.waitlistAvailable > 0));
                if (match) {
                    this.cancelled = true;
                    this.clearTimers();
                    this.onMatchFound(match);
                    void this.modal.dismiss();
                }
            },
            error: () => undefined // transient network hiccup: the next poll tick retries
        });
    }

    private clearTimers() {
        if (this.pollTimer) clearInterval(this.pollTimer);
        if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
    }

    ngOnDestroy() {
        this.cancelled = true;
        this.clearTimers();
    }

    private restorePreferences() {
        try {
            const saved = JSON.parse(window.localStorage.getItem(this.preferencesKey) || '{}') as Partial<{ gameType: GameType; players: number; maxStake: number }>;
            if (saved.gameType && this.gameTypes.some(option => option.type === saved.gameType)) this.selectedGameType = saved.gameType;
            if (saved.players && this.playerCounts.includes(saved.players) && !(this.selectedGameType === 'COCHON_GRATTE' && saved.players === 2)) this.selectedPlayerCount = saved.players;
            const savedStake = typeof saved.maxStake === 'number' ? saved.maxStake : (saved as Partial<{ stake: number }>).stake;
            if (typeof savedStake === 'number' && this.stakeTiers.includes(savedStake)) this.selectStake(savedStake);
        } catch { /* localStorage indisponible : les valeurs par défaut restent actives */ }
    }

    private savePreferences() {
        try {
            window.localStorage.setItem(this.preferencesKey, JSON.stringify({
                gameType: this.selectedGameType,
                players: this.selectedPlayerCount,
                maxStake: this.selectedStake,
            }));
        } catch { /* localStorage indisponible */ }
    }
}
