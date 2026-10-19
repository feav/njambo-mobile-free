import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ForgotPasswordStep1Page } from './forgot-password-step1.page';

const routes: Routes = [
  {
    path: '',
    component: ForgotPasswordStep1Page
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ForgotPasswordStep1PageRoutingModule {}
