import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
@Component({
  selector: 'app-contrats',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './contrats.html',
  styleUrl: './contrats.css'
})
export class ContratsComponent {}