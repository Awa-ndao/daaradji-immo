import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
@Component({
  selector: 'app-paiements',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './paiements.html',
  styleUrl: './paiements.css'
})
export class PaiementsComponent {}