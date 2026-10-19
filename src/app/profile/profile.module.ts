import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { FapfapButtonModule } from '../fapfap-button/fapfap-button.module';
import { BottomNavModule } from '../bottom-nav/bottom-nav.module';

import { ProfilePageRoutingModule } from './profile-routing.module';

import { ProfilePage } from './profile.page';
import {PageHeaderComponent}from'../shared/page-header/page-header.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    FapfapButtonModule,
    BottomNavModule,PageHeaderComponent,
    ProfilePageRoutingModule
  ],
  declarations: [
    ProfilePage
  ]
})
export class ProfilePageModule {}
