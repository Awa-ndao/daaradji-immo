<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('demarches_administratives', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['titre_foncier', 'permis_construire', 'mutation', 'autre']);
            $table->text('description')->nullable();
            $table->enum('statut', ['en_cours', 'termine', 'annule'])->default('en_cours');
            $table->date('date_debut');
            $table->date('date_fin')->nullable();
            $table->text('documents')->nullable();
            $table->foreignId('vente_id')->constrained('ventes')->cascadeOnDelete();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('demarches_administratives'); }
};