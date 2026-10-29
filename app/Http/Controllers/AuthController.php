<?php
namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthController extends Controller
{
    // Nombre d'échecs de connexion consécutifs autorisés
    private const MAX_TENTATIVES = 5;
    // Le propriétaire n'est jamais suspendu (personne ne pourrait le réactiver) : blocage temporaire
    private const BLOCAGE_PROPRIETAIRE_MINUTES = 15;

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $credentials = $request->only('email', 'password');
        $user = User::where('email', $request->email)->first();

        // Compte temporairement bloqué (propriétaire après 5 échecs)
        if ($user && $user->bloque_jusqu_a && now()->lt($user->bloque_jusqu_a)) {
            $minutes = (int) ceil(now()->diffInSeconds($user->bloque_jusqu_a) / 60);
            return response()->json([
                'message' => "Trop de tentatives. Réessayez dans {$minutes} minute" . ($minutes > 1 ? 's' : '') . '.'
            ], 429);
        }

        // Compte suspendu : refusé, même avec le bon mot de passe
        if ($user && $user->statut === 'inactif') {
            return response()->json(['message' => 'Compte suspendu. Contactez l\'administrateur.'], 403);
        }

        if (!$token = JWTAuth::attempt($credentials)) {
            return $this->echec($user);
        }

        // Connexion réussie : compteur remis à zéro
        $user = auth()->user();
        $user->forceFill(['tentatives_echouees' => 0, 'bloque_jusqu_a' => null])->saveQuietly();
        User::journaliserAction('connexion', $user, $user->id, ['id' => $user->id, 'email' => $user->email]);

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ]
        ]);
    }

    private function echec(?User $user)
    {
        if (!$user) {
            return response()->json(['message' => 'Email ou mot de passe incorrect.'], 401);
        }

        $echecs = $user->tentatives_echouees + 1;

        if ($echecs < self::MAX_TENTATIVES) {
            $user->forceFill(['tentatives_echouees' => $echecs])->saveQuietly();
            $reste = self::MAX_TENTATIVES - $echecs;
            return response()->json([
                'message' => "Email ou mot de passe incorrect. Il vous reste {$reste} tentative" . ($reste > 1 ? 's' : '') . '.'
            ], 401);
        }

        // 5e échec
        if ($user->role === 'proprietaire') {
            $user->forceFill([
                'tentatives_echouees' => 0,
                'bloque_jusqu_a'      => now()->addMinutes(self::BLOCAGE_PROPRIETAIRE_MINUTES),
            ])->saveQuietly();
            User::journaliserAction('blocage temporaire', $user, $user->id, ['id' => $user->id, 'email' => $user->email]);
            return response()->json([
                'message' => 'Trop de tentatives. Réessayez dans ' . self::BLOCAGE_PROPRIETAIRE_MINUTES . ' minutes.'
            ], 429);
        }

        $user->forceFill(['tentatives_echouees' => 0, 'statut' => 'inactif'])->saveQuietly();
        User::journaliserAction('suspension', $user, $user->id,
            ['id' => $user->id, 'email' => $user->email, 'motif' => '5 tentatives de connexion échouées']);
        return response()->json(['message' => 'Compte suspendu. Contactez l\'administrateur.'], 403);
    }

    public function logout()
    {
        JWTAuth::invalidate(JWTAuth::getToken());
        return response()->json(['message' => 'Déconnexion réussie']);
    }

    public function me()
    {
        return response()->json(auth()->user());
    }

    public function refresh()
    {
        return response()->json([
            'token' => JWTAuth::refresh(JWTAuth::getToken())
        ]);
    }
}
