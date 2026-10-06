<?php
namespace App\Http\Controllers;
use App\Models\Paiement;
use App\Models\Facture;
use Illuminate\Http\Request;

class PaiementController extends Controller
{
    public function index(Request $request)
    {
        $query = Paiement::with('facture');
        if ($request->statut) $query->where('statut', $request->statut);
        return response()->json($query->latest()->paginate(10));
    }

    public function store(Request $request)
    {
        $request->validate([
            'montant' => 'required|numeric',
            'date_paiement' => 'required|date',
            'mode_paiement' => 'required',
            'facture_id' => 'required|exists:factures,id',
        ]);
        $paiement = Paiement::create($request->all());
        $facture = Facture::find($request->facture_id);
        $totalPaye = $facture->paiements()->sum('montant');
        if ($totalPaye >= $facture->montant) {
            $facture->update(['statut' => 'payee']);
        }
        return response()->json($paiement, 201);
    }

    public function show(Paiement $paiement)
    {
        return response()->json($paiement->load('facture'));
    }

    public function update(Request $request, Paiement $paiement)
    {
        $paiement->update($request->all());
        return response()->json($paiement);
    }

    public function destroy(Paiement $paiement)
    {
        $paiement->delete();
        return response()->json(['message' => 'Paiement supprimé']);
    }
}