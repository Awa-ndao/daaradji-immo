<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

/*
 | Dernier recours quand personne ne peut se connecter pour changer le mot de passe
 | (le propriétaire a oublié le sien). Se lance sur le serveur :
 |     php artisan daaradji:mot-de-passe adresse@daaradji.sn
 */
class ReinitialiserMotDePasse extends Command
{
    protected $signature = 'daaradji:mot-de-passe {email : Adresse e-mail du compte}';

    protected $description = 'Attribue un nouveau mot de passe à un compte et le débloque';

    public function handle(): int
    {
        $user = User::where('email', $this->argument('email'))->first();
        if (!$user) {
            $this->error('Aucun compte avec cette adresse e-mail.');
            return self::FAILURE;
        }

        $this->line("Compte : {$user->name} ({$user->role})");
        $mdp = (string) $this->secret('Nouveau mot de passe (8 caractères minimum)');
        if (mb_strlen($mdp) < 8) {
            $this->error('Le mot de passe doit contenir au moins 8 caractères.');
            return self::FAILURE;
        }
        if ($mdp !== (string) $this->secret('Confirmez le mot de passe')) {
            $this->error('Les deux mots de passe ne correspondent pas.');
            return self::FAILURE;
        }

        // Nouveau mot de passe, compteur d'échecs remis à zéro, blocage levé, compte réactivé
        $user->forceFill([
            'password'            => $mdp,
            'tentatives_echouees' => 0,
            'bloque_jusqu_a'      => null,
            'statut'              => 'actif',
        ])->save();

        $this->info('Mot de passe modifié. Le compte est actif : vous pouvez vous connecter.');
        return self::SUCCESS;
    }
}