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
  { path: 'utilisateurs', component: UtilisateursComponent, canActivate: [authGuard, roleGuard], data: { module: 'utilisateurs' } },
  { path: '**', redirectTo: '/login' }
];