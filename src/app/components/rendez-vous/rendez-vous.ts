import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
@Component({
  selector: 'app-rendez-vous',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './rendez-vous.html',
  styleUrl: './rendez-vous.css'
})
export class RendezVousComponent {}