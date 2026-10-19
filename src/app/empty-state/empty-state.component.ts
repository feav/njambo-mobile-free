import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [IonicModule, NgIf],
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.scss']
})
export class EmptyStateComponent {
  @Input() icon = 'file-tray-outline';
  @Input() title = 'Aucune donnée disponible';
  @Input() message = 'Les informations apparaîtront ici dès qu’elles seront disponibles.';
  @Input() actionLabel = '';
  @Input() compact = false;
  @Output() action = new EventEmitter<void>();
}
