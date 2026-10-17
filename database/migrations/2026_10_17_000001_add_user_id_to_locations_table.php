<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// L'agent qui suit la location (les ventes, chantiers, achats et rendez-vous l'ont déjà)
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('locations', 'user_id')) {
            Schema::table('locations', function (Blueprint $table) {
                $table->foreignId('user_id')->nullable()->after('bien_id')
                    ->constrained('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('locations', 'user_id')) {
            Schema::table('locations', function (Blueprint $table) {
                $table->dropConstrainedForeignId('user_id');
            });
        }
    }
};
