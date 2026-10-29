<?php

namespace App\Http\Controllers;

use App\Models\ProprietaireTiers;
use Illuminate\Http\Request;

/**
 * Propriétaires tiers : personnes (particuliers) ou agences partenaires qui confient un bien à l'agence.
 */
class ProprietaireTiersController extends Controller
{
    public function index(Request $request)
    {
        $query = ProprietaireTiers::withCount(['biens', 'mandats']);
        if ($request->type) {
            $query->where('type', $request->type);
        }
        if ($request->q) {
            $query->where(function ($w) use ($request) {
                $w->where('nom', 'like', "%{$request->q}%")
                  ->orWhere('prenom', 'like', "%{$request->q}%")
                  ->orWhere('telephone', 'like', "%{$request->q}%");
            });
        }
        $parPage = min((int) ($request->per_page ?: 10), 100);
        return response()->json($query->orderBy('nom')->paginate($parPage));
    }

    public function store(Request $request)
    {
        $proprietaire = ProprietaireTiers::create($this->valider($request));
        return response()->json($proprietaire, 201);
    }

    public function show(ProprietaireTiers $proprietaire)
    {
        return response()->json($proprietaire->load(['biens', 'mandats.bien']));
    }

    public function update(Request $request, ProprietaireTiers $proprietaire)
    {
        $proprietaire->update($this->valider($request, true));
        return response()->json($proprietaire);
    }

    public function destroy(ProprietaireTiers $proprietaire)
    {
        if ($proprietaire->biens()->exists() || $proprietaire->mandats()->where('statut', 'actif')->exists()) {
            return response()->json([
                'message' => 'Ce propriétaire a encore des biens ou un mandat actif : impossible de le supprimer.'
            ], 422);
        }
        $proprietaire->delete();
        return response()->json(['message' => 'Propriétaire supprimé']);
    }

    private function valider(Request $request, bool $modif = false): array
    {
        $req = $modif ? 'sometimes|required' : 'required';
        return $request->validate([
            'type'                => "$req|in:particulier,agence",
            'nom'                 => "$req|string|max:255",
            'prenom'              => 'nullable|string|max:255',
            'telephone'           => "$req|string|max:30",
            'adresse'             => 'nullable|string',
            'piece_identite'      => 'nullable|string|max:255',
            'mode_reversement'    => 'nullable|in:virement,mobile_money,especes',
            'numero_compte'       => 'nullable|string|max:60',
            'numero_mobile_money' => 'nullable|string|max:30',
        ], [
            'type.required'      => 'Précisez s\'il s\'agit d\'un particulier ou d\'une agence.',
            'nom.required'       => 'Le nom est obligatoire.',
            'telephone.required' => 'Le téléphone est obligatoire.',
        ]);
    }
}
