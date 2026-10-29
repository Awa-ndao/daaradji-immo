<?php

namespace App\Models;

use App\Models\Concerns\Journalise;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Salaire d'un employé pour un mois : net = salaire de base + prime − retenue.
 * Géré par la comptable ; un salaire payé ne se modifie plus.
 */
class Salaire extends Model
{
    use Journalise, SoftDeletes;

    protected $fillable = ['user_id', 'mois', 'salaire_base', 'prime', 'retenue', 'net', 'statut',
                           'numero', 'date_paiement', 'mode_paiement', 'reference', 'note'];
    protected $casts = ['salaire_base' => 'float', 'prime' => 'float', 'retenue' => 'float', 'net' => 'float'];

    public function user() { return $this->belongsTo(User::class); }

    public static function calculerNet(float $base, float $prime, float $retenue): float
    {
        return round($base + $prime - $retenue, 2);
    }
}
