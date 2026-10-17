import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { SidebarComponent } from '../sidebar/sidebar';

@Component({
  selector: 'app-achats',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SidebarComponent],
  templateUrl: './achats.html',
  styleUrl: './achats.css'
})
export class AchatsComponent implements OnInit {
  achats: any[] = [];
  biens: any[] = [];
  total = 0;
  loaded = false;
  saving = false;
  showForm = false;
  successMsg = '';
  errorMsg = '';
  searchTerm = '';
  currentPage = 1;
  totalPages = 1;
  openPicker = false;
  editingId: number | null = null;
  biensLoading = false;
  biensError = '';

  achatToDelete: any = null;
  deleting = false;
  deleteError = '';

  // Documents proposés en un clic ; les autres se tapent dans « Autres documents »
  documentsCourants = ['Titre foncier', 'Acte de vente', 'Délibération', 'Plan cadastral', 'Permis de construire'];
  docsChoisis: string[] = [];
  autresDocs = '';

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
    this.loadAchats();
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
    this.loadAchats();
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
    this.api.put('achats', this.reattribution.id, { user_id: this.reattributionId }).subscribe({
      next: () => {
        this.agentBusy = false;
        this.reattribution = null;
        this.successMsg = 'Dossier attribué à ' + this.agentNomParId(this.reattributionId) + '.';
        this.loadAchats();
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

  initials(nom: string): string {
    const parts = (nom || '').trim().split(/\s+/).filter(Boolean);
    return parts.map(p => p.charAt(0)).join('').substring(0, 2).toUpperCase() || '?';
  }

  // "Titre foncier, Acte de vente" -> ["Titre foncier", "Acte de vente"]
  docsOf(documents: string): string[] {
    return (documents || '').split(',').map(d => d.trim()).filter(Boolean);
  }

  sameId(a: any, b: any): boolean {
    return a !== '' && a !== null && a !== undefined && String(a) === String(b);
  }

  bienLabel(): string {
    const b = this.biens.find(x => this.sameId(this.form.bien_id, x.id));
    return b ? `${b.reference} — ${b.localisation}` : '';
  }

  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    const n = this.total;
    const mot = n > 1 ? 'achats' : 'achat';
    return this.searchTerm
      ? `${n} ${mot} pour cette recherche`
      : `${n} ${mot} ${n > 1 ? 'enregistrés' : 'enregistré'}`;
  }

  // ---------- Recherche ----------

  onSearch(): void {
    // On attend que l'utilisateur ait fini de taper avant d'appeler l'API
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.currentPage = 1;
      this.loadAchats();
    }, 300);
  }

  // ---------- Chargement ----------

  loadAchats(): void {
    this.achats = [];
    this.loaded = false;
    this.cdr.detectChanges();

    const params: any = { page: this.currentPage };
    if (this.filterAgent) params.agent_id = this.filterAgent;
    if (this.searchTerm) params.q = this.searchTerm;

    this.api.get('achats', params).subscribe({
      next: (data: any) => {
        if (data && data.data) {
          this.achats = data.data;
          this.totalPages = data.last_page || 1;
          this.total = data.total ?? this.achats.length;
        } else if (Array.isArray(data)) {
          this.achats = data;
          this.totalPages = 1;
          this.total = data.length;
        } else {
          this.achats = [];
          this.totalPages = 1;
          this.total = 0;
        }
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.achats = [];
        this.totalPages = 1;
        this.total = 0;
        this.loaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  loadBiens(): void {
    this.biensLoading = true;
    this.biensError = '';
    this.cdr.detectChanges();

    this.api.get('biens', { per_page: 100 }).subscribe({
      next: (data: any) => {
        this.biens = data?.data || data || [];
        this.biensLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        // On affiche la raison dans la liste au lieu de la laisser vide
        this.biens = [];
        this.biensLoading = false;
        this.biensError = err?.status === 0
          ? 'Le serveur ne répond pas. Vérifiez que le backend est démarré.'
          : 'Impossible de charger les biens (erreur ' + (err?.status ?? 'inconnue') + ').';
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- Formulaire ----------

  emptyForm(): any {
    return {
      user_id: '',
      vendeur_nom: '',
      vendeur_telephone: '',
      prix_achat: '',
      date_achat: new Date().toISOString().slice(0, 10), // aujourd'hui par défaut
      bien_id: '',
      documents: ''
    };
  }

  openNew(): void {
    this.resetForm();
    this.loadBiens(); // pour voir un bien ajouté entre-temps
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm = false;
    this.openPicker = false;
    this.resetForm();
  }

  // Ouvre ou ferme la liste des biens ; si elle est vide, on (re)charge les biens
  openBienPicker(): void {
    this.openPicker = !this.openPicker;
    if (this.openPicker && this.biens.length === 0 && !this.biensLoading) {
      this.loadBiens();
    }
    this.cdr.detectChanges();
  }

  closeBienPicker(): void {
    this.openPicker = false;
    this.cdr.detectChanges();
  }

  pickBien(bien: any): void {
    this.form.bien_id = bien.id;
    this.openPicker = false;
    this.cdr.detectChanges();
  }

  toggleDoc(doc: string): void {
    this.docsChoisis = this.docsChoisis.includes(doc)
      ? this.docsChoisis.filter(d => d !== doc)
      : [...this.docsChoisis, doc];
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.achatToDelete) {
      this.cancelDelete();
    } else if (this.openPicker) {
      this.closeBienPicker();
    } else if (this.showForm) {
      this.closeForm();
    }
  }

  saveAchat(): void {
    if (this.saving) return;

    const prixVide = this.form.prix_achat === '' || this.form.prix_achat === null;
    if (!this.form.vendeur_nom || !this.form.bien_id || prixVide || !this.form.date_achat) {
      this.errorMsg = 'Veuillez remplir le nom du vendeur, le bien, le prix et la date.';
      this.cdr.detectChanges();
      return;
    }

    // Les documents cochés et les autres documents sont envoyés dans un seul champ, comme avant
    this.form.documents = [...this.docsChoisis, ...this.docsOf(this.autresDocs)].join(', ');

    this.saving = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    const modification = this.editingId !== null;
    const request = modification
      ? this.api.put('achats', this.editingId!, this.form)
      : this.api.post('achats', this.form);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.successMsg = modification ? 'Achat modifié avec succès.' : 'Achat enregistré avec succès.';
        this.showForm = false;
        this.resetForm();
        this.loadAchats();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.saving = false;
        this.errorMsg = err.error?.message
          || (modification ? 'Erreur lors de la modification' : 'Erreur lors de l\'enregistrement');
        this.cdr.detectChanges();
      }
    });
  }

  // Ouvre le formulaire rempli avec l'achat choisi
  editAchat(achat: any): void {
    this.resetForm();
    this.editingId = achat.id;
    this.form = {
      user_id: achat.user_id ?? achat.user?.id ?? '',
      vendeur_nom: achat.vendeur_nom || '',
      vendeur_telephone: achat.vendeur_telephone || '',
      prix_achat: achat.prix_achat,
      date_achat: (achat.date_achat || '').slice(0, 10),
      bien_id: achat.bien_id,
      documents: achat.documents || ''
    };
    // Les documents connus redeviennent des boutons cochés, les autres vont dans « Autres documents »
    const docs = this.docsOf(achat.documents);
    this.docsChoisis = docs.filter(d => this.documentsCourants.includes(d));
    this.autresDocs = docs.filter(d => !this.documentsCourants.includes(d)).join(', ');
    if (this.biens.length === 0) {
      this.loadBiens();
    }
    this.showForm = true;
    this.cdr.detectChanges();
  }

  resetForm(): void {
    this.form = this.emptyForm();
    this.editingId = null;
    this.docsChoisis = [];
    this.autresDocs = '';
    this.errorMsg = '';
    this.saving = false;
    this.cdr.detectChanges();
  }

  // ---------- Suppression ----------

  askDelete(achat: any): void {
    this.achatToDelete = achat;
    this.deleteError = '';
    this.cdr.detectChanges();
  }

  cancelDelete(): void {
    this.achatToDelete = null;
    this.deleteError = '';
    this.deleting = false;
    this.cdr.detectChanges();
  }

  confirmDelete(): void {
    if (!this.achatToDelete || this.deleting) return;
    this.deleting = true;
    this.deleteError = '';
    this.cdr.detectChanges();

    this.api.delete('achats', this.achatToDelete.id).subscribe({
      next: () => {
        this.deleting = false;
        this.achatToDelete = null;
        this.successMsg = 'Achat supprimé.';
        this.loadAchats();
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
      this.loadAchats();
    }
  }
}