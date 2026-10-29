<?php
namespace App\Http\Controllers;
use App\Http\Controllers\Concerns\SuppressionProtegee;
use App\Models\Construction;
use App\Models\Facture;
use App\Models\Location;
use App\Models\Vente;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\Request;

class FactureController extends Controller
{
    use SuppressionProtegee;
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
            $facture->update($this->valider($request, $facture));
        }
        return response()->json($facture->load(self::RELATIONS));
    }

    public function destroy(Facture $facture)
    {
        if ($refus = $this->refusSuppression($facture, 'cette facture', ['paiements'])) return $refus;
        $facture->delete();
        return response()->json(['message' => 'Facture supprimée']);
    }

    private function valider(Request $request, ?Facture $facture = null): array
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
        $this->verifierMontant($data, $facture);
        return $data;
    }

    // Le montant doit rester cohérent avec l'opération facturée :
    //  - vente : le total facturé ne dépasse pas le prix de vente ;
    //  - caution : le total facturé ne dépasse pas la caution de la location ;
    //  - construction : le total facturé ne dépasse pas le montant du chantier ;
    //  - une facture ne descend pas sous ce qui a déjà été payé dessus.
    private function verifierMontant(array $data, ?Facture $facture): void
    {
        $fcfa = fn ($n) => number_format((float) $n, 0, ',', ' ') . ' FCFA';
        $montant = (float) $data['montant'];

        if ($facture && $montant < $facture->totalPaye()) {
            throw ValidationException::withMessages(['montant' =>
                'Cette facture a déjà reçu ' . $fcfa($facture->totalPaye()) . ' de paiements : le montant ne peut pas être inférieur.']);
        }

        $plafond = null; $quoi = ''; $champ = null;
        if ($data['type'] === 'vente' && $data['vente_id']) {
            $plafond = Vente::find($data['vente_id'])?->prix_vente; $quoi = 'le prix de la vente'; $champ = 'vente_id';
        } elseif ($data['type'] === 'caution' && $data['location_id']) {
            $plafond = Location::find($data['location_id'])?->caution; $quoi = 'la caution de la location'; $champ = 'location_id';
        } elseif ($data['type'] === 'construction' && $data['construction_id']) {
            $plafond = Construction::find($data['construction_id'])?->montant_total; $quoi = 'le montant du chantier'; $champ = 'construction_id';
        }
        if ($plafond === null) return;

        $dejaFacture = (float) Facture::where('type', $data['type'])->where($champ, $data[$champ])
            ->when($facture, fn ($q) => $q->where('id', '!=', $facture->id))
            ->sum('montant');
        $reste = max(0, (float) $plafond - $dejaFacture);
        if ($montant > $reste + 0.001) {
            throw ValidationException::withMessages(['montant' =>
                'Le montant dépasse ' . $quoi . ' (' . $fcfa($plafond) . ')' .
                ($dejaFacture > 0 ? ', dont ' . $fcfa($dejaFacture) . ' déjà facturés' : '') .
                '. Reste à facturer : ' . $fcfa($reste) . '.']);
        }
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