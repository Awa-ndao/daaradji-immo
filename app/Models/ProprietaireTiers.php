<?php
namespace App\Models;
use App\Models\Concerns\Journalise;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProprietaireTiers extends Model
{
    use SoftDeletes, Journalise;
    protected $table = 'proprietaires_tiers';
    protected $fillable = ['type', 'nom', 'prenom', 'telephone', 'adresse', 'piece_identite', 'mode_reversement', 'numero_compte', 'numero_mobile_money'];

    public function biens() { return $this->hasMany(Bien::class); }
    public function mandats() { return $this->hasMany(Mandat::class); }
}