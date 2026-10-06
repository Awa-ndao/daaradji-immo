<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->date('date_debut');
            $table->date('date_fin')->nullable();
            $table->decimal('loyer_mensuel', 15, 2);
            $table->decimal('caution', 15, 2)->default(0);
            $table->enum('statut', ['actif', 'resilie', 'expire'])->default('actif');
            $table->date('date_renouvellement')->nullable();
            $table->text('motif_resiliation')->nullable();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->foreignId('bien_id')->constrained('biens')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }
    public function down(): void { Schema::dropIfExists('locations'); }
};