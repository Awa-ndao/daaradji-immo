<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Contrat extends Model
{
    use SoftDeletes;
    protected $fillable = ['numero', 'type', 'date_creation', 'date_signature', 'fichier_pdf', 'statut', 'location_id', 'vente_id', 'construction_id'];

    public function location() { return $this->belongsTo(Location::class); }
    public function vente() { return $this->belongsTo(Vente::class); }
    public function construction() { return $this->belongsTo(Construction::class); }
}