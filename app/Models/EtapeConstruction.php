<?php
namespace App\Models;
use App\Models\Concerns\Journalise;
use Illuminate\Database\Eloquent\Model;

class EtapeConstruction extends Model
{
    use Journalise;
    protected $table = 'etapes_construction';
    protected $fillable = ['numero', 'nom', 'montant_versement', 'date_versement', 'statut', 'photos', 'date_validation', 'construction_id'];

    public function construction() { return $this->belongsTo(Construction::class); }
}