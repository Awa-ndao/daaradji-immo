<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Commission extends Model
{
    protected $fillable = ['montant', 'taux', 'type_transaction', 'date_paiement', 'statut', 'vente_id', 'user_id'];

    public function vente() { return $this->belongsTo(Vente::class); }
    public function user() { return $this->belongsTo(User::class); }
}