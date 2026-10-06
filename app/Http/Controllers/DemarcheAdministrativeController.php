<?php
namespace App\Http\Controllers;
use App\Models\DemarcheAdministrative;
use Illuminate\Http\Request;

class DemarcheAdministrativeController extends Controller
{
    public function index(Request $request)
    {
        $query = DemarcheAdministrative::with('vente');
        if ($request->statut) $query->where('statut', $request->statut);
        return response()->json($query->latest()->paginate(10));
    }

    public function store(Request $request)
    {
        $request->validate([
            'type' => 'required',
            'date_debut' => 'required|date',
            'vente_id' => 'required|exists:ventes,id',
        ]);
        $demarche = DemarcheAdministrative::create($request->all());
        return response()->json($demarche, 201);
    }

    public function show(DemarcheAdministrative $demarcheAdministrative)
    {
        return response()->json($demarcheAdministrative->load('vente'));
    }

    public function update(Request $request, DemarcheAdministrative $demarcheAdministrative)
    {
        $demarcheAdministrative->update($request->all());
        return response()->json($demarcheAdministrative);
    }

    public function destroy(DemarcheAdministrative $demarcheAdministrative)
    {
        $demarcheAdministrative->delete();
        return response()->json(['message' => 'Démarche supprimée']);
    }
}