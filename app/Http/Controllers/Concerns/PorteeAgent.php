<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Chaque dossier (vente, location, chantier, achat, rendez-vous) appartient à un agent (user_id).
 * - Un agent ne voit et ne modifie que ses propres dossiers.
 * - Le propriétaire et l'administrateur voient tout, filtrent par agent et peuvent réattribuer.
 */
trait PorteeAgent
{
    protected function estAgent(): bool
    {
        return auth()->user()?->role === 'agent';
    }

    // Rôles qui peuvent choisir l'agent d'un dossier
    protected function peutAttribuer(array $roles = ['proprietaire', 'administrateur']): bool
    {
        return in_array(auth()->user()?->role, $roles, true);
    }

    // Liste : un agent ne voit que ses dossiers ; les autres peuvent filtrer (?agent_id=12 ou ?agent_id=aucun)
    protected function filtrerParAgent(Builder $query, Request $request, string $colonne = 'user_id'): Builder
    {
        if ($this->estAgent()) {
            return $query->where($colonne, auth()->id());
        }
        if ($request->agent_id === 'aucun') {
            return $query->whereNull($colonne);
        }
        if ($request->agent_id) {
            return $query->where($colonne, $request->agent_id);
        }
        return $query;
    }

    // Un agent ne peut ouvrir, modifier ou supprimer que ses propres dossiers
    protected function verifierAgent(Model $dossier, string $colonne = 'user_id'): void
    {
        if ($this->estAgent() && (int) $dossier->{$colonne} !== (int) auth()->id()) {
            abort(response()->json([
                'message' => 'Ce dossier est suivi par un autre agent.'
            ], 403));
        }
    }

    // Agent à enregistrer sur un nouveau dossier : celui choisi (si on a le droit), sinon la personne connectée
    protected function agentDuDossier(Request $request, array $rolesQuiAttribuent = ['proprietaire', 'administrateur']): ?int
    {
        if ($this->peutAttribuer($rolesQuiAttribuent) && $request->filled('user_id')) {
            $request->validate(['user_id' => 'exists:users,id'], ['user_id.exists' => 'Cet agent n\'existe pas.']);
            return (int) $request->user_id;
        }
        return auth()->id();
    }

    // Modification : seul celui qui a le droit peut changer l'agent ; sinon on ignore user_id
    protected function champsModifiables(Request $request, array $rolesQuiAttribuent = ['proprietaire', 'administrateur']): array
    {
        $data = $request->except(['user_id', 'id', 'created_at', 'updated_at', 'deleted_at']);
        if ($this->peutAttribuer($rolesQuiAttribuent) && $request->filled('user_id')) {
            $request->validate(['user_id' => 'exists:users,id'], ['user_id.exists' => 'Cet agent n\'existe pas.']);
            $data['user_id'] = (int) $request->user_id;
        }
        return $data;
    }
}
