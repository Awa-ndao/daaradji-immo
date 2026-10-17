<?php
namespace App\Http\Controllers;
use App\Models\RendezVous;
use Illuminate\Http\Request;
use App\Http\Controllers\Concerns\PorteeAgent;

class RendezVousController extends Controller
{
    use PorteeAgent;

    public function index(Request $request)
    {
        $query = RendezVous::with(['client', 'user']);
        if ($request->statut) $query->where('statut', $request->statut);
        if ($request->date) $query->whereDate('date_heure', $request->date);
        if ($request->q) {
            $query->where(function ($w) use ($request) {
                $w->whereHas('client', function ($q) use ($request) {
                    $q->where('nom', 'like', '%' . $request->q . '%')
                      ->orWhere('prenom', 'like', '%' . $request->q . '%');
                })->orWhere('objet', 'like', '%' . $request->q . '%');
            });
        }
        $this->filtrerParAgent($query, $request);

        $parPage = min((int) ($request->per_page ?: 10), 100);
        return response()->json($query->orderBy('date_heure')->paginate($parPage));
    }

    public function store(Request $request)
    {
        $request->validate([
            'date_heure' => 'required|date',
            'objet'      => 'required|string',
            'client_id'  => 'required|exists:clients,id',
        ], [
            'date_heure.required' => 'La date et l\'heure sont obligatoires.',
            'objet.required'      => 'L\'objet du rendez-vous est obligatoire.',
            'client_id.required'  => 'Le client est obligatoire.',
        ]);

        $rdv = RendezVous::create(array_merge($request->except(['user_id', 'statut']), [
            'user_id' => $this->agentDuDossier($request, ['proprietaire', 'administrateur', 'receptionniste']),
            'statut'  => $request->statut ?: 'planifie',
        ]));
        return response()->json($rdv->load(['client', 'user']), 201);
    }

    public function show(RendezVous $rendezVous)
    {
        $this->verifierAgent($rendezVous);
        return response()->json($rendezVous->load(['client', 'user']));
    }

    public function update(Request $request, RendezVous $rendezVous)
    {
        $this->verifierAgent($rendezVous);
        $rendezVous->update($this->champsModifiables($request, ['proprietaire', 'administrateur', 'receptionniste']));
        return response()->json($rendezVous->load(['client', 'user']));
    }

    public function destroy(RendezVous $rendezVous)
    {
        $this->verifierAgent($rendezVous);
        $rendezVous->delete();
        return response()->json(['message' => 'Rendez-vous supprimé']);
    }
}