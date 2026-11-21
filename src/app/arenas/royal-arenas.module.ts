import{NgModule}from'@angular/core';
import{CommonModule}from'@angular/common';
import{FormsModule}from'@angular/forms';
import{IonicModule}from'@ionic/angular';
import{RouterModule}from'@angular/router';
import{RoyalArenasPage}from'./royal-arenas.page';
import{PageHeaderComponent}from'../shared/page-header/page-header.component';
import{BottomNavModule}from'../bottom-nav/bottom-nav.module';
@NgModule({declarations:[RoyalArenasPage],imports:[CommonModule,FormsModule,IonicModule,PageHeaderComponent,BottomNavModule,RouterModule.forChild([{path:'',component:RoyalArenasPage}])]})
export class RoyalArenasPageModule{}
