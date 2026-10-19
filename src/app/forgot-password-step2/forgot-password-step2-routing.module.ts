import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ForgotPasswordStep2Page } from './forgot-password-step2.page';

const routes: Routes = [
  {
    path: '',
    component: ForgotPasswordStep2Page
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ForgotPasswordStep2PageRoutingModule {}
