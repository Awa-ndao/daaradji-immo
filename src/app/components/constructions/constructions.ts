import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
@Component({
  selector: 'app-constructions',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './constructions.html',
  styleUrl: './constructions.css'
})
export class ConstructionsComponent {}