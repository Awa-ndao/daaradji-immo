<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('commissions', function (Blueprint $table) {
            $table->id();
            $table->decimal('montant', 15, 2);
            $table->float('taux')->default(5);
            $table->enum('type_transaction', ['vente', 'location', 'construction']);
            $table->date('date_paiement')->nullable();
            $table->enum('statut', ['en_attente', 'payee'])->default('en_attente');
            $table->foreignId('vente_id')->nullable()->constrained('ventes')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('commissions'); }
};