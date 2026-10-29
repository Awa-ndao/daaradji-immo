import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { SidebarComponent } from '../sidebar/sidebar';

/**
 * Démarches administratives faites pour un client (titre foncier, permis de construire, mutation…),
 * liées à une vente ou à une construction. Un agent ne voit que celles de ses dossiers.
 */
@Component({
  selector: 'app-demarches',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SidebarComponent],
  templateUrl: './demarches.html',
  styleUrl: '../shared/module.css'
})
export class DemarchesComponent implements OnInit {
  demarches: any[] = [];
  ventes: any[] = [];
  constructions: any[] = [];
  total = 0;
  loaded = false;
  saving = false;
  showForm = false;
  successMsg = '';
  errorMsg = '';
  filterStatut = '';
  currentPage = 1;
  totalPages = 1;
  editingId: number | null = null;
  form: any = this.emptyForm();
  pickerOp = false;

  aSupprimer: any = null;
  deleting = false;
  deleteError = '';

  documentsCourants = ['Titre foncier', 'Acte de vente', 'Plan cadastral', 'Permis de construire', 'Pièce d’identité'];
  docsChoisis: string[] = [];
  autresDocs = '';

  types = [
    { value: 'titre_foncier', label: 'Titre foncier' },
    { value: 'permis_construire', label: 'Permis de construire' },
    { value: 'mutation', label: 'Mutation' },
    { value: 'autre', label: 'Autre' }
  ];
  statuts = [
    { value: 'en_cours', label: 'En cours' },
    { value: 'termine', label: 'Terminée' },
    { value: 'annule', label: 'Annulée' }
  ];
  statutTabs = [{ value: '', label: 'Toutes' }, ...this.statuts];

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
    this.loadOperations();
  }

  typeLabel(v: string): string { return this.types.find(t => t.value === v)?.label || v; }
  statutLabel(v: string): string { return this.statuts.find(t => t.value === v)?.label || v; }
  nom(p: any): string { return [p?.prenom, p?.nom].filter(Boolean).join(' ') || '—'; }
  bienTexte(b: any): string {
    if (!b) return '—';
    const t: any = { terrain: 'Terrain', maison: 'Maison', villa: 'Villa', appartement: 'Appartement', local_commercial: 'Local commercial' };
    return (t[b.type] || b.type) + ' — ' + b.localisation;
  }
  operation(d: any): any { return d.vente || d.construction; }
  docsOf(s: string): string[] { return (s || '').split(',').map(x => x.trim()).filter(Boolean); }
  sameId(a: any, b: any): boolean { return a !== '' && a !== null && a !== undefined && String(a) === String(b); }
  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    return `${this.total} démarche${this.total > 1 ? 's' : ''}`;
  }

  operationsProposees(): any[] { return this.form.dossier === 'vente' ? this.ventes : this.constructions; }
  operationChoisie(): any {
    const id = this.form.dossier === 'vente' ? this.form.vente_id : this.form.construction_id;
    return this.operationsProposees().find(o => this.sameId(id, o.id));
  }

  load(): void {
    this.loaded = false;
    this.cdr.detectChanges();
    const params: any = { page: this.currentPage };
    if (this.filterStatut) params.statut = this.filterStatut;
    this.api.get('demarches-administratives', params).subscribe({
      next: (d: any) => {
        this.demarches = d?.data || [];
        this.total = d?.total ?? this.demarches.length;
        this.totalPages = d?.last_page || 1;
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => { this.demarches = []; this.loaded = true; this.cdr.detectChanges(); }
    });
  }

  loadOperations(): void {
    this.api.get('ventes', { per_page: 100 }).subscribe({ next: (d: any) => { this.ventes = (d?.data || []).filter((v: any) => v.statut !== 'annule'); this.cdr.detectChanges(); } });
    this.api.get('constructions', { per_page: 100 }).subscribe({ next: (d: any) => { this.constructions = (d?.data || []).filter((c: any) => c.statut !== 'annule'); this.cdr.detectChanges(); } });
  }

  setStatut(v: string): void { this.filterStatut = v; this.currentPage = 1; this.load(); }
  changePage(p: number): void { if (p >= 1 && p <= this.totalPages) { this.currentPage = p; this.load(); } }

  emptyForm(): any {
    return { dossier: 'vente', vente_id: '', construction_id: '', type: 'mutation', description: '',
             date_debut: new Date().toISOString().slice(0, 10), date_fin: '', statut: 'en_cours', documents: '' };
  }

  openNew(): void {
    this.form = this.emptyForm();
    this.editingId = null;
    this.docsChoisis = [];
    this.autresDocs = '';
    this.errorMsg = '';
    this.loadOperations();
    this.showForm = true;
    this.cdr.detectChanges();
  }

  edit(d: any): void {
    this.form = {
      dossier: d.vente_id ? 'vente' : 'construction', vente_id: d.vente_id || '', construction_id: d.construction_id || '',
      type: d.type, description: d.description || '', date_debut: (d.date_debut || '').slice(0, 10),
      date_fin: (d.date_fin || '').slice(0, 10), statut: d.statut, documents: d.documents || ''
    };
    const docs = this.docsOf(d.documents);
    this.docsChoisis = docs.filter(x => this.documentsCourants.includes(x));
    this.autresDocs = docs.filter(x => !this.documentsCourants.includes(x)).join(', ');
    this.editingId = d.id;
    this.errorMsg = '';
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm(): void { this.showForm = false; this.pickerOp = false; this.cdr.detectChanges(); }

  choose(champ: string, v: string): void {
    this.form[champ] = v;
    if (champ === 'dossier') { this.form.vente_id = ''; this.form.construction_id = ''; if (v === 'construction') this.form.type = 'permis_construire'; }
    this.cdr.detectChanges();
  }

  pickOp(o: any): void {
    if (this.form.dossier === 'vente') this.form.vente_id = o.id; else this.form.construction_id = o.id;
    this.pickerOp = false;
    this.cdr.detectChanges();
  }

  toggleDoc(doc: string): void {
    this.docsChoisis = this.docsChoisis.includes(doc) ? this.docsChoisis.filter(d => d !== doc) : [...this.docsChoisis, doc];
    this.cdr.detectChanges();
  }

  save(): void {
    if (this.saving) return;
    if (!this.editingId && !this.operationChoisie()) {
      this.errorMsg = this.form.dossier === 'vente' ? 'Choisissez la vente concernée.' : 'Choisissez la construction concernée.';
      this.cdr.detectChanges();
      return;
    }
    const data: any = {
      type: this.form.type, description: this.form.description, date_debut: this.form.date_debut,
      date_fin: this.form.date_fin || null,
      documents: [...this.docsChoisis, ...this.docsOf(this.autresDocs)].join(', ')
    };
    if (this.editingId) {
      data.statut = this.form.statut;
    } else if (this.form.dossier === 'vente') {
      data.vente_id = this.form.vente_id;
    } else {
      data.construction_id = this.form.construction_id;
    }
    this.saving = true;
    this.errorMsg = '';
    const modif = this.editingId !== null;
    const req = modif ? this.api.put('demarches-administratives', this.editingId!, data) : this.api.post('demarches-administratives', data);
    req.subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.flash(modif ? 'Démarche modifiée.' : 'Démarche enregistrée.');
        this.load();
      },
      error: (err: any) => {
        this.saving = false;
        const e = err?.error?.errors;
        this.errorMsg = (e && (Object.values(e)[0] as any)?.[0]) || err?.error?.message || 'Enregistrement impossible.';
        this.cdr.detectChanges();
      }
    });
  }

  askDelete(d: any): void { this.aSupprimer = d; this.deleteError = ''; this.cdr.detectChanges(); }
  cancelDelete(): void { this.aSupprimer = null; this.deleting = false; this.cdr.detectChanges(); }
  confirmDelete(): void {
    if (!this.aSupprimer || this.deleting) return;
    this.deleting = true;
    this.api.delete('demarches-administratives', this.aSupprimer.id).subscribe({
      next: () => { this.deleting = false; this.aSupprimer = null; this.flash('Démarche supprimée (récupérable dans la corbeille).'); this.load(); },
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
    if (this.pickerOp) { this.pickerOp = false; this.cdr.detectChanges(); }
    else if (this.aSupprimer) this.cancelDelete();
    else if (this.showForm) this.closeForm();
  }
}
