<?php

namespace App\Models\Concerns;

use App\Models\Log;
use Illuminate\Database\Eloquent\Model;

/**
 * Journal d'activité : chaque création, modification, suppression ou restauration
 * faite par un utilisateur connecté est enregistrée dans la table logs
 * (qui, quand, sur quelle table, ancienne et nouvelle valeur, adresse IP).
 */
trait Journalise
{
    // Champs jamais recopiés dans le journal
    protected static array $champsIgnores = [
        'created_at', 'updated_at', 'remember_token', 'tentatives_echouees', 'bloque_jusqu_a',
    ];

    public static function bootJournalise(): void
    {
        static::created(fn (Model $m) => static::journaliser('création', $m, null, static::valeurs($m, $m->getAttributes())));

        static::updated(function (Model $m) {
            $changes = array_diff_key($m->getChanges(), array_flip(static::$champsIgnores));
            unset($changes['deleted_at']);
            if (!$changes) {
                return;
            }
            $avant = array_intersect_key($m->getOriginal(), $changes);
            static::journaliser('modification', $m, static::valeurs($m, $avant), static::valeurs($m, $changes));
        });

        static::deleted(fn (Model $m) => static::journaliser('suppression', $m, static::valeurs($m, $m->getAttributes()), null));

        if (method_exists(static::class, 'restored')) {
            static::restored(fn (Model $m) => static::journaliser('restauration', $m, null, static::valeurs($m, $m->getAttributes())));
        }
    }

    // Enregistrement direct d'une action (connexion, suspension, impression…)
    public static function journaliserAction(string $action, Model $m, ?int $userId = null, ?array $details = null): void
    {
        static::journaliser($action, $m, null, $details ?? ['id' => $m->getKey()], $userId);
    }

    protected static function valeurs(Model $m, array $attributs): array
    {
        $propre = array_diff_key($attributs, array_flip(static::$champsIgnores));
        unset($propre['deleted_at']);
        if (array_key_exists('password', $propre)) {
            $propre['password'] = '(modifié)';
        }
        return ['id' => $m->getKey()] + $propre;
    }

    protected static function journaliser(string $action, Model $m, ?array $avant, ?array $apres, ?int $userId = null): void
    {
        $userId = $userId ?? auth()->id();
        if (!$userId) {
            return; // pas d'utilisateur connecté (seeders, commandes) : rien à tracer
        }
        Log::create([
            'action'          => $action,
            'table_name'      => $m->getTable(),
            'ancienne_valeur' => $avant ? json_encode($avant, JSON_UNESCAPED_UNICODE) : null,
            'nouvelle_valeur' => $apres ? json_encode($apres, JSON_UNESCAPED_UNICODE) : null,
            'ip_adresse'      => request()?->ip(),
            'user_id'         => $userId,
        ]);
    }
}
