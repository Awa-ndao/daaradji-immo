<?php

namespace App\Http\Controllers;
use App\Http\Controllers\Concerns\SuppressionProtegee;

use App\Services\CommissionService;

use App\Models\Location;
use App\Models\Bien;
use Illuminate\Http\Request;
use App\Http\Controllers\Concerns\PorteeAgent;

class LocationController extends Controller
{
    use SuppressionProtegee;
    use PorteeAgent;

    public function index(Request $request)
    {
        $query = Location::with(['client', 'bien', 'user']);

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
            'date_debut'    => 'required|date',
            'loyer_mensuel' => 'required|numeric|min:0',
            'caution'       => 'nullable|numeric|min:0',
            'client_id'     => 'required|exists:clients,id',
            'bien_id'       => 'required|exists:biens,id',
        ], [
            'date_debut.required'    => 'La date de début est obligatoire.',
            'loyer_mensuel.required' => 'Le loyer mensuel est obligatoire.',
            'loyer_mensuel.numeric'  => 'Le loyer doit être un nombre.',
            'client_id.required'     => 'Le locataire est obligatoire.',
            'client_id.exists'       => 'Ce client n\'existe pas.',
            'bien_id.required'       => 'Le bien est obligatoire.',
            'bien_id.exists'         => 'Ce bien n\'existe pas.',
        ]);

        // Vérifier que le bien est disponible, et qu'il se loue (pas un terrain nu)
        $bien = Bien::find($request->bien_id);
        if ($bien->type === 'terrain') {
            return response()->json([
                'message' => 'Un terrain ne se met pas en location.'
            ], 422);
        }
        if ($bien->statut !== 'disponible') {
            return response()->json([
                'message' => 'Ce bien n\'est pas disponible à la location.'
            ], 422);
        }

        // Bien confié : il faut un mandat de location ou de gestion actif
        if ($erreur = CommissionService::verifierMandat($bien, 'location')) {
            return response()->json(['message' => $erreur], 422);
        }

        $location = Location::create([
            'date_debut'    => $request->date_debut,
            'date_fin'      => null,
            'loyer_mensuel' => $request->loyer_mensuel,
            'caution'       => $request->caution ?? 0,
            'statut'        => 'actif',
            'client_id'     => $request->client_id,
            'bien_id'       => $request->bien_id,
            'user_id'       => auth()->id(), // celui qui enregistre le dossier en est responsable
        ]);

        // Marquer le bien comme loué
        $bien->update(['statut' => 'loue']);

        // Commission calculée automatiquement à partir du mandat (bien confié uniquement)
        CommissionService::pourLocation($location);

        return response()->json($location->load(['client', 'bien', 'user']), 201);
    }

    public function show(Location $location)
    {
        $this->verifierAgent($location);
        return response()->json(
            $location->load(['client', 'bien', 'user', 'contrat', 'factures', 'commission'])
        );
    }

    public function update(Request $request, Location $location)
    {
        $request->validate([
            'loyer_mensuel' => 'nullable|numeric|min:0',
            'caution'       => 'nullable|numeric|min:0',
            'statut'        => 'nullable|in:actif,termine',
        ]);
        $this->verifierAgent($location);

        $location->update($this->champsModifiables($request));
        if ($location->wasChanged('loyer_mensuel')) {
            CommissionService::pourLocation($location->fresh());
        }

        // Si terminé → enregistrer date du jour + remettre bien disponible
        if ($request->statut === 'termine') {
            if (!$request->date_fin) {
                $location->update(['date_fin' => now()->toDateString()]);
            }
            $location->bien->update(['statut' => 'disponible']);
        }

        return response()->json($location->load(['client', 'bien', 'user']));
    }

    public function destroy(Location $location)
    {
        $this->verifierAgent($location);
        if ($refus = $this->refusSuppression($location, 'cette location', ['factures', 'contrat'])) return $refus;
        // Remettre le bien disponible
        $location->bien->update(['statut' => 'disponible']);
        $location->delete();
        return response()->json(['message' => 'Location supprimée avec succès']);
    }
}