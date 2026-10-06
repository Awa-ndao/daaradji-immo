<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Construction extends Model
{
    use SoftDeletes;
    protected $fillable = ['niveaux', 'superficie', 'montant_total', 'date_debut', 'date_livraison', 'statut', 'pv_remise_cles', 'client_id', 'bien_id', 'user_id'];

    public function client() { return $this->belongsTo(Client::class); }
    public function bien() { return $this->belongsTo(Bien::class); }
    public function user() { return $this->belongsTo(User::class); }
    public function etapes() { return $this->hasMany(EtapeConstruction::class); }
    public function contrat() { return $this->hasOne(Contrat::class); }
}