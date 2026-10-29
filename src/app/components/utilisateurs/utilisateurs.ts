import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { AuthService } from '../../services/auth';
import { SidebarComponent } from '../sidebar/sidebar';

type Action = 'delete' | 'statut';

@Component({
  selector: 'app-utilisateurs',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SidebarComponent],
  templateUrl: './utilisateurs.html',
  styleUrl: './utilisateurs.css'
})
export class UtilisateursComponent implements OnInit {
  utilisateurs: any[] = [];
  total = 0;
  loaded = false;
  saving = false;
  showForm = false;
  showPassword = false;
  successMsg = '';
  errorMsg = '';
  searchTerm = '';
  filterRole = '';
  currentPage = 1;
  totalPages = 1;
  editingId: number | null = null;
  moi: any = null; // utilisateur connecté

  pending: { action: Action; user: any } | null = null;
  pendingError = '';
  working = false;

  roles = [
    { value: 'proprietaire', label: 'Propriétaire', pluriel: 'Propriétaires', icon: 'bi-award', aide: 'Accès complet à l’agence' },
    { value: 'administrateur', label: 'Administrateur', pluriel: 'Administrateurs', icon: 'bi-shield-lock', aide: 'Second du propriétaire : tout, et les comptes des employés' },
    { value: 'agent', label: 'Agent immobilier', pluriel: 'Agents', icon: 'bi-person-badge', aide: 'Ses propres dossiers : ventes, locations, chantiers…' },
    { value: 'comptable', label: 'Comptable', pluriel: 'Comptables', icon: 'bi-calculator', aide: 'Factures et paiements' },
    { value: 'receptionniste', label: 'Réceptionniste', pluriel: 'Réceptionnistes', icon: 'bi-telephone', aide: 'Clients et rendez-vous des agents' }
  ];
  roleTabs = [{ value: '', label: 'Tous' }, ...this.roles.map(r => ({ value: r.value, label: r.pluriel }))];

  form: any = this.emptyForm();

  private searchTimer: any;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.moi = this.auth.getUser();
    this.loadUtilisateurs();
  }

  // ---------- Libellés ----------

  roleLabel(value: string): string {
    return this.roles.find(r => r.value === value)?.label || value || '—';
  }

  roleIcon(value: string): string {
    return this.roles.find(r => r.value === value)?.icon || 'bi-person';
  }

  initials(name: string): string {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  }

  estMoi(u: any): boolean {
    return !!this.moi && String(this.moi.id) === String(u?.id);
  }

  // ---------- Ce que la personne connectée peut faire ----------
  // L'administrateur (second du propriétaire) gère les employés, pas les comptes de direction

  private readonly rolesEmployes = ['agent', 'comptable', 'receptionniste'];

  estAdmin(): boolean {
    return this.moi?.role === 'administrateur';
  }

  // Ouvrir le formulaire de ce compte
  peutModifier(u: any): boolean {
    if (!this.estAdmin()) return true;
    return this.estMoi(u) || this.rolesEmployes.includes(u?.role);
  }

  // Désactiver / réactiver / supprimer ce compte
  peutGerer(u: any): boolean {
    if (this.estMoi(u)) return false;
    return !this.estAdmin() || this.rolesEmployes.includes(u?.role);
  }

  // Rôles proposés dans le formulaire
  rolesProposes(): any[] {
    return this.estAdmin() ? this.roles.filter(r => this.rolesEmployes.includes(r.value)) : this.roles;
  }

  // L'administrateur qui modifie son propre compte ne change pas son rôle
  roleVerrouille(): boolean {
    return this.estAdmin() && this.editingId !== null && this.estMoi({ id: this.editingId });
  }

  estActif(u: any): boolean {
    return (u?.statut || 'actif') === 'actif';
  }

  // Message lisible quand le serveur renvoie une erreur technique
  messageErreur(err: any, defaut: string): string {
    if (err?.status === 0) return 'Le serveur ne répond pas. Vérifiez que le backend est démarré.';
    const erreurs = err?.error?.errors;
    if (erreurs) {
      const premier = Object.values(erreurs)[0] as any;
      if (Array.isArray(premier) && premier.length) return premier[0];
    }
    const brut: string = err?.error?.message || '';
    if (!brut) return defaut + ' (erreur ' + (err?.status ?? 'inconnue') + ').';
    if (/SQLSTATE|Exception|on null/i.test(brut)) {
      return defaut + '. Erreur côté serveur : « ' + brut.slice(0, 140) + (brut.length > 140 ? '…' : '') + ' »';
    }
    return brut;
  }

  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    const n = this.total;
    const mot = n > 1 ? 'comptes' : 'compte';
    return this.searchTerm || this.filterRole
      ? `${n} ${mot} pour ces critères`
      : `${n} ${mot} ${n > 1 ? 'utilisateurs' : 'utilisateur'}`;
  }

  // ---------- Filtres ----------

  onSearch(): void {
    // On attend que l'utilisateur ait fini de taper avant d'appeler l'API
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.currentPage = 1;
      this.loadUtilisateurs();
    }, 300);
  }

  setRole(value: string): void {
    this.filterRole = value;
    this.currentPage = 1;
    this.loadUtilisateurs();
  }

  // ---------- Chargement ----------

  loadUtilisateurs(): void {
    this.utilisateurs = [];
    this.loaded = false;
    this.cdr.detectChanges();

    const params: any = { page: this.currentPage };
    if (this.searchTerm) params.q = this.searchTerm;
    if (this.filterRole) params.role = this.filterRole;

    this.api.get('utilisateurs', params).subscribe({
      next: (data: any) => {
        if (data && data.data) {
          this.utilisateurs = data.data;
          this.totalPages = data.last_page || 1;
          this.total = data.total ?? this.utilisateurs.length;
        } else if (Array.isArray(data)) {
          this.utilisateurs = data;
          this.totalPages = 1;
          this.total = data.length;
        } else {
          this.utilisateurs = [];
          this.totalPages = 1;
          this.total = 0;
        }
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.utilisateurs = [];
        this.totalPages = 1;
        this.total = 0;
        this.loaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- Formulaire ----------

  emptyForm(): any {
    return { name: '', email: '', password: '', role: '', statut: 'actif', salaire_base: '' };
  }

  openNew(): void {
    this.resetForm();
    this.showForm = true;
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm = false;
    this.resetForm();
  }

  chooseRole(value: string): void {
    this.form.role = value;
    this.cdr.detectChanges();
  }

  chooseStatut(value: string): void {
    this.form.statut = value;
    this.cdr.detectChanges();
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pending) {
      this.cancelPending();
    } else if (this.showForm) {
      this.closeForm();
    }
  }

  saveUtilisateur(): void {
    if (this.saving) return;

    const modification = this.editingId !== null;
    const email = String(this.form.email || '').trim();
    if (!String(this.form.name || '').trim() || !email || !this.form.role) {
      this.errorMsg = 'Veuillez remplir le nom, l’e-mail et choisir un rôle.';
      this.cdr.detectChanges();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.errorMsg = 'L’adresse e-mail n’est pas valide.';
      this.cdr.detectChanges();
      return;
    }
    const mdp = String(this.form.password || '');
    if ((!modification || mdp) && mdp.length < 8) {
      this.errorMsg = 'Le mot de passe doit contenir au moins 8 caractères.';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    const donnees: any = { ...this.form, email };
    if (donnees.role === 'proprietaire' || donnees.salaire_base === '' || donnees.salaire_base === null) donnees.salaire_base = null;
    if (modification && !mdp) delete donnees.password; // mot de passe inchangé

    const request = modification
      ? this.api.put('utilisateurs', this.editingId!, donnees)
      : this.api.post('utilisateurs', donnees);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.successMsg = modification ? 'Compte modifié.' : 'Compte créé. La personne peut se connecter avec cet e-mail et ce mot de passe.';
        this.showForm = false;
        this.resetForm();
        this.loadUtilisateurs();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err) => {
        this.saving = false;
        this.errorMsg = this.messageErreur(err, modification ? 'Erreur lors de la modification' : 'Erreur lors de la création');
        this.cdr.detectChanges();
      }
    });
  }

  editUtilisateur(u: any): void {
    this.resetForm();
    this.editingId = u.id;
    this.form = { name: u.name || '', email: u.email || '', password: '', role: u.role || '', statut: u.statut || 'actif',
                  salaire_base: u.salaire_base ?? '' };
    this.showForm = true;
    this.cdr.detectChanges();
  }

  resetForm(): void {
    this.form = this.emptyForm();
    this.editingId = null;
    this.showPassword = false;
    this.errorMsg = '';
    this.saving = false;
    this.cdr.detectChanges();
  }

  // ---------- Activer / désactiver / supprimer ----------

  ask(action: Action, user: any): void {
    this.pending = { action, user };
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
    const { action, user } = this.pending;
    this.working = true;
    this.pendingError = '';
    this.cdr.detectChanges();

    const nouveauStatut = this.estActif(user) ? 'inactif' : 'actif';
    const request = action === 'delete'
      ? this.api.delete('utilisateurs', user.id)
      : this.api.put('utilisateurs', user.id, { statut: nouveauStatut });

    request.subscribe({
      next: () => {
        this.working = false;
        this.pending = null;
        this.successMsg = action === 'delete'
          ? 'Compte supprimé.'
          : (nouveauStatut === 'actif' ? 'Compte réactivé.' : 'Compte désactivé : la personne ne peut plus se connecter.');
        this.loadUtilisateurs();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3500);
      },
      error: (err) => {
        // La fenêtre reste ouverte et affiche la raison donnée par le serveur
        this.working = false;
        this.pendingError = this.messageErreur(err, 'Le serveur a refusé l’opération');
        this.cdr.detectChanges();
      }
    });
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadUtilisateurs();
    }
  }
}