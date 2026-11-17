<?php
namespace App\Models;
use App\Models\Concerns\Journalise;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    use SoftDeletes, Journalise;
    protected $fillable = ['nom', 'prenom', 'telephone', 'email', 'adresse', 'piece_identite', 'numero_piece',
        'recherche_operation', 'recherche_type', 'recherche_quartier', 'recherche_budget_max',
        'recherche_superficie_min', 'recherche_note', 'recherche_depuis'];

    protected $casts = [
        'recherche_budget_max'     => 'float',
        'recherche_superficie_min' => 'float',
        'recherche_depuis'         => 'date:Y-m-d',
    ];

    public function rendezVous() { return $this->hasMany(RendezVous::class); }
    public function locations() { return $this->hasMany(Location::class); }
    public function ventes() { return $this->hasMany(Vente::class); }
    public function constructions() { return $this->hasMany(Construction::class); }

    // ---------- Recherche en cours (bien que le client attend) ----------

    public function scopeEnRecherche(Builder $q): Builder
    {
        return $q->whereNotNull('recherche_depuis');
    }

    // Biens disponibles qui respectent tous les critères renseignés
    public function biensCorrespondants(): Builder
    {
        $q = Bien::where('statut', 'disponible');
        if ($this->recherche_type) $q->where('type', $this->recherche_type);
        if ($this->recherche_quartier) $q->where('localisation', 'like', '%' . trim($this->recherche_quartier) . '%');
        if ($this->recherche_budget_max) $q->where('prix', '<=', $this->recherche_budget_max);
        if ($this->recherche_superficie_min) $q->where('superficie', '>=', $this->recherche_superficie_min);
        return $q;
    }

    // Clients en recherche auxquels ce bien répond (s'il est disponible)
    public static function pourBien(Bien $bien): Collection
    {
        if ($bien->statut !== 'disponible') {
            return new Collection();
        }
        $localisation = mb_strtolower($bien->localisation ?? '');
        return static::enRecherche()
            ->where(fn ($w) => $w->whereNull('recherche_type')->orWhere('recherche_type', $bien->type))
            ->where(fn ($w) => $w->whereNull('recherche_budget_max')->orWhere('recherche_budget_max', '>=', $bien->prix))
            ->where(fn ($w) => $w->whereNull('recherche_superficie_min')->orWhere('recherche_superficie_min', '<=', $bien->superficie ?? 0))
            ->orderBy('recherche_depuis')
            ->get()
            // le quartier recherché doit figurer dans la localisation du bien
            ->filter(fn ($c) => !trim((string) $c->recherche_quartier)
                || str_contains($localisation, mb_strtolower(trim($c->recherche_quartier))))
            ->values();
    }
}
