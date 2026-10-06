import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './clients.html',
  styleUrl: './clients.css'
})
export class ClientsComponent {}