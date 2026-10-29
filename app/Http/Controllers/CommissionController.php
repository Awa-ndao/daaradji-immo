<?php

namespace App\Http\Controllers;

use App\Models\Commission;
use Illuminate\Http\Request;

/**
 * Commissions de l'agence : créées automatiquement à la vente ou à la location d'un bien confié.
 * La comptabilité les consulte et marque leur encaissement.
 */
class CommissionController extends Controller
{
    private const RELATIONS = [
        'vente.bien', 'vente.client', 'vente.bien.proprietaireTiers',
        'location.bien', 'location.client', 'location.bien.proprietaireTiers',
    ];

    public function index(Request $request)
    {
        $query = Commission::with(self::RELATIONS);
        if ($request->statut) {
            $query->where('statut', $request->statut);
        }
        if ($request->type_transaction) {
            $query->where('type_transaction', $request->type_transaction);
        }
        if ($request->partenaire === '1') {
            $query->where('part_partenaire', '>', 0);
        }
        $parPage = min((int) ($request->per_page ?: 10), 100);
        $page = $query->latest()->paginate($parPage);

        // Totaux affichés en haut de l'écran
        $totaux = Commission::selectRaw('COALESCE(SUM(part_agence),0) as agence, COALESCE(SUM(part_partenaire),0) as partenaires')
            ->selectRaw("COALESCE(SUM(CASE WHEN statut = 'en_attente' THEN part_agence ELSE 0 END),0) as en_attente")
            ->first();

        return response()->json(array_merge($page->toArray(), ['totaux' => $totaux]));
    }

    public function show(Commission $commission)
    {
        return response()->json($commission->load(self::RELATIONS));
    }

    // Seul l'encaissement se modifie : statut et date de paiement
    public function update(Request $request, Commission $commission)
    {
        $data = $request->validate([
            'statut'        => 'required|in:en_attente,payee',
            'date_paiement' => 'nullable|date',
        ]);
        if ($data['statut'] === 'payee' && empty($data['date_paiement'])) {
            $data['date_paiement'] = now()->toDateString();
        }
        if ($data['statut'] === 'en_attente') {
            $data['date_paiement'] = null;
        }
        $commission->update($data);
        return response()->json($commission->load(self::RELATIONS));
    }
}
