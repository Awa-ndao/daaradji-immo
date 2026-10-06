import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
@Component({
  selector: 'app-utilisateurs',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './utilisateurs.html',
  styleUrl: './utilisateurs.css'
})
export class UtilisateursComponent {}