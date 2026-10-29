import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from './config';

/**
 * Impression des factures, reçus, contrats et bulletins de salaire.
 * L'API renvoie une page mise en forme (en-tête DAARADJI IMMO) ; on l'ouvre dans un nouvel onglet
 * et on lance l'impression. Dans la fenêtre d'impression, choisir « Enregistrer au format PDF »
 * donne le fichier PDF.
 */
@Injectable({ providedIn: 'root' })
export class ImpressionService {
  private apiUrl = API_URL;

  constructor(private http: HttpClient) {}

  // type : 'facture' | 'recu' | 'contrat' | 'bulletin' (bulletin de salaire)
  imprimer(type: 'facture' | 'recu' | 'contrat' | 'bulletin', id: number, onErreur?: (msg: string) => void): void {
    // L'onglet est ouvert tout de suite (sinon le navigateur le bloque), puis rempli
    const fenetre = window.open('', '_blank');
    if (fenetre) {
      fenetre.document.write('<p style="font-family:sans-serif;padding:24px;color:#0B4D2A">Préparation du document…</p>');
    }
    this.http.get(`${this.apiUrl}/impression/${type}/${id}`, { responseType: 'text' }).subscribe({
      next: (html: string) => {
        if (!fenetre) {
          onErreur?.('Le navigateur a bloqué l’ouverture du document. Autorisez les fenêtres pour ce site.');
          return;
        }
        fenetre.document.open();
        fenetre.document.write(html);
        fenetre.document.close();
        let lance = false;
        const lancer = () => {
          if (lance) return;
          lance = true;
          fenetre.focus();
          fenetre.print();
        };
        fenetre.onload = lancer;
        // certains navigateurs ne déclenchent pas onload après document.write
        setTimeout(lancer, 700);
      },
      error: (err: any) => {
        fenetre?.close();
        let msg = 'Impossible de préparer le document.';
        try { msg = JSON.parse(err?.error || '{}')?.message || msg; } catch { /* texte brut */ }
        if (err?.status === 403) msg = 'Vous n’avez pas accès à ce document.';
        onErreur?.(msg);
      }
    });
  }
}
