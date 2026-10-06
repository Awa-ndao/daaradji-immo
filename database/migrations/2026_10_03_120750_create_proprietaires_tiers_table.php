<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('proprietaires_tiers', function (Blueprint $table) {
            $table->id();
            $table->string('nom');
            $table->string('prenom');
            $table->string('telephone');
            $table->text('adresse')->nullable();
            $table->string('piece_identite')->nullable();
            $table->enum('mode_reversement', ['virement', 'mobile_money', 'especes'])->default('especes');
            $table->string('numero_compte')->nullable();
            $table->string('numero_mobile_money')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }
    public function down(): void { Schema::dropIfExists('proprietaires_tiers'); }
};