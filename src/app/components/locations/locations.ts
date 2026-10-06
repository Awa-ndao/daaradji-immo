import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './locations.html',
  styleUrl: './locations.css'
})
export class LocationsComponent {}