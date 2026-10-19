import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GameReplayPage } from './game-replay.page';

const routes: Routes = [{ path: '', component: GameReplayPage }];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class GameReplayPageRoutingModule {}
