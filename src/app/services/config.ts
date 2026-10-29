/**
 * Adresse de l'API (backend Laravel).
 * - sur l'ordinateur (localhost) : le serveur lancé avec « php artisan serve » ;
 * - en ligne : le backend déployé sur Render.
 */
const EN_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const API_URL = EN_LOCAL
  ? 'http://localhost:8000/api'
  : 'https://daaradji-immo-api.onrender.com/api';
