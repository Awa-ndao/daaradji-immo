<?php
namespace App\Http\Controllers;
use App\Models\Mandat;
use Illuminate\Http\Request;

class MandatController extends Controller
{
    public function index()
    {
        return response()->json(Mandat::with(['bien', 'proprietaireTiers', 'user'])->latest()->paginate(10));
    }

    public function store(Request $request)
    {
        $request->validate([
            'type' => 'required',
            'date_debut' => 'required|date',
            'bien_id' => 'required|exists:biens,id',
            'proprietaire_tiers_id' => 'required|exists:proprietaires_tiers,id',
        ]);
        $mandat = Mandat::create(array_merge($request->all(), ['user_id' => auth()->id()]));
        return response()->json($mandat, 201);
    }

    public function show(Mandat $mandat)
    {
        return response()->json($mandat->load(['bien', 'proprietaireTiers', 'user']));
    }

    public function update(Request $request, Mandat $mandat)
    {
        $mandat->update($request->all());
        return response()->json($mandat);
    }

    public function destroy(Mandat $mandat)
    {
        $mandat->delete();
        return response()->json(['message' => 'Mandat supprimé']);
    }
}