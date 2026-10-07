import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

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
        console.log('Réponse du tableau de bord :', data);
        this.stats = data.stats || {};
        this.activites = data.activites_recentes || [];
        this.rdvAujourdhui = data.rdv_aujourd_hui || [];
        // Rafraîchit l'écran dès que les chiffres arrivent du serveur
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Tableau de bord :', err);
        this.cdr.detectChanges();
      }
    });
  }

  goTo(path: string): void {
    this.router.navigate([path]);
  }
}