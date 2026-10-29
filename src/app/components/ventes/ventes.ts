import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { SidebarComponent } from '../sidebar/sidebar';

type Action = 'finalise' | 'annule' | 'delete';

@Component({
  selector: 'app-ventes',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SidebarComponent],
  templateUrl: './ventes.html',
  styleUrl: './ventes.css'
})
export class VentesComponent implements OnInit {
  ventes: any[] = [];
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
  openPicker: 'client' | 'bien' | null = null;

  // Fenêtre de confirmation (finaliser, annuler, supprimer)
  pending: { action: Action; vente: any } | null = null;
  pendingError = '';
  working = false;

  statuts = [
    { value: 'en_cours', label: 'En cours' },
    { value: 'finalise', label: 'Finalisée' },
    { value: 'annule', label: 'Annulée' }
  ];
  statutTabs = [{ value: '', label: 'Toutes' }, ...this.statuts];

  // Mandat du bien choisi : la commission est calculée par le serveur à partir de ce mandat
  mandatVente: any = null;
  mandatCharge = false;

  modesPaiement = [
    { value: 'especes', label: 'Espèces', icon: 'bi-cash' },
    { value: 'virement', label: 'Virement', icon: 'bi-bank' },
    { value: 'cheque', label: 'Chèque', icon: 'bi-pencil-square' },
    { value: 'mobile_money', label: 'Mobile Money', icon: 'bi-phone' }
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
    this.loadVentes();
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

  // ---------- Agent responsable affiché (fixé) dans le formulaire ----------
  // Nouveau dossier : la personne connectée. Modification : l'agent déjà enregistré.
  agentFixeLabel(): string {
    const moi = this.auth.getUser();
    const id = this.form?.user_id;
    if (!id || (moi && String(id) === String(moi.id))) {
      return (moi?.name || '') + ' (vous)';
    }
    return this.agentNomParId(id) || 'Non attribué';
  }

  agentFixeInitiales(): string {
    const nom = this.agentFixeLabel().replace(/ \(vous\)$/, '').replace(/ · .*$/, '').replace(/^Moi \(|\)$/g, '').trim();
    const p = nom.split(/\s+/).filter(Boolean);
    if (!p.length || nom === 'Non attribué') return '?';
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
    this.loadVentes();
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
    this.api.put('ventes', this.reattribution.id, { user_id: this.reattributionId }).subscribe({
      next: () => {
        this.agentBusy = false;
        this.reattribution = null;
        this.successMsg = 'Dossier attribué à ' + this.agentNomParId(this.reattributionId) + '.';
        this.loadVentes();
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
    return ((client.nom || '').charAt(0) + (client.prenom || '').charAt(0)).toUpperCase();
  }

  statutLabel(value: string): string {
    return this.statuts.find(s => s.value === value)?.label || value;
  }

  clientLabel(): string {
    const c = this.clients.find(x => x.id === this.form.client_id);
    return c ? `${c.nom} ${c.prenom}` : '';
  }

  bienLabel(): string {
    const b = this.biens.find(x => x.id === this.form.bien_id);
    return b ? `${b.reference} — ${b.localisation}` : '';
  }

  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    const n = this.total;
    const mot = n > 1 ? 'ventes' : 'vente';
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
      this.loadVentes();
    }, 300);
  }

  setStatut(value: string): void {
    this.filterStatut = value;
    this.currentPage = 1;
    this.loadVentes();
  }

  // ---------- Chargement ----------

  loadVentes(): void {
    this.ventes = [];
    this.loaded = false;
    this.cdr.detectChanges();

    const params: any = { page: this.currentPage };
    if (this.filterAgent) params.agent_id = this.filterAgent;
    if (this.searchTerm) params.q = this.searchTerm;
    if (this.filterStatut) params.statut = this.filterStatut;

    this.api.get('ventes', params).subscribe({
      next: (data: any) => {
        if (data && data.data) {
          this.ventes = data.data;
          this.totalPages = data.last_page || 1;
          this.total = data.total ?? this.ventes.length;
        } else if (Array.isArray(data)) {
          this.ventes = data;
          this.totalPages = 1;
          this.total = data.length;
        } else {
          this.ventes = [];
          this.totalPages = 1;
          this.total = 0;
        }
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.ventes = [];
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

  loadBiens(): void {
    this.api.get('biens', { statut: 'disponible', per_page: 100 }).subscribe({
      next: (data: any) => {
        this.biens = data?.data || data || [];
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- Commission (aperçu ; le calcul officiel est fait par le serveur) ----------

  bienChoisi(): any {
    return this.biens.find((b: any) => String(b.id) === String(this.form.bien_id));
  }

  chargerMandat(bien: any): void {
    this.mandatVente = null;
    this.mandatCharge = false;
    if (!bien || bien.type_propriete !== 'confie') return;
    this.api.get('mandats', { bien_id: bien.id, statut: 'actif', type: 'vente' }).subscribe({
      next: (d: any) => {
        this.mandatVente = (d?.data || [])[0] || null;
        this.mandatCharge = true;
        this.cdr.detectChanges();
      },
      error: () => { this.mandatCharge = true; this.cdr.detectChanges(); }
    });
  }

  partenaire(): boolean {
    return this.mandatVente?.proprietaire_tiers?.type === 'agence';
  }

  commissionTotale(): number {
    return Math.round((Number(this.form.prix_vente) || 0) * (Number(this.mandatVente?.taux_commission) || 0)) / 100;
  }

  getPartAgence(): number {
    return this.partenaire() ? this.commissionTotale() / 2 : this.commissionTotale();
  }

  getPartPartenaire(): number {
    return this.partenaire() ? this.commissionTotale() / 2 : 0;
  }

  montantReverse(): number {
    return (Number(this.form.prix_vente) || 0) - this.getPartAgence();
  }

  nomMandant(): string {
    const p = this.mandatVente?.proprietaire_tiers;
    return [p?.prenom, p?.nom].filter(Boolean).join(' ') || 'le propriétaire';
  }

  // ---------- Formulaire ----------

  emptyForm(): any {
    return {
      user_id: '',
      prix_vente: '',
      date_vente: new Date().toISOString().slice(0, 10), // aujourd'hui par défaut
      mode_paiement: 'especes',
      client_id: '',
      bien_id: ''
    };
  }

  // Rafraîchit l'écran tout de suite (choix en un clic, répartition 50/50)
  refresh(): void {
    this.cdr.detectChanges();
  }

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

  choose(field: 'mode_paiement', value: string): void {
    this.form[field] = value;
    this.cdr.detectChanges();
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

  // En choisissant un bien, on pré-remplit le prix et le type (modifiables ensuite)
  pickBien(bien: any): void {
    this.form.bien_id = bien.id;
    if (!this.form.prix_vente && bien.prix) {
      this.form.prix_vente = bien.prix;
    }
    this.chargerMandat(bien);
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

  saveVente(): void {
    if (this.saving) return;

    const prixVide = this.form.prix_vente === '' || this.form.prix_vente === null;
    if (!this.form.client_id || !this.form.bien_id || prixVide || !this.form.date_vente) {
      this.errorMsg = 'Veuillez choisir le client et le bien, et remplir le prix et la date.';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    this.api.post('ventes', this.form).subscribe({
      next: () => {
        this.saving = false;
        this.successMsg = 'Vente enregistrée avec succès.';
        this.showForm = false;
        this.resetForm();
        this.loadVentes();
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

  resetForm(): void {
    this.form = this.emptyForm();
    this.errorMsg = '';
    this.saving = false;
    this.cdr.detectChanges();
  }

  // ---------- Finaliser / annuler / supprimer ----------

  pendingText(): { title: string; text: string; action: string; icon: string } {
    switch (this.pending?.action) {
      case 'finalise':
        return { title: 'Finaliser cette vente ?', text: 'La vente sera marquée comme conclue.',
                 action: 'Finaliser', icon: 'bi-check2-circle' };
      case 'annule':
        return { title: 'Annuler cette vente ?', text: 'La vente sera marquée comme annulée.',
                 action: 'Annuler la vente', icon: 'bi-x-circle' };
      default:
        return { title: 'Supprimer cette vente ?', text: 'Cette suppression est définitive.',
                 action: 'Supprimer', icon: 'bi-trash3' };
    }
  }

  ask(action: Action, vente: any): void {
    this.pending = { action, vente };
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
    const { action, vente } = this.pending;
    this.working = true;
    this.pendingError = '';
    this.cdr.detectChanges();

    const request = action === 'delete'
      ? this.api.delete('ventes', vente.id)
      : this.api.put('ventes', vente.id, { statut: action });

    const messages: Record<Action, string> = {
      finalise: 'Vente finalisée.',
      annule: 'Vente annulée.',
      delete: 'Vente supprimée.'
    };

    request.subscribe({
      next: () => {
        this.working = false;
        this.pending = null;
        this.successMsg = messages[action];
        this.loadVentes();
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
      this.loadVentes();
    }
  }
}