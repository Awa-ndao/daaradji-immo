<?php
namespace App\Models;
use App\Models\Concerns\Journalise;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Facture extends Model
{
    use SoftDeletes, Journalise;
    protected $fillable = [
        'numero', 'type', 'montant', 'date_emission', 'date_echeance', 'statut', 'fichier_pdf',
        'location_id', 'vente_id', 'construction_id', 'etape_construction_id',
    ];

    public function location() { return $this->belongsTo(Location::class); }
    public function vente() { return $this->belongsTo(Vente::class); }
    public function construction() { return $this->belongsTo(Construction::class); }
    public function etape() { return $this->belongsTo(EtapeConstruction::class, 'etape_construction_id'); }
    public function paiements() { return $this->hasMany(Paiement::class); }

    // Statut recalculé à partir des paiements réglés :
    // payée si le total couvre le montant, sinon en retard (échéance passée) ou en attente
    public function majStatut(): void
    {
        $totalPaye = $this->paiements()->where('statut', 'paye')->sum('montant');
        if ($this->montant > 0 && $totalPaye >= $this->montant) {
            $statut = 'payee';
        } elseif ($this->date_echeance && now()->toDateString() > $this->date_echeance) {
            $statut = 'en_retard';
        } else {
            $statut = 'en_attente';
        }
        if ($this->statut !== $statut) {
            $this->update(['statut' => $statut]);
        }
    }

    public function totalPaye(): float
    {
        return (float) $this->paiements()->where('statut', 'paye')->sum('montant');
    }
}
