import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ModalController } from '@ionic/angular';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { GAME_TUTORIALS, GameTutorialDefinition, GameTutorialType } from './game-tutorial.config';
import { GameTutorialModalComponent } from '../shared/game-tutorial/game-tutorial-modal.component';

interface TutorialPreference { gameType: GameTutorialType; disabled: boolean; }
@Injectable({ providedIn: 'root' })
export class GameTutorialService {
  private readonly url = `${environment.apiBaseUrl}/api/tutorials/preferences`;
  private readonly localPrefix = 'njambo.tutorial.disabled.';
  private readonly presenting = new Set<GameTutorialType>();
  constructor(private http: HttpClient, private modal: ModalController, private auth: AuthService) {}
  definition(type: GameTutorialType): GameTutorialDefinition { return GAME_TUTORIALS[type]; }
  async maybePresent(type: GameTutorialType): Promise<void> {
    if (!this.auth.currentUser() || !GAME_TUTORIALS[type]) return;
    const preferences = await firstValueFrom(this.http.get<TutorialPreference[]>(this.url).pipe(catchError(() => of(undefined))));
    if (preferences) { const preference = preferences.find(value => value.gameType === type); this.cache(type, !!preference?.disabled); if (preference?.disabled) return; }
    else if (this.isCachedDisabled(type)) return;
    await this.present(type, false);
  }
  async present(type: GameTutorialType, force = true): Promise<void> {
    const definition = GAME_TUTORIALS[type]; if (!definition || (!force && this.isCachedDisabled(type))) return;
    if (this.presenting.has(type)) return;
    this.presenting.add(type);
    try {
      const modal = await this.modal.create({ component: GameTutorialModalComponent, cssClass: 'game-tutorial-modal', componentProps: { definition } });
      await modal.present(); const result = await modal.onDidDismiss<{ disabled?: boolean }>();
      if (result.data?.disabled) { this.cache(type, true); await firstValueFrom(this.http.put(`${this.url}/${type}`, { disabled: true }).pipe(catchError(() => of(undefined)))); }
    } catch { /* optional UI/API must never block a game */ }
    finally { this.presenting.delete(type); }
  }
  async reactivateAll(): Promise<void> {
    Object.keys(GAME_TUTORIALS).forEach(type => this.cache(type as GameTutorialType, false));
    await firstValueFrom(this.http.post(`${this.url}/reactivate-all`, {}).pipe(catchError(() => of(undefined))));
  }
  private cache(type: GameTutorialType, disabled: boolean): void { try { localStorage.setItem(`${this.localPrefix}${type}`, disabled ? '1' : '0'); } catch {} }
  private isCachedDisabled(type: GameTutorialType): boolean { try { return localStorage.getItem(`${this.localPrefix}${type}`) === '1'; } catch { return false; } }
}
