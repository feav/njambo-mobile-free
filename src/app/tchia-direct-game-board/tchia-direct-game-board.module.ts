import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {IonicModule} from '@ionic/angular';
import {RouterModule} from '@angular/router';
import {TchiaDirectGameBoardPage} from './tchia-direct-game-board.page';
import {PageHeaderComponent} from '../shared/page-header/page-header.component';
import {GameTableToolsComponent} from '../shared/game-table-tools/game-table-tools.component';
import {GameStakeInfoComponent} from '../shared/game-stake-info/game-stake-info.component';

@NgModule({imports:[CommonModule,IonicModule,PageHeaderComponent,GameTableToolsComponent,GameStakeInfoComponent,RouterModule.forChild([{path:'',component:TchiaDirectGameBoardPage}])],declarations:[TchiaDirectGameBoardPage]})
export class TchiaDirectGameBoardPageModule {}
