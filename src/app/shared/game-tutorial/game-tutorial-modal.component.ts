import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { GameTutorialDefinition } from '../../core/game-tutorial.config';
import { CardThemeService } from '../../core/card-theme.service';

@Component({ selector: 'app-game-tutorial-modal', templateUrl: './game-tutorial-modal.component.html', styleUrls: ['./game-tutorial-modal.component.scss'], standalone: false })
export class GameTutorialModalComponent {
  @Input() definition!: GameTutorialDefinition;
  index = 0; dontShowAgain = false; imageUnavailable = false;
  constructor(private modal: ModalController, private cardTheme: CardThemeService) {}
  get slide() { return this.definition.slides[this.index]; }
  get last() { return this.index === this.definition.slides.length - 1; }
  cardLabel(code: string): string { return code.startsWith('JOKER_') ? 'Joker' : code.slice(0, -1); }
  cardFamily(code: string): string { return code.startsWith('JOKER_') ? code.replace('JOKER_', '') : code.slice(-1); }
  familyName(code: string): string { return code.startsWith('JOKER_') ? (code.endsWith('RED') ? 'rouge' : 'noir') : ({ S: 'Black', C: 'Tchaka', H: 'Koubi', D: 'Zink' } as Record<string, string>)[this.cardFamily(code)] || ''; }
  isRed(code: string): boolean { return ['H', 'D'].includes(this.cardFamily(code)); }
  cardImage(code: string): string { return code.startsWith('JOKER_') ? this.cardTheme.joker(code.endsWith('RED') ? 'RED' : 'BLACK') : this.cardTheme.card(code.slice(0, -1), this.cardFamily(code)); }
  isUnoCard(code: string): boolean { return this.definition?.type === 'UNO'; }
  unoColor(code: string): string { return code.startsWith('WILD_') ? 'wild' : code.split('_')[0].toLowerCase(); }
  unoLabel(code: string): string { const value = code.split('_').slice(1).join('_'); return ({ SKIP: '⊘', REVERSE: '↻', DRAW_TWO: '+2', WILD: '★', DRAW_FOUR: '+4' } as Record<string, string>)[value] || value; }
  previous() { if (this.index > 0) { this.index--; this.imageUnavailable = false; } }
  next() { if (!this.last) { this.index++; this.imageUnavailable = false; } else void this.close(); }
  async close() { await this.modal.dismiss({ disabled: this.dontShowAgain }); }
  imageError() { this.imageUnavailable = true; }
}
