<?php
namespace App\Http\Controllers;
use App\Models\Location;
use App\Models\Bien;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function index(Request $request)
    {
        $query = Location::with(['client', 'bien']);
        if ($request->statut) $query->where('statut', $request->statut);
        return response()->json($query->latest()->paginate(10));
    }

    public function store(Request $request)
    {
        $request->validate([
            'date_debut' => 'required|date',
            'loyer_mensuel' => 'required|numeric',
            'client_id' => 'required|exists:clients,id',
            'bien_id' => 'required|exists:biens,id',
        ]);
        $location = Location::create($request->all());
        Bien::find($request->bien_id)->update(['statut' => 'loue']);
        return response()->json($location, 201);
    }

    public function show(Location $location)
    {
        return response()->json($location->load(['client', 'bien', 'contrat', 'factures']));
    }

    public function update(Request $request, Location $location)
    {
        $location->update($request->all());
        return response()->json($location);
    }

    public function destroy(Location $location)
    {
        $location->delete();
        return response()->json(['message' => 'Location supprimée']);
    }
}