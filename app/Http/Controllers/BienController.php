<?php
namespace App\Http\Controllers;
use App\Models\Bien;
use Illuminate\Http\Request;

class BienController extends Controller
{
    public function index(Request $request)
    {
        $query = Bien::with('proprietaireTiers');
        if ($request->statut) $query->where('statut', $request->statut);
        if ($request->type) $query->where('type', $request->type);
        if ($request->type_propriete) $query->where('type_propriete', $request->type_propriete);
        if ($request->q) $query->where('localisation', 'like', "%{$request->q}%")
            ->orWhere('reference', 'like', "%{$request->q}%");
        return response()->json($query->latest()->paginate(10));
    }

    public function store(Request $request)
    {
        $request->validate([
            'reference' => 'required|unique:biens',
            'type' => 'required',
            'localisation' => 'required',
            'prix' => 'required|numeric',
        ]);
        $bien = Bien::create($request->all());
        return response()->json($bien, 201);
    }

    public function show(Bien $bien)
    {
        return response()->json($bien->load(['proprietaireTiers', 'mandats', 'locations', 'ventes', 'constructions']));
    }

    public function update(Request $request, Bien $bien)
    {
        $bien->update($request->all());
        return response()->json($bien);
    }

    public function destroy(Bien $bien)
    {
        $bien->delete();
        return response()->json(['message' => 'Bien supprimé']);
    }
}