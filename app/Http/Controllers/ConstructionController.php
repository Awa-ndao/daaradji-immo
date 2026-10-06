<?php
namespace App\Http\Controllers;
use App\Models\Construction;
use App\Models\EtapeConstruction;
use App\Models\Bien;
use Illuminate\Http\Request;

class ConstructionController extends Controller
{
    public function index(Request $request)
    {
        $query = Construction::with(['client', 'bien', 'user', 'etapes']);
        if ($request->statut) $query->where('statut', $request->statut);
        return response()->json($query->latest()->paginate(10));
    }

    public function store(Request $request)
    {
        $request->validate([
            'montant_total' => 'required|numeric',
            'date_debut' => 'required|date',
            'client_id' => 'required|exists:clients,id',
            'bien_id' => 'required|exists:biens,id',
        ]);

        $construction = Construction::create(array_merge($request->all(), ['user_id' => auth()->id()]));

        $etapes = [
            ['numero' => 1, 'nom' => 'fondement', 'statut' => 'en_attente'],
            ['numero' => 2, 'nom' => 'elevation', 'statut' => 'en_attente'],
            ['numero' => 3, 'nom' => 'finition', 'statut' => 'en_attente'],
        ];
        foreach ($etapes as $etape) {
            EtapeConstruction::create(array_merge($etape, ['construction_id' => $construction->id]));
        }

        Bien::find($request->bien_id)->update(['statut' => 'en_construction']);
        return response()->json($construction->load('etapes'), 201);
    }

    public function show(Construction $construction)
    {
        return response()->json($construction->load(['client', 'bien', 'user', 'etapes', 'contrat']));
    }

    public function update(Request $request, Construction $construction)
    {
        $construction->update($request->all());
        return response()->json($construction);
    }

    public function destroy(Construction $construction)
    {
        $construction->delete();
        return response()->json(['message' => 'Construction supprimée']);
    }
}