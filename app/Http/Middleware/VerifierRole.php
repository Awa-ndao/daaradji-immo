<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Laisse passer seulement les rôles indiqués sur la route.
 * Exemple : ->middleware('acces:proprietaire,administrateur')
 * Le rôle est lu dans la colonne users.role.
 */
class VerifierRole
{
    private const LIBELLES = [
        'proprietaire'   => 'propriétaire',
        'administrateur' => 'administrateur',
        'agent'          => 'agent immobilier',
        'comptable'      => 'comptable',
        'receptionniste' => 'réceptionniste',
    ];

    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Non authentifié'], 401);
        }

        if (($user->statut ?? 'actif') === 'inactif') {
            return response()->json(['message' => 'Ce compte est désactivé.'], 403);
        }

        if (!in_array($user->role, $roles, true)) {
            $role = self::LIBELLES[$user->role] ?? $user->role;
            return response()->json([
                'message' => "Accès refusé : le rôle « $role » ne donne pas accès à cette partie de l'application."
            ], 403);
        }

        return $next($request);
    }
}
