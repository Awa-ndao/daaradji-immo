<?php
namespace App\Http\Controllers;
use App\Models\Paiement;
use App\Models\Facture;
use Illuminate\Http\Request;

class PaiementController extends Controller
{
    public function index(Request $request)
    {
        $query = Paiement::with([
            'facture.location.bien', 'facture.location.client',
            'facture.vente.bien', 'facture.vente.client',
            'facture.construction.bien', 'facture.construction.client',
            'facture.etape',
        ]);
        if ($request->statut) $query->where('statut', $request->statut);
        return response()->json($query->latest()->paginate(10));
    }

    public function store(Request $request)
    {
        $data = $this->valider($request);
        $data['statut'] = $data['statut'] ?? 'paye';
        if ($refus = $this->depasseReste($data)) return $refus;

        $paiement = Paiement::create($data);
        $paiement->facture?->majStatut();

        return response()->json($paiement->load('facture'), 201);
    }

    public function show(Paiement $paiement)
    {
        return response()->json($paiement->load('facture'));
    }

    public function update(Request $request, Paiement $paiement)
    {
        $ancienneFacture = $paiement->facture;
        $data = $this->valider($request);
        if ($refus = $this->depasseReste($data + ['statut' => $paiement->statut], $paiement->id)) return $refus;
        $paiement->update($data);
        $paiement->refresh();

        $paiement->facture?->majStatut();
        if ($ancienneFacture && $ancienneFacture->id !== $paiement->facture_id) {
            $ancienneFacture->majStatut();
        }
        return response()->json($paiement->load('facture'));
    }

    public function destroy(Paiement $paiement)
    {
        $facture = $paiement->facture;
        $paiement->delete();
        $facture?->majStatut();
        return response()->json(['message' => 'Paiement supprimé']);
    }

    // Un paiement réglé ne peut pas dépasser ce qu'il reste à payer sur la facture
    private function depasseReste(array $data, ?int $sauf = null)
    {
        if (($data['statut'] ?? 'paye') !== 'paye') {
            return null;
        }
        $facture = Facture::find($data['facture_id']);
        $dejaPaye = $facture->paiements()->where('statut', 'paye')
            ->when($sauf, fn ($q) => $q->where('id', '!=', $sauf))->sum('montant');
        $reste = max(0, (float) $facture->montant - (float) $dejaPaye);
        if ((float) $data['montant'] > $reste + 0.001) {
            $fmt = number_format($reste, 0, ',', ' ');
            return response()->json([
                'message' => $reste > 0
                    ? "Le montant dépasse le reste à payer ({$fmt} FCFA)."
                    : 'Cette facture est déjà entièrement payée.'
            ], 422);
        }
        return null;
    }

    private function valider(Request $request): array
    {
        return $request->validate([
            'montant'       => 'required|numeric|min:1',
            'date_paiement' => 'required|date',
            'mode_paiement' => 'required|in:especes,virement,cheque,wave,orange_money',
            'reference'     => 'nullable|string|max:100',
            'statut'        => 'nullable|in:paye,en_attente,annule',
            'facture_id'    => 'required|exists:factures,id',
        ], [
            'montant.required'       => 'Le montant est obligatoire.',
            'montant.min'            => 'Le montant doit être supérieur à 0.',
            'date_paiement.required' => 'La date de paiement est obligatoire.',
            'mode_paiement.required' => 'Le mode de paiement est obligatoire.',
            'facture_id.required'    => 'La facture est obligatoire.',
        ]);
    }

}