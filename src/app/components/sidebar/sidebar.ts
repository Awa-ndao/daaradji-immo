import { Component, OnInit } from '@angular/core';
import { DatePipe, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth';

// Pour afficher la date en français ("lundi 5 octobre 2026")
registerLocaleData(localeFr);

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent implements OnInit {
  user: any;
  today = new Date();
  initiales = '';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.user = this.authService.getUser();
    if (this.user?.name) {
      const parts = this.user.name.trim().split(/\s+/);
      this.initiales = parts.map((p: string) => p[0]).join('').substring(0, 2).toUpperCase();
    }
  }

  logout(): void {
    this.authService.logout();
  }
}