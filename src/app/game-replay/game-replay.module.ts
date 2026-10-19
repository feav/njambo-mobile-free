import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { GameReplayPageRoutingModule } from './game-replay-routing.module';
import { GameReplayPage } from './game-replay.page';

@NgModule({
  imports: [CommonModule, IonicModule, GameReplayPageRoutingModule],
  declarations: [GameReplayPage]
})
export class GameReplayPageModule {}
