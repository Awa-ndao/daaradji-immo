<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\PorteeAgent;
use App\Models\Bien;
use App\Models\Mandat;
use Illuminate\Http\Request;

/**
 * Mandat : contrat par lequel un propriétaire tiers confie un bien à l'agence
 * (vente, location ou gestion), pour une durée et un taux de commission négociés.
 */
class MandatController extends Controller
{
    use PorteeAgent;

    private const RELATIONS = ['bien', 'proprietaireTiers', 'user'];

    public function index(Request $request)
    {
        $this->expirerMandats();
        $query = Mandat::with(self::RELATIONS);
        foreach (['statut', 'type', 'bien_id', 'proprietaire_tiers_id'] as $champ) {
            if ($request->filled($champ)) {
                $query->where($champ, $request->$champ);
            }
        }
        if ($request->q) {
            $query->where(function ($w) use ($request) {
                $w->whereHas('bien', fn ($b) => $b->where('reference', 'like', "%{$request->q}%")
                        ->orWhere('localisation', 'like', "%{$request->q}%"))
                  ->orWhereHas('proprietaireTiers', fn ($p) => $p->where('nom', 'like', "%{$request->q}%")
                        ->orWhere('prenom', 'like', "%{$request->q}%"));
            });
        }
        $this->filtrerParAgent($query, $request);
        $parPage = min((int) ($request->per_page ?: 10), 100);
        return response()->json($query->latest()->paginate($parPage));
    }

    public function store(Request $request)
    {
        $data = $this->valider($request);
        $bien = Bien::findOrFail($data['bien_id']);

        if ($erreur = $this->verifierCoherence($bien, $data)) {
            return response()->json(['message' => $erreur], 422);
        }

        $mandat = Mandat::create($data + [
            'statut'  => 'actif',
            'user_id' => auth()->id(), // celui qui enregistre le mandat en est responsable
        ]);

        // Le bien devient « confié » et rattaché à son propriétaire tiers
        $bien->update(['type_propriete' => 'confie', 'proprietaire_tiers_id' => $data['proprietaire_tiers_id']]);

        return response()->json($mandat->load(self::RELATIONS), 201);
    }

    public function show(Mandat $mandat)
    {
        $this->verifierAgent($mandat);
        return response()->json($mandat->load(self::RELATIONS));
    }

    public function update(Request $request, Mandat $mandat)
    {
        $this->verifierAgent($mandat);
        $request->validate([
            'type'            => 'sometimes|in:vente,location,gestion',
            'date_debut'      => 'sometimes|date',
            'date_fin'        => 'nullable|date|after_or_equal:date_debut',
            'taux_commission' => 'sometimes|numeric|min:0|max:100',
            'statut'          => 'sometimes|in:actif,expire,resilie',
            'conditions'      => 'nullable|string',
        ]);
        $data = collect($this->champsModifiables($request))
            ->only(['type', 'date_debut', 'date_fin', 'taux_commission', 'statut', 'conditions', 'user_id'])
            ->all();

        if (($data['statut'] ?? $mandat->statut) === 'actif') {
            $bien = $mandat->bien;
            $type = $data['type'] ?? $mandat->type;
            if ($bien && $this->autreMandatActif($bien->id, $type, $mandat->id)) {
                return response()->json(['message' => 'Ce bien a déjà un mandat actif de ce type.'], 422);
            }
        }

        $mandat->update($data);
        return response()->json($mandat->load(self::RELATIONS));
    }

    public function destroy(Mandat $mandat)
    {
        $this->verifierAgent($mandat);
        $mandat->delete();
        return response()->json(['message' => 'Mandat supprimé']);
    }

    private function valider(Request $request): array
    {
        return $request->validate([
            'type'                  => 'required|in:vente,location,gestion',
            'date_debut'            => 'required|date',
            'date_fin'              => 'nullable|date|after_or_equal:date_debut',
            'taux_commission'       => 'required|numeric|min:0|max:100',
            'conditions'            => 'nullable|string',
            'bien_id'               => 'required|exists:biens,id',
            'proprietaire_tiers_id' => 'required|exists:proprietaires_tiers,id',
        ], [
            'type.required'                  => 'Le type de mandat est obligatoire.',
            'date_debut.required'            => 'La date de début est obligatoire.',
            'date_fin.after_or_equal'        => 'La date de fin doit être après la date de début.',
            'taux_commission.required'       => 'Le taux de commission est obligatoire.',
            'taux_commission.max'            => 'Le taux ne peut pas dépasser 100 %.',
            'bien_id.required'               => 'Le bien est obligatoire.',
            'proprietaire_tiers_id.required' => 'Le propriétaire tiers est obligatoire.',
        ]);
    }

    private function verifierCoherence(Bien $bien, array $data): ?string
    {
        if ($bien->type_propriete === 'propre' && $bien->achats()->exists()) {
            return 'Ce bien appartient à l\'agence (acheté) : il ne peut pas faire l\'objet d\'un mandat.';
        }
        if ($bien->proprietaire_tiers_id && (int) $bien->proprietaire_tiers_id !== (int) $data['proprietaire_tiers_id']) {
            return 'Ce bien appartient à un autre propriétaire tiers.';
        }
        if ($data['type'] === 'location' && $bien->type === 'terrain') {
            return 'Un terrain ne se met pas en location.';
        }
        if ($this->autreMandatActif($bien->id, $data['type'])) {
            return 'Ce bien a déjà un mandat actif de ce type.';
        }
        return null;
    }

    private function autreMandatActif(int $bienId, string $type, ?int $sauf = null): bool
    {
        return Mandat::where('bien_id', $bienId)->where('type', $type)->where('statut', 'actif')
            ->when($sauf, fn ($q) => $q->where('id', '!=', $sauf))
            ->exists();
    }

    // Un mandat dont la date de fin est passée devient « expiré »
    private function expirerMandats(): void
    {
        Mandat::where('statut', 'actif')->whereNotNull('date_fin')
            ->where('date_fin', '<', now()->toDateString())
            ->update(['statut' => 'expire']); // mise à jour automatique, hors journal
    }
}
