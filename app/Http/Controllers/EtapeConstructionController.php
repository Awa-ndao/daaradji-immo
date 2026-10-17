<?php

namespace App\Http\Controllers;

use App\Models\EtapeConstruction;
use Illuminate\Http\Request;
use App\Http\Controllers\Concerns\PorteeAgent;

class EtapeConstructionController extends Controller
{
    use PorteeAgent;

    public function index(Request $request)
    {
        $query = EtapeConstruction::with('construction');
        if ($request->construction_id) {
            $query->where('construction_id', $request->construction_id);
        }
        return response()->json($query->orderBy('numero')->get());
    }

    // On reçoit l'identifiant et on charge l'étape nous-mêmes.
    // (Avant : la route « etapes-construction/{etapes_construction} » ne correspondait pas
    //  au nom $etapeConstruction, Laravel passait une étape vide -> construction null.)
    public function update(Request $request, $id)
    {
        $etape = EtapeConstruction::with('construction')->findOrFail($id);
        if ($etape->construction) {
            $this->verifierAgent($etape->construction);
        }

        $data = $request->validate([
            'statut'            => 'nullable|in:en_attente,en_cours,termine',
            'montant_versement' => 'nullable|numeric|min:0',
            'date_versement'    => 'nullable|date',
        ]);

        // Date du versement remplie automatiquement quand on termine l'étape
        if (($data['statut'] ?? null) === 'termine' && empty($data['date_versement'])) {
            $data['date_versement'] = now()->toDateString();
        }

        // Les étapes se font dans l'ordre : pas de démarrage tant que les précédentes ne sont pas terminées
        if (in_array($data['statut'] ?? null, ['en_cours', 'termine']) && $etape->statut === 'en_attente') {
            $avant = EtapeConstruction::where('construction_id', $etape->construction_id)
                ->where('numero', '<', $etape->numero)
                ->where('statut', '!=', 'termine')
                ->exists();
            if ($avant) {
                return response()->json([
                    'message' => 'Terminez d\'abord les étapes précédentes.'
                ], 422);
            }
        }

        $etape->update($data);

        // Étape rouverte alors que le chantier était livré -> le chantier repasse en cours
        $construction = $etape->construction;
        if ($construction && ($data['statut'] ?? null) !== null && $data['statut'] !== 'termine'
            && $construction->statut === 'livre') {
            $construction->update(['statut' => 'en_cours', 'date_livraison' => null]);
            $construction->bien?->update(['statut' => 'en_construction']);
        }

        // Toutes les étapes terminées -> chantier livré
        if ($construction) {
            $toutesTerminees = !$construction->etapes()
                ->where('statut', '!=', 'termine')
                ->exists();

            if ($toutesTerminees && $construction->statut !== 'livre') {
                $construction->update([
                    'statut'         => 'livre',
                    'date_livraison' => now()->toDateString(),
                ]);
                $construction->bien?->update(['statut' => 'vendu']);
            }
        }

        return response()->json($etape->fresh());
    }

    public function show($id)
    {
        return response()->json(EtapeConstruction::with('construction')->findOrFail($id));
    }

    public function store(Request $request) {}
    public function destroy($id) {}
}