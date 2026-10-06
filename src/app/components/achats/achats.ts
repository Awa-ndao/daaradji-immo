import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
@Component({
  selector: 'app-achats',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './achats.html',
  styleUrl: './achats.css'
})
export class AchatsComponent {}