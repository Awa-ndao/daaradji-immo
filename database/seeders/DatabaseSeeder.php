<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $roles = ['proprietaire', 'administrateur', 'agent', 'comptable', 'receptionniste'];
        foreach ($roles as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'api']);
        }

        $proprietaire = User::firstOrCreate(
            ['email' => 'proprietaire@daaradji.sn'],
            ['name' => 'Moustapha NDAO', 'password' => Hash::make('Daaradji@2025'), 'role' => 'proprietaire', 'statut' => 'actif']
        );
        $proprietaire->assignRole('proprietaire');

        $admin = User::firstOrCreate(
            ['email' => 'admin@daaradji.sn'],
            ['name' => 'Aminata Diallo', 'password' => Hash::make('Admin@2025'), 'role' => 'administrateur', 'statut' => 'actif']
        );
        $admin->assignRole('administrateur');

        $agent = User::firstOrCreate(
            ['email' => 'agent@daaradji.sn'],
            ['name' => 'Moussa Sarr', 'password' => Hash::make('Agent@2025'), 'role' => 'agent', 'statut' => 'actif']
        );
        $agent->assignRole('agent');

        $comptable = User::firstOrCreate(
            ['email' => 'comptable@daaradji.sn'],
            ['name' => 'Ibrahim Ndiaye', 'password' => Hash::make('Comptable@2025'), 'role' => 'comptable', 'statut' => 'actif']
        );
        $comptable->assignRole('comptable');

        $receptionniste = User::firstOrCreate(
            ['email' => 'reception@daaradji.sn'],
            ['name' => 'Aida Fall', 'password' => Hash::make('Reception@2025'), 'role' => 'receptionniste', 'statut' => 'actif']
        );
        $receptionniste->assignRole('receptionniste');

        $this->command->info('Utilisateurs crees avec succes !');
    }
}