import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { FapfapButtonModule } from '../fapfap-button/fapfap-button.module';
import { BottomNavModule } from '../bottom-nav/bottom-nav.module';
import { HomePage } from './home.page';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

import { HomePageRoutingModule } from './home-routing.module';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FapfapButtonModule,
    BottomNavModule,
    EmptyStateComponent,
    HomePageRoutingModule
  ],
  declarations: [HomePage]
})
export class HomePageModule {}
