<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Facture extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'numero', 'type', 'montant', 'date_emission', 'date_echeance', 'statut', 'fichier_pdf',
        'location_id', 'vente_id', 'construction_id', 'etape_construction_id',
    ];

    public function location() { return $this->belongsTo(Location::class); }
    public function vente() { return $this->belongsTo(Vente::class); }
    public function construction() { return $this->belongsTo(Construction::class); }
    public function etape() { return $this->belongsTo(EtapeConstruction::class, 'etape_construction_id'); }
    public function paiements() { return $this->hasMany(Paiement::class); }
}