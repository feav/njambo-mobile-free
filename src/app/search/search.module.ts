import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { BottomNavModule } from '../bottom-nav/bottom-nav.module';

import { SearchPageRoutingModule } from './search-routing.module';

import { SearchPage } from './search.page';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import {PageHeaderComponent}from'../shared/page-header/page-header.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BottomNavModule,
    EmptyStateComponent,PageHeaderComponent,
    SearchPageRoutingModule
  ],
  declarations: [SearchPage]
})
export class SearchPageModule {}
