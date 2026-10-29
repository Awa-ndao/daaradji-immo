<?php

namespace App\Http\Controllers;

use App\Models\Salaire;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Salaires des employés (comptable et direction).
 * - « Préparer le mois » crée une ligne par employé actif, à partir de son salaire de base ;
 * - la comptable ajuste la prime ou la retenue, puis enregistre le versement ;
 * - un salaire payé ne se modifie plus et ne se supprime pas.
 * Le propriétaire n'est pas salarié : il n'a pas de ligne.
 */
class SalaireController extends Controller
{
    private const MODES = 'especes,virement,cheque,wave,orange_money';
    private const FORMAT_MOIS = 'regex:/^\d{4}-(0[1-9]|1[0-2])$/';

    public function index(Request $request)
    {
        $request->validate(['mois' => ['nullable', self::FORMAT_MOIS]], ['mois.regex' => 'Mois invalide.']);
        $mois = $request->mois ?: now()->format('Y-m');

        $query = Salaire::with('user:id,name,role,statut')->where('mois', $mois);
        if ($request->statut) {
            $query->where('statut', $request->statut);
        }
        if ($request->q) {
            $query->whereHas('user', fn ($q) => $q->where('name', 'like', '%' . $request->q . '%'));
        }
        $lignes = $query->get()->sortBy(fn ($s) => mb_strtolower($s->user?->name ?? ''))->values();

        $tous = Salaire::where('mois', $mois)->get();
        $totaux = [
            'masse'    => round($tous->sum('net'), 2),
            'paye'     => round($tous->where('statut', 'paye')->sum('net'), 2),
            'nb'       => $tous->count(),
            'nb_payes' => $tous->where('statut', 'paye')->count(),
        ];
        $totaux['reste'] = round($totaux['masse'] - $totaux['paye'], 2);

        return response()->json([
            'mois'               => $mois,
            'data'               => $lignes,
            'totaux'             => $totaux,
            'employes_a_ajouter' => $this->employesSansLigne($mois)->count(),
        ]);
    }

    // Crée les lignes manquantes du mois pour tous les employés actifs
    public function preparer(Request $request)
    {
        $data = $request->validate(['mois' => ['required', self::FORMAT_MOIS]],
            ['mois.required' => 'Choisissez le mois.', 'mois.regex' => 'Mois invalide.']);

        $crees = 0;
        $sansSalaire = 0;
        foreach ($this->employesSansLigne($data['mois'])->get() as $employe) {
            $base = (float) ($employe->salaire_base ?? 0);
            Salaire::create([
                'user_id'      => $employe->id,
                'mois'         => $data['mois'],
                'salaire_base' => $base,
                'net'          => $base,
                'statut'       => 'en_attente',
            ]);
            $crees++;
            if ($base <= 0) $sansSalaire++;
        }

        $message = $crees === 0
            ? 'Les salaires de ce mois sont déjà tous préparés.'
            : $crees . ' salaire' . ($crees > 1 ? 's préparés' : ' préparé') . '.'
              . ($sansSalaire ? ' ' . $sansSalaire . ' employé(s) sans salaire de base : complétez le montant avant de payer.' : '');

        return response()->json(['message' => $message, 'crees' => $crees, 'sans_salaire' => $sansSalaire]);
    }

    // Ajustement avant paiement : salaire de base du mois, prime, retenue, note
    public function update(Request $request, Salaire $salaire)
    {
        if ($salaire->statut === 'paye') {
            return response()->json(['message' => 'Ce salaire est déjà payé : il ne peut plus être modifié.'], 422);
        }
        $data = $request->validate([
            'salaire_base' => 'required|numeric|min:0',
            'prime'        => 'nullable|numeric|min:0',
            'retenue'      => 'nullable|numeric|min:0',
            'note'         => 'nullable|string|max:500',
        ], [
            'salaire_base.required' => 'Le salaire de base est obligatoire.',
            '*.min'                 => 'Les montants ne peuvent pas être négatifs.',
        ]);
        $data['prime'] = (float) ($data['prime'] ?? 0);
        $data['retenue'] = (float) ($data['retenue'] ?? 0);
        $data['net'] = Salaire::calculerNet((float) $data['salaire_base'], $data['prime'], $data['retenue']);
        if ($data['net'] < 0) {
            return response()->json(['message' => 'La retenue ne peut pas dépasser le salaire de base et la prime.'], 422);
        }
        $salaire->update($data);
        return response()->json($salaire->load('user:id,name,role,statut'));
    }

    // Enregistrement du versement
    public function payer(Request $request, Salaire $salaire)
    {
        if ($salaire->statut === 'paye') {
            return response()->json(['message' => 'Ce salaire est déjà payé.'], 422);
        }
        if ($salaire->net <= 0) {
            return response()->json(['message' => 'Le salaire net est de 0 FCFA : renseignez d\'abord le salaire de base.'], 422);
        }
        $data = $request->validate([
            'date_paiement' => 'required|date',
            'mode_paiement' => 'required|in:' . self::MODES,
            'reference'     => 'nullable|string|max:100',
        ], [
            'date_paiement.required' => 'La date du versement est obligatoire.',
            'mode_paiement.required' => 'Choisissez le mode de paiement.',
        ]);
        $data['statut'] = 'paye';
        $data['numero'] = 'BUL-' . str_replace('-', '', $salaire->mois) . '-' . str_pad((string) $salaire->id, 4, '0', STR_PAD_LEFT);
        $salaire->update($data);
        return response()->json($salaire->load('user:id,name,role,statut'));
    }

    public function destroy(Salaire $salaire)
    {
        if ($salaire->statut === 'paye') {
            return response()->json(['message' => 'Un salaire déjà payé ne peut pas être supprimé.'], 422);
        }
        $salaire->delete();
        return response()->json(['message' => 'Salaire supprimé (récupérable dans la corbeille).']);
    }

    // Employés actifs (hors propriétaire) qui n'ont pas encore de ligne pour ce mois
    private function employesSansLigne(string $mois)
    {
        return User::where('statut', 'actif')
            ->where('role', '!=', 'proprietaire')
            ->whereNotIn('id', Salaire::where('mois', $mois)->pluck('user_id'))
            ->orderBy('name');
    }
}
