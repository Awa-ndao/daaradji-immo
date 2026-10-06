<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class RendezVous extends Model
{
    use SoftDeletes;
    protected $table = 'rendez_vous';
    protected $fillable = ['date_heure', 'objet', 'statut', 'notes', 'lieu_rdv', 'user_id', 'client_id'];

    public function user() { return $this->belongsTo(User::class); }
    public function client() { return $this->belongsTo(Client::class); }
}