import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
@Component({
  selector: 'app-biens',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './biens.html',
  styleUrl: './biens.css'
})
export class BiensComponent {}