import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { SidebarComponent } from '../sidebar/sidebar';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, SidebarComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  stats: any = {};
  activites: any[] = [];
  rdvAujourdhui: any[] = [];
  user: any;
  prenom = '';

  constructor(private api: ApiService, private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.user = this.auth.getUser();
    if (this.user?.name) {
      this.prenom = this.user.name.trim().split(/\s+/)[0];
    }
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.api.get('dashboard').subscribe({
      next: (data: any) => {
        this.stats = data.stats || {};
        this.activites = data.activites_recentes || [];
        this.rdvAujourdhui = data.rdv_aujourd_hui || [];
      },
      error: (err) => console.error(err)
    });
  }

  goTo(path: string): void {
    this.router.navigate([path]);
  }
}