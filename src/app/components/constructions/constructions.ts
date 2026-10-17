import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { SidebarComponent } from '../sidebar/sidebar';

type Etat = 'loading' | 'ok' | 'error';

@Component({
  selector: 'app-constructions',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SidebarComponent],
  templateUrl: './constructions.html',
  styleUrl: './constructions.css'
})
export class ConstructionsComponent implements OnInit {
  constructions: any[] = [];
  clients: any[] = [];
  biens: any[] = [];
  ventes: any[] = [];
  total = 0;
  loaded = false;
  saving = false;
  showForm = false;
  successMsg = '';
  errorMsg = '';
  searchTerm = '';
  filterStatut = '';
  currentPage = 1;
  totalPages = 1;
  editingId: number | null = null;
  editingBien: any = null; // terrain du chantier modifié (absent de la liste des biens disponibles)
  editingClient: any = null;
  openPicker: 'client' | 'bien' | null = null;
  clientsEtat: Etat = 'loading';
  biensEtat: Etat = 'loading';

  // Suivi du chantier (étapes)
  selectedConstruction: any = null;
  etapesLoading = false;
  etapeBusy: number | null = null;
  etapeError = '';
  closingId: number | null = null; // étape en train d'être terminée (saisie du versement)
  versement: any = '';

  // Confirmation de suppression
  pending: any = null;
  pendingError = '';
  working = false;

  statuts = [
    { value: 'en_cours', label: 'En cours', icon: 'bi-cone-striped' },
    { value: 'livre', label: 'Livré', icon: 'bi-house-check' },
    { value: 'annule', label: 'Annulé', icon: 'bi-x-circle' }
  ];
  statutTabs = [
    { value: '', label: 'Tous' },
    { value: 'en_cours', label: 'En cours' },
    { value: 'livre', label: 'Livrés' },
    { value: 'annule', label: 'Annulés' }
  ];
  etapeStatuts: any = { en_attente: 'En attente', en_cours: 'En cours', termine: 'Terminée' };

  form: any = this.emptyForm();

  private searchTimer: any;

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
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAgents();
    this.loadConstructions();
    this.loadClients();
    this.loadBiens();
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
    return dossier?.user?.name || this.agentNomParId(dossier?.user_id) || 'Non attribué';
  }

  // Dans le tableau : prénom seulement (le nom complet est dans l'info-bulle)
  agentCourt(dossier: any): string {
    const nom = this.agentNom(dossier);
    if (nom === 'Non attribué') return nom;
    if (nom.startsWith('Moi')) return 'Moi';
    return nom.replace(/ · .*$/, '').trim().split(/\s+/)[0];
  }

  agentInitiales(dossier: any): string {
    const nom = dossier?.user?.name || this.agentNomParId(dossier?.user_id);
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
    this.loadConstructions();
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

  // Changer l'agent d'un dossier (propriétaire, administrateur)
  ouvrirReattribution(dossier: any): void {
    if (!this.peutChoisirAgent()) return;
    this.reattribution = dossier;
    this.reattributionId = dossier.user_id ?? dossier.user?.id ?? '';
    this.reattributionError = '';
    this.cdr.detectChanges();
  }

  fermerReattribution(): void {
    this.reattribution = null;
    this.reattributionError = '';
    this.agentBusy = false;
    this.cdr.detectChanges();
  }

  choisirReattribution(id: any): void {
    this.reattributionId = id;
    this.cdr.detectChanges();
  }

  confirmerReattribution(): void {
    if (!this.reattribution || this.agentBusy || !this.reattributionId) return;
    this.agentBusy = true;
    this.reattributionError = '';
    this.cdr.detectChanges();
    this.api.put('constructions', this.reattribution.id, { user_id: this.reattributionId }).subscribe({
      next: () => {
        this.agentBusy = false;
        this.reattribution = null;
        this.successMsg = 'Dossier attribué à ' + this.agentNomParId(this.reattributionId) + '.';
        this.loadConstructions();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err: any) => {
        this.agentBusy = false;
        this.reattributionError = err?.error?.message || 'Impossible de changer l’agent.';
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- Libellés ----------

  // Message lisible quand le serveur renvoie une erreur technique (SQL, PHP…)
  messageErreur(err: any, defaut: string): string {
    if (err?.status === 0) return 'Le serveur ne répond pas. Vérifiez que le backend est démarré.';
    const brut: string = err?.error?.message || '';
    if (!brut) return defaut + ' (erreur ' + (err?.status ?? 'inconnue') + ').';
    if (/Duplicate entry/i.test(brut) && /numero/i.test(brut)) {
      return 'Ce numéro existe déjà en base : le serveur a généré un numéro déjà utilisé. '
        + 'Il faut corriger la création du numéro dans le contrôleur Laravel.';
    }
    if (/SQLSTATE|Call to a member function|Undefined|Exception|on null/i.test(brut)) {
      return defaut + '. Erreur côté serveur : « ' + brut.slice(0, 140) + (brut.length > 140 ? '…' : '') + ' »';
    }
    return brut;
  }


  // 1500000 -> « 1 500 000 »
  nombre(value: any): string {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || isNaN(n)) return '0';
    const [entier, decimales] = String(Math.round(n * 100) / 100).split('.');
    const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return decimales ? groupes + ',' + decimales : groupes;
  }

  initials(client: any): string {
    if (!client) return '?';
    return ((client.prenom || '').charAt(0) + (client.nom || '').charAt(0)).toUpperCase();
  }

  statutLabel(value: string): string {
    return this.statuts.find(s => s.value === value)?.label || value;
  }

  etapeLabel(value: string): string {
    return this.etapeStatuts[value] || value;
  }

  niveauxLabel(n: any): string {
    const v = Number(n) || 0;
    return v > 1 ? `${v} niveaux` : `${v} niveau`;
  }

  // Les identifiants peuvent arriver en texte ou en nombre selon l'API
  sameId(a: any, b: any): boolean {
    return a !== '' && a !== null && a !== undefined && String(a) === String(b);
  }

  clientLabel(): string {
    const c = this.clients.find(x => this.sameId(this.form.client_id, x.id)) || this.editingClient;
    return c ? `${c.prenom} ${c.nom}` : '';
  }

  bienLabel(): string {
    const b = this.biens.find(x => this.sameId(this.form.bien_id, x.id)) || this.editingBien;
    return b ? `${b.reference} — ${b.localisation}` : '';
  }

  // Seuls les terrains peuvent accueillir un chantier
  // Terrains proposés : les terrains libres, et ceux vendus au client choisi
  terrains(): any[] {
    return this.biens.filter(b =>
      (!b.type || b.type === 'terrain') &&
      (b.statut === 'disponible' || this.venduAuClient(b)));
  }

  // Ce terrain a-t-il été vendu (vente en cours ou finalisée) au client choisi ?
  venduAuClient(b: any): boolean {
    if (!this.form.client_id) return false;
    return this.ventes.some(v =>
      this.sameId(v.bien_id ?? v.bien?.id, b.id) &&
      this.sameId(v.client_id ?? v.client?.id, this.form.client_id) &&
      v.statut !== 'annule');
  }

  // Avancement : nombre d'étapes terminées sur le total
  etapesFaites(c: any): number {
    return (c?.etapes || []).filter((e: any) => e.statut === 'termine').length;
  }

  etapesTotal(c: any): number {
    return (c?.etapes || []).length;
  }

  avancement(c: any): number {
    const t = this.etapesTotal(c);
    return t ? Math.round(this.etapesFaites(c) * 100 / t) : 0;
  }

  // Somme versée pour les étapes terminées
  verse(c: any): number {
    return (c?.etapes || [])
      .filter((e: any) => e.statut === 'termine')
      .reduce((s: number, e: any) => s + (Number(e.montant_versement) || 0), 0);
  }

  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    const n = this.total;
    const mot = n > 1 ? 'chantiers' : 'chantier';
    return this.searchTerm || this.filterStatut
      ? `${n} ${mot} pour ces critères`
      : `${n} ${mot} ${n > 1 ? 'enregistrés' : 'enregistré'}`;
  }

  // ---------- Filtres ----------

  onSearch(): void {
    // On attend que l'utilisateur ait fini de taper avant d'appeler l'API
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.currentPage = 1;
      this.loadConstructions();
    }, 300);
  }

  setStatut(value: string): void {
    this.filterStatut = value;
    this.currentPage = 1;
    this.loadConstructions();
  }

  // ---------- Chargement ----------

  loadConstructions(): void {
    this.constructions = [];
    this.loaded = false;
    this.cdr.detectChanges();

    const params: any = { page: this.currentPage };
    if (this.filterAgent) params.agent_id = this.filterAgent;
    if (this.searchTerm) params.q = this.searchTerm;
    if (this.filterStatut) params.statut = this.filterStatut;

    this.api.get('constructions', params).subscribe({
      next: (data: any) => {
        if (data && data.data) {
          this.constructions = data.data;
          this.totalPages = data.last_page || 1;
          this.total = data.total ?? this.constructions.length;
        } else if (Array.isArray(data)) {
          this.constructions = data;
          this.totalPages = 1;
          this.total = data.length;
        } else {
          this.constructions = [];
          this.totalPages = 1;
          this.total = 0;
        }
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.constructions = [];
        this.totalPages = 1;
        this.total = 0;
        this.loaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  loadClients(): void {
    this.clientsEtat = 'loading';
    this.cdr.detectChanges();
    this.api.get('clients', { per_page: 100 }).subscribe({
      next: (data: any) => { this.clients = data?.data || data || []; this.clientsEtat = 'ok'; this.cdr.detectChanges(); },
      error: () => { this.clientsEtat = 'error'; this.cdr.detectChanges(); }
    });
  }

  loadBiens(): void {
    this.biensEtat = 'loading';
    this.cdr.detectChanges();
    // Tous les biens + les ventes : un terrain vendu à un client peut être construit pour lui
    let reste = 2;
    const fini = () => { if (--reste === 0) { this.biensEtat = 'ok'; this.cdr.detectChanges(); } };
    this.api.get('biens', { per_page: 100 }).subscribe({
      next: (data: any) => { this.biens = data?.data || data || []; fini(); },
      error: () => { this.biensEtat = 'error'; this.cdr.detectChanges(); }
    });
    this.api.get('ventes', { per_page: 100 }).subscribe({
      next: (data: any) => { this.ventes = data?.data || data || []; fini(); },
      error: () => { this.ventes = []; fini(); } // sans les ventes, on propose seulement les terrains libres
    });
  }

  // ---------- Formulaire ----------

  emptyForm(): any {
    return {
      user_id: '',
      montant_total: '',
      date_debut: new Date().toISOString().slice(0, 10), // aujourd'hui par défaut
      niveaux: 1,
      superficie: '',
      client_id: '',
      bien_id: ''
    };
  }

  openNew(): void {
    this.resetForm();
    if (this.clientsEtat !== 'ok') this.loadClients();
    this.loadBiens();
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm = false;
    this.openPicker = null;
    this.resetForm();
  }

  togglePicker(name: 'client' | 'bien' | null): void {
    this.openPicker = this.openPicker === name ? null : name;
    // Liste en erreur : on retente à l'ouverture
    if (name === 'client' && this.clientsEtat === 'error') this.loadClients();
    if (name === 'bien' && this.biensEtat === 'error') this.loadBiens();
    this.cdr.detectChanges();
  }

  pickClient(client: any): void {
    this.form.client_id = client.id;
    // Changer de client peut rendre le terrain choisi impossible
    if (!this.editingId && this.form.bien_id && !this.terrains().some(b => this.sameId(b.id, this.form.bien_id))) {
      this.form.bien_id = '';
    }
    this.openPicker = null;
    this.cdr.detectChanges();
  }

  pickBien(bien: any): void {
    this.form.bien_id = bien.id;
    // Superficie du terrain reprise si elle n'est pas encore saisie
    if (!this.form.superficie && bien.superficie) this.form.superficie = bien.superficie;
    this.openPicker = null;
    this.cdr.detectChanges();
  }

  changeNiveaux(delta: number): void {
    const n = (Number(this.form.niveaux) || 1) + delta;
    this.form.niveaux = Math.max(1, Math.min(20, n));
    this.cdr.detectChanges();
  }

  chooseStatut(value: string): void {
    this.form.statut = value;
    if (value === 'livre' && !this.form.date_livraison) {
      this.form.date_livraison = new Date().toISOString().slice(0, 10);
    }
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pending) {
      this.cancelPending();
    } else if (this.openPicker) {
      this.togglePicker(null);
    } else if (this.showForm) {
      this.closeForm();
    } else if (this.selectedConstruction) {
      this.closeEtapes();
    }
  }

  saveConstruction(): void {
    if (this.saving) return;

    if (!this.form.client_id || !this.form.bien_id || !(Number(this.form.montant_total) > 0) || !this.form.date_debut) {
      this.errorMsg = 'Veuillez choisir le client et le terrain, et remplir le montant et la date de début.';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    const modification = this.editingId !== null;
    const request = modification
      ? this.api.put('constructions', this.editingId!, this.form)
      : this.api.post('constructions', this.form);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.successMsg = modification ? 'Chantier modifié.' : 'Chantier enregistré. Ses étapes ont été créées.';
        this.showForm = false;
        this.resetForm();
        this.loadConstructions();
        this.loadBiens();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.saving = false;
        this.errorMsg = this.messageErreur(err, modification ? 'Erreur lors de la modification' : 'Erreur lors de l’enregistrement');
        this.cdr.detectChanges();
      }
    });
  }

  editConstruction(c: any): void {
    this.resetForm();
    this.editingId = c.id;
    this.editingBien = c.bien || null;
    this.editingClient = c.client || null;
    this.form = {
      user_id: c.user_id ?? c.user?.id ?? '',
      montant_total: c.montant_total ?? '',
      date_debut: (c.date_debut || '').slice(0, 10),
      niveaux: c.niveaux || 1,
      superficie: c.superficie ?? '',
      client_id: c.client_id,
      bien_id: c.bien_id,
      statut: c.statut || 'en_cours',
      date_livraison: (c.date_livraison || '').slice(0, 10)
    };
    if (this.clientsEtat !== 'ok') this.loadClients();
    this.showForm = true;
    this.cdr.detectChanges();
  }

  resetForm(): void {
    this.form = this.emptyForm();
    this.editingId = null;
    this.editingBien = null;
    this.editingClient = null;
    this.errorMsg = '';
    this.saving = false;
    this.cdr.detectChanges();
  }

  // ---------- Suivi du chantier ----------

  voirEtapes(c: any): void {
    this.selectedConstruction = c;
    this.etapeError = '';
    this.etapesLoading = true;
    this.cdr.detectChanges();
    this.refreshEtapes();
  }

  private refreshEtapes(): void {
    if (!this.selectedConstruction) return;
    const id = this.selectedConstruction.id;
    this.api.get('constructions/' + id).subscribe({
      next: (data: any) => {
        const c = data?.data || data;
        if (this.selectedConstruction?.id === id && c) this.selectedConstruction = c;
        this.etapesLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.etapesLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeEtapes(): void {
    this.selectedConstruction = null;
    this.etapeBusy = null;
    this.closingId = null;
    this.etapeError = '';
    this.cdr.detectChanges();
  }

  // Les étapes se font dans l'ordre : on démarre une étape quand la précédente est terminée
  peutDemarrer(c: any, etape: any): boolean {
    return (c?.etapes || [])
      .filter((x: any) => (Number(x.numero) || 0) < (Number(etape.numero) || 0))
      .every((x: any) => x.statut === 'termine');
  }

  // « Terminer » : on demande d'abord le montant versé pour cette étape
  startClose(etape: any): void {
    this.closingId = etape.id;
    this.versement = Number(etape.montant_versement) > 0 ? Number(etape.montant_versement) : ''; // « 500000.00 » -> 500000
    this.etapeError = '';
    this.cdr.detectChanges();
  }

  cancelClose(): void {
    this.closingId = null;
    this.versement = '';
    this.cdr.detectChanges();
  }

  confirmClose(etape: any): void {
    const montant = Number(this.versement);
    if (this.versement === '' || isNaN(montant) || montant < 0) {
      this.etapeError = 'Indiquez le montant versé pour cette étape (0 si rien n’a été versé).';
      this.cdr.detectChanges();
      return;
    }
    this.updateEtape(etape, 'termine', { montant_versement: montant });
  }

  updateEtape(etape: any, statut: string, extra: any = {}): void {
    if (this.etapeBusy !== null) return;
    this.etapeBusy = etape.id;
    this.etapeError = '';
    this.cdr.detectChanges();

    this.api.put('etapes-construction', etape.id, { statut, ...extra }).subscribe({
      next: () => {
        this.etapeBusy = null;
        this.closingId = null;
        etape.statut = statut; // affichage immédiat
        if (extra.montant_versement !== undefined) etape.montant_versement = extra.montant_versement;
        this.cdr.detectChanges();
        this.refreshEtapes();
        this.loadConstructions();
      },
      error: (err) => {
        this.etapeBusy = null;
        this.etapeError = this.messageErreur(err, 'Impossible de mettre à jour cette étape');
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- Suppression ----------

  ask(c: any): void {
    this.pending = c;
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

    this.api.delete('constructions', this.pending.id).subscribe({
      next: () => {
        this.working = false;
        this.pending = null;
        this.successMsg = 'Chantier supprimé.';
        this.loadConstructions();
        this.loadBiens();
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
      this.loadConstructions();
    }
  }
}