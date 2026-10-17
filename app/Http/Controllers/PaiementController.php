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

        $paiement = Paiement::create($data);
        $this->majStatutFacture($paiement->facture);

        return response()->json($paiement->load('facture'), 201);
    }

    public function show(Paiement $paiement)
    {
        return response()->json($paiement->load('facture'));
    }

    public function update(Request $request, Paiement $paiement)
    {
        $ancienneFacture = $paiement->facture;
        $paiement->update($this->valider($request));
        $paiement->refresh();

        $this->majStatutFacture($paiement->facture);
        if ($ancienneFacture && $ancienneFacture->id !== $paiement->facture_id) {
            $this->majStatutFacture($ancienneFacture);
        }
        return response()->json($paiement->load('facture'));
    }

    public function destroy(Paiement $paiement)
    {
        $facture = $paiement->facture;
        $paiement->delete();
        $this->majStatutFacture($facture);
        return response()->json(['message' => 'Paiement supprimé']);
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

    // La facture est « payée » quand les paiements réglés couvrent son montant,
    // sinon elle redevient « en attente » (ou « en retard » si l'échéance est passée).
    private function majStatutFacture(?Facture $facture): void
    {
        if (!$facture) return;
        $totalPaye = $facture->paiements()->where('statut', 'paye')->sum('montant');

        if ($facture->montant > 0 && $totalPaye >= $facture->montant) {
            $statut = 'payee';
        } elseif ($facture->date_echeance && now()->toDateString() > $facture->date_echeance) {
            $statut = 'en_retard';
        } else {
            $statut = 'en_attente';
        }
        if ($facture->statut !== $statut) {
            $facture->update(['statut' => $statut]);
        }
    }
}