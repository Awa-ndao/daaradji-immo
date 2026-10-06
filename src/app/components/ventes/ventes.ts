import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
@Component({
  selector: 'app-ventes',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './ventes.html',
  styleUrl: './ventes.css'
})
export class VentesComponent {}