<?php

namespace App\Http\Controllers;

use App\Models\Achat;
use App\Models\Bien;
use Illuminate\Http\Request;
use App\Http\Controllers\Concerns\PorteeAgent;

class AchatController extends Controller
{
    use PorteeAgent;

    public function index(Request $request)
    {
        $query = Achat::with(['bien', 'user']);

        if ($request->statut) {
            $query->where('statut', $request->statut);
        }
        if ($request->q) {
            // Entre parenthèses, sinon le « ou » annule les autres filtres
            $query->where(function ($w) use ($request) {
                $w->where('vendeur_nom', 'like', '%' . $request->q . '%')
                  ->orWhereHas('bien', function ($q) use ($request) {
                      $q->where('reference', 'like', '%' . $request->q . '%')
                        ->orWhere('localisation', 'like', '%' . $request->q . '%');
                  });
            });
        }
        $this->filtrerParAgent($query, $request);

        $parPage = min((int) ($request->per_page ?: 10), 100);
        return response()->json($query->latest()->paginate($parPage));
    }

    public function store(Request $request)
    {
        $request->validate([
            'vendeur_nom'       => 'required|string',
            'vendeur_telephone' => 'nullable|string',
            'prix_achat'        => 'required|numeric|min:0',
            'date_achat'        => 'required|date',
            'bien_id'           => 'required|exists:biens,id',
        ], [
            'vendeur_nom.required'  => 'Le nom du vendeur est obligatoire.',
            'prix_achat.required'   => 'Le prix d\'achat est obligatoire.',
            'prix_achat.numeric'    => 'Le prix doit être un nombre.',
            'date_achat.required'   => 'La date d\'achat est obligatoire.',
            'bien_id.required'      => 'Le bien est obligatoire.',
            'bien_id.exists'        => 'Ce bien n\'existe pas.',
        ]);

        $achat = Achat::create([
            'vendeur_nom'       => $request->vendeur_nom,
            'vendeur_telephone' => $request->vendeur_telephone,
            'prix_achat'        => $request->prix_achat,
            'date_achat'        => $request->date_achat,
            'statut'            => 'finalise',
            'documents'         => $request->documents,
            'bien_id'           => $request->bien_id,
            'user_id'           => auth()->id(), // celui qui enregistre le dossier en est responsable
        ]);

        // Marquer le bien comme propre
        Bien::find($request->bien_id)->update([
            'type_propriete' => 'propre',
            'statut'         => 'disponible',
        ]);

        return response()->json($achat->load(['bien', 'user']), 201);
    }

    public function show(Achat $achat)
    {
        $this->verifierAgent($achat);
        return response()->json($achat->load(['bien', 'user']));
    }

    public function update(Request $request, Achat $achat)
    {
        $this->verifierAgent($achat);
        $achat->update($this->champsModifiables($request));
        return response()->json($achat->load(['bien', 'user']));
    }

    public function destroy(Achat $achat)
    {
        $this->verifierAgent($achat);
        $achat->delete();
        return response()->json(['message' => 'Achat supprimé avec succès']);
    }
}