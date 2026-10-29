<?php

namespace App\Services;

use App\Models\Bien;
use App\Models\Commission;
use App\Models\Location;
use App\Models\Mandat;
use App\Models\Vente;

/**
 * Commission de l'agence sur un bien confié (jamais sur un bien propre).
 *  - le taux vient du mandat actif du bien (mandat de vente pour une vente,
 *    de location ou de gestion pour une location) ;
 *  - vente : base = prix de vente ; location : base = loyer mensuel ;
 *  - si le bien est confié par une agence partenaire, la commission est partagée 50/50.
 * Les employés sont salariés : la commission revient à l'agence.
 */
class CommissionService
{
    public const TYPES_MANDAT = [
        'vente'    => ['vente'],
        'location' => ['location', 'gestion'],
    ];

    // Mandat actif d'un bien pour une opération ; null si aucun
    public static function mandatActif(Bien $bien, string $operation): ?Mandat
    {
        return Mandat::with('proprietaireTiers')
            ->where('bien_id', $bien->id)
            ->where('statut', 'actif')
            ->whereIn('type', self::TYPES_MANDAT[$operation])
            ->where('date_debut', '<=', now()->toDateString())
            ->where(fn ($q) => $q->whereNull('date_fin')->orWhere('date_fin', '>=', now()->toDateString()))
            ->latest('date_debut')
            ->first();
    }

    // Message d'erreur si l'opération est impossible faute de mandat, sinon null
    public static function verifierMandat(Bien $bien, string $operation): ?string
    {
        if ($bien->type_propriete !== 'confie') {
            return null;
        }
        if (!self::mandatActif($bien, $operation)) {
            $quoi = $operation === 'vente' ? 'de vente' : 'de location ou de gestion';
            return "Ce bien est confié : il faut d'abord un mandat {$quoi} actif.";
        }
        return null;
    }

    // Calcul sans enregistrement (aussi utilisé pour l'aperçu dans le formulaire)
    public static function calculer(float $base, float $taux, bool $partenaire): array
    {
        $montant = round($base * $taux / 100, 2);
        $partPartenaire = $partenaire ? round($montant / 2, 2) : 0.0;
        return [
            'base'            => $base,
            'taux'            => $taux,
            'montant'         => $montant,
            'part_agence'     => round($montant - $partPartenaire, 2),
            'part_partenaire' => $partPartenaire,
        ];
    }

    public static function pourVente(Vente $vente): ?Commission
    {
        $bien = $vente->bien;
        $mandat = $bien ? self::mandatActif($bien, 'vente') : null;
        if (!$bien || $bien->type_propriete !== 'confie' || !$mandat) {
            $vente->forceFill(['commission_agence' => 0, 'montant_reverse' => 0])->saveQuietly();
            $vente->commission?->delete();
            return null;
        }
        $calc = self::calculer((float) $vente->prix_vente, (float) $mandat->taux_commission,
                               $mandat->proprietaireTiers?->type === 'agence');
        // Ce que l'agence reverse au mandant (propriétaire ou agence partenaire)
        $vente->forceFill([
            'commission_agence' => $calc['part_agence'],
            'montant_reverse'   => round((float) $vente->prix_vente - $calc['part_agence'], 2),
        ])->saveQuietly();

        return Commission::updateOrCreate(
            ['vente_id' => $vente->id],
            $calc + ['type_transaction' => 'vente', 'statut' => $vente->commission->statut ?? 'en_attente']
        );
    }

    public static function pourLocation(Location $location): ?Commission
    {
        $bien = $location->bien;
        $mandat = $bien ? self::mandatActif($bien, 'location') : null;
        if (!$bien || $bien->type_propriete !== 'confie' || !$mandat) {
            $location->commission?->delete();
            return null;
        }
        $calc = self::calculer((float) $location->loyer_mensuel, (float) $mandat->taux_commission,
                               $mandat->proprietaireTiers?->type === 'agence');
        return Commission::updateOrCreate(
            ['location_id' => $location->id],
            $calc + ['type_transaction' => 'location', 'statut' => $location->commission->statut ?? 'en_attente']
        );
    }
}
