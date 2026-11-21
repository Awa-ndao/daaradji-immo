import { timeout } from 'rxjs';
import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { SidebarComponent } from '../sidebar/sidebar';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './clients.html',
  styleUrl: './clients.css'
})
export class ClientsComponent implements OnInit {
  clients: any[] = [];
  total = 0;
  loaded = false;
  saving = false;
  showForm = false;
  successMsg = '';
  errorMsg = '';
  searchTerm = '';
  currentPage = 1;
  totalPages = 1;
  editingId: number | null = null;
  // Recherche de bien : filtre « clients qui recherchent » et fiche des biens qui correspondent
  filtreRecherche = false;
  fiche: any = null;
  ficheLoading = false;
  ficheError = '';
  operations = [
    { value: '', label: 'Aucune', icon: 'bi-dash-circle' },
    { value: 'achat', label: 'Achat', icon: 'bi-tag' },
    { value: 'location', label: 'Location', icon: 'bi-key' }
  ];
  typesBien = [
    { value: '', label: 'Peu importe' },
    { value: 'terrain', label: 'Terrain' },
    { value: 'maison', label: 'Maison' },
    { value: 'villa', label: 'Villa' },
    { value: 'appartement', label: 'Appartement' },
    { value: 'local_commercial', label: 'Local commercial' }
  ];
  clientToDelete: any = null;
  deleting = false;
  deleteError = '';

  // Pièces d'identité proposées dans le formulaire
  // 'short' est le libellé court affiché sur le bouton du formulaire
  pieces: { value: string; label: string; short?: string; icon: string }[] = [
    { value: 'CNI', label: 'CNI', icon: 'bi-person-vcard' },
    { value: 'Passeport', label: 'Passeport', icon: 'bi-globe2' },
    { value: 'Permis', label: 'Permis de conduire', short: 'Permis', icon: 'bi-car-front' }
  ];

  form: any = {
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    adresse: '',
    piece_identite: '',
    numero_piece: '',
    recherche_operation: '',
    recherche_type: '',
    recherche_quartier: '',
    recherche_budget_max: '',
    recherche_superficie_min: '',
    recherche_note: ''
  };

  private searchTimer: any;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadClients();
  }

  // ---------- Libellés ----------

  initials(client: any): string {
    return ((client.nom || '').charAt(0) + (client.prenom || '').charAt(0)).toUpperCase();
  }

  pieceLabel(value: string): string {
    return this.pieces.find(p => p.value === value)?.label || value;
  }

  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    const n = this.total;
    if (this.searchTerm) {
      return `${n} ${n > 1 ? 'clients' : 'client'} pour cette recherche`;
    }
    if (this.filtreRecherche) {
      return `${n} ${n > 1 ? 'clients recherchent' : 'client recherche'} un bien`;
    }
    return `${n} ${n > 1 ? 'clients enregistrés' : 'client enregistré'}`;
  }

  // ---------- Recherche ----------

  onSearch(): void {
    // On attend que l'utilisateur ait fini de taper avant d'appeler l'API
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.currentPage = 1;
      this.loadClients();
    }, 300);
  }

  // ---------- Chargement ----------

  loadClients(): void {
    this.clients = [];
    this.loaded = false;
    this.cdr.detectChanges();

    const params: any = { page: this.currentPage };
    if (this.searchTerm) params.q = this.searchTerm;
    if (this.filtreRecherche) params.recherche = 1;

    this.api.get('clients', params).subscribe({
      next: (data: any) => {
        if (data && data.data) {
          this.clients = data.data;
          this.totalPages = data.last_page || 1;
          this.total = data.total ?? this.clients.length;
        } else if (Array.isArray(data)) {
          this.clients = data;
          this.totalPages = 1;
          this.total = data.length;
        } else {
          this.clients = [];
          this.totalPages = 1;
          this.total = 0;
        }
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.clients = [];
        this.totalPages = 1;
        this.total = 0;
        this.loaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- Formulaire ----------

  openNew(): void {
    this.resetForm();
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm = false;
    this.resetForm();
  }

  // Choix de la pièce en un clic ; un second clic sur la même pièce l'enlève.
  // detectChanges() rafraîchit l'écran tout de suite après le clic.
  choosePiece(value: string): void {
    this.form.piece_identite = this.form.piece_identite === value ? '' : value;
    this.cdr.detectChanges();
  }

  // ---------- Recherche de bien ----------

  choisirRecherche(field: string, value: string): void {
    this.form[field] = value;
    this.cdr.detectChanges();
  }

  basculerFiltre(): void {
    this.filtreRecherche = !this.filtreRecherche;
    this.currentPage = 1;
    this.loadClients();
  }

  nombre(v: any): string {
    return String(Math.round(Number(v) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  typeLabel(v: string): string {
    return this.typesBien.find(t => t.value === v)?.label || v;
  }

  rechercheTitre(c: any): string {
    const op = c.recherche_operation === 'location' ? 'Location' : 'Achat';
    return op + (c.recherche_type ? ' · ' + this.typeLabel(c.recherche_type).toLowerCase() : '');
  }

  rechercheDetail(c: any): string {
    const parts = [c.recherche_quartier || 'Tout quartier'];
    if (c.recherche_budget_max) parts.push(this.nombre(c.recherche_budget_max) + ' FCFA max.');
    if (c.recherche_superficie_min) parts.push(this.nombre(c.recherche_superficie_min) + ' m² min.');
    return parts.join(' · ');
  }

  ouvrirFiche(c: any): void {
    this.fiche = { ...c, biens_correspondants: [] };
    this.ficheLoading = true;
    this.ficheError = '';
    this.cdr.detectChanges();
    this.api.get('clients/' + c.id).subscribe({
      next: (r: any) => { this.fiche = r; this.ficheLoading = false; this.cdr.detectChanges(); },
      error: () => { this.ficheLoading = false; this.ficheError = 'Impossible de charger la recherche du client.'; this.cdr.detectChanges(); }
    });
  }

  fermerFiche(): void {
    this.fiche = null;
    this.ficheError = '';
    this.cdr.detectChanges();
  }

  // Le client a trouvé son bien (ou ne cherche plus) : sa recherche est effacée
  terminerRecherche(): void {
    if (!this.fiche || this.saving) return;
    this.saving = true;
    this.api.delete('clients/' + this.fiche.id, 'recherche' as any).subscribe({
      next: (r: any) => {
        this.saving = false;
        this.fiche = null;
        this.successMsg = r?.message || 'Recherche terminée.';
        this.loadClients();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err) => {
        this.saving = false;
        this.ficheError = err?.error?.message || 'Action impossible.';
        this.cdr.detectChanges();
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.fiche) {
      this.fermerFiche();
    } else if (this.clientToDelete) {
      this.cancelDelete();
    } else if (this.showForm) {
      this.closeForm();
    }
  }

  saveClient(): void {
    if (this.saving) return;

    if (!this.form.nom || !this.form.prenom || !this.form.telephone) {
      this.errorMsg = 'Veuillez remplir le nom, le prénom et le téléphone.';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    const modif = !!this.editingId;
    const requete = modif ? this.api.put('clients', this.editingId!, this.form) : this.api.post('clients', this.form);

    // 30 secondes maximum : le bouton ne doit jamais rester bloqué sur « Enregistrement… »
    requete.pipe(timeout(30000)).subscribe({
      next: (r: any) => {
        let message = modif ? 'Client modifié avec succès.' : 'Client ajouté avec succès.';
        try {
          message += this.messageBiens(r);
        } catch (e) {
          console.error('Message de recherche', e);
        }
        this.saving = false;
        this.showForm = false;
        this.successMsg = message;
        this.resetForm();
        this.loadClients();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err: any) => {
        console.error('Enregistrement du client', err);
        this.saving = false;
        const e = err?.error;
        if (err?.name === 'TimeoutError') {
          this.errorMsg = 'Le serveur ne répond pas. Vérifiez que le backend et MySQL sont démarrés, puis réessayez.';
        } else if (e?.errors) {
          this.errorMsg = (Object.values(e.errors)[0] as string[])[0];
        } else {
          this.errorMsg = e?.message || (modif ? 'Erreur lors de la modification' : 'Erreur lors de l\'ajout');
        }
        this.cdr.detectChanges();
      }
    });
  }

  editClient(client: any): void {
    this.errorMsg = '';
    this.editingId = client.id;
    this.form = {
      nom: client.nom,
      prenom: client.prenom,
      telephone: client.telephone,
      email: client.email || '',
      adresse: client.adresse || '',
      piece_identite: client.piece_identite || '',
      numero_piece: client.numero_piece || '',
      recherche_operation: client.recherche_operation || '',
      recherche_type: client.recherche_type || '',
      recherche_quartier: client.recherche_quartier || '',
      recherche_budget_max: client.recherche_budget_max ?? '',
      recherche_superficie_min: client.recherche_superficie_min ?? '',
      recherche_note: client.recherche_note || ''
    };
    this.showForm = true;
    this.cdr.detectChanges();
  }

  // ---------- Suppression ----------

  // On ouvre d'abord la fenêtre de confirmation
  askDelete(client: any): void {
    this.clientToDelete = client;
    this.deleteError = '';
    this.cdr.detectChanges();
  }

  cancelDelete(): void {
    this.clientToDelete = null;
    this.deleteError = '';
    this.deleting = false;
    this.cdr.detectChanges();
  }

  confirmDelete(): void {
    if (!this.clientToDelete || this.deleting) return;
    this.deleting = true;
    this.deleteError = '';
    this.cdr.detectChanges();

    this.api.delete('clients', this.clientToDelete.id).subscribe({
      next: () => {
        this.deleting = false;
        this.clientToDelete = null;
        this.successMsg = 'Client supprimé.';
        this.loadClients();
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

  resetForm(): void {
    this.form = {
      nom: '',
      prenom: '',
      telephone: '',
      email: '',
      adresse: '',
      piece_identite: '',
      numero_piece: '',
      recherche_operation: '',
      recherche_type: '',
      recherche_quartier: '',
      recherche_budget_max: '',
      recherche_superficie_min: '',
      recherche_note: ''
    };
    this.editingId = null;
    this.errorMsg = '';
    this.saving = false;
    this.cdr.detectChanges();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadClients();
    }
  }

  private messageBiens(r: any): string {
    const n = Number(r?.nb_biens) || 0;
    if (!r?.recherche_depuis) return '';
    return n ? ` ${n} bien${n > 1 ? 's' : ''} disponible${n > 1 ? 's' : ''} correspond${n > 1 ? 'ent' : ''} déjà à sa recherche.`
      : ' Il sera signalé dès qu’un bien correspondant sera ajouté.';
  }
}
