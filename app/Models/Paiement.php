<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Paiement extends Model
{
    protected $fillable = ['montant', 'date_paiement', 'mode_paiement', 'reference', 'statut', 'recu', 'facture_id'];

    public function facture() { return $this->belongsTo(Facture::class); }
}