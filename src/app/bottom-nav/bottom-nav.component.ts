import { Component, Input } from '@angular/core';
import { MenuController } from '@ionic/angular';

export type BottomNavItem = 'home' | 'profile' | 'game' | 'transactions' | 'menu' | '';

@Component({
    standalone: false,
    selector: 'app-bottom-nav',
    templateUrl: './bottom-nav.component.html',
    styleUrls: ['./bottom-nav.component.scss'],
})
export class BottomNavComponent {
    @Input() active: BottomNavItem = '';

    constructor(private menu: MenuController) {}

    openMenu() {
        this.menu.open('main-menu');
    }
}
