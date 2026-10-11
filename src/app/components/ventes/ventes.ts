import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
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

  typesBien = [
    { value: 'propre', label: 'Bien propre (agence)', icon: 'bi-patch-check' },
    { value: 'confie_proprietaire', label: 'Confié par un propriétaire', icon: 'bi-person-vcard' },
    { value: 'confie_agent', label: 'Confié par un agent externe', icon: 'bi-people' }
  ];

  modesPaiement = [
    { value: 'especes', label: 'Espèces', icon: 'bi-cash' },
    { value: 'virement', label: 'Virement', icon: 'bi-bank' },
    { value: 'cheque', label: 'Chèque', icon: 'bi-pencil-square' },
    { value: 'mobile_money', label: 'Mobile Money', icon: 'bi-phone' }
  ];

  form: any = this.emptyForm();

  private searchTimer: any;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadVentes();
    this.loadClients();
    this.loadBiens();
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

  // ---------- Commission ----------

  getPartAgent(): number {
    if (this.form.type_bien === 'confie_agent') {
      return (Number(this.form.commission_agence) || 0) / 2;
    }
    return 0;
  }

  getPartAgence(): number {
    const commission = Number(this.form.commission_agence) || 0;
    return this.form.type_bien === 'confie_agent' ? commission / 2 : commission;
  }

  // ---------- Formulaire ----------

  emptyForm(): any {
    return {
      prix_vente: '',
      date_vente: new Date().toISOString().slice(0, 10), // aujourd'hui par défaut
      mode_paiement: 'especes',
      client_id: '',
      bien_id: '',
      type_bien: 'propre',
      commission_agence: 0,
      nom_agent_externe: ''
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

  choose(field: 'type_bien' | 'mode_paiement', value: string): void {
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
    this.form.type_bien = bien.type_propriete === 'propre' ? 'propre' : 'confie_proprietaire';
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