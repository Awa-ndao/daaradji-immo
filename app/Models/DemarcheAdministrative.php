<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class DemarcheAdministrative extends Model
{
    protected $table = 'demarches_administratives';
    protected $fillable = ['type', 'description', 'statut', 'date_debut', 'date_fin', 'documents', 'vente_id'];

    public function vente() { return $this->belongsTo(Vente::class); }
}