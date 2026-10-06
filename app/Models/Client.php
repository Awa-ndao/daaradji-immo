<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    use SoftDeletes;
    protected $fillable = ['nom', 'prenom', 'telephone', 'email', 'adresse', 'piece_identite', 'numero_piece'];

    public function rendezVous() { return $this->hasMany(RendezVous::class); }
    public function locations() { return $this->hasMany(Location::class); }
    public function ventes() { return $this->hasMany(Vente::class); }
    public function constructions() { return $this->hasMany(Construction::class); }
}