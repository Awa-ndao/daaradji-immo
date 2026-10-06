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

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'biens', component: BiensComponent, canActivate: [authGuard] },
  { path: 'clients', component: ClientsComponent, canActivate: [authGuard] },
  { path: 'ventes', component: VentesComponent, canActivate: [authGuard] },
  { path: 'locations', component: LocationsComponent, canActivate: [authGuard] },
  { path: 'constructions', component: ConstructionsComponent, canActivate: [authGuard] },
  { path: 'achats', component: AchatsComponent, canActivate: [authGuard] },
  { path: 'rendez-vous', component: RendezVousComponent, canActivate: [authGuard] },
  { path: 'contrats', component: ContratsComponent, canActivate: [authGuard] },
  { path: 'factures', component: FacturesComponent, canActivate: [authGuard] },
  { path: 'paiements', component: PaiementsComponent, canActivate: [authGuard] },
  { path: 'utilisateurs', component: UtilisateursComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '/login' }
];