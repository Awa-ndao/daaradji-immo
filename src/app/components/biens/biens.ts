import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { SidebarComponent } from '../sidebar/sidebar';

@Component({
  selector: 'app-biens',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './biens.html',
  styleUrl: './biens.css'
})
export class BiensComponent implements OnInit {
  biens: any[] = [];
  total = 0;
  loaded = false;
  saving = false;
  showForm = false;
  successMsg = '';
  errorMsg = '';
  searchTerm = '';
  filterStatut = '';
  filterType = '';
  typeMenuOpen = false;
  currentPage = 1;
  totalPages = 1;
  editingId: number | null = null;
  bienToDelete: any = null;
  deleting = false;
  deleteError = '';

  // Listes utilisées par les filtres, le tableau et le formulaire
  types = [
    { value: 'terrain', label: 'Terrain', icon: 'bi-map' },
    { value: 'maison', label: 'Maison', icon: 'bi-house-door' },
    { value: 'villa', label: 'Villa', icon: 'bi-house-heart' },
    { value: 'appartement', label: 'Appartement', icon: 'bi-building' },
    { value: 'local_commercial', label: 'Local commercial', icon: 'bi-shop' }
  ];

  statuts = [
    { value: 'disponible', label: 'Disponible' },
    { value: 'loue', label: 'Loué' },
    { value: 'vendu', label: 'Vendu' },
    { value: 'en_construction', label: 'En construction' }
  ];

  statutTabs = [{ value: '', label: 'Tous' }, ...this.statuts];

  form: any = {
    reference: '',
    type: '',
    localisation: '',
    superficie: '',
    prix: '',
    type_propriete: 'propre',
    statut: 'disponible',
    description: ''
  };

  private searchTimer: any;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadBiens();
  }

  // ---------- Libellés ----------

  typeLabel(value: string): string {
    return this.types.find(t => t.value === value)?.label || value;
  }

  typeIcon(value: string): string {
    return this.types.find(t => t.value === value)?.icon || 'bi-house';
  }

  statutLabel(value: string): string {
    return this.statuts.find(s => s.value === value)?.label || value;
  }

  // Nombre à la française : 1 500 000
  nombre(value: any): string {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || isNaN(n)) return '';
    const [entier, decimales] = String(Math.round(n * 100) / 100).split('.');
    const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
    return decimales ? groupes + ',' + decimales : groupes;
  }

  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    const n = this.total;
    const mot = n > 1 ? 'biens' : 'bien';
    const filtre = this.searchTerm || this.filterStatut || this.filterType;
    return filtre
      ? `${n} ${mot} pour ces critères`
      : `${n} ${mot} ${n > 1 ? 'gérés' : 'géré'} par l'agence`;
  }

  // ---------- Filtres ----------

  onSearch(): void {
    // On attend que l'utilisateur ait fini de taper avant d'appeler l'API
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.currentPage = 1;
      this.loadBiens();
    }, 300);
  }

  toggleTypeMenu(open: boolean = !this.typeMenuOpen): void {
    this.typeMenuOpen = open;
    this.cdr.detectChanges();
  }

  setStatut(value: string): void {
    this.filterStatut = value;
    this.currentPage = 1;
    this.loadBiens();
  }

  setType(value: string): void {
    this.filterType = value;
    this.typeMenuOpen = false;
    this.currentPage = 1;
    this.loadBiens();
  }

  // ---------- Chargement ----------

  loadBiens(): void {
    this.biens = [];
    this.loaded = false;
    this.cdr.detectChanges();

    const params: any = { page: this.currentPage };
    if (this.searchTerm) params.q = this.searchTerm;
    if (this.filterStatut) params.statut = this.filterStatut;
    if (this.filterType) params.type = this.filterType;

    this.api.get('biens', params).subscribe({
      next: (data: any) => {
        if (data && data.data) {
          this.biens = data.data;
          this.totalPages = data.last_page || 1;
          this.total = data.total ?? this.biens.length;
        } else if (Array.isArray(data)) {
          this.biens = data;
          this.totalPages = 1;
          this.total = data.length;
        } else {
          this.biens = [];
          this.totalPages = 1;
          this.total = 0;
        }
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.biens = [];
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

  // Choix en un clic dans le formulaire (type, propriété, statut).
  // detectChanges() rafraîchit l'écran tout de suite après le clic.
  choose(field: 'type' | 'type_propriete' | 'statut', value: string): void {
    this.form[field] = value;
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm = false;
    this.resetForm();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.bienToDelete) {
      this.cancelDelete();
    } else if (this.typeMenuOpen) {
      this.toggleTypeMenu(false);
    } else if (this.showForm) {
      this.closeForm();
    }
  }

  saveBien(): void {
    if (this.saving) return;

    const prixVide = this.form.prix === '' || this.form.prix === null || this.form.prix === undefined;
    if (!this.form.reference || !this.form.type || !this.form.localisation || prixVide) {
      this.errorMsg = 'Veuillez remplir la référence, le type, la localisation et le prix.';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    if (this.editingId) {
      this.api.put('biens', this.editingId, this.form).subscribe({
        next: () => {
          this.saving = false;
          this.successMsg = 'Bien modifié avec succès.';
          this.showForm = false;
          this.editingId = null;
          this.resetForm();
          this.loadBiens();
          setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
        },
        error: (err) => {
          this.saving = false;
          this.errorMsg = err.error?.message || 'Erreur lors de la modification';
          this.cdr.detectChanges();
        }
      });
    } else {
      this.api.post('biens', this.form).subscribe({
        next: () => {
          this.saving = false;
          this.successMsg = 'Bien ajouté avec succès.';
          this.showForm = false;
          this.resetForm();
          this.loadBiens();
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

  editBien(bien: any): void {
    this.errorMsg = '';
    this.editingId = bien.id;
    this.form = {
      reference: bien.reference,
      type: bien.type,
      localisation: bien.localisation,
      superficie: bien.superficie,
      prix: bien.prix,
      type_propriete: bien.type_propriete,
      statut: bien.statut,
      description: bien.description || ''
    };
    this.showForm = true;
    this.cdr.detectChanges();
  }

  // Suppression : on ouvre d'abord la fenêtre de confirmation
  askDelete(bien: any): void {
    this.bienToDelete = bien;
    this.deleteError = '';
    this.cdr.detectChanges();
  }

  cancelDelete(): void {
    this.bienToDelete = null;
    this.deleteError = '';
    this.deleting = false;
    this.cdr.detectChanges();
  }

  confirmDelete(): void {
    if (!this.bienToDelete || this.deleting) return;
    this.deleting = true;
    this.deleteError = '';
    this.cdr.detectChanges();

    this.api.delete('biens', this.bienToDelete.id).subscribe({
      next: () => {
        this.deleting = false;
        this.bienToDelete = null;
        this.successMsg = 'Bien supprimé.';
        this.loadBiens();
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
      reference: '',
      type: '',
      localisation: '',
      superficie: '',
      prix: '',
      type_propriete: 'propre',
      statut: 'disponible',
      description: ''
    };
    this.editingId = null;
    this.errorMsg = '';
    this.saving = false;
    this.cdr.detectChanges();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadBiens();
    }
  }
}