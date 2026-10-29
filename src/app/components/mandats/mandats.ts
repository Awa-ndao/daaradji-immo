import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { SidebarComponent } from '../sidebar/sidebar';

/**
 * Mandats : un propriétaire tiers confie un bien à l'agence (vente, location ou gestion),
 * pour une durée et un taux de commission négociés.
 */
@Component({
  selector: 'app-mandats',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SidebarComponent],
  templateUrl: './mandats.html',
  styleUrl: '../shared/module.css'
})
export class MandatsComponent implements OnInit {
  mandats: any[] = [];
  proprietaires: any[] = [];
  biens: any[] = [];
  agents: any[] = [];
  total = 0;
  loaded = false;
  saving = false;
  showForm = false;
  successMsg = '';
  errorMsg = '';
  searchTerm = '';
  filterStatut = '';
  filterAgent: any = '';
  agentFiltreOuvert = false;
  currentPage = 1;
  totalPages = 1;
  editingId: number | null = null;
  form: any = this.emptyForm();
  pickerPt = false;
  pickerBien = false;

  aSupprimer: any = null;
  deleting = false;
  deleteError = '';

  statutTabs = [
    { value: '', label: 'Tous' },
    { value: 'actif', label: 'Actifs' },
    { value: 'expire', label: 'Expirés' },
    { value: 'resilie', label: 'Résiliés' }
  ];
  types = [
    { value: 'vente', label: 'Vente', icon: 'bi-tag' },
    { value: 'location', label: 'Location', icon: 'bi-key' },
    { value: 'gestion', label: 'Gestion', icon: 'bi-clipboard-check' }
  ];
  statuts = [
    { value: 'actif', label: 'Actif' },
    { value: 'expire', label: 'Expiré' },
    { value: 'resilie', label: 'Résilié' }
  ];

  private searchTimer: any;

  constructor(private api: ApiService, private auth: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
    this.loadProprietaires();
    this.loadBiens();
    if (this.direction()) {
      this.api.get('agents').subscribe({ next: (d: any) => { this.agents = Array.isArray(d) ? d : (d?.data || []); this.cdr.detectChanges(); } });
    }
  }

  direction(): boolean { return this.auth.estDirection(); }

  // ---------- Libellés ----------
  nomPt(p: any): string { return [p?.prenom, p?.nom].filter(Boolean).join(' ') || '—'; }
  typeLabel(v: string): string { return this.types.find(t => t.value === v)?.label || v; }
  statutLabel(v: string): string { return this.statuts.find(t => t.value === v)?.label || v; }
  bienTexte(b: any): string {
    if (!b) return '—';
    const t: any = { terrain: 'Terrain', maison: 'Maison', villa: 'Villa', appartement: 'Appartement', local_commercial: 'Local commercial' };
    return (t[b.type] || b.type) + ' — ' + b.localisation;
  }
  agentNom(m: any): string { return m?.user?.name || 'Non attribué'; }
  agentFiltreLabel(): string {
    if (!this.filterAgent) return 'Tous les agents';
    return this.agents.find(a => String(a.id) === String(this.filterAgent))?.name || 'Agent';
  }
  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    return `${this.total} mandat${this.total > 1 ? 's' : ''}`;
  }
  sameId(a: any, b: any): boolean { return a !== '' && a !== null && a !== undefined && String(a) === String(b); }

  ptChoisi(): any { return this.proprietaires.find(p => this.sameId(this.form.proprietaire_tiers_id, p.id)); }
  bienChoisi(): any { return this.biens.find(b => this.sameId(this.form.bien_id, b.id)); }

  // Biens proposés : ceux déjà rattachés à ce propriétaire, ou pas encore rattachés et non achetés par l'agence
  biensProposes(): any[] {
    const pt = this.form.proprietaire_tiers_id;
    if (!pt) return [];
    return this.biens.filter(b => this.sameId(b.proprietaire_tiers_id, pt)
      || (!b.proprietaire_tiers_id && b.type_propriete === 'confie'));
  }

  // ---------- Chargement ----------
  load(): void {
    this.loaded = false;
    this.cdr.detectChanges();
    const params: any = { page: this.currentPage };
    if (this.searchTerm) params.q = this.searchTerm;
    if (this.filterStatut) params.statut = this.filterStatut;
    if (this.filterAgent) params.agent_id = this.filterAgent;
    this.api.get('mandats', params).subscribe({
      next: (d: any) => {
        this.mandats = d?.data || [];
        this.total = d?.total ?? this.mandats.length;
        this.totalPages = d?.last_page || 1;
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => { this.mandats = []; this.total = 0; this.loaded = true; this.cdr.detectChanges(); }
    });
  }

  loadProprietaires(): void {
    this.api.get('proprietaires-tiers', { per_page: 100 }).subscribe({
      next: (d: any) => { this.proprietaires = d?.data || []; this.cdr.detectChanges(); }
    });
  }

  loadBiens(): void {
    this.api.get('biens', { per_page: 100 }).subscribe({
      next: (d: any) => { this.biens = d?.data || []; this.cdr.detectChanges(); }
    });
  }

  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.currentPage = 1; this.load(); }, 300);
  }
  setStatut(v: string): void { this.filterStatut = v; this.currentPage = 1; this.load(); }
  toggleAgentFiltre(): void { this.agentFiltreOuvert = !this.agentFiltreOuvert; this.cdr.detectChanges(); }
  setAgentFiltre(v: any): void { this.filterAgent = v; this.agentFiltreOuvert = false; this.currentPage = 1; this.load(); }
  changePage(p: number): void { if (p >= 1 && p <= this.totalPages) { this.currentPage = p; this.load(); } }

  // ---------- Formulaire ----------
  emptyForm(): any {
    return { proprietaire_tiers_id: '', bien_id: '', type: 'vente', date_debut: new Date().toISOString().slice(0, 10),
             date_fin: '', taux_commission: 5, conditions: '', statut: 'actif' };
  }

  openNew(): void {
    this.form = this.emptyForm();
    this.editingId = null;
    this.errorMsg = '';
    this.loadProprietaires();
    this.loadBiens();
    this.showForm = true;
    this.cdr.detectChanges();
  }

  edit(m: any): void {
    this.form = {
      proprietaire_tiers_id: m.proprietaire_tiers_id, bien_id: m.bien_id, type: m.type,
      date_debut: (m.date_debut || '').slice(0, 10), date_fin: (m.date_fin || '').slice(0, 10),
      taux_commission: m.taux_commission, conditions: m.conditions || '', statut: m.statut, user_id: m.user_id
    };
    this.editingId = m.id;
    this.errorMsg = '';
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm(): void { this.showForm = false; this.pickerPt = this.pickerBien = false; this.cdr.detectChanges(); }

  choose(champ: string, v: string): void { this.form[champ] = v; this.cdr.detectChanges(); }

  pickPt(p: any): void {
    if (!this.sameId(this.form.proprietaire_tiers_id, p.id)) this.form.bien_id = '';
    this.form.proprietaire_tiers_id = p.id;
    this.pickerPt = false;
    this.cdr.detectChanges();
  }
  pickBien(b: any): void { this.form.bien_id = b.id; this.pickerBien = false; this.cdr.detectChanges(); }

  agentFixeLabel(): string {
    const moi = this.auth.getUser();
    if (this.editingId) {
      const m = this.mandats.find(x => x.id === this.editingId);
      if (m?.user && (!moi || String(m.user.id) !== String(moi.id))) return m.user.name;
    }
    return (moi?.name || '') + ' (vous)';
  }

  save(): void {
    if (this.saving) return;
    if (!this.editingId && (!this.form.proprietaire_tiers_id || !this.form.bien_id)) {
      this.errorMsg = 'Choisissez le propriétaire tiers et le bien.';
      this.cdr.detectChanges();
      return;
    }
    if (this.form.taux_commission === '' || this.form.taux_commission === null || !this.form.date_debut) {
      this.errorMsg = 'Indiquez la date de début et le taux de commission.';
      this.cdr.detectChanges();
      return;
    }
    const data: any = { ...this.form };
    if (!data.date_fin) data.date_fin = null;
    if (!this.editingId) delete data.statut;
    delete data.user_id;
    this.saving = true;
    this.errorMsg = '';
    const modif = this.editingId !== null;
    const req = modif ? this.api.put('mandats', this.editingId!, data) : this.api.post('mandats', data);
    req.subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.flash(modif ? 'Mandat modifié.' : 'Mandat enregistré : le bien est maintenant confié à l’agence.');
        this.load();
        this.loadBiens();
      },
      error: (err: any) => {
        this.saving = false;
        this.errorMsg = err?.error?.message || 'Enregistrement impossible.';
        this.cdr.detectChanges();
      }
    });
  }

  askDelete(m: any): void { this.aSupprimer = m; this.deleteError = ''; this.cdr.detectChanges(); }
  cancelDelete(): void { this.aSupprimer = null; this.deleting = false; this.cdr.detectChanges(); }
  confirmDelete(): void {
    if (!this.aSupprimer || this.deleting) return;
    this.deleting = true;
    this.api.delete('mandats', this.aSupprimer.id).subscribe({
      next: () => { this.deleting = false; this.aSupprimer = null; this.flash('Mandat supprimé (récupérable dans la corbeille).'); this.load(); },
      error: (err: any) => { this.deleting = false; this.deleteError = err?.error?.message || 'Suppression impossible.'; this.cdr.detectChanges(); }
    });
  }

  private flash(msg: string): void {
    this.successMsg = msg;
    this.cdr.detectChanges();
    setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3500);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pickerPt || this.pickerBien) { this.pickerPt = this.pickerBien = false; this.cdr.detectChanges(); }
    else if (this.aSupprimer) this.cancelDelete();
    else if (this.showForm) this.closeForm();
  }
}
