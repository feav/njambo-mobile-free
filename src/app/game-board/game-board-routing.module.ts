import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GameBoardPage } from './game-board.page';

const routes: Routes = [
  {
    path: '',
    component: GameBoardPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GameBoardPageRoutingModule {}
