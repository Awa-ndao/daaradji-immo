<?php
namespace App\Http\Controllers;
use App\Models\RendezVous;
use Illuminate\Http\Request;

class RendezVousController extends Controller
{
    public function index(Request $request)
    {
        $query = RendezVous::with(['client', 'user']);
        if ($request->date) $query->whereDate('date_heure', $request->date);
        if ($request->statut) $query->where('statut', $request->statut);
        return response()->json($query->orderBy('date_heure')->paginate(10));
    }

    public function store(Request $request)
    {
        $request->validate([
            'date_heure' => 'required|date',
            'objet' => 'required|string',
            'client_id' => 'required|exists:clients,id',
        ]);
        $rdv = RendezVous::create(array_merge($request->all(), ['user_id' => auth()->id()]));
        return response()->json($rdv, 201);
    }

    public function show(RendezVous $rendezVous)
    {
        return response()->json($rendezVous->load(['client', 'user']));
    }

    public function update(Request $request, RendezVous $rendezVous)
    {
        $rendezVous->update($request->all());
        return response()->json($rendezVous);
    }

    public function destroy(RendezVous $rendezVous)
    {
        $rendezVous->delete();
        return response()->json(['message' => 'Rendez-vous supprimé']);
    }
}