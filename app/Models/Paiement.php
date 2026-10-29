<?php
namespace App\Models;
use App\Models\Concerns\Journalise;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Paiement extends Model
{
    use SoftDeletes, Journalise;
    protected $fillable = ['montant', 'date_paiement', 'mode_paiement', 'reference', 'statut', 'recu', 'facture_id'];
    public function facture() { return $this->belongsTo(Facture::class); }
}
