<?php

namespace App\Http\Controllers;

use App\Models\Client;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        $query = Client::query();

        if ($request->q) {
            $query->where(function($q) use ($request) {
                $q->where('nom', 'like', '%' . $request->q . '%')
                  ->orWhere('prenom', 'like', '%' . $request->q . '%')
                  ->orWhere('telephone', 'like', '%' . $request->q . '%')
                  ->orWhere('email', 'like', '%' . $request->q . '%');
            });
        }

        return response()->json($query->latest()->paginate(10));
    }

    public function store(Request $request)
    {
        $request->validate([
            'nom'          => 'required|string',
            'prenom'       => 'required|string',
            'telephone'    => 'required|unique:clients,telephone',
            'email'        => 'nullable|email|unique:clients,email',
            'piece_identite' => 'nullable|in:CNI,Passeport,Permis',
            'numero_piece' => 'nullable|unique:clients,numero_piece',
        ], [
            'nom.required'           => 'Le nom est obligatoire.',
            'prenom.required'        => 'Le prénom est obligatoire.',
            'telephone.required'     => 'Le téléphone est obligatoire.',
            'telephone.unique'       => 'Ce client est déjà enregistré avec ce numéro de téléphone.',
            'email.unique'           => 'Cet email est déjà utilisé par un autre client.',
            'email.email'            => 'L\'adresse email n\'est pas valide.',
            'piece_identite.in'      => 'La pièce d\'identité doit être CNI, Passeport ou Permis.',
            'numero_piece.unique'    => 'Ce numéro de pièce d\'identité est déjà enregistré.',
        ]);

        $client = Client::create($request->all());
        return response()->json($client, 201);
    }

    public function show(Client $client)
    {
        return response()->json(
            $client->load(['rendezVous', 'locations', 'ventes', 'constructions'])
        );
    }

    public function update(Request $request, Client $client)
    {
        $request->validate([
            'nom'          => 'required|string',
            'prenom'       => 'required|string',
            'telephone'    => 'required|unique:clients,telephone,' . $client->id,
            'email'        => 'nullable|email|unique:clients,email,' . $client->id,
            'piece_identite' => 'nullable|in:CNI,Passeport,Permis',
            'numero_piece' => 'nullable|unique:clients,numero_piece,' . $client->id,
        ], [
            'nom.required'        => 'Le nom est obligatoire.',
            'prenom.required'     => 'Le prénom est obligatoire.',
            'telephone.required'  => 'Le téléphone est obligatoire.',
            'telephone.unique'    => 'Ce numéro de téléphone est déjà utilisé par un autre client.',
            'email.unique'        => 'Cet email est déjà utilisé par un autre client.',
            'email.email'         => 'L\'adresse email n\'est pas valide.',
            'piece_identite.in'   => 'La pièce d\'identité doit être CNI, Passeport ou Permis.',
            'numero_piece.unique' => 'Ce numéro de pièce d\'identité est déjà enregistré.',
        ]);

        $client->update($request->all());
        return response()->json($client);
    }

    public function destroy(Client $client)
    {
        $client->delete();
        return response()->json(['message' => 'Client supprimé avec succès']);
    }

    public function search(Request $request)
    {
        $query = $request->get('q');
        $clients = Client::where('nom', 'like', "%$query%")
            ->orWhere('prenom', 'like', "%$query%")
            ->orWhere('telephone', 'like', "%$query%")
            ->get();
        return response()->json($clients);
    }
}