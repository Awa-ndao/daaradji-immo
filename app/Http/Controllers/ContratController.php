<?php
namespace App\Http\Controllers;
use App\Models\Contrat;
use Illuminate\Http\Request;

class ContratController extends Controller
{
    public function index(Request $request)
    {
        $query = Contrat::with(['location', 'vente', 'construction']);
        if ($request->type) $query->where('type', $request->type);
        if ($request->statut) $query->where('statut', $request->statut);
        return response()->json($query->latest()->paginate(10));
    }

    public function store(Request $request)
    {
        $request->validate([
            'type' => 'required',
            'date_creation' => 'required|date',
        ]);
        $numero = 'CTR-' . str_pad(Contrat::count() + 1, 4, '0', STR_PAD_LEFT);
        $contrat = Contrat::create(array_merge($request->all(), ['numero' => $numero]));
        return response()->json($contrat, 201);
    }

    public function show(Contrat $contrat)
    {
        return response()->json($contrat->load(['location', 'vente', 'construction']));
    }

    public function update(Request $request, Contrat $contrat)
    {
        $contrat->update($request->all());
        return response()->json($contrat);
    }

    public function destroy(Contrat $contrat)
    {
        $contrat->delete();
        return response()->json(['message' => 'Contrat supprimé']);
    }
}