import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { SidebarComponent } from '../sidebar/sidebar';
import { API_URL } from '../../services/config';

/**
 * Corbeille : tout ce qui a été supprimé peut être restauré par la direction.
 * Seul le propriétaire peut supprimer définitivement.
 */
@Component({
  selector: 'app-corbeille',
  standalone: true,
  imports: [CommonModule, DatePipe, SidebarComponent],
  templateUrl: './corbeille.html',
  styleUrl: '../shared/module.css'
})
export class CorbeilleComponent implements OnInit {
  private apiUrl = API_URL;
  elements: any[] = [];
  loaded = false;
  filterType = '';
  pickType = false;
  successMsg = '';
  errorMsg = '';
  busy = '';

  confirmation: { action: 'definitif' | 'vider'; element?: any } | null = null;
  confirmError = '';

  types: Record<string, string> = {
    clients: 'Clients', biens: 'Biens', proprietaires: 'Propriétaires tiers', mandats: 'Mandats', achats: 'Achats',
    ventes: 'Ventes', locations: 'Locations', constructions: 'Constructions', contrats: 'Contrats',
    factures: 'Factures', paiements: 'Paiements', rendez_vous: 'Rendez-vous', demarches: 'Démarches'
  };

  constructor(private api: ApiService, private http: HttpClient, private auth: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  proprietaire(): boolean { return this.auth.getRole() === 'proprietaire'; }
  typeKeys(): string[] { return Object.keys(this.types); }
  cle(e: any): string { return e.type + '-' + e.id; }

  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    const n = this.elements.length;
    return n ? `${n} élément${n > 1 ? 's' : ''} supprimé${n > 1 ? 's' : ''} · restaurables` : 'La corbeille est vide';
  }

  load(): void {
    this.loaded = false;
    this.cdr.detectChanges();
    this.api.get('corbeille', this.filterType ? { type: this.filterType } : {}).subscribe({
      next: (d: any) => { this.elements = Array.isArray(d) ? d : []; this.loaded = true; this.cdr.detectChanges(); },
      error: () => { this.elements = []; this.loaded = true; this.cdr.detectChanges(); }
    });
  }

  setType(v: string): void { this.filterType = v; this.pickType = false; this.load(); }

  restaurer(e: any): void {
    if (this.busy) return;
    this.busy = this.cle(e);
    this.errorMsg = '';
    this.api.post(`corbeille/${e.type}/${e.id}/restaurer`, {}).subscribe({
      next: (r: any) => { this.busy = ''; this.flash(r?.message || 'Élément restauré.'); this.load(); },
      error: (err: any) => { this.busy = ''; this.errorMsg = err?.error?.message || 'Restauration impossible.'; this.cdr.detectChanges(); }
    });
  }

  demanderDefinitif(e: any): void { this.confirmation = { action: 'definitif', element: e }; this.confirmError = ''; this.cdr.detectChanges(); }
  demanderVider(): void { this.confirmation = { action: 'vider' }; this.confirmError = ''; this.cdr.detectChanges(); }
  annuler(): void { this.confirmation = null; this.busy = ''; this.cdr.detectChanges(); }

  confirmer(): void {
    if (!this.confirmation || this.busy) return;
    const c = this.confirmation;
    this.busy = 'confirm';
    const url = c.action === 'vider' ? `${this.apiUrl}/corbeille` : `${this.apiUrl}/corbeille/${c.element.type}/${c.element.id}`;
    this.http.delete(url).subscribe({
      next: (r: any) => { this.busy = ''; this.confirmation = null; this.flash(r?.message || 'Supprimé définitivement.'); this.load(); },
      error: (err: any) => { this.busy = ''; this.confirmError = err?.error?.message || 'Suppression impossible.'; this.cdr.detectChanges(); }
    });
  }

  private flash(msg: string): void {
    this.successMsg = msg;
    this.cdr.detectChanges();
    setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 4000);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmation) this.annuler();
    else if (this.pickType) { this.pickType = false; this.cdr.detectChanges(); }
  }
}
