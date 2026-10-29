import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { SidebarComponent } from '../sidebar/sidebar';

/**
 * Propriétaires tiers : particuliers ou agences partenaires qui confient un bien à l'agence.
 * Avec une agence partenaire, la commission est partagée 50/50.
 */
@Component({
  selector: 'app-proprietaires',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './proprietaires.html',
  styleUrl: '../shared/module.css'
})
export class ProprietairesComponent implements OnInit {
  proprietaires: any[] = [];
  total = 0;
  loaded = false;
  saving = false;
  showForm = false;
  successMsg = '';
  errorMsg = '';
  searchTerm = '';
  filterType = '';
  currentPage = 1;
  totalPages = 1;
  editingId: number | null = null;
  form: any = this.emptyForm();

  aSupprimer: any = null;
  deleting = false;
  deleteError = '';

  typeTabs = [
    { value: '', label: 'Tous' },
    { value: 'particulier', label: 'Particuliers' },
    { value: 'agence', label: 'Agences partenaires' }
  ];
  modes = [
    { value: 'mobile_money', label: 'Mobile money', icon: 'bi-phone' },
    { value: 'virement', label: 'Virement', icon: 'bi-bank' },
    { value: 'especes', label: 'Espèces', icon: 'bi-cash' }
  ];

  private searchTimer: any;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  // ---------- Libellés ----------
  nomComplet(p: any): string {
    return [p?.prenom, p?.nom].filter(Boolean).join(' ');
  }

  initials(p: any): string {
    const parts = this.nomComplet(p).split(/\s+/).filter(Boolean);
    return parts.map(x => x.charAt(0)).join('').substring(0, 2).toUpperCase() || '?';
  }

  modeLabel(v: string): string {
    return this.modes.find(m => m.value === v)?.label || '—';
  }

  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    const n = this.total;
    return `${n} propriétaire${n > 1 ? 's' : ''} tiers`;
  }

  // ---------- Chargement ----------
  load(): void {
    this.loaded = false;
    this.cdr.detectChanges();
    const params: any = { page: this.currentPage };
    if (this.searchTerm) params.q = this.searchTerm;
    if (this.filterType) params.type = this.filterType;
    this.api.get('proprietaires-tiers', params).subscribe({
      next: (d: any) => {
        this.proprietaires = d?.data || [];
        this.total = d?.total ?? this.proprietaires.length;
        this.totalPages = d?.last_page || 1;
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => { this.proprietaires = []; this.total = 0; this.loaded = true; this.cdr.detectChanges(); }
    });
  }

  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.currentPage = 1; this.load(); }, 300);
  }

  setType(v: string): void {
    this.filterType = v;
    this.currentPage = 1;
    this.load();
  }

  changePage(p: number): void {
    if (p >= 1 && p <= this.totalPages) { this.currentPage = p; this.load(); }
  }

  // ---------- Formulaire ----------
  emptyForm(): any {
    return { type: 'particulier', nom: '', prenom: '', telephone: '', adresse: '', piece_identite: '',
             mode_reversement: 'mobile_money', numero_compte: '', numero_mobile_money: '' };
  }

  openNew(): void {
    this.form = this.emptyForm();
    this.editingId = null;
    this.errorMsg = '';
    this.showForm = true;
    this.cdr.detectChanges();
  }

  edit(p: any): void {
    this.form = { ...this.emptyForm(), ...p };
    Object.keys(this.form).forEach(k => { if (this.form[k] === null) this.form[k] = ''; });
    this.editingId = p.id;
    this.errorMsg = '';
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm = false;
    this.errorMsg = '';
    this.cdr.detectChanges();
  }

  choose(champ: 'type' | 'mode_reversement', v: string): void {
    this.form[champ] = v;
    if (champ === 'type' && v === 'agence') this.form.prenom = '';
    this.cdr.detectChanges();
  }

  save(): void {
    if (this.saving) return;
    if (!this.form.nom || !this.form.telephone) {
      this.errorMsg = this.form.type === 'agence'
        ? 'Indiquez le nom de l’agence et son téléphone.'
        : 'Indiquez le nom et le téléphone.';
      this.cdr.detectChanges();
      return;
    }
    const data = { ...this.form };
    if (data.mode_reversement !== 'virement') data.numero_compte = '';
    if (data.mode_reversement !== 'mobile_money') data.numero_mobile_money = '';
    this.saving = true;
    this.errorMsg = '';
    const modif = this.editingId !== null;
    const req = modif ? this.api.put('proprietaires-tiers', this.editingId!, data) : this.api.post('proprietaires-tiers', data);
    req.subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.flash(modif ? 'Propriétaire modifié.' : 'Propriétaire enregistré.');
        this.load();
      },
      error: (err: any) => {
        this.saving = false;
        this.errorMsg = err?.error?.message || 'Enregistrement impossible.';
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- Suppression ----------
  askDelete(p: any): void { this.aSupprimer = p; this.deleteError = ''; this.cdr.detectChanges(); }
  cancelDelete(): void { this.aSupprimer = null; this.deleting = false; this.cdr.detectChanges(); }

  confirmDelete(): void {
    if (!this.aSupprimer || this.deleting) return;
    this.deleting = true;
    this.api.delete('proprietaires-tiers', this.aSupprimer.id).subscribe({
      next: () => { this.deleting = false; this.aSupprimer = null; this.flash('Propriétaire supprimé (récupérable dans la corbeille).'); this.load(); },
      error: (err: any) => { this.deleting = false; this.deleteError = err?.error?.message || 'Suppression impossible.'; this.cdr.detectChanges(); }
    });
  }

  private flash(msg: string): void {
    this.successMsg = msg;
    this.cdr.detectChanges();
    setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.aSupprimer) this.cancelDelete();
    else if (this.showForm) this.closeForm();
  }
}
