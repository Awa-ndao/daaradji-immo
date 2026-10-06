<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('ventes', function (Blueprint $table) {
            $table->id();
            $table->decimal('prix_vente', 15, 2);
            $table->date('date_vente');
            $table->enum('mode_paiement', ['especes', 'virement', 'cheque', 'mobile_money'])->default('especes');
            $table->enum('statut', ['en_cours', 'finalise', 'annule'])->default('en_cours');
            $table->decimal('commission_agence', 15, 2)->default(0);
            $table->decimal('montant_reverse', 15, 2)->default(0);
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->foreignId('bien_id')->constrained('biens')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }
    public function down(): void { Schema::dropIfExists('ventes'); }
};