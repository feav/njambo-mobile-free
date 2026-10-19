import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { FapfapButtonModule } from '../fapfap-button/fapfap-button.module';

import { ForgotPasswordStep2PageRoutingModule } from './forgot-password-step2-routing.module';

import { ForgotPasswordStep2Page } from './forgot-password-step2.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    FapfapButtonModule,
    ForgotPasswordStep2PageRoutingModule
  ],
  declarations: [ForgotPasswordStep2Page]
})
export class ForgotPasswordStep2PageModule {}
