import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

// import {DragDropModule} from 'primeng/dragdrop';
import { GameBoardPageRoutingModule } from './game-board-routing.module';
import { FapfapTimeblockModule } from '../fapfap-timeblock/fapfap-timeblock.module';

import { GameBoardPage } from './game-board.page';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { PlayerBadgesComponent } from '../shared/player-badges/player-badges.component';
import { PlayerProfileTriggerDirective } from '../shared/player-profile-trigger/player-profile-trigger.directive';
import { GameStakeInfoComponent } from '../shared/game-stake-info/game-stake-info.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    // DragDropModule,
    GameBoardPageRoutingModule,
    FapfapTimeblockModule,
    EmptyStateComponent,
    PlayerBadgesComponent, PlayerProfileTriggerDirective,
    GameStakeInfoComponent
  ],
  declarations: [GameBoardPage]
})
export class GameBoardPageModule {}
