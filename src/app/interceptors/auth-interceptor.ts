import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  return next(req.clone({ setHeaders: headers })).pipe(
    catchError((err: HttpErrorResponse) => {
      // 401 = le serveur ne reconnaît plus le jeton (expiré ou supprimé).
      // On efface la session et on renvoie à la page de connexion.
      // La page de connexion gère elle-même son erreur de mot de passe.
      const isLogin = req.url.endsWith('/login');
      if (err.status === 401 && !isLogin) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};