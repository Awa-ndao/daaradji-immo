import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { DashboardComponent } from './components/dashboard/dashboard';
import { BiensComponent } from './components/biens/biens';
import { ClientsComponent } from './components/clients/clients';
import { VentesComponent } from './components/ventes/ventes';
import { LocationsComponent } from './components/locations/locations';
import { ConstructionsComponent } from './components/constructions/constructions';
import { AchatsComponent } from './components/achats/achats';
import { RendezVousComponent } from './components/rendez-vous/rendez-vous';
import { ContratsComponent } from './components/contrats/contrats';
import { FacturesComponent } from './components/factures/factures';
import { PaiementsComponent } from './components/paiements/paiements';
import { UtilisateursComponent } from './components/utilisateurs/utilisateurs';
import { ProprietairesComponent } from './components/proprietaires/proprietaires';
import { MandatsComponent } from './components/mandats/mandats';
import { CommissionsComponent } from './components/commissions/commissions';
import { SalairesComponent } from './components/salaires/salaires';
import { DemarchesComponent } from './components/demarches/demarches';
import { JournalComponent } from './components/journal/journal';
import { CorbeilleComponent } from './components/corbeille/corbeille';
import { authGuard } from './guards/auth-guard';
import { roleGuard } from './guards/role-guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'biens', component: BiensComponent, canActivate: [authGuard, roleGuard], data: { module: 'biens' } },
  { path: 'clients', component: ClientsComponent, canActivate: [authGuard, roleGuard], data: { module: 'clients' } },
  { path: 'ventes', component: VentesComponent, canActivate: [authGuard, roleGuard], data: { module: 'ventes' } },
  { path: 'locations', component: LocationsComponent, canActivate: [authGuard, roleGuard], data: { module: 'locations' } },
  { path: 'constructions', component: ConstructionsComponent, canActivate: [authGuard, roleGuard], data: { module: 'constructions' } },
  { path: 'achats', component: AchatsComponent, canActivate: [authGuard, roleGuard], data: { module: 'achats' } },
  { path: 'rendez-vous', component: RendezVousComponent, canActivate: [authGuard, roleGuard], data: { module: 'rendez-vous' } },
  { path: 'contrats', component: ContratsComponent, canActivate: [authGuard, roleGuard], data: { module: 'contrats' } },
  { path: 'factures', component: FacturesComponent, canActivate: [authGuard, roleGuard], data: { module: 'factures' } },
  { path: 'paiements', component: PaiementsComponent, canActivate: [authGuard, roleGuard], data: { module: 'paiements' } },
  { path: 'proprietaires', component: ProprietairesComponent, canActivate: [authGuard, roleGuard], data: { module: 'proprietaires' } },
  { path: 'mandats', component: MandatsComponent, canActivate: [authGuard, roleGuard], data: { module: 'mandats' } },
  { path: 'demarches', component: DemarchesComponent, canActivate: [authGuard, roleGuard], data: { module: 'demarches' } },
  { path: 'commissions', component: CommissionsComponent, canActivate: [authGuard, roleGuard], data: { module: 'commissions' } },
  { path: 'salaires', component: SalairesComponent, canActivate: [authGuard, roleGuard], data: { module: 'salaires' } },
  { path: 'journal', component: JournalComponent, canActivate: [authGuard, roleGuard], data: { module: 'journal' } },
  { path: 'corbeille', component: CorbeilleComponent, canActivate: [authGuard, roleGuard], data: { module: 'corbeille' } },
  { path: 'utilisateurs', component: UtilisateursComponent, canActivate: [authGuard, roleGuard], data: { module: 'utilisateurs' } },
  { path: '**', redirectTo: '/login' }
];