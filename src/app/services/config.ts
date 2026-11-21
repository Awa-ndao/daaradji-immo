/**
 * Adresse de l'API (backend Laravel).
 * - sur l'ordinateur (localhost) : le serveur lancé avec « php artisan serve » ;
 * - en ligne : le backend est sur le même serveur que le site (VPS Contabo), à l'adresse /api.
 */
const EN_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const API_URL = EN_LOCAL
  ? 'http://localhost:8000/api'
  : '/api';