<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('etapes_construction', function (Blueprint $table) {
            $table->id();
            $table->integer('numero');
            $table->enum('nom', ['fondement', 'elevation', 'finition']);
            $table->decimal('montant_versement', 15, 2)->default(0);
            $table->date('date_versement')->nullable();
            $table->enum('statut', ['en_attente', 'en_cours', 'termine'])->default('en_attente');
            $table->text('photos')->nullable();
            $table->date('date_validation')->nullable();
            $table->foreignId('construction_id')->constrained('constructions')->cascadeOnDelete();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('etapes_construction'); }
};