import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { SidebarComponent } from '../sidebar/sidebar';

@Component({
  selector: 'app-paiements',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SidebarComponent],
  templateUrl: './paiements.html',
  styleUrl: './paiements.css'
})
export class PaiementsComponent implements OnInit {
  paiements: any[] = [];
  factures: any[] = [];
  locations: any[] = [];
  ventes: any[] = [];
  constructions: any[] = [];
  biens: any[] = [];
  clients: any[] = [];
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

  openPicker = false;
  relationsLoading = 0;   // nombre de listes encore en cours de chargement
  relationsError = '';

  pending: any = null;    // paiement à supprimer
  pendingError = '';
  working = false;

  modes = [
    { value: 'especes', label: 'Espèces', icon: 'bi-cash-stack' },
    { value: 'virement', label: 'Virement', icon: 'bi-bank' },
    { value: 'cheque', label: 'Chèque', icon: 'bi-journal-text' },
    { value: 'wave', label: 'Wave', icon: 'bi-phone' },
    { value: 'orange_money', label: 'Orange Money', icon: 'bi-phone-fill' }
  ];

  statuts = [
    { value: 'paye', label: 'Payé', icon: 'bi-check2-circle' },
    { value: 'en_attente', label: 'En attente', icon: 'bi-hourglass-split' },
    { value: 'annule', label: 'Annulé', icon: 'bi-x-circle' }
  ];
  statutTabs = [
    { value: '', label: 'Tous' },
    { value: 'paye', label: 'Payés' },
    { value: 'en_attente', label: 'En attente' },
    { value: 'annule', label: 'Annulés' }
  ];

  factureTypes: any = { loyer: 'Loyer', vente: 'Vente', construction: 'Construction', caution: 'Caution' };

  form: any = this.emptyForm();

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadPaiements();
    this.loadRelations(); // factures, et de quoi retrouver le bien et le client
  }

  // ---------- Libellés ----------

  modeLabel(value: string): string {
    return this.modes.find(m => m.value === value)?.label || value || '—';
  }

  modeIcon(value: string): string {
    return this.modes.find(m => m.value === value)?.icon || 'bi-wallet2';
  }

  statutLabel(value: string): string {
    return this.statuts.find(s => s.value === value)?.label || value;
  }

  factureType(value: string): string {
    return this.factureTypes[value] || value || '';
  }

  // 1500000 -> « 1 500 000 »
  nombre(value: any): string {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || isNaN(n)) return '0';
    const [entier, decimales] = String(Math.round(n * 100) / 100).split('.');
    const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return decimales ? groupes + ',' + decimales : groupes;
  }

  // Message lisible quand le serveur renvoie une erreur technique (SQL, PHP…)
  messageErreur(err: any, defaut: string): string {
    if (err?.status === 0) return 'Le serveur ne répond pas. Vérifiez que le backend est démarré.';
    const brut: string = err?.error?.message || '';
    if (!brut) return defaut + ' (erreur ' + (err?.status ?? 'inconnue') + ').';
    if (/SQLSTATE|Call to a member function|Undefined|Exception|on null/i.test(brut)) {
      return defaut + '. Erreur côté serveur : « ' + brut.slice(0, 140) + (brut.length > 140 ? '…' : '') + ' »';
    }
    return brut;
  }

  sameId(a: any, b: any): boolean {
    return a !== '' && a !== null && a !== undefined && String(a) === String(b);
  }

  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    const n = this.total;
    const mot = n > 1 ? 'paiements' : 'paiement';
    return this.filterStatut
      ? `${n} ${mot} pour ce statut`
      : `${n} ${mot} ${n > 1 ? 'enregistrés' : 'enregistré'}`;
  }

  // ---------- Facture et bien concernés ----------

  // La facture d'un paiement : complète depuis la liste chargée, sinon celle renvoyée par l'API
  factureDe(p: any): any {
    const id = p?.facture_id ?? p?.facture?.id;
    return this.factures.find(f => this.sameId(id, f.id)) || p?.facture || null;
  }

  private bienType(value: string): string {
    const types: any = {
      terrain: 'Terrain', maison: 'Maison', villa: 'Villa',
      appartement: 'Appartement', local_commercial: 'Local commercial'
    };
    return types[value] || '';
  }

  // Bien (type, lieu, référence) et client d'une facture, via sa location, sa vente ou son chantier
  concerne(f: any): { titre: string; ref: string; label: string } | null {
    if (!f) return null;
    const trouver = (obj: any, list: any[], id: any) => {
      const cle = id ?? obj?.id;
      return (cle != null ? list.find(x => this.sameId(cle, x.id)) : null) || obj || null;
    };
    const x = f.location_id || f.location ? trouver(f.location, this.locations, f.location_id)
      : f.vente_id || f.vente ? trouver(f.vente, this.ventes, f.vente_id)
      : f.construction_id || f.construction ? trouver(f.construction, this.constructions, f.construction_id)
      : null;
    if (!x) return null;
    const bien = x.bien || this.biens.find(b => this.sameId(x.bien_id, b.id));
    const client = x.client || this.clients.find(c => this.sameId(x.client_id, c.id));
    const titre = [this.bienType(bien?.type), bien?.localisation].filter(Boolean).join(' — ');
    return {
      titre: titre || bien?.reference || 'Bien non renseigné',
      ref: bien?.reference || '',
      label: [client?.prenom, client?.nom].filter(Boolean).join(' ')
    };
  }

  // Étape du chantier d'une facture de construction
  etapeDe(f: any): any {
    if (f?.etape) return f.etape;
    if (!f?.etape_construction_id) return null;
    for (const c of this.constructions) {
      const e = (c.etapes || []).find((x: any) => this.sameId(f.etape_construction_id, x.id));
      if (e) return e;
    }
    return null;
  }

  etapeNom(e: any): string {
    const nom = String(e?.nom || '');
    return e ? 'Étape ' + (e.numero ?? '') + ' : ' + nom.charAt(0).toUpperCase() + nom.slice(1) : '';
  }

  // Ce qui a déjà été payé sur une facture (paiements non annulés)
  dejaPaye(f: any): number {
    const exclu = this.editingId;
    return this.paiementsDe(f)
      .filter((p: any) => p.statut !== 'annule' && !this.sameId(exclu, p.id))
      .reduce((s: number, p: any) => s + (Number(p.montant) || 0), 0);
  }

  private paiementsDe(f: any): any[] {
    if (Array.isArray(f?.paiements)) return f.paiements;
    return this.paiements.filter(p => this.sameId(p.facture_id, f?.id));
  }

  resteAPayer(f: any): number {
    return Math.max(0, (Number(f?.montant) || 0) - this.dejaPaye(f));
  }

  // Factures qu'on peut encore payer (+ celle du paiement modifié)
  facturesAPayer(): any[] {
    return this.factures.filter(f =>
      f.statut !== 'payee' || this.sameId(this.form.facture_id, f.id));
  }

  factureChoisie(): any {
    return this.factures.find(f => this.sameId(this.form.facture_id, f.id)) || null;
  }

  factureLabel(): string {
    const f = this.factureChoisie();
    if (!f) return '';
    const q = this.concerne(f);
    const e = this.etapeDe(f);
    return f.numero + ' · ' + this.factureType(f.type) + (q ? ' — ' + q.titre : '') + (e ? ' — ' + this.etapeNom(e) : '');
  }

  // ---------- Filtres ----------

  setStatut(value: string): void {
    this.filterStatut = value;
    this.currentPage = 1;
    this.loadPaiements();
  }

  // ---------- Chargement ----------

  loadPaiements(): void {
    this.paiements = [];
    this.loaded = false;
    this.cdr.detectChanges();

    const params: any = { page: this.currentPage };
    if (this.filterStatut) params.statut = this.filterStatut;

    this.api.get('paiements', params).subscribe({
      next: (data: any) => {
        if (data && data.data) {
          this.paiements = data.data;
          this.totalPages = data.last_page || 1;
          this.total = data.total ?? this.paiements.length;
        } else if (Array.isArray(data)) {
          this.paiements = data;
          this.totalPages = 1;
          this.total = data.length;
        } else {
          this.paiements = [];
          this.totalPages = 1;
          this.total = 0;
        }
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.paiements = [];
        this.totalPages = 1;
        this.total = 0;
        this.loaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  loadRelations(): void {
    const listes: [string, (d: any[]) => void][] = [
      ['factures', d => this.factures = d],
      ['locations', d => this.locations = d],
      ['ventes', d => this.ventes = d],
      ['constructions', d => this.constructions = d],
      ['biens', d => this.biens = d],
      ['clients', d => this.clients = d]
    ];
    this.relationsLoading = listes.length;
    this.relationsError = '';
    this.cdr.detectChanges();

    for (const [endpoint, ranger] of listes) {
      this.api.get(endpoint, { per_page: 100 }).subscribe({
        next: (d: any) => {
          ranger(d?.data || d || []);
          this.relationsLoading--;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          if (endpoint === 'factures') {
            this.relationsError = err?.status === 0
              ? 'Le serveur ne répond pas. Vérifiez que le backend est démarré.'
              : 'Impossible de charger les factures (erreur ' + (err?.status ?? 'inconnue') + ').';
          }
          this.relationsLoading--;
          this.cdr.detectChanges();
        }
      });
    }
  }

  // ---------- Formulaire ----------

  emptyForm(): any {
    return {
      facture_id: '',
      montant: '',
      date_paiement: new Date().toISOString().slice(0, 10), // aujourd'hui par défaut
      mode_paiement: 'especes',
      reference: ''
    };
  }

  openNew(): void {
    this.resetForm();
    this.loadRelations();
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm = false;
    this.openPicker = false;
    this.resetForm();
  }

  togglePicker(): void {
    this.openPicker = !this.openPicker;
    this.cdr.detectChanges();
  }

  closePicker(): void {
    this.openPicker = false;
    this.cdr.detectChanges();
  }

  // Choisir la facture remplit le montant avec ce qui reste à payer
  pickFacture(f: any): void {
    this.form.facture_id = f.id;
    if (!this.editingId) {
      const reste = this.resteAPayer(f);
      this.form.montant = reste > 0 ? reste : '';
    }
    this.openPicker = false;
    this.cdr.detectChanges();
  }

  chooseMode(value: string): void {
    this.form.mode_paiement = value;
    this.cdr.detectChanges();
  }

  chooseStatut(value: string): void {
    this.form.statut = value;
    this.cdr.detectChanges();
  }

  // Les espèces n'ont pas de référence de transaction
  referenceAide(): string {
    switch (this.form.mode_paiement) {
      case 'virement': return 'Ex : numéro du virement';
      case 'cheque': return 'Ex : numéro du chèque';
      case 'wave':
      case 'orange_money': return 'Ex : identifiant de la transaction';
      default: return 'Facultatif';
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pending) {
      this.cancelPending();
    } else if (this.openPicker) {
      this.closePicker();
    } else if (this.showForm) {
      this.closeForm();
    }
  }

  savePaiement(): void {
    if (this.saving) return;

    const montant = Number(this.form.montant);
    if (!this.form.facture_id || !(montant > 0) || !this.form.date_paiement || !this.form.mode_paiement) {
      this.errorMsg = 'Veuillez choisir la facture, et remplir le montant, la date et le mode de paiement.';
      this.cdr.detectChanges();
      return;
    }
    const f = this.factureChoisie();
    if (f && montant > this.resteAPayer(f) && this.resteAPayer(f) > 0) {
      this.errorMsg = 'Le montant dépasse ce qui reste à payer sur cette facture ('
        + this.nombre(this.resteAPayer(f)) + ' FCFA).';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    const modification = this.editingId !== null;
    const request = modification
      ? this.api.put('paiements', this.editingId!, this.form)
      : this.api.post('paiements', this.form);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.successMsg = modification ? 'Paiement modifié.' : 'Paiement enregistré.';
        this.showForm = false;
        this.resetForm();
        this.loadPaiements();
        this.loadRelations(); // le statut des factures a pu changer
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.saving = false;
        this.errorMsg = this.messageErreur(err, modification ? 'Erreur lors de la modification' : 'Erreur lors de l’enregistrement');
        this.cdr.detectChanges();
      }
    });
  }

  editPaiement(p: any): void {
    this.resetForm();
    this.editingId = p.id;
    this.form = {
      facture_id: p.facture_id ?? p.facture?.id ?? '',
      montant: p.montant ?? '',
      date_paiement: (p.date_paiement || '').slice(0, 10),
      mode_paiement: p.mode_paiement || 'especes',
      reference: p.reference || '',
      statut: p.statut || 'paye'
    };
    this.showForm = true;
    this.cdr.detectChanges();
  }

  resetForm(): void {
    this.form = this.emptyForm();
    this.editingId = null;
    this.errorMsg = '';
    this.saving = false;
    this.cdr.detectChanges();
  }

  // ---------- Suppression ----------

  ask(p: any): void {
    this.pending = p;
    this.pendingError = '';
    this.cdr.detectChanges();
  }

  cancelPending(): void {
    this.pending = null;
    this.pendingError = '';
    this.working = false;
    this.cdr.detectChanges();
  }

  confirmPending(): void {
    if (!this.pending || this.working) return;
    this.working = true;
    this.pendingError = '';
    this.cdr.detectChanges();

    this.api.delete('paiements', this.pending.id).subscribe({
      next: () => {
        this.working = false;
        this.pending = null;
        this.successMsg = 'Paiement supprimé.';
        this.loadPaiements();
        this.loadRelations();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        // La fenêtre reste ouverte et affiche la raison donnée par le serveur
        this.working = false;
        this.pendingError = this.messageErreur(err, 'Le serveur a refusé la suppression');
        this.cdr.detectChanges();
      }
    });
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadPaiements();
    }
  }
}