<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('constructions', function (Blueprint $table) {
            $table->id();
            $table->integer('niveaux')->default(1);
            $table->float('superficie')->nullable();
            $table->decimal('montant_total', 15, 2);
            $table->date('date_debut');
            $table->date('date_livraison')->nullable();
            $table->enum('statut', ['en_cours', 'livre', 'annule'])->default('en_cours');
            $table->boolean('pv_remise_cles')->default(false);
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->foreignId('bien_id')->constrained('biens')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }
    public function down(): void { Schema::dropIfExists('constructions'); }
};