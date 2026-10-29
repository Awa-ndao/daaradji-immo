<?php
namespace App\Models;
use App\Models\Concerns\Journalise;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable, HasRoles, Journalise;

    protected $fillable = ['name', 'email', 'password', 'role', 'statut', 'salaire_base'];
    // Le salaire n'est montré que dans la gestion des comptes et des salaires (direction, comptable)
    protected $hidden = ['password', 'remember_token', 'bloque_jusqu_a', 'salaire_base'];
    protected $casts = ['email_verified_at' => 'datetime', 'password' => 'hashed', 'bloque_jusqu_a' => 'datetime', 'salaire_base' => 'float'];

    public function getJWTIdentifier() { return $this->getKey(); }
    public function getJWTCustomClaims() { return []; }

    public function rendezVous() { return $this->hasMany(RendezVous::class); }
    public function mandats() { return $this->hasMany(Mandat::class); }
    public function ventes() { return $this->hasMany(Vente::class); }
    public function constructions() { return $this->hasMany(Construction::class); }
    public function logs() { return $this->hasMany(Log::class); }
    public function achats() { return $this->hasMany(Achat::class); }
    public function salaires() { return $this->hasMany(Salaire::class); }
}