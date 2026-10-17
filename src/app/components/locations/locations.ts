import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { SidebarComponent } from '../sidebar/sidebar';

type Action = 'terminer' | 'delete';

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SidebarComponent],
  templateUrl: './locations.html',
  styleUrl: './locations.css'
})
export class LocationsComponent implements OnInit {
  locations: any[] = [];
  clients: any[] = [];
  biens: any[] = [];
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
  editingBien: any = null; // bien de la location modifiée (absent de la liste des biens disponibles)
  openPicker: 'client' | 'bien' | null = null;

  // Fenêtre de confirmation (terminer, supprimer)
  pending: { action: Action; location: any } | null = null;
  pendingError = '';
  working = false;
  dateDepart = '';

  statuts = [
    { value: 'actif', label: 'Active' },
    { value: 'termine', label: 'Terminée' }
  ];
  // Onglets de filtre (au pluriel)
  statutTabs = [
    { value: '', label: 'Toutes' },
    { value: 'actif', label: 'Actives' },
    { value: 'termine', label: 'Terminées' }
  ];

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
    this.loadLocations();
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
    this.loadLocations();
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
    this.api.put('locations', this.reattribution.id, { user_id: this.reattributionId }).subscribe({
      next: () => {
        this.agentBusy = false;
        this.reattribution = null;
        this.successMsg = 'Dossier attribué à ' + this.agentNomParId(this.reattributionId) + '.';
        this.loadLocations();
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

  // Nombre à la française : 1 500 000
  nombre(value: any): string {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || isNaN(n)) return '0';
    const [entier, decimales] = String(Math.round(n * 100) / 100).split('.');
    const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return decimales ? groupes + ',' + decimales : groupes;
  }

  initials(client: any): string {
    if (!client) return '?';
    return ((client.prenom || '').charAt(0) + (client.nom || '').charAt(0)).toUpperCase();
  }

  statutLabel(value: string): string {
    return this.statuts.find(s => s.value === value)?.label || value;
  }

  // Les identifiants peuvent arriver en texte ou en nombre selon l'API
  sameId(a: any, b: any): boolean {
    return a !== '' && a !== null && a !== undefined && String(a) === String(b);
  }

  clientLabel(): string {
    const c = this.clients.find(x => this.sameId(this.form.client_id, x.id));
    return c ? `${c.prenom} ${c.nom}` : '';
  }

  bienLabel(): string {
    const b = this.biens.find(x => this.sameId(this.form.bien_id, x.id)) || this.editingBien;
    return b ? `${b.reference} — ${b.localisation}` : '';
  }

  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    const n = this.total;
    const mot = n > 1 ? 'locations' : 'location';
    return this.searchTerm || this.filterStatut
      ? `${n} ${mot} pour ces critères`
      : `${n} ${mot} ${n > 1 ? 'enregistrées' : 'enregistrée'}`;
  }

  // ---------- Filtres ----------

  onSearch(): void {
    // On attend que l'utilisateur ait fini de taper avant d'appeler l'API
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.currentPage = 1;
      this.loadLocations();
    }, 300);
  }

  setStatut(value: string): void {
    this.filterStatut = value;
    this.currentPage = 1;
    this.loadLocations();
  }

  // ---------- Chargement ----------

  loadLocations(): void {
    this.locations = [];
    this.loaded = false;
    this.cdr.detectChanges();

    const params: any = { page: this.currentPage };
    if (this.filterAgent) params.agent_id = this.filterAgent;
    if (this.searchTerm) params.q = this.searchTerm;
    if (this.filterStatut) params.statut = this.filterStatut;

    this.api.get('locations', params).subscribe({
      next: (data: any) => {
        if (data && data.data) {
          this.locations = data.data;
          this.totalPages = data.last_page || 1;
          this.total = data.total ?? this.locations.length;
        } else if (Array.isArray(data)) {
          this.locations = data;
          this.totalPages = 1;
          this.total = data.length;
        } else {
          this.locations = [];
          this.totalPages = 1;
          this.total = 0;
        }
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.locations = [];
        this.totalPages = 1;
        this.total = 0;
        this.loaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  loadClients(): void {
    this.api.get('clients', { per_page: 100 }).subscribe({
      next: (data: any) => {
        this.clients = data?.data || data || [];
        this.cdr.detectChanges();
      }
    });
  }

  // On ne loue pas un terrain nu : seuls les biens habitables ou commerciaux sont proposés
  biensLouables(): any[] {
    return this.biens.filter(b => b.type !== 'terrain');
  }

  bienType(value: string): string {
    const types: any = {
      terrain: 'Terrain', maison: 'Maison', villa: 'Villa',
      appartement: 'Appartement', local_commercial: 'Local commercial'
    };
    return types[value] || '';
  }

  loadBiens(): void {
    this.api.get('biens', { statut: 'disponible', per_page: 100 }).subscribe({
      next: (data: any) => {
        this.biens = data?.data || data || [];
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- Formulaire ----------

  emptyForm(): any {
    return {
      user_id: '',
      date_debut: new Date().toISOString().slice(0, 10), // aujourd'hui par défaut
      loyer_mensuel: '',
      caution: '',
      client_id: '',
      bien_id: ''
    };
  }

  // Le bouton « Nouvelle location » ouvre le formulaire et rafraîchit l'écran
  // tout de suite (avant, il fallait recharger la page pour le voir apparaître).
  openNew(): void {
    this.resetForm();
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
    this.cdr.detectChanges();
  }

  pickClient(client: any): void {
    this.form.client_id = client.id;
    this.openPicker = null;
    this.cdr.detectChanges();
  }

  pickBien(bien: any): void {
    this.form.bien_id = bien.id;
    this.openPicker = null;
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
    }
  }

  saveLocation(): void {
    if (this.saving) return;

    const loyerVide = this.form.loyer_mensuel === '' || this.form.loyer_mensuel === null;
    if (!this.form.client_id || !this.form.bien_id || loyerVide || !this.form.date_debut) {
      this.errorMsg = 'Veuillez choisir le locataire et le bien, et remplir le loyer et la date de début.';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    if (this.editingId) {
      this.api.put('locations', this.editingId, this.form).subscribe({
        next: () => {
          this.saving = false;
          this.successMsg = 'Location modifiée avec succès.';
          this.showForm = false;
          this.resetForm();
          this.loadLocations();
          setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
        },
        error: (err) => {
          this.saving = false;
          this.errorMsg = err.error?.message || 'Erreur lors de la modification';
          this.cdr.detectChanges();
        }
      });
    } else {
      this.api.post('locations', this.form).subscribe({
        next: () => {
          this.saving = false;
          this.successMsg = 'Location enregistrée avec succès.';
          this.showForm = false;
          this.resetForm();
          this.loadLocations();
          this.loadBiens();
          setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
        },
        error: (err) => {
          this.saving = false;
          this.errorMsg = err.error?.message || 'Erreur lors de l\'enregistrement';
          this.cdr.detectChanges();
        }
      });
    }
  }

  editLocation(location: any): void {
    this.errorMsg = '';
    this.editingId = location.id;
    this.editingBien = location.bien || null;
    this.form = {
      user_id: location.user_id ?? location.user?.id ?? '',
      date_debut: (location.date_debut || '').slice(0, 10),
      loyer_mensuel: location.loyer_mensuel,
      caution: location.caution,
      client_id: location.client_id,
      bien_id: location.bien_id
    };
    this.showForm = true;
    this.cdr.detectChanges();
  }

  resetForm(): void {
    this.form = this.emptyForm();
    this.editingId = null;
    this.editingBien = null;
    this.errorMsg = '';
    this.saving = false;
    this.cdr.detectChanges();
  }

  // ---------- Terminer / supprimer ----------

  ask(action: Action, location: any): void {
    this.pending = { action, location };
    this.pendingError = '';
    this.dateDepart = new Date().toISOString().slice(0, 10); // aujourd'hui par défaut
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
    const { action, location } = this.pending;

    if (action === 'terminer' && !this.dateDepart) {
      this.pendingError = 'Veuillez indiquer la date de départ du locataire.';
      this.cdr.detectChanges();
      return;
    }

    this.working = true;
    this.pendingError = '';
    this.cdr.detectChanges();

    const request = action === 'delete'
      ? this.api.delete('locations', location.id)
      : this.api.put('locations', location.id, { statut: 'termine', date_fin: this.dateDepart });

    request.subscribe({
      next: () => {
        this.working = false;
        this.pending = null;
        this.successMsg = action === 'delete'
          ? 'Location supprimée.'
          : 'Location terminée. Le bien est de nouveau disponible.';
        this.loadLocations();
        this.loadBiens();
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
      this.loadLocations();
    }
  }
}