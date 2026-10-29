<?php

namespace App\Http\Controllers;

use App\Models\Achat;
use App\Models\Bien;
use App\Models\Client;
use App\Models\Construction;
use App\Models\Contrat;
use App\Models\DemarcheAdministrative;
use App\Models\Facture;
use App\Models\Location;
use App\Models\Log;
use App\Models\Mandat;
use App\Models\Paiement;
use App\Models\ProprietaireTiers;
use App\Models\RendezVous;
use App\Models\Salaire;
use App\Models\Vente;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Corbeille : les suppressions sont réversibles (SoftDeletes).
 * - la direction consulte et restaure ;
 * - seul le propriétaire supprime définitivement.
 * Une restauration est refusée si elle casse une règle du logiciel
 * (élément parent lui-même supprimé, bien déjà pris par une autre opération…).
 */
class CorbeilleController extends Controller
{
    // type => [modèle, libellé, relations parentes, relations enfants]
    private function types(): array
    {
        return [
            'clients'       => [Client::class, 'Client', [], ['ventes', 'locations', 'constructions', 'rendezVous']],
            'biens'         => [Bien::class, 'Bien', ['proprietaireTiers'], ['mandats', 'ventes', 'locations', 'constructions', 'achats']],
            'proprietaires' => [ProprietaireTiers::class, 'Propriétaire tiers', [], ['biens', 'mandats']],
            'mandats'       => [Mandat::class, 'Mandat', ['bien', 'proprietaireTiers'], []],
            'achats'        => [Achat::class, 'Achat', ['bien'], []],
            'ventes'        => [Vente::class, 'Vente', ['client', 'bien'], ['factures', 'contrat', 'demarches']],
            'locations'     => [Location::class, 'Location', ['client', 'bien'], ['factures', 'contrat']],
            'constructions' => [Construction::class, 'Construction', ['client', 'bien'], ['factures', 'contrat', 'demarches']],
            'contrats'      => [Contrat::class, 'Contrat', [], []],
            'factures'      => [Facture::class, 'Facture', [], ['paiements']],
            'paiements'     => [Paiement::class, 'Paiement', ['facture'], []],
            'rendez_vous'   => [RendezVous::class, 'Rendez-vous', ['client'], []],
            'demarches'     => [DemarcheAdministrative::class, 'Démarche administrative', [], []],
            'salaires'      => [Salaire::class, 'Salaire', [], []],
        ];
    }

    public function index(Request $request)
    {
        $elements = collect();
        foreach ($this->types() as $type => [$classe, $libelle]) {
            if ($request->type && $request->type !== $type) {
                continue;
            }
            $classe::onlyTrashed()->latest('deleted_at')->limit(200)->get()
                ->each(function (Model $m) use ($type, $libelle, $elements) {
                    $elements->push([
                        'type'         => $type,
                        'type_libelle' => $libelle,
                        'id'           => $m->id,
                        'libelle'      => $this->libelle($type, $m),
                        'supprime_le'  => $m->deleted_at?->toDateTimeString(),
                        'supprime_par' => $this->auteurSuppression($m),
                    ]);
                });
        }
        return response()->json($elements->sortByDesc('supprime_le')->values());
    }

    public function restaurer(string $type, int $id)
    {
        $m = $this->trouver($type, $id);
        if ($refus = $this->verifierRestauration($type, $m)) {
            return response()->json(['message' => $refus], 422);
        }
        $m->restore();
        $this->apresRestauration($type, $m);
        return response()->json(['message' => $this->types()[$type][1] . ' restauré(e).']);
    }

    // Suppression définitive d'un élément (propriétaire uniquement)
    public function supprimer(string $type, int $id)
    {
        $m = $this->trouver($type, $id);
        if ($refus = $this->enfantsActifs($type, $m)) {
            return response()->json(['message' => $refus], 422);
        }
        $m->forceDelete();
        return response()->json(['message' => 'Supprimé définitivement.']);
    }

    // Vider la corbeille : supprime définitivement tout ce qui peut l'être
    public function vider()
    {
        $supprimes = 0;
        $gardes = 0;
        // les éléments « enfants » d'abord, pour ne pas bloquer leurs parents
        foreach (array_reverse($this->types(), true) as $type => [$classe]) {
            foreach ($classe::onlyTrashed()->get() as $m) {
                if ($this->enfantsActifs($type, $m)) {
                    $gardes++;
                    continue;
                }
                $m->forceDelete();
                $supprimes++;
            }
        }
        $msg = "{$supprimes} élément(s) supprimé(s) définitivement.";
        if ($gardes) {
            $msg .= " {$gardes} élément(s) gardé(s) car encore liés à des dossiers actifs.";
        }
        return response()->json(['message' => $msg, 'supprimes' => $supprimes, 'gardes' => $gardes]);
    }

    // ---------------------------------------------------------------------
    private function trouver(string $type, int $id): Model
    {
        abort_unless(isset($this->types()[$type]), 404, 'Type inconnu.');
        return $this->types()[$type][0]::onlyTrashed()->findOrFail($id);
    }

    private function verifierRestauration(string $type, Model $m): ?string
    {
        // Les éléments parents doivent exister (pas eux-mêmes dans la corbeille)
        foreach ($this->types()[$type][2] as $rel) {
            $fk = $m->$rel()->getForeignKeyName();
            if ($m->$fk && !$m->$rel()->exists()) {
                return 'Restaurez d\'abord l\'élément lié (' . $this->nomRelation($rel) . ').';
            }
        }

        switch ($type) {
            case 'ventes':
            case 'locations':
                $actif = $type === 'ventes' ? $m->statut !== 'annule' : $m->statut === 'actif';
                if ($actif && $m->bien->statut !== 'disponible') {
                    return 'Impossible : le bien ' . $m->bien->reference . ' n\'est plus disponible.';
                }
                break;
            case 'constructions':
                if ($m->statut === 'en_cours') {
                    $autre = Construction::where('bien_id', $m->bien_id)->where('statut', 'en_cours')->exists();
                    if ($autre || in_array($m->bien->statut, ['loue', 'en_construction'], true)) {
                        return 'Impossible : le terrain ' . $m->bien->reference . ' est déjà occupé par une autre opération.';
                    }
                }
                break;
            case 'mandats':
                if ($m->statut === 'actif' && Mandat::where('bien_id', $m->bien_id)->where('type', $m->type)
                        ->where('statut', 'actif')->exists()) {
                    return 'Impossible : ce bien a déjà un autre mandat actif de ce type.';
                }
                break;
            case 'contrats':
                $op = $m->location_id ? $m->location() : ($m->vente_id ? $m->vente() : $m->construction());
                if (!$op->exists()) {
                    return 'Restaurez d\'abord l\'opération liée à ce contrat.';
                }
                $col = $m->location_id ? 'location_id' : ($m->vente_id ? 'vente_id' : 'construction_id');
                if ($m->statut !== 'resilie' && Contrat::where($col, $m->$col)->where('statut', '!=', 'resilie')->exists()) {
                    return 'Impossible : cette opération a déjà un autre contrat.';
                }
                break;
            case 'factures':
                foreach (['location', 'vente', 'construction'] as $rel) {
                    $fk = $rel . '_id';
                    if ($m->$fk && !$m->$rel()->exists()) {
                        return 'Restaurez d\'abord l\'opération liée à cette facture.';
                    }
                }
                break;
            case 'paiements':
                if ($m->statut === 'paye') {
                    $reste = (float) $m->facture->montant - $m->facture->totalPaye();
                    if ((float) $m->montant > $reste + 0.001) {
                        return 'Impossible : ce paiement dépasserait le montant de la facture.';
                    }
                }
                break;
            case 'salaires':
                if (Salaire::where('user_id', $m->user_id)->where('mois', $m->mois)->exists()) {
                    return 'Impossible : le salaire de ce mois a déjà été préparé à nouveau pour cet employé.';
                }
                break;
            case 'demarches':
                if (($m->vente_id && !$m->vente()->exists()) || ($m->construction_id && !$m->construction()->exists())) {
                    return 'Restaurez d\'abord la vente ou la construction liée.';
                }
                break;
        }
        return null;
    }

    // Remettre le bien dans l'état qui correspond à l'opération restaurée
    private function apresRestauration(string $type, Model $m): void
    {
        match ($type) {
            'ventes'        => $m->statut !== 'annule' ? $m->bien->update(['statut' => 'vendu']) : null,
            'locations'     => $m->statut === 'actif' ? $m->bien->update(['statut' => 'loue']) : null,
            'constructions' => $m->statut === 'en_cours' ? $m->bien->update(['statut' => 'en_construction']) : null,
            'paiements'     => $m->facture?->majStatut(),
            default         => null,
        };
    }

    private function enfantsActifs(string $type, Model $m): ?string
    {
        foreach ($this->types()[$type][3] as $rel) {
            if ($m->$rel()->exists()) {
                return 'Impossible : cet élément est encore lié à des dossiers actifs (' . $this->nomRelation($rel) . ').';
            }
        }
        return null;
    }

    private function nomRelation(string $rel): string
    {
        return [
            'client' => 'client', 'bien' => 'bien', 'proprietaireTiers' => 'propriétaire tiers',
            'facture' => 'facture', 'ventes' => 'ventes', 'locations' => 'locations',
            'constructions' => 'constructions', 'rendezVous' => 'rendez-vous', 'mandats' => 'mandats',
            'achats' => 'achats', 'biens' => 'biens', 'factures' => 'factures', 'contrat' => 'contrat',
            'demarches' => 'démarches', 'paiements' => 'paiements',
        ][$rel] ?? $rel;
    }

    private function libelle(string $type, Model $m): string
    {
        $bien = fn ($b) => $b ? trim($b->reference . ' — ' . $b->localisation) : 'bien supprimé';
        $client = fn ($c) => $c ? trim($c->prenom . ' ' . $c->nom) : 'client supprimé';
        $fcfa = fn ($v) => number_format((float) $v, 0, ',', ' ') . ' FCFA';
        return match ($type) {
            'clients'       => $client($m),
            'biens'         => $bien($m),
            'proprietaires' => trim($m->prenom . ' ' . $m->nom) . ($m->type === 'agence' ? ' (agence)' : ''),
            'mandats'       => 'Mandat de ' . $m->type . ' — ' . $bien($m->bien()->withTrashed()->first()),
            'achats'        => 'Achat — ' . $bien($m->bien()->withTrashed()->first()) . ' (' . $fcfa($m->prix_achat) . ')',
            'ventes'        => 'Vente — ' . $bien($m->bien()->withTrashed()->first()) . ' à ' . $client($m->client()->withTrashed()->first()),
            'locations'     => 'Location — ' . $bien($m->bien()->withTrashed()->first()) . ' à ' . $client($m->client()->withTrashed()->first()),
            'constructions' => 'Construction — ' . $bien($m->bien()->withTrashed()->first()) . ' pour ' . $client($m->client()->withTrashed()->first()),
            'contrats'      => 'Contrat ' . $m->numero,
            'factures'      => 'Facture ' . $m->numero . ' (' . $fcfa($m->montant) . ')',
            'paiements'     => 'Paiement de ' . $fcfa($m->montant) . ' du ' . $m->date_paiement,
            'rendez_vous'   => 'Rendez-vous « ' . $m->objet . ' » — ' . $client($m->client()->withTrashed()->first()),
            'demarches'     => 'Démarche : ' . str_replace('_', ' ', $m->type),
            'salaires'      => 'Salaire de ' . ($m->user?->name ?? 'employé') . ' — ' . $m->mois . ' (' . $fcfa($m->net) . ')',
            default         => '#' . $m->id,
        };
    }

    private function auteurSuppression(Model $m): ?string
    {
        $log = Log::with('user:id,name')->where('table_name', $m->getTable())->where('action', 'suppression')
            ->where('ancienne_valeur', 'like', '{"id":' . $m->id . ',%')
            ->latest('id')->first();
        return $log?->user?->name;
    }
}
