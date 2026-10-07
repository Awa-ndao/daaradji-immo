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
    numero_piece: ''
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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.clientToDelete) {
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

    if (this.editingId) {
      this.api.put('clients', this.editingId, this.form).subscribe({
        next: () => {
          this.saving = false;
          this.successMsg = 'Client modifié avec succès.';
          this.showForm = false;
          this.editingId = null;
          this.resetForm();
          this.loadClients();
          setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
        },
        error: (err) => {
          this.saving = false;
          this.errorMsg = err.error?.message || 'Erreur lors de la modification';
          this.cdr.detectChanges();
        }
      });
    } else {
      this.api.post('clients', this.form).subscribe({
        next: () => {
          this.saving = false;
          this.successMsg = 'Client ajouté avec succès.';
          this.showForm = false;
          this.resetForm();
          this.loadClients();
          setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
        },
        error: (err) => {
          this.saving = false;
          this.errorMsg = err.error?.message || 'Erreur lors de l\'ajout';
          this.cdr.detectChanges();
        }
      });
    }
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
      numero_piece: client.numero_piece || ''
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
      numero_piece: ''
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
}