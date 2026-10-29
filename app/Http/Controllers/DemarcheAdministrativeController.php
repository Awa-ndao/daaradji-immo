<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\PorteeAgent;
use App\Models\Construction;
use App\Models\DemarcheAdministrative;
use App\Models\Vente;
use Illuminate\Http\Request;

/**
 * Démarches administratives (titre foncier, permis de construire, mutation…)
 * faites pour un client, liées à une vente OU à une construction.
 * Un agent ne voit que les démarches de ses propres dossiers.
 */
class DemarcheAdministrativeController extends Controller
{
    use PorteeAgent;

    private const RELATIONS = ['vente.client', 'vente.bien', 'construction.client', 'construction.bien'];

    public function index(Request $request)
    {
        $query = DemarcheAdministrative::with(self::RELATIONS);
        if ($request->statut) {
            $query->where('statut', $request->statut);
        }
        if ($request->type) {
            $query->where('type', $request->type);
        }
        if ($this->estAgent()) {
            $moi = auth()->id();
            $query->where(function ($w) use ($moi) {
                $w->whereHas('vente', fn ($v) => $v->where('user_id', $moi))
                  ->orWhereHas('construction', fn ($c) => $c->where('user_id', $moi));
            });
        }
        $parPage = min((int) ($request->per_page ?: 10), 100);
        return response()->json($query->latest()->paginate($parPage));
    }

    public function store(Request $request)
    {
        $data = $this->valider($request);
        if ($erreur = $this->verifierOperation($data)) {
            return $erreur;
        }
        $demarche = DemarcheAdministrative::create($data + ['statut' => 'en_cours']);
        return response()->json($demarche->load(self::RELATIONS), 201);
    }

    public function show(DemarcheAdministrative $demarcheAdministrative)
    {
        $this->verifierDemarche($demarcheAdministrative);
        return response()->json($demarcheAdministrative->load(self::RELATIONS));
    }

    public function update(Request $request, DemarcheAdministrative $demarcheAdministrative)
    {
        $this->verifierDemarche($demarcheAdministrative);
        $data = $request->validate([
            'type'        => 'sometimes|in:titre_foncier,permis_construire,mutation,autre',
            'description' => 'nullable|string',
            'statut'      => 'sometimes|in:en_cours,termine,annule',
            'date_debut'  => 'sometimes|date',
            'date_fin'    => 'nullable|date',
            'documents'   => 'nullable|string',
        ]);
        if (($data['statut'] ?? null) === 'termine' && empty($data['date_fin']) && !$demarcheAdministrative->date_fin) {
            $data['date_fin'] = now()->toDateString();
        }
        $demarcheAdministrative->update($data);
        return response()->json($demarcheAdministrative->load(self::RELATIONS));
    }

    public function destroy(DemarcheAdministrative $demarcheAdministrative)
    {
        $this->verifierDemarche($demarcheAdministrative);
        $demarcheAdministrative->delete();
        return response()->json(['message' => 'Démarche supprimée']);
    }

    private function valider(Request $request): array
    {
        return $request->validate([
            'type'            => 'required|in:titre_foncier,permis_construire,mutation,autre',
            'description'     => 'nullable|string',
            'date_debut'      => 'required|date',
            'date_fin'        => 'nullable|date|after_or_equal:date_debut',
            'documents'       => 'nullable|string',
            'vente_id'        => 'nullable|required_without:construction_id|prohibits:construction_id|exists:ventes,id',
            'construction_id' => 'nullable|required_without:vente_id|exists:constructions,id',
        ], [
            'type.required'                => 'Le type de démarche est obligatoire.',
            'date_debut.required'          => 'La date de début est obligatoire.',
            'vente_id.required_without'    => 'Choisissez la vente ou la construction concernée.',
            'construction_id.required_without' => 'Choisissez la vente ou la construction concernée.',
            'vente_id.prohibits'           => 'Une démarche concerne une vente OU une construction, pas les deux.',
        ]);
    }

    private function verifierOperation(array $data)
    {
        $operation = !empty($data['vente_id']) ? Vente::find($data['vente_id']) : Construction::find($data['construction_id']);
        if ($operation && $this->estAgent() && (int) $operation->user_id !== (int) auth()->id()) {
            return response()->json(['message' => 'Ce dossier est suivi par un autre agent.'], 403);
        }
        return null;
    }

    private function verifierDemarche(DemarcheAdministrative $d): void
    {
        $operation = $d->vente ?? $d->construction;
        if ($operation) {
            $this->verifierAgent($operation);
        }
    }
}
