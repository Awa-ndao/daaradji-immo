<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Bien extends Model
{
    use SoftDeletes;
    protected $fillable = ['reference', 'type', 'localisation', 'superficie', 'prix', 'statut', 'type_propriete', 'description', 'proprietaire_tiers_id'];

    public function proprietaireTiers() { return $this->belongsTo(ProprietaireTiers::class); }
    public function mandats() { return $this->hasMany(Mandat::class); }
    public function locations() { return $this->hasMany(Location::class); }
    public function ventes() { return $this->hasMany(Vente::class); }
    public function constructions() { return $this->hasMany(Construction::class); }
    public function achats() { return $this->hasMany(Achat::class); }
}