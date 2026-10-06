<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Achat extends Model
{
    use SoftDeletes;
    protected $fillable = ['vendeur_nom', 'vendeur_telephone', 'prix_achat', 'date_achat', 'statut', 'documents', 'bien_id', 'user_id'];

    public function bien() { return $this->belongsTo(Bien::class); }
    public function user() { return $this->belongsTo(User::class); }
}