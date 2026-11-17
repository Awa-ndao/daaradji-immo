<?php

namespace App\Http\Controllers;
use App\Http\Controllers\Concerns\SuppressionProtegee;

use App\Models\Client;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    use SuppressionProtegee;

    // Recherche en cours : le bien que le client attend (tous les champs sont facultatifs)
    private const REGLES_RECHERCHE = [
        'recherche_operation'      => 'nullable|in:achat,location',
        'recherche_type'           => 'nullable|in:terrain,maison,villa,appartement,local_commercial',
        'recherche_quartier'       => 'nullable|string|max:120',
        'recherche_budget_max'     => 'nullable|numeric|min:0',
        'recherche_superficie_min' => 'nullable|numeric|min:0',
        'recherche_note'           => 'nullable|string|max:500',
    ];
    private const MESSAGES_RECHERCHE = [
        'recherche_budget_max.numeric'     => 'Le budget doit être un nombre.',
        'recherche_budget_max.min'         => 'Le budget ne peut pas être négatif.',
        'recherche_superficie_min.min'     => 'La superficie ne peut pas être négative.',
    ];
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

        // « Clients qui recherchent un bien » : filtre de la liste
        if ($request->recherche) {
            $query->enRecherche();
        }

        $page = $query->latest()->paginate(10);
        // Nombre de biens disponibles qui correspondent à la recherche du client
        $page->getCollection()->each(fn (Client $c) =>
            $c->setAttribute('nb_biens', $c->recherche_depuis ? $c->biensCorrespondants()->count() : 0));
        return response()->json($page);
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
        ] + self::REGLES_RECHERCHE, [
            'nom.required'           => 'Le nom est obligatoire.',
            'prenom.required'        => 'Le prénom est obligatoire.',
            'telephone.required'     => 'Le téléphone est obligatoire.',
            'telephone.unique'       => 'Ce client est déjà enregistré avec ce numéro de téléphone.',
            'email.unique'           => 'Cet email est déjà utilisé par un autre client.',
            'email.email'            => 'L\'adresse email n\'est pas valide.',
            'piece_identite.in'      => 'La pièce d\'identité doit être CNI, Passeport ou Permis.',
            'numero_piece.unique'    => 'Ce numéro de pièce d\'identité est déjà enregistré.',
        ] + self::MESSAGES_RECHERCHE);

        $client = Client::create($this->avecRecherche($request, $request->all()));
        return response()->json($this->avecBiens($client), 201);
    }

    public function show(Client $client)
    {
        return response()->json(
            $client->load(['rendezVous', 'locations', 'ventes', 'constructions'])
                ->setAttribute('biens_correspondants', $client->recherche_depuis
                    ? $client->biensCorrespondants()->orderBy('prix')->limit(20)->get() : [])
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
        ] + self::REGLES_RECHERCHE, [
            'nom.required'        => 'Le nom est obligatoire.',
            'prenom.required'     => 'Le prénom est obligatoire.',
            'telephone.required'  => 'Le téléphone est obligatoire.',
            'telephone.unique'    => 'Ce numéro de téléphone est déjà utilisé par un autre client.',
            'email.unique'        => 'Cet email est déjà utilisé par un autre client.',
            'email.email'         => 'L\'adresse email n\'est pas valide.',
            'piece_identite.in'   => 'La pièce d\'identité doit être CNI, Passeport ou Permis.',
            'numero_piece.unique' => 'Ce numéro de pièce d\'identité est déjà enregistré.',
        ] + self::MESSAGES_RECHERCHE);

        $client->update($this->avecRecherche($request, $request->all(), $client));
        return response()->json($this->avecBiens($client));
    }

    public function destroy(Client $client)
    {
        if ($refus = $this->refusSuppression($client, 'ce client', ['ventes', 'locations', 'constructions', 'rendezVous'])) return $refus;
        $client->delete();
        return response()->json(['message' => 'Client supprimé avec succès']);
    }

    // Le client a trouvé son bien (ou ne cherche plus) : on efface sa recherche
    public function terminerRecherche(Client $client)
    {
        $client->update(array_fill_keys(self::CHAMPS_RECHERCHE, null));
        return response()->json(['message' => 'Recherche terminée pour ' . $client->prenom . ' ' . $client->nom . '.']);
    }

    private const CHAMPS_RECHERCHE = ['recherche_operation', 'recherche_type', 'recherche_quartier', 'recherche_budget_max',
        'recherche_superficie_min', 'recherche_note', 'recherche_depuis'];

    // Une recherche existe quand on a choisi achat ou location ; la date de début est gardée tant qu'elle dure
    private function avecRecherche(Request $request, array $data, ?Client $client = null): array
    {
        unset($data['recherche_depuis'], $data['nb_biens']);
        if (!$request->has('recherche_operation')) {
            return $data; // formulaire sans la partie recherche : on n'y touche pas
        }
        if (empty($data['recherche_operation'])) {
            foreach (self::CHAMPS_RECHERCHE as $champ) $data[$champ] = null;
            return $data;
        }
        foreach (['recherche_type', 'recherche_quartier', 'recherche_budget_max', 'recherche_superficie_min', 'recherche_note'] as $champ) {
            if (($data[$champ] ?? '') === '') $data[$champ] = null;
        }
        if (!$data['recherche_type'] && !trim((string) $data['recherche_quartier']) && !$data['recherche_budget_max'] && !$data['recherche_superficie_min']) {
            abort(response()->json([
                'message' => 'Recherche du client : renseignez au moins un critère (type de bien, quartier, budget ou superficie).',
            ], 422));
        }
        $data['recherche_depuis'] = $client?->recherche_depuis?->toDateString() ?? now()->toDateString();
        return $data;
    }

    private function avecBiens(Client $client): Client
    {
        $client->setAttribute('nb_biens', $client->recherche_depuis ? $client->biensCorrespondants()->count() : 0);
        return $client;
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