import { Component, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  email = '';
  password = '';
  showPassword = false;
  loading = false;
  errorMessage = '';
  infoMessage = '';

  constructor(private authService: AuthService, private router: Router, private cdr: ChangeDetectorRef) {}

  // Pas d'envoi d'e-mail : c'est le propriétaire ou l'administrateur qui attribue un nouveau mot de passe
  motDePasseOublie(): void {
    this.errorMessage = '';
    this.infoMessage = 'Contactez le propriétaire ou l’administrateur de l’agence : il vous attribuera un nouveau mot de passe ';
    this.cdr.detectChanges();
  }

  onLogin(): void {
    this.infoMessage = '';
    if (!this.email || !this.password) {
      this.errorMessage = 'Veuillez remplir tous les champs.';
      this.cdr.detectChanges();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();
    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        // Messages du serveur : tentatives restantes, compte suspendu, blocage temporaire…
        this.errorMessage = err.status === 0
          ? 'Le serveur ne répond pas. Vérifiez que le backend est démarré.'
          : (err.error?.message || 'Email ou mot de passe incorrect.');
        this.cdr.detectChanges();
      }
    });
  }
}