import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { BottomNavComponent } from './bottom-nav.component';

@NgModule({
    imports: [CommonModule, RouterModule, IonicModule],
    declarations: [BottomNavComponent],
    exports: [BottomNavComponent],
})
export class BottomNavModule {}
