import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ApiService } from '../../services/api';
import { SidebarComponent } from '../sidebar/sidebar';

/**
 * Commissions de l'agence : calculées automatiquement à la vente ou à la location d'un bien confié
 * (taux du mandat ; partage 50/50 avec une agence partenaire). La comptabilité marque leur encaissement.
 */
@Component({
  selector: 'app-commissions',
  standalone: true,
  imports: [CommonModule, DatePipe, SidebarComponent],
  templateUrl: './commissions.html',
  styleUrl: '../shared/module.css'
})
export class CommissionsComponent implements OnInit {
  commissions: any[] = [];
  totaux: any = { agence: 0, partenaires: 0, en_attente: 0 };
  total = 0;
  loaded = false;
  filterStatut = '';
  filterType = '';
  currentPage = 1;
  totalPages = 1;
  successMsg = '';
  errorMsg = '';
  busyId: number | null = null;

  statutTabs = [
    { value: '', label: 'Toutes' },
    { value: 'en_attente', label: 'À encaisser' },
    { value: 'payee', label: 'Encaissées' }
  ];
  typeTabs = [
    { value: '', label: 'Ventes et locations' },
    { value: 'vente', label: 'Ventes' },
    { value: 'location', label: 'Locations' }
  ];

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  nombre(v: any): string {
    const n = Math.round(Number(v) || 0);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  operation(c: any): any { return c.vente || c.location; }
  bienTexte(b: any): string {
    if (!b) return '—';
    const t: any = { terrain: 'Terrain', maison: 'Maison', villa: 'Villa', appartement: 'Appartement', local_commercial: 'Local commercial' };
    return (t[b.type] || b.type) + ' — ' + b.localisation;
  }
  nom(p: any): string { return [p?.prenom, p?.nom].filter(Boolean).join(' ') || '—'; }

  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    return `${this.total} commission${this.total > 1 ? 's' : ''} · calculées automatiquement à partir des mandats`;
  }

  load(): void {
    this.loaded = false;
    this.cdr.detectChanges();
    const params: any = { page: this.currentPage };
    if (this.filterStatut) params.statut = this.filterStatut;
    if (this.filterType) params.type_transaction = this.filterType;
    this.api.get('commissions', params).subscribe({
      next: (d: any) => {
        this.commissions = d?.data || [];
        this.total = d?.total ?? this.commissions.length;
        this.totalPages = d?.last_page || 1;
        this.totaux = d?.totaux || this.totaux;
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => { this.commissions = []; this.loaded = true; this.cdr.detectChanges(); }
    });
  }

  setStatut(v: string): void { this.filterStatut = v; this.currentPage = 1; this.load(); }
  setType(v: string): void { this.filterType = v; this.currentPage = 1; this.load(); }
  changePage(p: number): void { if (p >= 1 && p <= this.totalPages) { this.currentPage = p; this.load(); } }

  basculer(c: any): void {
    if (this.busyId) return;
    this.busyId = c.id;
    this.errorMsg = '';
    const statut = c.statut === 'payee' ? 'en_attente' : 'payee';
    this.api.put('commissions', c.id, { statut }).subscribe({
      next: () => {
        this.busyId = null;
        this.successMsg = statut === 'payee' ? 'Commission marquée comme encaissée.' : 'Encaissement annulé.';
        this.load();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err: any) => {
        this.busyId = null;
        this.errorMsg = err?.error?.message || 'Modification impossible.';
        this.cdr.detectChanges();
      }
    });
  }
}
