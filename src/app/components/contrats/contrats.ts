import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { SidebarComponent } from '../sidebar/sidebar';
import { ImpressionService } from '../../services/impression';

type Action = 'signe' | 'delete';

@Component({
  selector: 'app-contrats',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SidebarComponent],
  templateUrl: './contrats.html',
  styleUrl: './contrats.css'
})
export class ContratsComponent implements OnInit {
  contrats: any[] = [];
  locations: any[] = [];
  ventes: any[] = [];
  constructions: any[] = [];
  biens: any[] = [];
  tousContrats: any[] = []; // pour ne plus proposer une opération qui a déjà son contrat
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

  pending: { action: Action; contrat: any } | null = null;
  pendingError = '';
  working = false;

  types = [
    { value: 'location', label: 'Location', icon: 'bi-key' },
    { value: 'vente', label: 'Vente', icon: 'bi-tag' },
    { value: 'construction', label: 'Construction', icon: 'bi-building' }
  ];
  typeTabs = [{ value: '', label: 'Tous les types' }, ...this.types];

  statuts = [
    { value: 'en_attente', label: 'En attente', icon: 'bi-hourglass-split' },
    { value: 'signe', label: 'Signé', icon: 'bi-check2-circle' },
    { value: 'resilie', label: 'Résilié', icon: 'bi-x-circle' }
  ];
  statutTabs = [
    { value: '', label: 'Tous' },
    { value: 'en_attente', label: 'En attente' },
    { value: 'signe', label: 'Signés' },
    { value: 'resilie', label: 'Résiliés' }
  ];

  form: any = this.emptyForm();

  // Agent responsable
  agents: any[] = [];
  filterAgent: any = '';
  agentFiltreOuvert = false;
  agentChoixOuvert = false;
  reattribution: any = null;
  reattributionId: any = '';
  reattributionError = '';
  agentBusy = false;

  constructor(
    private api: ApiService,
    private impression: ImpressionService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  // Ouvre le document à l'en-tête de l'agence et lance l'impression (ou « Enregistrer au format PDF »)
  imprimer(element: any): void {
    this.errorMsg = '';
    this.impression.imprimer('contrat', element.id, (msg: string) => {
      this.errorMsg = msg;
      this.cdr.detectChanges();
    });
  }

  ngOnInit(): void {
    this.loadAgents();
    this.loadContrats();
    this.loadRelations(); // pour afficher le bien et le client de chaque contrat
  }


  // ---------- Agent responsable du dossier ----------

  // Propriétaire et administrateur voient les dossiers de tous les agents
  voitTousLesDossiers(): boolean {
    return this.auth.estDirection();
  }

  peutChoisirAgent(): boolean {
    return this.auth.estDirection();
  }

  // Agents actifs (+ « moi » pour la direction, qui peut suivre un dossier elle-même)
  loadAgents(): void {
    if (!this.voitTousLesDossiers() && !this.peutChoisirAgent()) return;
    this.api.get('agents').subscribe({
      next: (d: any) => {
        const liste = Array.isArray(d) ? d : (d?.data || []);
        const moi = this.auth.getUser();
        // La personne connectée apparaît comme « Moi »
        this.agents = liste.map((a: any) => ({ ...a, moi: !!moi && String(a.id) === String(moi.id) }));
        this.cdr.detectChanges();
      },
      error: () => { this.agents = []; this.cdr.detectChanges(); }
    });
  }

  agentNomParId(id: any): string {
    const a = this.agents.find(x => String(x.id) === String(id));
    return a ? this.agentLibelle(a) : '';
  }

  // « Moussa Sarr », « Aminata Diallo · Administrateur », « Moi (Moustapha NDAO) »
  agentLibelle(a: any): string {
    if (a?.moi) return 'Moi (' + a.name + ')';
    const roles: any = { administrateur: 'Administrateur', proprietaire: 'Propriétaire' };
    return a?.name + (roles[a?.role] ? ' · ' + roles[a.role] : '');
  }

  agentNom(dossier: any): string {
    return (dossier?.location || dossier?.vente || dossier?.construction)?.user?.name || this.agentNomParId((dossier?.location || dossier?.vente || dossier?.construction)?.user_id) || 'Non attribué';
  }

  // Dans le tableau : prénom seulement (le nom complet est dans l'info-bulle)
  agentCourt(dossier: any): string {
    const nom = this.agentNom(dossier);
    if (nom === 'Non attribué') return nom;
    if (nom.startsWith('Moi')) return 'Moi';
    return nom.replace(/ · .*$/, '').trim().split(/\s+/)[0];
  }

  agentInitiales(dossier: any): string {
    const nom = (dossier?.location || dossier?.vente || dossier?.construction)?.user?.name || this.agentNomParId((dossier?.location || dossier?.vente || dossier?.construction)?.user_id);
    if (!nom) return '?';
    const p = String(nom).replace(/^Moi \(|\)$/g, '').replace(/ · .*$/, '').trim().split(/\s+/);
    return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  }

  // ---------- Filtre par agent ----------

  agentFiltreLabel(): string {
    if (!this.filterAgent) return 'Tous les agents';
    if (this.filterAgent === 'aucun') return 'Non attribués';
    return this.agentNomParId(this.filterAgent) || 'Agent';
  }

  toggleAgentFiltre(): void {
    this.agentFiltreOuvert = !this.agentFiltreOuvert;
    this.cdr.detectChanges();
  }

  setAgentFiltre(value: any): void {
    this.filterAgent = value;
    this.agentFiltreOuvert = false;
    this.currentPage = 1;
    this.loadContrats();
  }

  // ---------- Choix de l'agent dans le formulaire ----------

  toggleAgentChoix(): void {
    this.agentChoixOuvert = !this.agentChoixOuvert;
    this.cdr.detectChanges();
  }

  pickAgent(id: any): void {
    this.form.user_id = id;
    this.agentChoixOuvert = false;
    this.cdr.detectChanges();
  }

  agentChoixLabel(): string {
    if (!this.form.user_id) {
      return this.auth.estDirection() ? 'Moi (' + (this.auth.getUser()?.name || '') + ')' : 'Choisir l’agent';
    }
    return this.agentNomParId(this.form.user_id) || 'Agent';
  }

  // ---------- Libellés ----------

  typeLabel(value: string): string {
    return this.types.find(t => t.value === value)?.label || value;
  }

  typeIcon(value: string): string {
    return this.types.find(t => t.value === value)?.icon || 'bi-file-earmark-text';
  }

  statutLabel(value: string): string {
    return this.statuts.find(s => s.value === value)?.label || value;
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
    const mot = n > 1 ? 'contrats' : 'contrat';
    return this.filterType || this.filterStatut
      ? `${n} ${mot} pour ces critères`
      : `${n} ${mot} ${n > 1 ? 'enregistrés' : 'enregistré'}`;
  }

  // ---------- Opération liée au contrat ----------

  private relationKey(): 'location_id' | 'vente_id' | 'construction_id' | null {
    switch (this.form.type) {
      case 'location': return 'location_id';
      case 'vente': return 'vente_id';
      case 'construction': return 'construction_id';
      default: return null;
    }
  }

  relationId(): any {
    const key = this.relationKey();
    return key ? this.form[key] : '';
  }

  relationTitle(): string {
    switch (this.form.type) {
      case 'location': return 'Location concernée';
      case 'vente': return 'Vente concernée';
      default: return 'Construction concernée';
    }
  }

  relationOptions(): { id: any; titre: string; ref: string; label: string }[] {
    const list = this.form.type === 'location' ? this.locations
      : this.form.type === 'vente' ? this.ventes
      : this.form.type === 'construction' ? this.constructions : [];
    // Une opération qui a déjà un contrat (non résilié) n'est plus proposée
    const key = this.relationKey();
    const prises = new Set(this.tousContrats
      .filter(c => c.statut !== 'resilie' && !this.sameId(this.editingId, c.id) && key && c[key])
      .map(c => String(c[key!])));
    return list
      .filter((x: any) => (!prises.has(String(x.id)) && this.eligible(x, key)) || this.sameId(this.relationId(), x.id))
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

  // Ce que concerne un contrat de la liste : on prend l'objet renvoyé par l'API
  // s'il est présent, sinon on le retrouve dans les listes chargées.
  concerne(c: any): { titre: string; ref: string; label: string } | null {
    // On préfère l'élément complet des listes chargées (il contient le bien et le client)
    const trouver = (obj: any, list: any[], id: any) => {
      const cle = id ?? obj?.id;
      return (cle != null ? list.find(x => this.sameId(cle, x.id)) : null) || obj || null;
    };
    const x = c.type === 'location' ? trouver(c.location, this.locations, c.location_id)
      : c.type === 'vente' ? trouver(c.vente, this.ventes, c.vente_id)
      : c.type === 'construction' ? trouver(c.construction, this.constructions, c.construction_id)
      : null;
    return x ? this.describe(x) : null;
  }

  // ---------- Filtres ----------

  setType(value: string): void {
    this.filterType = value;
    this.currentPage = 1;
    this.loadContrats();
  }

  setStatut(value: string): void {
    this.filterStatut = value;
    this.currentPage = 1;
    this.loadContrats();
  }

  // ---------- Chargement ----------

  loadContrats(): void {
    this.contrats = [];
    this.loaded = false;
    this.cdr.detectChanges();

    const params: any = { page: this.currentPage };
    if (this.filterAgent) params.agent_id = this.filterAgent;
    if (this.filterType) params.type = this.filterType;
    if (this.filterStatut) params.statut = this.filterStatut;

    this.api.get('contrats', params).subscribe({
      next: (data: any) => {
        if (data && data.data) {
          this.contrats = data.data;
          this.totalPages = data.last_page || 1;
          this.total = data.total ?? this.contrats.length;
        } else if (Array.isArray(data)) {
          this.contrats = data;
          this.totalPages = 1;
          this.total = data.length;
        } else {
          this.contrats = [];
          this.totalPages = 1;
          this.total = 0;
        }
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.contrats = [];
        this.totalPages = 1;
        this.total = 0;
        this.loaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  loadRelations(): void {
    this.relationsLoading = 6;
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
    this.api.get('contrats', { per_page: 100 }).subscribe({
      next: (d: any) => { this.tousContrats = d?.data || d || []; fin(); }, error: () => fin()
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
      date_creation: new Date().toISOString().slice(0, 10), // aujourd'hui par défaut
      date_signature: '',
      statut: 'en_attente',
      location_id: '',
      vente_id: '',
      construction_id: ''
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
    if (key) this.form[key] = id;
    this.openPicker = false;
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

  saveContrat(): void {
    if (this.saving) return;

    if (!this.form.type || !this.form.date_creation) {
      this.errorMsg = 'Veuillez choisir le type de contrat et la date de création.';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    const modification = this.editingId !== null;
    const request = modification
      ? this.api.put('contrats', this.editingId!, this.form)
      : this.api.post('contrats', this.form);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.successMsg = modification ? 'Contrat modifié.' : 'Contrat créé.';
        this.showForm = false;
        this.resetForm();
        this.loadContrats();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.saving = false;
        this.errorMsg = this.messageErreur(err, modification ? 'Erreur lors de la modification' : 'Erreur lors de la création');
        this.cdr.detectChanges();
      }
    });
  }

  editContrat(contrat: any): void {
    this.resetForm();
    this.editingId = contrat.id;
    this.form = {
      type: contrat.type || '',
      date_creation: (contrat.date_creation || '').slice(0, 10),
      date_signature: (contrat.date_signature || '').slice(0, 10),
      statut: contrat.statut || 'en_attente',
      location_id: contrat.location_id || '',
      vente_id: contrat.vente_id || '',
      construction_id: contrat.construction_id || ''
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

  // ---------- Signer / supprimer ----------

  ask(action: Action, contrat: any): void {
    this.pending = { action, contrat };
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
    const { action, contrat } = this.pending;
    this.working = true;
    this.pendingError = '';
    this.cdr.detectChanges();

    const request = action === 'delete'
      ? this.api.delete('contrats', contrat.id)
      : this.api.put('contrats', contrat.id, { statut: 'signe' });

    request.subscribe({
      next: () => {
        this.working = false;
        this.pending = null;
        this.successMsg = action === 'delete' ? 'Contrat supprimé.' : 'Contrat marqué comme signé.';
        this.loadContrats();
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
      this.loadContrats();
    }
  }
}