<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;

/**
 * Avant de mettre un élément à la corbeille, on vérifie qu'aucun dossier n'en dépend encore.
 * Exemple : un client qui a une vente ne peut pas être supprimé, sinon la vente
 * n'aurait plus de client. Il faut d'abord supprimer (ou terminer) les dossiers liés.
 */
trait SuppressionProtegee
{
    private const NOMS_DOSSIERS = [
        'ventes' => 'des ventes', 'locations' => 'des locations', 'constructions' => 'des chantiers',
        'rendezVous' => 'des rendez-vous', 'mandats' => 'des mandats', 'achats' => 'un achat',
        'factures' => 'des factures', 'contrat' => 'un contrat', 'demarches' => 'des démarches',
        'paiements' => 'des paiements',
    ];

    protected function refusSuppression(Model $element, string $quoi, array $relations): ?JsonResponse
    {
        $lies = [];
        foreach ($relations as $rel) {
            if ($element->$rel()->exists()) $lies[] = self::NOMS_DOSSIERS[$rel] ?? $rel;
        }
        if (!$lies) return null;
        return response()->json([
            'message' => "Impossible de supprimer {$quoi} : des dossiers en dépendent encore ("
                . implode(', ', $lies) . '). Supprimez d\'abord ces dossiers.'
        ], 422);
    }
}
