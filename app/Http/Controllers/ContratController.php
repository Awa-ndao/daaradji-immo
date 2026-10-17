<?php
namespace App\Http\Controllers;
use App\Models\Contrat;
use App\Models\Construction;
use App\Models\Location;
use App\Models\Vente;
use App\Http\Controllers\Concerns\PorteeAgent;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\Request;

class ContratController extends Controller
{
    use PorteeAgent;

    // Tout ce qu'il faut pour afficher le bien et le client de chaque contrat
    private const RELATIONS = [
        'location.bien', 'location.client', 'location.user',
        'vente.bien', 'vente.client', 'vente.user',
        'construction.bien', 'construction.client', 'construction.user',
    ];

    public function index(Request $request)
    {
        $query = Contrat::with(self::RELATIONS);
        if ($request->type) $query->where('type', $request->type);
        if ($request->statut) $query->where('statut', $request->statut);

        // Un contrat appartient à l'agent qui suit sa location, sa vente ou son chantier
        $agent = $this->estAgent() ? auth()->id() : ($request->agent_id ?: null);
        if ($agent === 'aucun') {
            $query->whereDoesntHave('location', fn ($q) => $q->whereNotNull('user_id'))
                  ->whereDoesntHave('vente', fn ($q) => $q->whereNotNull('user_id'))
                  ->whereDoesntHave('construction', fn ($q) => $q->whereNotNull('user_id'));
        } elseif ($agent) {
            $query->where(function (Builder $w) use ($agent) {
                $w->whereHas('location', fn ($q) => $q->where('user_id', $agent))
                  ->orWhereHas('vente', fn ($q) => $q->where('user_id', $agent))
                  ->orWhereHas('construction', fn ($q) => $q->where('user_id', $agent));
            });
        }
        $parPage = min((int) ($request->per_page ?: 10), 100);
        return response()->json($query->latest()->paginate($parPage));
    }

    public function store(Request $request)
    {
        $data = $this->valider($request);
        $this->verifierOperation($data);

        if ($doublon = $this->contratExistant($data)) {
            return response()->json([
                'message' => 'Cette opération a déjà un contrat : ' . $doublon->numero . '.'
            ], 422);
        }

        $data['numero'] = $this->nouveauNumero();
        $data['statut'] = $data['statut'] ?? 'en_attente';

        $contrat = Contrat::create($data);
        return response()->json($contrat->load(self::RELATIONS), 201);
    }

    public function show(Contrat $contrat)
    {
        $this->verifierContrat($contrat);
        return response()->json($contrat->load(self::RELATIONS));
    }

    public function update(Request $request, Contrat $contrat)
    {
        $this->verifierContrat($contrat);
        // Le bouton « Marquer signé » n'envoie que le statut
        if ($request->keys() === ['statut']) {
            $request->validate(['statut' => 'required|in:en_attente,signe,resilie']);
            $maj = ['statut' => $request->statut];
            if ($request->statut === 'signe' && !$contrat->date_signature) {
                $maj['date_signature'] = now()->toDateString();
            }
            $contrat->update($maj);
        } else {
            $data = $this->valider($request);
            $this->verifierOperation($data);
            if ($doublon = $this->contratExistant($data, $contrat->id)) {
                return response()->json([
                    'message' => 'Cette opération a déjà un contrat : ' . $doublon->numero . '.'
                ], 422);
            }
            $contrat->update($data);
        }
        return response()->json($contrat->load(self::RELATIONS));
    }

    public function destroy(Contrat $contrat)
    {
        $this->verifierContrat($contrat);
        $contrat->delete();
        return response()->json(['message' => 'Contrat supprimé']);
    }

    // Agent qui suit l'opération d'un contrat
    private function agentDuContrat(Contrat $contrat): ?int
    {
        $operation = $contrat->location ?? $contrat->vente ?? $contrat->construction;
        return $operation?->user_id;
    }

    private function verifierContrat(Contrat $contrat): void
    {
        if ($this->estAgent() && (int) $this->agentDuContrat($contrat) !== (int) auth()->id()) {
            abort(response()->json(['message' => 'Ce contrat concerne le dossier d\'un autre agent.'], 403));
        }
    }

    // Un agent ne fait un contrat que pour ses propres opérations
    private function verifierOperation(array $data): void
    {
        if (!$this->estAgent()) return;
        $operation = match ($data['type']) {
            'location'     => Location::find($data['location_id'] ?? null),
            'vente'        => Vente::find($data['vente_id'] ?? null),
            'construction' => Construction::find($data['construction_id'] ?? null),
            default        => null,
        };
        if ($operation && (int) $operation->user_id !== (int) auth()->id()) {
            abort(response()->json(['message' => 'Cette opération est suivie par un autre agent.'], 403));
        }
    }

    private function valider(Request $request): array
    {
        $data = $request->validate([
            'type'            => 'required|in:location,vente,construction',
            'date_creation'   => 'required|date',
            'date_signature'  => 'nullable|date',
            'statut'          => 'nullable|in:en_attente,signe,resilie',
            'location_id'     => 'nullable|required_if:type,location|exists:locations,id',
            'vente_id'        => 'nullable|required_if:type,vente|exists:ventes,id',
            'construction_id' => 'nullable|required_if:type,construction|exists:constructions,id',
        ], [
            'type.required'               => 'Le type de contrat est obligatoire.',
            'date_creation.required'      => 'La date de création est obligatoire.',
            'location_id.required_if'     => 'Choisissez la location concernée.',
            'vente_id.required_if'        => 'Choisissez la vente concernée.',
            'construction_id.required_if' => 'Choisissez le chantier concerné.',
        ]);

        // Une seule opération liée, celle du type choisi
        if ($data['type'] !== 'location') $data['location_id'] = null;
        if ($data['type'] !== 'vente') $data['vente_id'] = null;
        if ($data['type'] !== 'construction') $data['construction_id'] = null;
        return $data;
    }

    // Un contrat non résilié existe-t-il déjà pour la même location / vente / construction ?
    private function contratExistant(array $data, ?int $saufId = null): ?Contrat
    {
        $champ = $data['type'] . '_id';
        if (empty($data[$champ])) return null;
        return Contrat::where($champ, $data[$champ])
            ->where('statut', '!=', 'resilie')
            ->when($saufId, fn ($q) => $q->where('id', '!=', $saufId))
            ->first();
    }

    // Numéro suivant à partir du DERNIER numéro de l'année (et non du nombre de contrats,
    // qui redonne un numéro déjà pris dès qu'un contrat a été supprimé)
    private function nouveauNumero(): string
    {
        $annee = date('Y');
        $query = in_array(SoftDeletes::class, class_uses_recursive(Contrat::class))
            ? Contrat::withTrashed()
            : Contrat::query();
        $dernier = $query->where('numero', 'like', "CTR-$annee-%")
            ->orderByDesc('numero')
            ->value('numero');
        $suivant = $dernier ? ((int) substr($dernier, -4)) + 1 : 1;
        return sprintf('CTR-%s-%04d', $annee, $suivant);
    }
}