<?php
namespace App\Http\Controllers;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private const ROLES = 'proprietaire,administrateur,agent,comptable,receptionniste';

    // Comptes que l'administrateur (second du propriétaire) peut gérer
    private const ROLES_GERES_PAR_ADMIN = ['agent', 'comptable', 'receptionniste'];

    private function estAdministrateur(Request $request): bool
    {
        return $request->user()?->role === 'administrateur';
    }

    // L'administrateur ne touche pas aux comptes de direction (propriétaire, administrateur)
    private function refusPourAdmin(Request $request, User $cible): ?\Illuminate\Http\JsonResponse
    {
        if ($this->estAdministrateur($request) && !in_array($cible->role, self::ROLES_GERES_PAR_ADMIN, true)) {
            return response()->json([
                'message' => 'Seul le propriétaire peut modifier les comptes de direction.'
            ], 403);
        }
        return null;
    }

    public function index(Request $request)
    {
        $query = User::query();
        if ($request->role) $query->where('role', $request->role);
        if ($request->q) {
            // Entre parenthèses, sinon le « ou » annule le filtre par rôle
            $query->where(function ($w) use ($request) {
                $w->where('name', 'like', '%' . $request->q . '%')
                  ->orWhere('email', 'like', '%' . $request->q . '%');
            });
        }
        if ($request->statut) $query->where('statut', $request->statut);
        $parPage = min((int) ($request->per_page ?: 10), 100);
        $page = $query->latest()->paginate($parPage);
        $page->getCollection()->each->makeVisible('salaire_base');
        return response()->json($page);
    }

    // Personnes qui peuvent suivre un dossier (agents, administrateurs, propriétaires actifs)
    // Liste courte : id, nom et rôle, sans autre information
    public function agents()
    {
        return response()->json(
            User::whereIn('role', ['agent', 'administrateur', 'proprietaire'])
                ->where('statut', 'actif')
                ->orderByRaw("CASE role WHEN 'agent' THEN 0 WHEN 'administrateur' THEN 1 ELSE 2 END")
                ->orderBy('name')
                ->get(['id', 'name', 'role'])
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|min:8',
            'role'     => 'required|in:' . self::ROLES,
            'salaire_base' => 'nullable|numeric|min:0',
        ], $this->messages());

        if ($this->estAdministrateur($request) && !in_array($request->role, self::ROLES_GERES_PAR_ADMIN, true)) {
            return response()->json([
                'message' => 'Seul le propriétaire peut créer un compte propriétaire ou administrateur.'
            ], 403);
        }

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            'role'     => $request->role,
            'statut'   => 'actif',
            'salaire_base' => $request->filled('salaire_base') ? $request->salaire_base : null,
        ]);

        return response()->json($user->makeVisible('salaire_base'), 201);
    }

    public function show(User $user)
    {
        return response()->json($user->makeVisible('salaire_base'));
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name'     => 'sometimes|required|string|max:255',
            'email'    => ['sometimes', 'required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => 'nullable|min:8',
            'role'     => 'sometimes|required|in:' . self::ROLES,
            'statut'   => 'sometimes|required|in:actif,inactif',
            'salaire_base' => 'nullable|numeric|min:0',
        ], $this->messages());
        if (array_key_exists('salaire_base', $data) && $data['salaire_base'] === '') $data['salaire_base'] = null;

        $moi = $request->user();
        $soiMeme = $moi && $moi->id === $user->id;

        if ($this->estAdministrateur($request)) {
            if ($soiMeme) {
                // Son propre compte : nom, e-mail et mot de passe seulement
                if ((isset($data['role']) && $data['role'] !== $user->role) || isset($data['statut']) && $data['statut'] !== $user->statut) {
                    return response()->json(['message' => 'Vous ne pouvez pas changer votre propre rôle ni votre statut.'], 403);
                }
                if (array_key_exists('salaire_base', $data) && (float) $data['salaire_base'] !== (float) $user->salaire_base) {
                    return response()->json(['message' => 'Votre salaire est fixé par le propriétaire.'], 403);
                }
            } else {
                if ($refus = $this->refusPourAdmin($request, $user)) return $refus;
                if (isset($data['role']) && !in_array($data['role'], self::ROLES_GERES_PAR_ADMIN, true)) {
                    return response()->json(['message' => 'Seul le propriétaire peut donner un rôle de direction.'], 403);
                }
            }
        }

        // On ne se bloque pas soi-même
        if ($moi && $moi->id === $user->id && ($data['statut'] ?? 'actif') === 'inactif') {
            return response()->json(['message' => 'Vous ne pouvez pas désactiver votre propre compte.'], 422);
        }

        // L'agence garde toujours au moins un propriétaire actif
        $perdProprietaire = $user->role === 'proprietaire' && (
            (isset($data['role']) && $data['role'] !== 'proprietaire') ||
            (($data['statut'] ?? 'actif') === 'inactif')
        );
        if ($perdProprietaire && $this->dernierProprietaire($user)) {
            return response()->json(['message' => 'C\'est le seul propriétaire actif : il doit le rester.'], 422);
        }

        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']); // mot de passe inchangé
        }

        $user->update($data);

        // Compte réactivé ou mot de passe changé : le compteur d'échecs de connexion repart à zéro
        if (($data['statut'] ?? null) === 'actif' || !empty($data['password'])) {
            $user->forceFill(['tentatives_echouees' => 0, 'bloque_jusqu_a' => null])->saveQuietly();
        }

        // Compte désactivé : ses sessions ouvertes sont fermées
        if (($data['statut'] ?? null) === 'inactif' && method_exists($user, 'tokens')) {
            $user->tokens()->delete();
        }

        return response()->json($user->makeVisible('salaire_base'));
    }

    public function destroy(Request $request, User $user)
    {
        if ($refus = $this->refusPourAdmin($request, $user)) return $refus;
        if ($request->user() && $request->user()->id === $user->id) {
            return response()->json(['message' => 'Vous ne pouvez pas supprimer votre propre compte.'], 422);
        }
        if ($user->role === 'proprietaire' && $this->dernierProprietaire($user)) {
            return response()->json(['message' => 'C\'est le seul propriétaire actif : il ne peut pas être supprimé.'], 422);
        }
        // Supprimer le compte effacerait aussi ses dossiers (ventes, chantiers… liés à lui) : on refuse
        $dossiers = $user->ventes()->count() + $user->constructions()->count() + $user->achats()->count()
            + $user->rendezVous()->count() + \App\Models\Location::where('user_id', $user->id)->count()
            + $user->salaires()->withTrashed()->count();
        if ($dossiers > 0) {
            return response()->json([
                'message' => 'Ce compte a ' . $dossiers . ' dossier(s) ou salaire(s) enregistrés. Désactivez-le plutôt, ou réattribuez d\'abord ses dossiers à un autre agent.'
            ], 422);
        }
        if (method_exists($user, 'tokens')) {
            $user->tokens()->delete();
        }
        $user->delete();
        return response()->json(['message' => 'Utilisateur supprimé']);
    }

    private function dernierProprietaire(User $user): bool
    {
        return !User::where('role', 'proprietaire')
            ->where('statut', 'actif')
            ->where('id', '!=', $user->id)
            ->exists();
    }

    private function messages(): array
    {
        return [
            'name.required'     => 'Le nom est obligatoire.',
            'email.required'    => 'L\'e-mail est obligatoire.',
            'email.email'       => 'L\'adresse e-mail n\'est pas valide.',
            'email.unique'      => 'Cet e-mail est déjà utilisé par un autre compte.',
            'password.required' => 'Le mot de passe est obligatoire.',
            'password.min'      => 'Le mot de passe doit avoir au moins 8 caractères.',
            'role.required'     => 'Le rôle est obligatoire.',
            'salaire_base.numeric' => 'Le salaire doit être un montant.',
            'salaire_base.min'     => 'Le salaire ne peut pas être négatif.',
        ];
    }
}