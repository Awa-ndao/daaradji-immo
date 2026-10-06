<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('achats', function (Blueprint $table) {
            $table->id();
            $table->string('vendeur_nom');
            $table->string('vendeur_telephone')->nullable();
            $table->decimal('prix_achat', 15, 2);
            $table->date('date_achat');
            $table->enum('statut', ['en_cours', 'finalise', 'annule'])->default('en_cours');
            $table->text('documents')->nullable();
            $table->foreignId('bien_id')->constrained('biens')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }
    public function down(): void { Schema::dropIfExists('achats'); }
};