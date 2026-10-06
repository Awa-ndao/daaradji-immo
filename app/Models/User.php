<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable, HasRoles;

    protected $fillable = ['name', 'email', 'password', 'role', 'statut'];
    protected $hidden = ['password', 'remember_token'];
    protected $casts = ['email_verified_at' => 'datetime', 'password' => 'hashed'];

    public function getJWTIdentifier() { return $this->getKey(); }
    public function getJWTCustomClaims() { return []; }

    public function rendezVous() { return $this->hasMany(RendezVous::class); }
    public function mandats() { return $this->hasMany(Mandat::class); }
    public function ventes() { return $this->hasMany(Vente::class); }
    public function constructions() { return $this->hasMany(Construction::class); }
    public function commissions() { return $this->hasMany(Commission::class); }
    public function logs() { return $this->hasMany(Log::class); }
    public function achats() { return $this->hasMany(Achat::class); }
}