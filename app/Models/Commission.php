<?php
namespace App\Models;
use App\Models\Concerns\Journalise;
use Illuminate\Database\Eloquent\Model;

/**
 * Commission de l'agence sur une vente ou une location d'un bien confié.
 * montant = base × taux ; si le bien vient d'une agence partenaire, partage 50/50.
 */
class Commission extends Model
{
    use Journalise;
    protected $fillable = ['base', 'taux', 'montant', 'part_agence', 'part_partenaire', 'type_transaction',
                           'date_paiement', 'statut', 'vente_id', 'location_id'];
    protected $casts = ['base' => 'float', 'taux' => 'float', 'montant' => 'float',
                        'part_agence' => 'float', 'part_partenaire' => 'float'];
    public function vente() { return $this->belongsTo(Vente::class); }
    public function location() { return $this->belongsTo(Location::class); }
}
