import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ACCES, ROLE_LIBELLES } from './acces';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post(this.apiUrl + '/login', { email, password }).pipe(
      tap((response: any) => {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
      })
    );
  }

  logout(): void {
    this.http.post(this.apiUrl + '/logout', {}).subscribe();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }

  getToken(): string | null { return localStorage.getItem('token'); }
  getUser(): any {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
  isLoggedIn(): boolean { return !!this.getToken(); }

  // ---------- Rôle de la personne connectée ----------

  getRole(): string {
    return this.getUser()?.role || '';
  }

  roleLabel(): string {
    return ROLE_LIBELLES[this.getRole()] || '';
  }

  // Le module (biens, ventes, utilisateurs…) est-il ouvert à ce rôle ?
  peutAcceder(module: string): boolean {
    const roles = ACCES[module];
    return !!roles && roles.includes(this.getRole() as any);
  }

  // Propriétaire et administrateur : voient les dossiers de tous les agents
  estDirection(): boolean {
    return ['proprietaire', 'administrateur'].includes(this.getRole());
  }

  estAgent(): boolean {
    return this.getRole() === 'agent';
  }
}