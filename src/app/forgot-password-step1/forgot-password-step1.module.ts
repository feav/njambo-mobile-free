import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { FapfapButtonModule } from '../fapfap-button/fapfap-button.module';

import { ForgotPasswordStep1PageRoutingModule } from './forgot-password-step1-routing.module';

import { ForgotPasswordStep1Page } from './forgot-password-step1.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    FapfapButtonModule,
    ForgotPasswordStep1PageRoutingModule
  ],
  declarations: [ForgotPasswordStep1Page]
})
export class ForgotPasswordStep1PageModule {}
