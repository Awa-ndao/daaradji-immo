<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\PorteeAgent;
use App\Models\Contrat;
use App\Models\Facture;
use App\Models\Paiement;
use App\Models\Salaire;

/**
 * Documents imprimables (facture, reçu, contrat) à l'en-tête de l'agence.
 * L'API renvoie une page HTML mise en forme pour l'impression ;
 * l'application l'ouvre et lance l'impression (ou « Enregistrer au format PDF »).
 */
class ImpressionController extends Controller
{
    use PorteeAgent;

    private const MODES = [
        'especes' => 'Espèces', 'virement' => 'Virement bancaire', 'cheque' => 'Chèque',
        'wave' => 'Wave', 'orange_money' => 'Orange Money', 'mobile_money' => 'Mobile money',
    ];

    public function facture(int $id)
    {
        $facture = Facture::with(['location.client', 'location.bien', 'vente.client', 'vente.bien',
                                  'construction.client', 'construction.bien', 'etape', 'paiements'])->findOrFail($id);
        [$client, $bien] = $this->partiesFacture($facture);
        Facture::journaliserAction('impression', $facture);

        return response()->view('impression.facture', [
            'titre' => 'Facture', 'numero' => $facture->numero, 'facture' => $facture,
            'client' => $client, 'bien' => $bien, 'designation' => $this->designation($facture),
            'paye' => $facture->totalPaye(), 'modes' => self::MODES,
        ]);
    }

    public function recu(int $id)
    {
        $paiement = Paiement::with(['facture.location.client', 'facture.location.bien', 'facture.vente.client',
                                    'facture.vente.bien', 'facture.construction.client', 'facture.construction.bien',
                                    'facture.etape'])->findOrFail($id);
        $facture = $paiement->facture;
        [$client, $bien] = $this->partiesFacture($facture);
        $numero = 'REC-' . str_pad((string) $paiement->id, 5, '0', STR_PAD_LEFT);
        if (!$paiement->recu) {
            $paiement->forceFill(['recu' => $numero])->saveQuietly(); // numéro de reçu gardé sur le paiement
        }
        Paiement::journaliserAction('impression', $paiement);

        return response()->view('impression.recu', [
            'titre' => 'Reçu de paiement', 'numero' => $paiement->recu ?: $numero, 'paiement' => $paiement,
            'facture' => $facture, 'client' => $client, 'bien' => $bien,
            'designation' => $this->designation($facture), 'paye' => $facture->totalPaye(), 'modes' => self::MODES,
        ]);
    }

    public function contrat(int $id)
    {
        $contrat = Contrat::with(['location.client', 'location.bien', 'location.user', 'vente.client', 'vente.bien',
                                  'vente.user', 'construction.client', 'construction.bien', 'construction.user'])
            ->findOrFail($id);
        $operation = $contrat->location ?? $contrat->vente ?? $contrat->construction;
        abort_unless($operation, 422, 'L\'opération liée à ce contrat a été supprimée.');
        $this->verifierAgent($operation);
        Contrat::journaliserAction('impression', $contrat);

        $titres = ['location' => 'Contrat de location', 'vente' => 'Contrat de vente', 'construction' => 'Contrat de construction'];
        return response()->view('impression.contrat', [
            'titre' => $titres[$contrat->type] ?? 'Contrat', 'numero' => $contrat->numero, 'contrat' => $contrat,
            'operation' => $operation, 'client' => $operation->client, 'bien' => $operation->bien,
            'agent' => $operation->user, 'modes' => self::MODES,
        ]);
    }

    // Bulletin de salaire d'un employé pour un mois
    public function bulletin(int $id)
    {
        $salaire = Salaire::with('user')->findOrFail($id);
        Salaire::journaliserAction('impression', $salaire);
        $mois = \Carbon\Carbon::createFromFormat('Y-m-d', $salaire->mois . '-01')->locale('fr');
        return response()->view('impression.bulletin', [
            'titre' => 'Bulletin de salaire', 'numero' => $salaire->numero, 'salaire' => $salaire,
            'employe' => $salaire->user, 'periode' => ucfirst($mois->translatedFormat('F Y')),
            'modes' => self::MODES,
            'roles' => ['administrateur' => 'Administrateur', 'agent' => 'Agent immobilier',
                        'comptable' => 'Comptable', 'receptionniste' => 'Réceptionniste', 'proprietaire' => 'Propriétaire'],
        ]);
    }

    private function partiesFacture(Facture $f): array
    {
        $op = $f->location ?? $f->vente ?? $f->construction;
        return [$op?->client, $op?->bien];
    }

    private function designation(Facture $f): string
    {
        $etapes = ['fondement' => 'fondement', 'elevation' => 'élévation', 'finition' => 'finition'];
        return match ($f->type) {
            'loyer'        => 'Loyer',
            'caution'      => 'Caution de location',
            'vente'        => 'Vente du bien',
            'construction' => 'Construction' . ($f->etape ? ' — étape ' . $f->etape->numero . ' : ' . ($etapes[$f->etape->nom] ?? $f->etape->nom) : ''),
            default        => ucfirst((string) $f->type),
        };
    }
}
