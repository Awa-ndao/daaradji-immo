<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Vente extends Model
{
    use SoftDeletes;
    protected $fillable = ['prix_vente', 'date_vente', 'mode_paiement', 'statut', 'commission_agence', 'montant_reverse', 'client_id', 'bien_id', 'user_id'];

    public function client() { return $this->belongsTo(Client::class); }
    public function bien() { return $this->belongsTo(Bien::class); }
    public function user() { return $this->belongsTo(User::class); }
    public function contrat() { return $this->hasOne(Contrat::class); }
    public function factures() { return $this->hasMany(Facture::class); }
    public function commission() { return $this->hasOne(Commission::class); }
    public function demarchesAdministratives() { return $this->hasMany(DemarcheAdministrative::class); }
}