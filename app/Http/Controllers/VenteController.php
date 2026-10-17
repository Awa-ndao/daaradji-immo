<?php

namespace App\Http\Controllers;

use App\Models\Vente;
use App\Models\Bien;
use App\Models\Commission;
use Illuminate\Http\Request;
use App\Http\Controllers\Concerns\PorteeAgent;

class VenteController extends Controller
{
    use PorteeAgent;

    public function index(Request $request)
    {
        $query = Vente::with(['client', 'bien', 'user']);

        if ($request->statut) {
            $query->where('statut', $request->statut);
        }
        if ($request->q) {
            // Entre parenthèses, sinon le « ou » annule les autres filtres
            $query->where(function ($w) use ($request) {
                $w->whereHas('client', function ($q) use ($request) {
                    $q->where('nom', 'like', '%' . $request->q . '%')
                      ->orWhere('prenom', 'like', '%' . $request->q . '%');
                })->orWhereHas('bien', function ($q) use ($request) {
                    $q->where('reference', 'like', '%' . $request->q . '%')
                      ->orWhere('localisation', 'like', '%' . $request->q . '%');
                });
            });
        }
        $this->filtrerParAgent($query, $request);

        $parPage = min((int) ($request->per_page ?: 10), 100);
        return response()->json($query->latest()->paginate($parPage));
    }

    public function store(Request $request)
    {
        $request->validate([
            'prix_vente'       => 'required|numeric|min:0',
            'date_vente'       => 'required|date',
            'mode_paiement'    => 'required|in:especes,virement,cheque,mobile_money',
            'client_id'        => 'required|exists:clients,id',
            'bien_id'          => 'required|exists:biens,id',
            'type_bien'        => 'required|in:propre,confie_proprietaire,confie_agent',
            'commission_agence'=> 'nullable|numeric|min:0',
            'nom_agent_externe'=> 'nullable|string',
        ], [
            'prix_vente.required'    => 'Le prix de vente est obligatoire.',
            'date_vente.required'    => 'La date de vente est obligatoire.',
            'mode_paiement.required' => 'Le mode de paiement est obligatoire.',
            'client_id.required'     => 'Le client est obligatoire.',
            'bien_id.required'       => 'Le bien est obligatoire.',
            'type_bien.required'     => 'Le type de bien est obligatoire.',
        ]);

        // Vérifier que le bien est disponible
        $bien = Bien::find($request->bien_id);
        if ($bien->statut !== 'disponible') {
            return response()->json([
                'message' => 'Ce bien n\'est pas disponible à la vente.'
            ], 422);
        }

        $commissionAgence = $request->commission_agence ?? 0;
        $montantReverse   = 0;

        // Si agent externe : partage 50/50
        if ($request->type_bien === 'confie_agent') {
            $montantReverse   = $commissionAgence / 2;
            $commissionAgence = $commissionAgence / 2;
        }

        $vente = Vente::create([
            'prix_vente'        => $request->prix_vente,
            'date_vente'        => $request->date_vente,
            'mode_paiement'     => $request->mode_paiement,
            'statut'            => 'en_cours',
            'commission_agence' => $commissionAgence,
            'montant_reverse'   => $montantReverse,
            'client_id'         => $request->client_id,
            'bien_id'           => $request->bien_id,
            'user_id'           => auth()->id(), // celui qui enregistre le dossier en est responsable
        ]);

        // Créer la commission
        Commission::create([
            'montant'          => $commissionAgence,
            'taux'             => 0,
            'type_transaction' => 'vente',
            'statut'           => 'en_attente',
            'vente_id'         => $vente->id,
            'user_id'          => $vente->user_id,
        ]);

        // Marquer le bien comme vendu
        $bien->update(['statut' => 'vendu']);

        return response()->json($vente->load(['client', 'bien', 'user']), 201);
    }

    public function show(Vente $vente)
    {
        $this->verifierAgent($vente);
        return response()->json(
            $vente->load(['client', 'bien', 'user', 'contrat', 'factures', 'commission'])
        );
    }

    public function update(Request $request, Vente $vente)
    {
        $this->verifierAgent($vente);
        $vente->update($this->champsModifiables($request));
        if ($vente->wasChanged('user_id')) {
            $vente->commission?->update(['user_id' => $vente->user_id]);
        }

        if ($request->statut === 'annule') {
            $vente->bien->update(['statut' => 'disponible']);
        }

        return response()->json($vente->load(['client', 'bien', 'user']));
    }

    public function destroy(Vente $vente)
    {
        $this->verifierAgent($vente);
        $vente->bien->update(['statut' => 'disponible']);
        $vente->delete();
        return response()->json(['message' => 'Vente supprimée avec succès']);
    }
}