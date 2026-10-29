<?php

namespace App\Http\Controllers;
use App\Http\Controllers\Concerns\SuppressionProtegee;

use App\Models\Vente;
use App\Models\Bien;
use App\Services\CommissionService;
use Illuminate\Http\Request;
use App\Http\Controllers\Concerns\PorteeAgent;

class VenteController extends Controller
{
    use SuppressionProtegee;
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
        ], [
            'prix_vente.required'    => 'Le prix de vente est obligatoire.',
            'date_vente.required'    => 'La date de vente est obligatoire.',
            'mode_paiement.required' => 'Le mode de paiement est obligatoire.',
            'client_id.required'     => 'Le client est obligatoire.',
            'bien_id.required'       => 'Le bien est obligatoire.',
        ]);

        // Vérifier que le bien est disponible
        $bien = Bien::find($request->bien_id);
        if ($bien->statut !== 'disponible') {
            return response()->json([
                'message' => 'Ce bien n\'est pas disponible à la vente.'
            ], 422);
        }

        // Bien confié : il faut un mandat de vente actif
        if ($erreur = CommissionService::verifierMandat($bien, 'vente')) {
            return response()->json(['message' => $erreur], 422);
        }

        $vente = Vente::create([
            'prix_vente'        => $request->prix_vente,
            'date_vente'        => $request->date_vente,
            'mode_paiement'     => $request->mode_paiement,
            'statut'            => 'en_cours',
            'commission_agence' => 0,
            'montant_reverse'   => 0,
            'client_id'         => $request->client_id,
            'bien_id'           => $request->bien_id,
            'user_id'           => auth()->id(), // celui qui enregistre le dossier en est responsable
        ]);

        // Commission calculée automatiquement à partir du mandat (bien confié uniquement)
        CommissionService::pourVente($vente);

        // Marquer le bien comme vendu
        $bien->update(['statut' => 'vendu']);

        return response()->json($vente->load(['client', 'bien', 'user']), 201);
    }

    public function show(Vente $vente)
    {
        $this->verifierAgent($vente);
        return response()->json(
            $vente->load(['client', 'bien', 'user', 'contrat', 'factures', 'commission', 'demarches'])
        );
    }

    public function update(Request $request, Vente $vente)
    {
        $this->verifierAgent($vente);
        // La commission et le montant reversé sont calculés, jamais saisis
        $vente->update(collect($this->champsModifiables($request))
            ->except(['commission_agence', 'montant_reverse'])->all());
        if ($vente->wasChanged('prix_vente')) {
            CommissionService::pourVente($vente->fresh());
        }

        if ($request->statut === 'annule') {
            $vente->bien->update(['statut' => 'disponible']);
            $vente->commission?->delete(); // vente annulée : pas de commission
        }

        return response()->json($vente->load(['client', 'bien', 'user']));
    }

    public function destroy(Vente $vente)
    {
        $this->verifierAgent($vente);
        if ($refus = $this->refusSuppression($vente, 'cette vente', ['factures', 'contrat', 'demarches'])) return $refus;
        $vente->bien->update(['statut' => 'disponible']);
        $vente->delete();
        return response()->json(['message' => 'Vente supprimée avec succès']);
    }
}