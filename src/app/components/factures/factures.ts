import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { SidebarComponent } from '../sidebar/sidebar';
import { ImpressionService } from '../../services/impression';

type Action = 'payee' | 'delete';

@Component({
  selector: 'app-factures',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SidebarComponent],
  templateUrl: './factures.html',
  styleUrl: './factures.css'
})
export class FacturesComponent implements OnInit {
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
  filterType = '';
  filterStatut = '';
  currentPage = 1;
  totalPages = 1;
  editingId: number | null = null;

  openPicker = false;
  relationsLoading = 0;   // nombre de listes encore en cours de chargement
  relationsError = '';

  pending: { action: Action; facture: any } | null = null;
  pendingError = '';
  working = false;

  types = [
    { value: 'loyer', label: 'Loyer', icon: 'bi-house-door' },
    { value: 'vente', label: 'Vente', icon: 'bi-tag' },
    { value: 'construction', label: 'Construction', icon: 'bi-building' },
    { value: 'caution', label: 'Caution', icon: 'bi-shield-check' }
  ];
  typeTabs = [{ value: '', label: 'Tous les types' }, ...this.types];

  statuts = [
    { value: 'en_attente', label: 'En attente', icon: 'bi-hourglass-split' },
    { value: 'payee', label: 'Payée', icon: 'bi-check2-circle' },
    { value: 'en_retard', label: 'En retard', icon: 'bi-exclamation-triangle' }
  ];
  statutTabs = [
    { value: '', label: 'Tous les statuts' },
    { value: 'en_attente', label: 'En attente' },
    { value: 'payee', label: 'Payées' },
    { value: 'en_retard', label: 'En retard' }
  ];

  form: any = this.emptyForm();

  constructor(
    private api: ApiService,
    private impression: ImpressionService,
    private cdr: ChangeDetectorRef
  ) {}

  // Ouvre le document à l'en-tête de l'agence et lance l'impression (ou « Enregistrer au format PDF »)
  imprimer(element: any): void {
    this.errorMsg = '';
    this.impression.imprimer('facture', element.id, (msg: string) => {
      this.errorMsg = msg;
      this.cdr.detectChanges();
    });
  }

  ngOnInit(): void {
    this.loadFactures();
    this.loadRelations(); // pour afficher le bien et le client de chaque facture
  }

  // ---------- Libellés ----------

  typeLabel(value: string): string {
    return this.types.find(t => t.value === value)?.label || value;
  }

  typeIcon(value: string): string {
    return this.types.find(t => t.value === value)?.icon || 'bi-receipt';
  }

  statutLabel(value: string): string {
    return this.statuts.find(s => s.value === value)?.label || value;
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
    if (/Duplicate entry/i.test(brut) && /numero/i.test(brut)) {
      const num = (brut.match(/Duplicate entry '([^']+)'/i) || [])[1] || '';
      return 'Enregistrement impossible : le numéro ' + num + ' choisi par le serveur est déjà utilisé. '
        + 'Ce n’est pas une erreur de saisie, c’est le contrôleur Laravel qui calcule mal le numéro.';
    }
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
    const mot = n > 1 ? 'factures' : 'facture';
    return this.filterType || this.filterStatut
      ? `${n} ${mot} pour ces critères`
      : `${n} ${mot} ${n > 1 ? 'enregistrées' : 'enregistrée'}`;
  }

  // ---------- Opération liée à la facture ----------
  // Loyer et caution -> une location ; vente -> une vente ; construction -> un chantier

  private relationKey(): 'location_id' | 'vente_id' | 'construction_id' | null {
    switch (this.form.type) {
      case 'loyer':
      case 'caution': return 'location_id';
      case 'vente': return 'vente_id';
      case 'construction': return 'construction_id';
      default: return null;
    }
  }

  hasRelation(): boolean {
    return this.relationKey() !== null;
  }

  relationId(): any {
    const key = this.relationKey();
    return key ? this.form[key] : '';
  }

  relationTitle(): string {
    switch (this.form.type) {
      case 'vente': return 'Vente concernée';
      case 'construction': return 'Chantier concerné';
      default: return 'Location concernée';
    }
  }

  relationOptions(): { id: any; titre: string; ref: string; label: string }[] {
    const key = this.relationKey();
    const list = key === 'location_id' ? this.locations
      : key === 'vente_id' ? this.ventes
      : key === 'construction_id' ? this.constructions : [];
    return list
      .filter((x: any) => this.eligible(x, key) || this.sameId(this.relationId(), x.id))
      .map((x: any) => ({ id: x.id, ...this.describe(x) }));
  }

  // Seules les opérations cohérentes sont proposées :
  // location en cours sur un bien habitable (pas un terrain), vente ou chantier non annulés
  private eligible(x: any, key: string | null): boolean {
    if (key === 'location_id') {
      const bien = x?.bien || this.biens.find(b => this.sameId(x?.bien_id, b.id));
      return x?.statut === 'actif' && bien?.type !== 'terrain';
    }
    if (key === 'vente_id' || key === 'construction_id') return x?.statut !== 'annule';
    return true;
  }


  relationSelectedLabel(): string {
    const o = this.relationOptions().find(x => this.sameId(this.relationId(), x.id));
    if (!o) return '';
    return o.titre + (o.ref ? ' (' + o.ref + ')' : '') + (o.label ? ' · ' + o.label : '');
  }

  // Bien (type, lieu, référence) et client d'une location, d'une vente ou d'une construction
  private describe(x: any): { titre: string; ref: string; label: string } {
    // Le bien et le client peuvent arriver complets, ou seulement par leur identifiant
    const bien = x?.bien || this.biens.find(b => this.sameId(x?.bien_id, b.id));
    const client = x?.client || this.clients.find(c => this.sameId(x?.client_id, c.id));
    const titre = [this.bienType(bien?.type), bien?.localisation].filter(Boolean).join(' — ');
    return {
      titre: titre || bien?.reference || 'Bien non renseigné',
      ref: bien?.reference || '',
      label: [client?.prenom, client?.nom].filter(Boolean).join(' ')
    };
  }

  private bienType(value: string): string {
    const types: any = {
      terrain: 'Terrain', maison: 'Maison', villa: 'Villa',
      appartement: 'Appartement', local_commercial: 'Local commercial'
    };
    return types[value] || '';
  }

  // Ce que concerne une facture de la liste : on prend l'objet renvoyé par l'API
  // s'il est présent, sinon on le retrouve dans les listes chargées.
  concerne(f: any): { titre: string; ref: string; label: string } | null {
    // On préfère l'élément complet des listes chargées (il contient le bien et le client)
    const trouver = (obj: any, list: any[], id: any) => {
      const cle = id ?? obj?.id;
      return (cle != null ? list.find(x => this.sameId(cle, x.id)) : null) || obj || null;
    };
    const x = f.location_id || f.location ? trouver(f.location, this.locations, f.location_id)
      : f.vente_id || f.vente ? trouver(f.vente, this.ventes, f.vente_id)
      : f.construction_id || f.construction ? trouver(f.construction, this.constructions, f.construction_id)
      : null;
    return x ? this.describe(x) : null;
  }

  // ---------- Filtres ----------

  setType(value: string): void {
    this.filterType = value;
    this.currentPage = 1;
    this.loadFactures();
  }

  setStatut(value: string): void {
    this.filterStatut = value;
    this.currentPage = 1;
    this.loadFactures();
  }

  // ---------- Chargement ----------

  loadFactures(): void {
    this.factures = [];
    this.loaded = false;
    this.cdr.detectChanges();

    const params: any = { page: this.currentPage };
    if (this.filterType) params.type = this.filterType;
    if (this.filterStatut) params.statut = this.filterStatut;

    this.api.get('factures', params).subscribe({
      next: (data: any) => {
        if (data && data.data) {
          this.factures = data.data;
          this.totalPages = data.last_page || 1;
          this.total = data.total ?? this.factures.length;
        } else if (Array.isArray(data)) {
          this.factures = data;
          this.totalPages = 1;
          this.total = data.length;
        } else {
          this.factures = [];
          this.totalPages = 1;
          this.total = 0;
        }
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.factures = [];
        this.totalPages = 1;
        this.total = 0;
        this.loaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  loadRelations(): void {
    this.relationsLoading = 5;
    this.relationsError = '';
    this.cdr.detectChanges();

    const fin = () => { this.relationsLoading--; this.cdr.detectChanges(); };
    const echec = (err: any) => {
      this.relationsError = err?.status === 0
        ? 'Le serveur ne répond pas. Vérifiez que le backend est démarré.'
        : 'Impossible de charger la liste (erreur ' + (err?.status ?? 'inconnue') + ').';
      fin();
    };

    this.api.get('locations', { per_page: 100 }).subscribe({
      next: (d: any) => { this.locations = d?.data || d || []; fin(); }, error: echec
    });
    this.api.get('biens', { per_page: 100 }).subscribe({
      next: (d: any) => { this.biens = d?.data || d || []; fin(); }, error: echec
    });
    this.api.get('clients', { per_page: 100 }).subscribe({
      next: (d: any) => { this.clients = d?.data || d || []; fin(); }, error: echec
    });
    this.api.get('ventes', { per_page: 100 }).subscribe({
      next: (d: any) => { this.ventes = d?.data || d || []; fin(); }, error: echec
    });
    this.api.get('constructions', { per_page: 100 }).subscribe({
      next: (d: any) => { this.constructions = d?.data || d || []; fin(); }, error: echec
    });
  }

  // ---------- Formulaire ----------

  emptyForm(): any {
    return {
      type: '',
      montant: '',
      date_emission: new Date().toISOString().slice(0, 10), // aujourd'hui par défaut
      date_echeance: '',
      statut: 'en_attente',
      location_id: '',
      vente_id: '',
      construction_id: '',
      etape_construction_id: ''
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

  // En changeant de type, on vide l'opération choisie pour l'ancien type
  chooseType(value: string): void {
    if (this.form.type !== value) {
      this.form.type = value;
      this.form.location_id = '';
      this.form.vente_id = '';
      this.form.construction_id = '';
      this.form.etape_construction_id = '';
    }
    this.openPicker = false;
    this.cdr.detectChanges();
  }

  chooseStatut(value: string): void {
    this.form.statut = value;
    this.cdr.detectChanges();
  }

  openRelationPicker(): void {
    this.openPicker = !this.openPicker;
    this.cdr.detectChanges();
  }

  closeRelationPicker(): void {
    this.openPicker = false;
    this.cdr.detectChanges();
  }

  pickRelation(id: any): void {
    const key = this.relationKey();
    if (key) {
      if (key === 'construction_id' && !this.sameId(this.form.construction_id, id)) {
        this.form.etape_construction_id = ''; // nouveau chantier : on rechoisit l'étape
      }
      this.form[key] = id;
      this.proposerMontant(key, id);
    }
    this.openPicker = false;
    this.cdr.detectChanges();
  }

  // Nouvelle facture : on propose le montant de l'opération (prix de vente, loyer ou caution).
  // Le serveur refuse ensuite un total facturé supérieur au prix, à la caution ou au chantier.
  private proposerMontant(key: string, id: any): void {
    if (this.editingId) return;
    if (key === 'vente_id') {
      const v = this.ventes.find((x: any) => this.sameId(x.id, id));
      if (v?.prix_vente) this.form.montant = Number(v.prix_vente);
    } else if (key === 'location_id') {
      const l = this.locations.find((x: any) => this.sameId(x.id, id));
      const m = this.form.type === 'caution' ? l?.caution : l?.loyer_mensuel;
      if (Number(m) > 0) this.form.montant = Number(m);
    }
  }

  // ---------- Étape du chantier (factures de construction) ----------

  etapesDuChantier(): any[] {
    const c = this.constructions.find(x => this.sameId(this.form.construction_id, x.id));
    return [...(c?.etapes || [])].sort((a: any, b: any) => (a.numero || 0) - (b.numero || 0));
  }

  etapeTitre(e: any): string {
    const nom = String(e?.nom || '');
    return nom.charAt(0).toUpperCase() + nom.slice(1);
  }

  etapeNom(e: any): string {
    return e ? 'Étape ' + (e.numero ?? '') + ' : ' + this.etapeTitre(e) : '';
  }

  // L'étape d'une facture de la liste
  etapeDe(f: any): any {
    if (f?.etape) return f.etape;
    if (!f?.etape_construction_id) return null;
    for (const c of this.constructions) {
      const e = (c.etapes || []).find((x: any) => this.sameId(f.etape_construction_id, x.id));
      if (e) return e;
    }
    return null;
  }

  // Choisir l'étape reprend le montant versé pour cette étape, s'il est connu
  chooseEtape(e: any): void {
    this.form.etape_construction_id = e.id;
    if (Number(e.montant_versement) > 0 && !this.editingId) {
      this.form.montant = e.montant_versement;
    }
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pending) {
      this.cancelPending();
    } else if (this.openPicker) {
      this.closeRelationPicker();
    } else if (this.showForm) {
      this.closeForm();
    }
  }

  saveFacture(): void {
    if (this.saving) return;

    if (!this.form.type || !this.form.date_emission || !(Number(this.form.montant) > 0)) {
      this.errorMsg = 'Veuillez choisir le type, saisir un montant et la date de création.';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    const modification = this.editingId !== null;
    const request = modification
      ? this.api.put('factures', this.editingId!, this.form)
      : this.api.post('factures', this.form);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.successMsg = modification ? 'Facture modifiée.' : 'Facture créée.';
        this.showForm = false;
        this.resetForm();
        this.loadFactures();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.saving = false;
        this.errorMsg = this.messageErreur(err, modification ? 'Erreur lors de la modification' : 'Erreur lors de la création');
        this.cdr.detectChanges();
      }
    });
  }

  editFacture(facture: any): void {
    this.resetForm();
    this.editingId = facture.id;
    this.form = {
      type: facture.type || '',
      montant: facture.montant ?? '',
      date_emission: (facture.date_emission || '').slice(0, 10),
      date_echeance: (facture.date_echeance || '').slice(0, 10),
      statut: facture.statut || 'en_attente',
      location_id: facture.location_id || '',
      vente_id: facture.vente_id || '',
      construction_id: facture.construction_id || '',
      etape_construction_id: facture.etape_construction_id || ''
    };
    this.loadRelations();
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

  // ---------- Marquer payée / supprimer ----------

  ask(action: Action, facture: any): void {
    this.pending = { action, facture };
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
    const { action, facture } = this.pending;
    this.working = true;
    this.pendingError = '';
    this.cdr.detectChanges();

    const request = action === 'delete'
      ? this.api.delete('factures', facture.id)
      : this.api.put('factures', facture.id, { statut: 'payee' });

    request.subscribe({
      next: () => {
        this.working = false;
        this.pending = null;
        this.successMsg = action === 'delete' ? 'Facture supprimée.' : 'Facture marquée comme payée.';
        this.loadFactures();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        // La fenêtre reste ouverte et affiche la raison donnée par le serveur
        this.working = false;
        if (err?.status === 0) {
          this.pendingError = 'Le serveur ne répond pas. Vérifiez que le backend est démarré.';
        } else {
          this.pendingError = err?.error?.message
            || 'Le serveur a refusé l\'opération (erreur ' + (err?.status ?? 'inconnue') + ').';
        }
        this.cdr.detectChanges();
      }
    });
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadFactures();
    }
  }
}