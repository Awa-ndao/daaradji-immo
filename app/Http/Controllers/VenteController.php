<?php
namespace App\Http\Controllers;
use App\Models\Vente;
use App\Models\Bien;
use App\Models\Commission;
use Illuminate\Http\Request;

class VenteController extends Controller
{
    public function index(Request $request)
    {
        $query = Vente::with(['client', 'bien', 'user']);
        if ($request->statut) $query->where('statut', $request->statut);
        return response()->json($query->latest()->paginate(10));
    }

    public function store(Request $request)
    {
        $request->validate([
            'prix_vente' => 'required|numeric',
            'date_vente' => 'required|date',
            'client_id' => 'required|exists:clients,id',
            'bien_id' => 'required|exists:biens,id',
        ]);

        $commission = $request->prix_vente * 0.05;
        $vente = Vente::create(array_merge($request->all(), [
            'user_id' => auth()->id(),
            'commission_agence' => $commission,
        ]));

        Commission::create([
            'montant' => $commission,
            'taux' => 5,
            'type_transaction' => 'vente',
            'vente_id' => $vente->id,
            'user_id' => auth()->id(),
        ]);

        Bien::find($request->bien_id)->update(['statut' => 'vendu']);
        return response()->json($vente, 201);
    }

    public function show(Vente $vente)
    {
        return response()->json($vente->load(['client', 'bien', 'user', 'contrat', 'factures', 'commission', 'demarchesAdministratives']));
    }

    public function update(Request $request, Vente $vente)
    {
        $vente->update($request->all());
        return response()->json($vente);
    }

    public function destroy(Vente $vente)
    {
        $vente->delete();
        return response()->json(['message' => 'Vente supprimée']);
    }
}