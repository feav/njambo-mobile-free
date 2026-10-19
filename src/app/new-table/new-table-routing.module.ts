import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { NewTablePage } from './new-table.page';

const routes: Routes = [
  {
    path: '',
    component: NewTablePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NewTablePageRoutingModule {}
