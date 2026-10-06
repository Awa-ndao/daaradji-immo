<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('contrats', function (Blueprint $table) {
            $table->id();
            $table->string('numero')->unique();
            $table->enum('type', ['location', 'vente', 'construction']);
            $table->date('date_creation');
            $table->date('date_signature')->nullable();
            $table->string('fichier_pdf')->nullable();
            $table->enum('statut', ['en_attente', 'signe', 'resilie'])->default('en_attente');
            $table->foreignId('location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->foreignId('vente_id')->nullable()->constrained('ventes')->nullOnDelete();
            $table->foreignId('construction_id')->nullable()->constrained('constructions')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }
    public function down(): void { Schema::dropIfExists('contrats'); }
};