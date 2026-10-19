import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { FapfapButtonModule } from '../fapfap-button/fapfap-button.module';

import { FilterTablePageRoutingModule } from './filter-table-routing.module';

import { FilterTablePage } from './filter-table.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FapfapButtonModule,
    FilterTablePageRoutingModule
  ],
  declarations: [FilterTablePage]
})
export class FilterTablePageModule {}
