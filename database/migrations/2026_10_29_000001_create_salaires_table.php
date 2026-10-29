<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 | Salaires des employés : chaque employé a un salaire mensuel de base ;
 | chaque mois, la comptable prépare une ligne par employé (prime, retenue),
 | puis enregistre le versement et imprime le bulletin.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('salaire_base', 15, 2)->nullable()->after('statut');
        });

        Schema::create('salaires', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('mois', 7);                       // « 2026-10 »
            $table->decimal('salaire_base', 15, 2)->default(0);
            $table->decimal('prime', 15, 2)->default(0);
            $table->decimal('retenue', 15, 2)->default(0);
            $table->decimal('net', 15, 2)->default(0);       // base + prime − retenue
            $table->string('statut')->default('en_attente'); // en_attente | paye
            $table->string('numero')->nullable();            // n° du bulletin, donné au paiement
            $table->date('date_paiement')->nullable();
            $table->string('mode_paiement')->nullable();
            $table->string('reference')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['mois', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salaires');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('salaire_base');
        });
    }
};
