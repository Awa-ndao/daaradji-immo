<?php

namespace App\Http\Controllers;
use App\Http\Controllers\Concerns\SuppressionProtegee;

use App\Models\Construction;
use App\Models\EtapeConstruction;
use App\Models\Bien;
use App\Models\Location;
use App\Models\Vente;
use Illuminate\Http\Request;
use App\Http\Controllers\Concerns\PorteeAgent;

class ConstructionController extends Controller
{
    use SuppressionProtegee;
    use PorteeAgent;

    public function index(Request $request)
    {
        $query = Construction::with(['client', 'bien', 'user', 'etapes']);

        if ($request->statut) {
            $query->where('statut', $request->statut);
        }
        if ($request->q) {
            // Entre parenthèses, sinon le « ou » annule le filtre par statut
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
            'montant_total' => 'required|numeric|min:0',
            'date_debut'    => 'required|date',
            'client_id'     => 'required|exists:clients,id',
            'bien_id'       => 'required|exists:biens,id',
            'niveaux'       => 'nullable|integer|min:1',
            'superficie'    => 'nullable|numeric|min:0',
        ], [
            'montant_total.required' => 'Le montant total est obligatoire.',
            'date_debut.required'    => 'La date de début est obligatoire.',
            'client_id.required'     => 'Le client est obligatoire.',
            'bien_id.required'       => 'Le terrain est obligatoire.',
        ]);

        $bien = Bien::find($request->bien_id);
        if ($bien->type && $bien->type !== 'terrain') {
            return response()->json([
                'message' => 'Une construction se fait sur un terrain : ' . $bien->reference . ' n\'en est pas un.'
            ], 422);
        }
        // Un terrain peut être construit s'il est libre,
        // ou s'il a été vendu AU MÊME client (il construit sur son terrain)
        if ($conflit = $this->operationEnCours($bien, (int) $request->client_id)) {
            return response()->json(['message' => $conflit], 422);
        }

        $construction = Construction::create([
            'montant_total'  => $request->montant_total,
            'date_debut'     => $request->date_debut,
            'date_livraison' => null,
            'statut'         => 'en_cours',
            'niveaux'        => $request->niveaux ?? 1,
            'superficie'     => $request->superficie,
            'pv_remise_cles' => false,
            'client_id'      => $request->client_id,
            'bien_id'        => $request->bien_id,
            'user_id'        => auth()->id(), // celui qui enregistre le dossier en est responsable
        ]);

        // Créer les 3 étapes automatiquement
        $etapes = [
            ['numero' => 1, 'nom' => 'fondement',  'statut' => 'en_attente'],
            ['numero' => 2, 'nom' => 'elevation',  'statut' => 'en_attente'],
            ['numero' => 3, 'nom' => 'finition',   'statut' => 'en_attente'],
        ];

        foreach ($etapes as $etape) {
            EtapeConstruction::create(array_merge($etape, [
                'construction_id'   => $construction->id,
                'montant_versement' => 0,
            ]));
        }

        // Marquer le terrain en construction
        $bien->update(['statut' => 'en_construction']);

        return response()->json($construction->load(['client', 'bien', 'user', 'etapes']), 201);
    }

    public function show(Construction $construction)
    {
        $this->verifierAgent($construction);
        return response()->json(
            $construction->load(['client', 'bien', 'user', 'etapes', 'contrat'])
        );
    }

    public function update(Request $request, Construction $construction)
    {
        $data = $request->validate([
            'montant_total'  => 'sometimes|numeric|min:0',
            'date_debut'     => 'sometimes|date',
            'date_livraison' => 'nullable|date',
            'niveaux'        => 'nullable|integer|min:1',
            'superficie'     => 'nullable|numeric|min:0',
            'client_id'      => 'sometimes|exists:clients,id',
            'statut'         => 'sometimes|in:en_cours,livre,annule',
        ]);
        $this->verifierAgent($construction);

        // Réattribution du chantier : propriétaire et administrateur seulement
        if ($this->peutAttribuer() && $request->filled('user_id')) {
            $request->validate(['user_id' => 'exists:users,id']);
            $data['user_id'] = (int) $request->user_id;
        }

        // Livré sans date saisie -> date du jour
        if (($data['statut'] ?? null) === 'livre' && empty($data['date_livraison'])) {
            $data['date_livraison'] = now()->toDateString();
        }

        $construction->update($data);

        if (($data['statut'] ?? null) === 'livre') {
            $construction->bien?->update(['statut' => 'vendu']);
        }
        if (($data['statut'] ?? null) === 'annule') {
            $construction->bien?->update(['statut' => $this->statutTerrainLibere($construction)]);
        }

        return response()->json($construction->load(['client', 'bien', 'user', 'etapes']));
    }

    // Vente de ce terrain au client donné (en cours ou finalisée)
    private function venteAuClient(int $bienId, int $clientId): ?Vente
    {
        return Vente::where('bien_id', $bienId)
            ->where('client_id', $clientId)
            ->whereIn('statut', ['en_cours', 'finalise'])
            ->first();
    }

    // Message d'erreur si le terrain ne peut pas recevoir ce chantier, sinon null
    private function operationEnCours(Bien $bien, int $clientId, ?int $saufConstructionId = null): ?string
    {
        $chantier = Construction::where('bien_id', $bien->id)
            ->whereIn('statut', ['en_cours', 'livre'])
            ->when($saufConstructionId, fn ($q) => $q->where('id', '!=', $saufConstructionId))
            ->exists();
        if ($chantier) {
            return 'Un chantier existe déjà sur ce terrain.';
        }

        if (Location::where('bien_id', $bien->id)->where('statut', 'actif')->exists()) {
            return 'Ce terrain est actuellement en location.';
        }

        // Vendu (ou en cours de vente) à quelqu'un d'autre : refus
        $autreVente = Vente::with('client')->where('bien_id', $bien->id)
            ->where('client_id', '!=', $clientId)
            ->whereIn('statut', ['en_cours', 'finalise'])
            ->first();
        if ($autreVente) {
            $acheteur = $autreVente->client
                ? $autreVente->client->prenom . ' ' . $autreVente->client->nom
                : 'un autre client';
            return 'Ce terrain est vendu à ' . $acheteur . ' : seul ce client peut y faire construire.';
        }

        // Ni libre, ni vendu à ce client
        if ($bien->statut !== 'disponible' && !$this->venteAuClient($bien->id, $clientId)) {
            return 'Ce terrain n\'est pas disponible.';
        }
        return null;
    }

    // Statut du terrain quand le chantier s'arrête : « vendu » s'il appartient au client, sinon « disponible »
    private function statutTerrainLibere(Construction $construction): string
    {
        return $this->venteAuClient($construction->bien_id, (int) $construction->client_id) ? 'vendu' : 'disponible';
    }

    public function destroy(Construction $construction)
    {
        $this->verifierAgent($construction);
        if ($refus = $this->refusSuppression($construction, 'ce chantier', ['factures', 'contrat', 'demarches'])) return $refus;
        $construction->bien?->update(['statut' => $this->statutTerrainLibere($construction)]);
        $construction->etapes()->delete();
        $construction->delete();
        return response()->json(['message' => 'Construction supprimée avec succès']);
    }
}