import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { ImpressionService } from '../../services/impression';
import { SidebarComponent } from '../sidebar/sidebar';

/**
 * Salaires des employés (comptable et direction).
 * Chaque mois : « Préparer les salaires » crée une ligne par employé actif à partir de son salaire de base,
 * la comptable ajuste la prime ou la retenue, enregistre le versement et imprime le bulletin.
 */
@Component({
  selector: 'app-salaires',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, SidebarComponent],
  templateUrl: './salaires.html',
  styleUrls: ['../shared/module.css', './salaires.css']
})
export class SalairesComponent implements OnInit {
  mois = this.moisCourant();
  lignes: any[] = [];
  totaux: any = { masse: 0, paye: 0, reste: 0, nb: 0, nb_payes: 0 };
  aAjouter = 0;
  loaded = false;
  filterStatut = '';
  searchTerm = '';
  successMsg = '';
  errorMsg = '';
  preparing = false;

  // Ajustement (prime, retenue) avant paiement
  enEdition: any = null;
  form: any = { salaire_base: 0, prime: 0, retenue: 0, note: '' };
  // Enregistrement du versement
  aPayer: any = null;
  paiement: any = { date_paiement: '', mode_paiement: 'virement', reference: '' };
  // Suppression d'une ligne en attente
  aSupprimer: any = null;
  saving = false;
  dialogError = '';

  statutTabs = [
    { value: '', label: 'Tous' },
    { value: 'en_attente', label: 'À payer' },
    { value: 'paye', label: 'Payés' }
  ];
  modes = [
    { value: 'virement', label: 'Virement', icon: 'bi-bank' },
    { value: 'wave', label: 'Wave', icon: 'bi-phone' },
    { value: 'orange_money', label: 'Orange Money', icon: 'bi-phone' },
    { value: 'especes', label: 'Espèces', icon: 'bi-cash' },
    { value: 'cheque', label: 'Chèque', icon: 'bi-pencil-square' }
  ];
  roles: Record<string, string> = {
    administrateur: 'Administrateur', agent: 'Agent immobilier', comptable: 'Comptable', receptionniste: 'Réceptionniste'
  };

  private searchTimer: any;

  constructor(private api: ApiService, private impression: ImpressionService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  // ---------- Mois ----------
  private moisCourant(): string {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  moisLabel(m: string = this.mois): string {
    const [a, n] = m.split('-').map(Number);
    const t = new Date(a, n - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  changerMois(delta: number): void {
    const [a, n] = this.mois.split('-').map(Number);
    const d = new Date(a, n - 1 + delta, 1);
    this.mois = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    this.load();
  }
  estMoisCourant(): boolean { return this.mois === this.moisCourant(); }
  revenirMoisCourant(): void { this.mois = this.moisCourant(); this.load(); }

  // ---------- Affichage ----------
  nombre(v: any): string {
    const n = Math.round(Number(v) || 0);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  initiales(nom: string): string {
    return (nom || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
  }
  modeLabel(v: string): string { return this.modes.find(m => m.value === v)?.label || v; }
  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    const n = this.totaux.nb;
    return n === 0 ? 'Aucun salaire préparé pour ce mois'
      : `${n} salaire${n > 1 ? 's' : ''} · ${this.totaux.nb_payes} payé${this.totaux.nb_payes > 1 ? 's' : ''}`;
  }

  // ---------- Chargement ----------
  load(): void {
    this.loaded = false;
    this.cdr.detectChanges();
    const params: any = { mois: this.mois };
    if (this.filterStatut) params.statut = this.filterStatut;
    if (this.searchTerm) params.q = this.searchTerm;
    this.api.get('salaires', params).subscribe({
      next: (d: any) => {
        this.lignes = d?.data || [];
        this.totaux = d?.totaux || this.totaux;
        this.aAjouter = d?.employes_a_ajouter || 0;
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.lignes = [];
        this.loaded = true;
        this.errorMsg = err?.error?.message || 'Impossible de charger les salaires.';
        this.cdr.detectChanges();
      }
    });
  }
  setStatut(v: string): void { this.filterStatut = v; this.load(); }
  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  private succes(msg: string): void {
    this.successMsg = msg;
    this.errorMsg = '';
    this.load();
    setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 4000);
  }

  // ---------- Préparer le mois ----------
  preparer(): void {
    if (this.preparing) return;
    this.preparing = true;
    this.errorMsg = '';
    this.cdr.detectChanges();
    this.api.post('salaires/preparer', { mois: this.mois }).subscribe({
      next: (r: any) => { this.preparing = false; this.succes(r?.message || 'Salaires préparés.'); },
      error: (err: any) => {
        this.preparing = false;
        this.errorMsg = err?.error?.message || 'Préparation impossible.';
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- Ajuster une ligne ----------
  ouvrirEdition(l: any): void {
    this.enEdition = l;
    this.form = { salaire_base: l.salaire_base, prime: l.prime || 0, retenue: l.retenue || 0, note: l.note || '' };
    this.dialogError = '';
    this.cdr.detectChanges();
  }
  netPrevu(): number {
    return (Number(this.form.salaire_base) || 0) + (Number(this.form.prime) || 0) - (Number(this.form.retenue) || 0);
  }
  enregistrerEdition(): void {
    if (this.saving || !this.enEdition) return;
    if (this.netPrevu() < 0) {
      this.dialogError = 'La retenue ne peut pas dépasser le salaire de base et la prime.';
      this.cdr.detectChanges();
      return;
    }
    this.saving = true;
    this.dialogError = '';
    this.api.put('salaires', this.enEdition.id, this.form).subscribe({
      next: () => { this.saving = false; this.enEdition = null; this.succes('Salaire mis à jour.'); },
      error: (err: any) => {
        this.saving = false;
        this.dialogError = err?.error?.message || 'Modification impossible.';
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- Payer ----------
  ouvrirPaiement(l: any): void {
    this.aPayer = l;
    this.paiement = { date_paiement: new Date().toISOString().slice(0, 10), mode_paiement: 'virement', reference: '' };
    this.dialogError = '';
    this.cdr.detectChanges();
  }
  choisirMode(v: string): void { this.paiement.mode_paiement = v; this.cdr.detectChanges(); }
  confirmerPaiement(): void {
    if (this.saving || !this.aPayer) return;
    if (!this.paiement.date_paiement) {
      this.dialogError = 'Indiquez la date du versement.';
      this.cdr.detectChanges();
      return;
    }
    this.saving = true;
    this.dialogError = '';
    this.api.post(`salaires/${this.aPayer.id}/payer`, this.paiement).subscribe({
      next: () => {
        const nom = this.aPayer.user?.name || '';
        this.saving = false;
        this.aPayer = null;
        this.succes(`Salaire de ${nom} payé. Vous pouvez imprimer son bulletin.`);
      },
      error: (err: any) => {
        this.saving = false;
        this.dialogError = err?.error?.message || 'Paiement impossible.';
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- Bulletin ----------
  imprimer(l: any): void {
    this.impression.imprimer('bulletin', l.id, (msg) => { this.errorMsg = msg; this.cdr.detectChanges(); });
  }

  // ---------- Supprimer ----------
  demanderSuppression(l: any): void { this.aSupprimer = l; this.dialogError = ''; this.cdr.detectChanges(); }
  confirmerSuppression(): void {
    if (this.saving || !this.aSupprimer) return;
    this.saving = true;
    this.api.delete('salaires', this.aSupprimer.id).subscribe({
      next: () => { this.saving = false; this.aSupprimer = null; this.succes('Salaire supprimé (récupérable dans la corbeille).'); },
      error: (err: any) => {
        this.saving = false;
        this.dialogError = err?.error?.message || 'Suppression impossible.';
        this.cdr.detectChanges();
      }
    });
  }

  fermer(): void {
    this.enEdition = null;
    this.aPayer = null;
    this.aSupprimer = null;
    this.dialogError = '';
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.fermer(); }
}
