import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
@Component({
  selector: 'app-factures',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './factures.html',
  styleUrl: './factures.css'
})
export class FacturesComponent {}