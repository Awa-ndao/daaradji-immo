<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 | Nouvelle version :
 | - propriétaire tiers : particulier ou agence partenaire (commission partagée 50/50)
 | - commission : calculée à partir du mandat, pour une vente ou une location ; elle revient à l'agence
 | - démarche administrative : liée à une vente ou à une construction
 | - corbeille : paiements et démarches peuvent être restaurés
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('proprietaires_tiers', function (Blueprint $table) {
            $table->string('type')->default('particulier')->after('id'); // particulier | agence
        });
        // Une agence partenaire n'a pas de prénom
        Schema::table('proprietaires_tiers', function (Blueprint $table) {
            $table->string('prenom')->nullable()->change();
        });

        Schema::table('commissions', function (Blueprint $table) {
            $table->decimal('base', 15, 2)->default(0)->after('id');
            $table->decimal('part_agence', 15, 2)->default(0)->after('montant');
            $table->decimal('part_partenaire', 15, 2)->default(0)->after('part_agence');
            $table->foreignId('location_id')->nullable()->after('vente_id')
                  ->constrained('locations')->nullOnDelete();
        });
        // Les employés sont salariés : la commission n'est plus attribuée à un agent
        Schema::table('commissions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });

        Schema::table('demarches_administratives', function (Blueprint $table) {
            $table->foreignId('construction_id')->nullable()->after('vente_id')
                  ->constrained('constructions')->nullOnDelete();
            $table->softDeletes();
        });
        Schema::table('demarches_administratives', function (Blueprint $table) {
            $table->unsignedBigInteger('vente_id')->nullable()->change();
        });

        Schema::table('paiements', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
        Schema::table('demarches_administratives', function (Blueprint $table) {
            $table->dropConstrainedForeignId('construction_id');
            $table->dropSoftDeletes();
        });
        Schema::table('commissions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('location_id');
            $table->dropColumn(['base', 'part_agence', 'part_partenaire']);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
        });
        Schema::table('proprietaires_tiers', function (Blueprint $table) {
            $table->dropColumn('type');
        });
    }
};
