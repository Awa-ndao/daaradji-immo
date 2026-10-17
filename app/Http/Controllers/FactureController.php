<?php
namespace App\Http\Controllers;
use App\Models\Facture;
use Illuminate\Http\Request;

class FactureController extends Controller
{
    // Tout ce qu'il faut pour afficher le bien, le client et l'étape d'une facture
    private const RELATIONS = [
        'location.bien', 'location.client',
        'vente.bien', 'vente.client',
        'construction.bien', 'construction.client',
        'etape', 'paiements',
    ];

    public function index(Request $request)
    {
        $query = Facture::with(self::RELATIONS);
        if ($request->statut) $query->where('statut', $request->statut);
        if ($request->type) $query->where('type', $request->type);
        $parPage = min((int) ($request->per_page ?: 10), 100);
        return response()->json($query->latest()->paginate($parPage));
    }

    public function store(Request $request)
    {
        $data = $this->valider($request);
        $data['numero'] = $this->nouveauNumero();
        $data['statut'] = $data['statut'] ?? 'en_attente';

        $facture = Facture::create($data);
        return response()->json($facture->load(self::RELATIONS), 201);
    }

    public function show(Facture $facture)
    {
        return response()->json($facture->load(self::RELATIONS));
    }

    public function update(Request $request, Facture $facture)
    {
        // Un simple changement de statut (bouton « Marquer payée ») n'envoie que le statut
        if ($request->keys() === ['statut']) {
            $request->validate(['statut' => 'required|in:en_attente,payee,en_retard']);
            $facture->update(['statut' => $request->statut]);
        } else {
            $facture->update($this->valider($request));
        }
        return response()->json($facture->load(self::RELATIONS));
    }

    public function destroy(Facture $facture)
    {
        $facture->delete();
        return response()->json(['message' => 'Facture supprimée']);
    }

    private function valider(Request $request): array
    {
        $data = $request->validate([
            'type'                  => 'required|in:loyer,vente,construction,caution',
            'montant'               => 'required|numeric|min:0',
            'date_emission'         => 'required|date',
            'date_echeance'         => 'nullable|date',
            'statut'                => 'nullable|in:en_attente,payee,en_retard',
            'location_id'           => 'nullable|exists:locations,id',
            'vente_id'              => 'nullable|exists:ventes,id',
            'construction_id'       => 'nullable|required_if:type,construction|exists:constructions,id',
            'etape_construction_id' => 'nullable|integer',
        ], [
            'type.required'               => 'Le type de facture est obligatoire.',
            'montant.required'            => 'Le montant est obligatoire.',
            'date_emission.required'      => 'La date d\'émission est obligatoire.',
            'construction_id.required_if' => 'Choisissez le chantier concerné.',
        ]);

        // Une seule opération liée, selon le type de facture
        $type = $data['type'];
        if (!in_array($type, ['loyer', 'caution'])) $data['location_id'] = null;
        if ($type !== 'vente') $data['vente_id'] = null;
        if ($type !== 'construction') {
            $data['construction_id'] = null;
            $data['etape_construction_id'] = null;
        }
        foreach (['location_id', 'vente_id', 'construction_id', 'etape_construction_id', 'date_echeance'] as $champ) {
            if (($data[$champ] ?? null) === '') $data[$champ] = null;
        }
        return $data;
    }

    // Numéro suivant à partir du dernier numéro de l'année.
    // withTrashed() : les factures supprimées (SoftDeletes) gardent leur numéro en base,
    // c'est pour ça que Facture::count() + 1 donnait un numéro déjà pris.
    private function nouveauNumero(): string
    {
        $annee = date('Y');
        $dernier = Facture::withTrashed()
            ->where('numero', 'like', "FAC-$annee-%")
            ->orderByDesc('numero')
            ->value('numero');
        $suivant = $dernier ? ((int) substr($dernier, -4)) + 1 : 1;
        return sprintf('FAC-%s-%04d', $annee, $suivant);
    }
}