<?php
namespace App\Models;
use App\Models\Concerns\Journalise;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DemarcheAdministrative extends Model
{
    use SoftDeletes, Journalise;
    protected $table = 'demarches_administratives';
    protected $fillable = ['type', 'description', 'statut', 'date_debut', 'date_fin', 'documents', 'vente_id', 'construction_id'];
    public function vente() { return $this->belongsTo(Vente::class); }
    public function construction() { return $this->belongsTo(Construction::class); }
}
