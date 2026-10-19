import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { FapfapButtonModule } from '../fapfap-button/fapfap-button.module';

import { LoginPageRoutingModule } from './login-routing.module';

import { LoginPage } from './login.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    FapfapButtonModule,
    LoginPageRoutingModule
  ],
  declarations: [
    LoginPage
  ]
})
export class LoginPageModule {}
