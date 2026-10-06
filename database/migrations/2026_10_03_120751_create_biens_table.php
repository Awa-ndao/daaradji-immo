<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('biens', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->enum('type', ['terrain', 'maison', 'villa', 'appartement', 'local_commercial']);
            $table->string('localisation');
            $table->float('superficie')->nullable();
            $table->decimal('prix', 15, 2);
            $table->enum('statut', ['disponible', 'loue', 'vendu', 'en_construction'])->default('disponible');
            $table->enum('type_propriete', ['propre', 'confie'])->default('propre');
            $table->text('description')->nullable();
            $table->foreignId('proprietaire_tiers_id')->nullable()->constrained('proprietaires_tiers')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }
    public function down(): void { Schema::dropIfExists('biens'); }
};