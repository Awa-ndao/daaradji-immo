import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth';

// Bloque une page si le rôle n'y a pas accès (même en tapant l'adresse à la main)
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const module = route.data?.['module'] as string;

  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }
  if (!module || auth.peutAcceder(module)) return true;

  router.navigate(['/dashboard']);
  return false;
};
