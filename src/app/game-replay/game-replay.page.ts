import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameApiService, GameReplayDto } from '../core/game-realtime/game-api.service';

@Component({
  standalone: false,
  selector: 'app-game-replay',
  templateUrl: './game-replay.page.html',
  styleUrls: ['./game-replay.page.scss']
})
export class GameReplayPage implements OnInit, OnDestroy {
  replay: GameReplayDto | null = null;
  step = 0;
  loading = true;
  error = '';
  playing = false;
  private timer?: ReturnType<typeof setInterval>;
  requestedGameType = 'FAFAP';

  constructor(private route: ActivatedRoute, private router: Router, private api: GameApiService) {}

  ngOnInit() {
    this.requestedGameType = this.route.snapshot.queryParamMap.get('gameType') || 'FAFAP';
    const gameId = this.route.snapshot.queryParamMap.get('gameId');
    if (!gameId) { this.error = 'Identifiant de partie manquant.'; this.loading = false; return; }
    this.api.replay(gameId).subscribe({
      next: replay => { this.replay = replay; this.loading = false; },
      error: error => { this.error = error?.error?.message || 'Replay indisponible.'; this.loading = false; }
    });
  }

  ngOnDestroy() { this.stop(); }
  back() { void this.router.navigate(['/search'], { queryParams: { tab: 'terminees' } }); }
  previous() { this.stop(); this.step = Math.max(0, this.step - 1); }
  next() {
    if (!this.replay) return;
    this.step = Math.min(this.replay.actions.length, this.step + 1);
    if (this.step >= this.replay.actions.length) this.stop();
  }
  togglePlay() {
    if (!this.replay?.actions.length) return;
    if (this.playing) { this.stop(); return; }
    if (this.step >= this.replay.actions.length) this.step = 0;
    this.playing = true;
    this.timer = setInterval(() => this.next(), 1100);
  }
  seek(value: Event) {
    this.stop();
    this.step = Number((value.target as HTMLInputElement).value);
  }
  get currentAction() { return this.step > 0 ? this.replay?.actions[this.step - 1] ?? null : null; }
  get currentRound() { return this.currentAction?.round ?? 1; }
  get tableCards() {
    if (!this.replay) return [];
    return this.replay.actions.filter(action => action.order <= this.step && action.round === this.currentRound);
  }
  playerName(id: string | null | undefined) {
    return this.replay?.players.find(player => player.gamePlayerId === id)?.username || '—';
  }
  roundWins(playerId: string) {
    if (!this.replay) return 0;
    const currentOrder = this.currentAction?.order ?? 0;
    return this.replay.rounds.filter(round => round.winnerPlayerId === playerId &&
      this.replay!.actions.filter(action => action.round === round.roundNumber).every(action => action.order <= currentOrder)).length;
  }
  suitSymbol(suit: string) {
    return ({ BLACK: '♠', TCHAKA: '♣', KOUBI: '♥', ZINK: '♦' } as Record<string, string>)[suit] || '●';
  }
  get gameType() { return this.replay?.gameType || this.requestedGameType; }
  get gameName() {
    return this.gameType === 'FAFAP' ? 'FapFap'
      : this.gameType === 'PRESIDENT' ? 'Président (Trou du cul)'
      : this.gameType === 'UNO' ? 'UNO'
      : this.gameType === 'CHECK_GAMES' ? 'Tcheck Game'
      : this.gameType === 'TCHIA_DIRECT' ? '21 Direct'
      : this.gameType === 'TCHIA_IMPOT' ? '21 Impôt'
      : this.gameType === 'TCHIA_GARAME' ? '21 Garame'
      : 'Cochon Gratté';
  }
  get gameIcon() {
    const asset = this.gameType === 'FAFAP' ? 'fafap'
      : this.gameType === 'PRESIDENT' ? 'tcheck'
      : this.gameType === 'UNO' ? 'uno'
      : this.gameType === 'CHECK_GAMES' ? 'check-games'
      : this.gameType === 'TCHIA_DIRECT' ? '21-direct'
      : this.gameType === 'TCHIA_IMPOT' ? '21-impot'
      : this.gameType === 'TCHIA_GARAME' ? '21-garame'
      : 'cochon-gratte';
    return `assets/images/game-types/${asset}.webp`;
  }
  get replayHint() {
    if (this.gameType === 'UNO') return 'Le replay UNO retracera les cartes posées, les changements de couleur, les pioches et les annonces UNO.';
    if (this.gameType === 'PRESIDENT') return 'Le replay Président (Trou du cul) retracera chaque combinaison, les passes et les séries remportées.';
    if (this.gameType === 'TCHIA_DIRECT') return 'Le replay 21 Direct retracera le boxing, la sélection des cartes et le calcul des mains.';
    if (this.gameType === 'TCHIA_IMPOT') return 'Le replay 21 Impôt retracera le boxing, les sélections et les règles propres à l’Impôt.';
    if (this.gameType === 'TCHIA_GARAME') return 'Le replay 21 Garame retracera le challenge, le boxing et la sélection des cartes.';
    return 'Le replay Cochon Gratté retracera chaque échange simultané jusqu’à la formation du carré gagnant.';
  }
  private stop() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
