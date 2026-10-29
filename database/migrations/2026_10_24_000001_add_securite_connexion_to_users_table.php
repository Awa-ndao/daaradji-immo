<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Sécurité de connexion : compteur d'échecs et blocage temporaire (propriétaire)
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedTinyInteger('tentatives_echouees')->default(0)->after('statut');
            $table->timestamp('bloque_jusqu_a')->nullable()->after('tentatives_echouees');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['tentatives_echouees', 'bloque_jusqu_a']);
        });
    }
};
