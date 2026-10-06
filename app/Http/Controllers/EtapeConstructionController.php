<?php
namespace App\Http\Controllers;
use App\Models\EtapeConstruction;
use App\Models\Construction;
use Illuminate\Http\Request;

class EtapeConstructionController extends Controller
{
    public function index(Request $request)
    {
        $query = EtapeConstruction::with('construction');
        if ($request->construction_id) $query->where('construction_id', $request->construction_id);
        return response()->json($query->get());
    }

    public function update(Request $request, EtapeConstruction $etapeConstruction)
    {
        $etapeConstruction->update($request->all());
        $construction = $etapeConstruction->construction;
        $toutesTerminees = $construction->etapes()->where('statut', '!=', 'termine')->count() === 0;
        if ($toutesTerminees) {
            $construction->update(['statut' => 'livre']);
        }
        return response()->json($etapeConstruction);
    }

    public function show(EtapeConstruction $etapeConstruction)
    {
        return response()->json($etapeConstruction->load('construction'));
    }

    public function store(Request $request) {}
    public function destroy(EtapeConstruction $etapeConstruction) {}
}