import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { BottomNavModule } from '../bottom-nav/bottom-nav.module';

import { RulesPageRoutingModule } from './rules-routing.module';
import { FapfapTimeblockModule } from '../fapfap-timeblock/fapfap-timeblock.module';

import { RulesPage } from './rules.page';
import {PageHeaderComponent}from'../shared/page-header/page-header.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BottomNavModule,
    RulesPageRoutingModule,
    FapfapTimeblockModule,PageHeaderComponent
  ],
  declarations: [RulesPage]
})
export class RulesPageModule {}
