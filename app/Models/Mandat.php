<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Mandat extends Model
{
    use SoftDeletes;
    protected $fillable = ['type', 'date_debut', 'date_fin', 'taux_commission', 'statut', 'conditions', 'bien_id', 'proprietaire_tiers_id', 'user_id'];

    public function bien() { return $this->belongsTo(Bien::class); }
    public function proprietaireTiers() { return $this->belongsTo(ProprietaireTiers::class); }
    public function user() { return $this->belongsTo(User::class); }
}