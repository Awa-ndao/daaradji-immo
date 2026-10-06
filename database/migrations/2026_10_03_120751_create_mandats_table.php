<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('mandats', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['vente', 'location', 'gestion']);
            $table->date('date_debut');
            $table->date('date_fin')->nullable();
            $table->float('taux_commission')->default(5);
            $table->enum('statut', ['actif', 'expire', 'resilie'])->default('actif');
            $table->text('conditions')->nullable();
            $table->foreignId('bien_id')->constrained('biens')->cascadeOnDelete();
            $table->foreignId('proprietaire_tiers_id')->constrained('proprietaires_tiers')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }
    public function down(): void { Schema::dropIfExists('mandats'); }
};