<?php
namespace App\Http\Controllers;
use App\Models\Achat;
use Illuminate\Http\Request;

class AchatController extends Controller
{
    public function index(Request $request)
    {
        $query = Achat::with(['bien', 'user']);
        if ($request->statut) $query->where('statut', $request->statut);
        return response()->json($query->latest()->paginate(10));
    }

    public function store(Request $request)
    {
        $request->validate([
            'vendeur_nom' => 'required|string',
            'prix_achat' => 'required|numeric',
            'date_achat' => 'required|date',
            'bien_id' => 'required|exists:biens,id',
        ]);
        $achat = Achat::create(array_merge($request->all(), ['user_id' => auth()->id()]));
        return response()->json($achat, 201);
    }

    public function show(Achat $achat)
    {
        return response()->json($achat->load(['bien', 'user']));
    }

    public function update(Request $request, Achat $achat)
    {
        $achat->update($request->all());
        return response()->json($achat);
    }

    public function destroy(Achat $achat)
    {
        $achat->delete();
        return response()->json(['message' => 'Achat supprimé']);
    }
}