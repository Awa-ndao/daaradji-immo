<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Recherche en cours d'un client : le bien qu'il cherche quand l'agence ne l'a pas encore.
 * Quand un bien disponible correspond, le logiciel signale le client à rappeler.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->enum('recherche_operation', ['achat', 'location'])->nullable()->after('numero_piece');
            $table->enum('recherche_type', ['terrain', 'maison', 'villa', 'appartement', 'local_commercial'])->nullable()->after('recherche_operation');
            $table->string('recherche_quartier')->nullable()->after('recherche_type');
            $table->decimal('recherche_budget_max', 15, 2)->nullable()->after('recherche_quartier');
            $table->float('recherche_superficie_min')->nullable()->after('recherche_budget_max');
            $table->string('recherche_note', 500)->nullable()->after('recherche_superficie_min');
            $table->date('recherche_depuis')->nullable()->after('recherche_note');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['recherche_operation', 'recherche_type', 'recherche_quartier', 'recherche_budget_max',
                'recherche_superficie_min', 'recherche_note', 'recherche_depuis']);
        });
    }
};
