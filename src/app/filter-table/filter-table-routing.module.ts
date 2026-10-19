import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { FilterTablePage } from './filter-table.page';

const routes: Routes = [
  {
    path: '',
    component: FilterTablePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FilterTablePageRoutingModule {}
