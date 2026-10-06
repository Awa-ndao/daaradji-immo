<?php
namespace App\Http\Controllers;
use App\Models\Facture;
use Illuminate\Http\Request;

class FactureController extends Controller
{
    public function index(Request $request)
    {
        $query = Facture::with(['location', 'vente', 'paiements']);
        if ($request->statut) $query->where('statut', $request->statut);
        if ($request->type) $query->where('type', $request->type);
        return response()->json($query->latest()->paginate(10));
    }

    public function store(Request $request)
    {
        $request->validate([
            'type' => 'required',
            'montant' => 'required|numeric',
            'date_emission' => 'required|date',
        ]);
        $numero = 'FAC-' . str_pad(Facture::count() + 1, 4, '0', STR_PAD_LEFT);
        $facture = Facture::create(array_merge($request->all(), ['numero' => $numero]));
        return response()->json($facture, 201);
    }

    public function show(Facture $facture)
    {
        return response()->json($facture->load(['location', 'vente', 'paiements']));
    }

    public function update(Request $request, Facture $facture)
    {
        $facture->update($request->all());
        return response()->json($facture);
    }

    public function destroy(Facture $facture)
    {
        $facture->delete();
        return response()->json(['message' => 'Facture supprimée']);
    }
}