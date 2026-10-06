<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('factures', function (Blueprint $table) {
            $table->id();
            $table->string('numero')->unique();
            $table->enum('type', ['loyer', 'vente', 'construction', 'caution']);
            $table->decimal('montant', 15, 2);
            $table->date('date_emission');
            $table->date('date_echeance')->nullable();
            $table->enum('statut', ['en_attente', 'payee', 'en_retard'])->default('en_attente');
            $table->string('fichier_pdf')->nullable();
            $table->foreignId('location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->foreignId('vente_id')->nullable()->constrained('ventes')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }
    public function down(): void { Schema::dropIfExists('factures'); }
};