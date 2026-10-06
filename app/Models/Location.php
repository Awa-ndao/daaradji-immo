<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Location extends Model
{
    use SoftDeletes;
    protected $fillable = ['date_debut', 'date_fin', 'loyer_mensuel', 'caution', 'statut', 'date_renouvellement', 'motif_resiliation', 'client_id', 'bien_id'];

    public function client() { return $this->belongsTo(Client::class); }
    public function bien() { return $this->belongsTo(Bien::class); }
    public function contrat() { return $this->hasOne(Contrat::class); }
    public function factures() { return $this->hasMany(Facture::class); }
}