<?php

namespace App\Http\Controllers;

use App\Models\Bien;
use Illuminate\Http\Request;

class BienController extends Controller
{
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

        return response()->json($query->latest()->paginate(10));
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
            'type_propriete.in'       => 'Le type de propriété doit être : propre ou confié.',
        ]);

        $bien = Bien::create($request->all());
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
        ], [
            'reference.required'      => 'La référence est obligatoire.',
            'reference.unique'        => 'Cette référence est déjà utilisée par un autre bien.',
            'type.required'           => 'Le type de bien est obligatoire.',
            'localisation.required'   => 'La localisation est obligatoire.',
            'prix.required'           => 'Le prix est obligatoire.',
            'prix.numeric'            => 'Le prix doit être un nombre.',
            'type_propriete.required' => 'Le type de propriété est obligatoire.',
        ]);

        $bien->update($request->all());
        return response()->json($bien);
    }

    public function destroy(Bien $bien)
    {
        $bien->delete();
        return response()->json(['message' => 'Bien supprimé avec succès']);
    }
}