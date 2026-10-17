import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { SidebarComponent } from '../sidebar/sidebar';

// Pour afficher les jours et les mois en français (« jeu. 15 oct. 2026 »)
registerLocaleData(localeFr);

@Component({
  selector: 'app-rendez-vous',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SidebarComponent],
  templateUrl: './rendez-vous.html',
  styleUrl: './rendez-vous.css'
})
export class RendezVousComponent implements OnInit {
  rdvs: any[] = [];
  clients: any[] = [];
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

  openPicker = false;
  clientsLoading = false;
  clientsError = '';

  rdvToDelete: any = null;
  deleting = false;
  deleteError = '';

  statuts = [
    { value: 'planifie', label: 'Planifié', icon: 'bi-calendar-event' },
    { value: 'confirme', label: 'Confirmé', icon: 'bi-check2-circle' },
    { value: 'effectue', label: 'Effectué', icon: 'bi-flag' },
    { value: 'annule', label: 'Annulé', icon: 'bi-x-circle' }
  ];

  // Onglets de filtre (au pluriel)
  statutTabs = [
    { value: '', label: 'Tous' },
    { value: 'planifie', label: 'Planifiés' },
    { value: 'confirme', label: 'Confirmés' },
    { value: 'effectue', label: 'Effectués' },
    { value: 'annule', label: 'Annulés' }
  ];

  // Objets proposés en un clic ; on peut aussi taper un autre objet
  objetsCourants = ['Visite de bien', 'Signature de contrat', 'Remise des clés', 'Estimation', 'Suivi de chantier'];

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
    this.loadRdvs();
    this.loadClients();
  }


  // ---------- Agent responsable du dossier ----------

  // Direction et réception voient les rendez-vous de tous les agents
  voitTousLesDossiers(): boolean {
    return this.auth.estDirection() || this.auth.getRole() === 'receptionniste';
  }

  peutChoisirAgent(): boolean {
    return this.auth.estDirection() || this.auth.getRole() === 'receptionniste';
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
    this.loadRdvs();
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

  // Changer l'agent d'un dossier (propriétaire, administrateur, réception)
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
    this.api.put('rendez-vous', this.reattribution.id, { user_id: this.reattributionId }).subscribe({
      next: () => {
        this.agentBusy = false;
        this.reattribution = null;
        this.successMsg = 'Dossier attribué à ' + this.agentNomParId(this.reattributionId) + '.';
        this.loadRdvs();
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

  initials(client: any): string {
    if (!client) return '?';
    return ((client.prenom || '').charAt(0) + (client.nom || '').charAt(0)).toUpperCase();
  }

  statutLabel(value: string): string {
    return this.statuts.find(s => s.value === value)?.label || value;
  }

  sameId(a: any, b: any): boolean {
    return a !== '' && a !== null && a !== undefined && String(a) === String(b);
  }

  clientLabel(): string {
    const c = this.clients.find(x => this.sameId(this.form.client_id, x.id));
    return c ? `${c.prenom} ${c.nom}` : '';
  }

  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    const n = this.total;
    const mot = n > 1 ? 'rendez-vous' : 'rendez-vous';
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
      this.loadRdvs();
    }, 300);
  }

  setStatut(value: string): void {
    this.filterStatut = value;
    this.currentPage = 1;
    this.loadRdvs();
  }

  // ---------- Chargement ----------

  loadRdvs(): void {
    this.rdvs = [];
    this.loaded = false;
    this.cdr.detectChanges();

    const params: any = { page: this.currentPage };
    if (this.filterAgent) params.agent_id = this.filterAgent;
    if (this.searchTerm) params.q = this.searchTerm;
    if (this.filterStatut) params.statut = this.filterStatut;

    this.api.get('rendez-vous', params).subscribe({
      next: (data: any) => {
        if (data && data.data) {
          this.rdvs = data.data;
          this.totalPages = data.last_page || 1;
          this.total = data.total ?? this.rdvs.length;
        } else if (Array.isArray(data)) {
          this.rdvs = data;
          this.totalPages = 1;
          this.total = data.length;
        } else {
          this.rdvs = [];
          this.totalPages = 1;
          this.total = 0;
        }
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.rdvs = [];
        this.totalPages = 1;
        this.total = 0;
        this.loaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  loadClients(): void {
    this.clientsLoading = true;
    this.clientsError = '';
    this.cdr.detectChanges();

    this.api.get('clients', { per_page: 100 }).subscribe({
      next: (data: any) => {
        this.clients = data?.data || data || [];
        this.clientsLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.clients = [];
        this.clientsLoading = false;
        this.clientsError = err?.status === 0
          ? 'Le serveur ne répond pas. Vérifiez que le backend est démarré.'
          : 'Impossible de charger les clients (erreur ' + (err?.status ?? 'inconnue') + ').';
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- Formulaire ----------

  emptyForm(): any {
    return { user_id: '', date_heure: '', objet: '', lieu_rdv: '', notes: '', client_id: '', statut: 'planifie' };
  }

  // Rafraîchit l'écran tout de suite (suggestions d'objet)
  refresh(): void {
    this.cdr.detectChanges();
  }

  openNew(): void {
    this.resetForm();
    this.loadClients(); // pour voir un client ajouté entre-temps
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm = false;
    this.openPicker = false;
    this.resetForm();
  }

  openClientPicker(): void {
    this.openPicker = !this.openPicker;
    if (this.openPicker && this.clients.length === 0 && !this.clientsLoading) {
      this.loadClients();
    }
    this.cdr.detectChanges();
  }

  closeClientPicker(): void {
    this.openPicker = false;
    this.cdr.detectChanges();
  }

  pickClient(client: any): void {
    this.form.client_id = client.id;
    this.openPicker = false;
    this.cdr.detectChanges();
  }

  chooseObjet(objet: string): void {
    this.form.objet = objet;
    this.cdr.detectChanges();
  }

  choose(field: 'statut', value: string): void {
    this.form[field] = value;
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.rdvToDelete) {
      this.cancelDelete();
    } else if (this.openPicker) {
      this.closeClientPicker();
    } else if (this.showForm) {
      this.closeForm();
    }
  }

  saveRdv(): void {
    if (this.saving) return;

    // La réception prend le rendez-vous pour un agent : il faut dire lequel
    if (this.auth.getRole() === 'receptionniste' && !this.form.user_id) {
      this.errorMsg = 'Choisissez l’agent qui recevra le client.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.form.client_id || !this.form.date_heure || !this.form.objet) {
      this.errorMsg = 'Veuillez choisir le client et remplir la date, l’heure et l’objet.';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    const modification = this.editingId !== null;
    const request = modification
      ? this.api.put('rendez-vous', this.editingId!, this.form)
      : this.api.post('rendez-vous', this.form);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.successMsg = modification ? 'Rendez-vous modifié.' : 'Rendez-vous ajouté.';
        this.showForm = false;
        this.resetForm();
        this.loadRdvs();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.saving = false;
        this.errorMsg = err.error?.message || (modification ? 'Erreur lors de la modification' : 'Erreur lors de l’ajout');
        this.cdr.detectChanges();
      }
    });
  }

  editRdv(rdv: any): void {
    this.resetForm();
    this.editingId = rdv.id;
    this.form = {
      user_id: rdv.user_id ?? rdv.user?.id ?? '',
      // « 2026-10-15 14:00:00 » -> « 2026-10-15T14:00 » pour le champ date et heure
      date_heure: (rdv.date_heure || '').replace(' ', 'T').substring(0, 16),
      objet: rdv.objet,
      lieu_rdv: rdv.lieu_rdv || '',
      notes: rdv.notes || '',
      client_id: rdv.client_id,
      statut: rdv.statut
    };
    if (this.clients.length === 0) {
      this.loadClients();
    }
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

  askDelete(rdv: any): void {
    this.rdvToDelete = rdv;
    this.deleteError = '';
    this.cdr.detectChanges();
  }

  cancelDelete(): void {
    this.rdvToDelete = null;
    this.deleteError = '';
    this.deleting = false;
    this.cdr.detectChanges();
  }

  confirmDelete(): void {
    if (!this.rdvToDelete || this.deleting) return;
    this.deleting = true;
    this.deleteError = '';
    this.cdr.detectChanges();

    this.api.delete('rendez-vous', this.rdvToDelete.id).subscribe({
      next: () => {
        this.deleting = false;
        this.rdvToDelete = null;
        this.successMsg = 'Rendez-vous supprimé.';
        this.loadRdvs();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        // La fenêtre reste ouverte et affiche la raison donnée par le serveur
        this.deleting = false;
        if (err?.status === 0) {
          this.deleteError = 'Le serveur ne répond pas. Vérifiez que le backend est démarré.';
        } else {
          this.deleteError = err?.error?.message
            || 'Le serveur a refusé la suppression (erreur ' + (err?.status ?? 'inconnue') + ').';
        }
        this.cdr.detectChanges();
      }
    });
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadRdvs();
    }
  }
}