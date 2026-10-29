import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { SidebarComponent } from '../sidebar/sidebar';
import { ROLE_LIBELLES } from '../../services/acces';

/**
 * Journal d'activité (direction) : qui a fait quoi, quand, sur quel élément,
 * avec l'ancienne et la nouvelle valeur. Rempli automatiquement par le serveur.
 */
@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SidebarComponent],
  templateUrl: './journal.html',
  styleUrls: ['../shared/module.css', './journal.css']
})
export class JournalComponent implements OnInit {
  logs: any[] = [];
  utilisateurs: any[] = [];
  total = 0;
  loaded = false;
  currentPage = 1;
  totalPages = 1;
  filterAction = '';
  filterTable = '';
  filterUser: any = '';
  du = '';
  au = '';
  ouvert: number | null = null;
  pickUser = false;
  pickTable = false;

  actions = [
    { value: '', label: 'Toutes' },
    { value: 'création', label: 'Créations' },
    { value: 'modification', label: 'Modifications' },
    { value: 'suppression', label: 'Suppressions' },
    { value: 'restauration', label: 'Restaurations' },
    { value: 'connexion', label: 'Connexions' },
    { value: 'impression', label: 'Impressions' }
  ];

  tables: Record<string, string> = {
    biens: 'Bien', clients: 'Client', proprietaires_tiers: 'Propriétaire tiers', mandats: 'Mandat',
    achats: 'Achat', ventes: 'Vente', locations: 'Location', constructions: 'Construction',
    etapes_construction: 'Étape de construction', contrats: 'Contrat', factures: 'Facture', paiements: 'Paiement',
    commissions: 'Commission', demarches_administratives: 'Démarche', rendez_vous: 'Rendez-vous', users: 'Compte utilisateur'
  };

  // Noms lisibles des champs affichés dans le détail
  champs: Record<string, string> = {
    statut: 'Statut', prix: 'Prix', prix_vente: 'Prix de vente', loyer_mensuel: 'Loyer mensuel', caution: 'Caution',
    montant: 'Montant', montant_total: 'Montant total', montant_versement: 'Montant versé', user_id: 'Agent responsable',
    client_id: 'Client', bien_id: 'Bien', date_debut: 'Date de début', date_fin: 'Date de fin', role: 'Rôle',
    name: 'Nom', nom: 'Nom', prenom: 'Prénom', email: 'E-mail', telephone: 'Téléphone', password: 'Mot de passe',
    reference: 'Référence', localisation: 'Localisation', type: 'Type', taux_commission: 'Taux de commission',
    date_paiement: 'Date de paiement', mode_paiement: 'Mode de paiement', numero: 'Numéro', motif: 'Motif'
  };

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
    this.api.get('utilisateurs', { per_page: 100 }).subscribe({
      next: (d: any) => { this.utilisateurs = d?.data || (Array.isArray(d) ? d : []); this.cdr.detectChanges(); }
    });
  }

  tableKeys(): string[] { return Object.keys(this.tables); }
  roleLabel(r: string): string { return ROLE_LIBELLES[r] || r || ''; }
  initiales(n: string): string {
    const p = (n || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase() || '?';
  }

  valeurs(l: any): { avant: any; apres: any } {
    const parse = (s: string) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
    return { avant: parse(l.ancienne_valeur), apres: parse(l.nouvelle_valeur) };
  }

  element(l: any): string {
    const v = this.valeurs(l);
    const id = v.apres?.id ?? v.avant?.id;
    const nom = this.tables[l.table_name] || l.table_name;
    const extra = v.apres?.numero || v.avant?.numero || v.apres?.reference || v.avant?.reference || '';
    return nom + (extra ? ' ' + extra : (id ? ' n° ' + id : ''));
  }

  // Lignes « champ : avant → après » pour le détail
  details(l: any): { champ: string; avant: string; apres: string }[] {
    const { avant, apres } = this.valeurs(l);
    const cles = Array.from(new Set([...Object.keys(avant || {}), ...Object.keys(apres || {})])).filter(k => k !== 'id');
    const txt = (x: any) => (x === null || x === undefined || x === '') ? '—' : String(x);
    return cles.map(k => ({ champ: this.champs[k] || k.replace(/_/g, ' '), avant: txt(avant?.[k]), apres: txt(apres?.[k]) }));
  }

  actionClasse(a: string): string {
    return ({ 'création': 'tag--vert', modification: 'tag--or', suppression: 'tag--rouge', restauration: 'tag--vert',
              suspension: 'tag--rouge', 'blocage temporaire': 'tag--rouge' } as any)[a] || 'tag--gris';
  }

  userLabel(): string {
    if (!this.filterUser) return 'Tous les utilisateurs';
    return this.utilisateurs.find(u => String(u.id) === String(this.filterUser))?.name || 'Utilisateur';
  }

  subtitle(): string {
    if (!this.loaded) return 'Chargement…';
    return `${this.total} action${this.total > 1 ? 's' : ''} enregistrée${this.total > 1 ? 's' : ''}`;
  }

  load(): void {
    this.loaded = false;
    this.cdr.detectChanges();
    const params: any = { page: this.currentPage };
    if (this.filterAction) params.action = this.filterAction;
    if (this.filterTable) params.table = this.filterTable;
    if (this.filterUser) params.user_id = this.filterUser;
    if (this.du) params.du = this.du;
    if (this.au) params.au = this.au;
    this.api.get('logs', params).subscribe({
      next: (d: any) => {
        this.logs = d?.data || [];
        this.total = d?.total ?? this.logs.length;
        this.totalPages = d?.last_page || 1;
        this.loaded = true;
        this.cdr.detectChanges();
      },
      error: () => { this.logs = []; this.loaded = true; this.cdr.detectChanges(); }
    });
  }

  filtrer(): void { this.currentPage = 1; this.ouvert = null; this.load(); }
  setAction(v: string): void { this.filterAction = v; this.filtrer(); }
  setUser(v: any): void { this.filterUser = v; this.pickUser = false; this.filtrer(); }
  setTable(v: string): void { this.filterTable = v; this.pickTable = false; this.filtrer(); }
  basculer(id: number): void { this.ouvert = this.ouvert === id ? null : id; this.cdr.detectChanges(); }
  changePage(p: number): void { if (p >= 1 && p <= this.totalPages) { this.currentPage = p; this.ouvert = null; this.load(); } }
}
