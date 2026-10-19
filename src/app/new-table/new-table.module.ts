import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { FapfapButtonModule } from '../fapfap-button/fapfap-button.module';

import { NewTablePageRoutingModule } from './new-table-routing.module';

import { NewTablePage } from './new-table.page';
import {PageHeaderComponent}from'../shared/page-header/page-header.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    FapfapButtonModule,PageHeaderComponent,
    NewTablePageRoutingModule
  ],
  declarations: [NewTablePage]
})
export class NewTablePageModule {}
