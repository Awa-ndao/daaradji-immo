<?php

namespace App\Http\Controllers;
use App\Http\Controllers\Concerns\SuppressionProtegee;

use App\Models\Bien;
use Illuminate\Http\Request;

class BienController extends Controller
{
    use SuppressionProtegee;
    public function index(Request $request)
    {
        $query = Bien::with('proprietaireTiers');

        if ($request->statut) {
            $query->where('statut', $request->statut);
        }
        if ($request->type) {
            $query->where('type', $request->type);
        }
        if ($request->type_propriete) {
            $query->where('type_propriete', $request->type_propriete);
        }
        if ($request->q) {
            $query->where(function($q) use ($request) {
                $q->where('localisation', 'like', '%' . $request->q . '%')
                  ->orWhere('reference', 'like', '%' . $request->q . '%');
            });
        }

        $parPage = min((int) ($request->per_page ?: 10), 100);
        return response()->json($query->latest()->paginate($parPage));
    }

    public function store(Request $request)
    {
        $request->validate([
            'reference'      => 'required|unique:biens,reference',
            'type'           => 'required|in:terrain,maison,villa,appartement,local_commercial',
            'localisation'   => 'required|string',
            'prix'           => 'required|numeric|min:0',
            'type_propriete' => 'required|in:propre,confie',
            'statut'         => 'nullable|in:disponible,loue,vendu,en_construction',
            'superficie'     => 'nullable|numeric|min:0',
            'proprietaire_tiers_id' => 'nullable|required_if:type_propriete,confie|exists:proprietaires_tiers,id',
        ], [
            'reference.required'      => 'La référence est obligatoire.',
            'reference.unique'        => 'Ce bien est déjà enregistré avec cette référence.',
            'type.required'           => 'Le type de bien est obligatoire.',
            'type.in'                 => 'Le type doit être : terrain, maison, villa, appartement ou local commercial.',
            'localisation.required'   => 'La localisation est obligatoire.',
            'prix.required'           => 'Le prix est obligatoire.',
            'prix.numeric'            => 'Le prix doit être un nombre.',
            'prix.min'                => 'Le prix doit être supérieur à 0.',
            'type_propriete.required' => 'Le type de propriété est obligatoire.',
            'proprietaire_tiers_id.required_if' => 'Un bien confié doit avoir son propriétaire tiers.',
            'type_propriete.in'       => 'Le type de propriété doit être : propre ou confié.',
        ]);

        $bien = Bien::create($this->donnees($request));
        return response()->json($bien, 201);
    }

    public function show(Bien $bien)
    {
        return response()->json(
            $bien->load(['proprietaireTiers', 'mandats', 'locations', 'ventes'])
        );
    }

    public function update(Request $request, Bien $bien)
    {
        $request->validate([
            'reference'      => 'required|unique:biens,reference,' . $bien->id,
            'type'           => 'required|in:terrain,maison,villa,appartement,local_commercial',
            'localisation'   => 'required|string',
            'prix'           => 'required|numeric|min:0',
            'type_propriete' => 'required|in:propre,confie',
            'statut'         => 'nullable|in:disponible,loue,vendu,en_construction',
            'superficie'     => 'nullable|numeric|min:0',
            'proprietaire_tiers_id' => 'nullable|required_if:type_propriete,confie|exists:proprietaires_tiers,id',
        ], [
            'reference.required'      => 'La référence est obligatoire.',
            'reference.unique'        => 'Cette référence est déjà utilisée par un autre bien.',
            'type.required'           => 'Le type de bien est obligatoire.',
            'localisation.required'   => 'La localisation est obligatoire.',
            'prix.required'           => 'Le prix est obligatoire.',
            'prix.numeric'            => 'Le prix doit être un nombre.',
            'type_propriete.required' => 'Le type de propriété est obligatoire.',
            'proprietaire_tiers_id.required_if' => 'Un bien confié doit avoir son propriétaire tiers.',
        ]);

        $bien->update($this->donnees($request));
        return response()->json($bien);
    }

    public function destroy(Bien $bien)
    {
        if ($refus = $this->refusSuppression($bien, 'ce bien', ['mandats', 'ventes', 'locations', 'constructions', 'achats'])) return $refus;
        $bien->delete();
        return response()->json(['message' => 'Bien supprimé avec succès']);
    }

    // Un bien propre n'a pas de propriétaire tiers
    private function donnees(Request $request): array
    {
        $data = $request->except(['id', 'created_at', 'updated_at', 'deleted_at']);
        if (($data['type_propriete'] ?? null) === 'propre') {
            $data['proprietaire_tiers_id'] = null;
        }
        return $data;
    }
}
