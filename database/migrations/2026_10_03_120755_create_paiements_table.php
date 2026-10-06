<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('paiements', function (Blueprint $table) {
            $table->id();
            $table->decimal('montant', 15, 2);
            $table->date('date_paiement');
            $table->enum('mode_paiement', ['especes', 'virement', 'cheque', 'wave', 'orange_money']);
            $table->string('reference')->nullable();
            $table->enum('statut', ['paye', 'en_attente', 'annule'])->default('paye');
            $table->string('recu')->nullable();
            $table->foreignId('facture_id')->constrained('factures')->cascadeOnDelete();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('paiements'); }
};