<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Une facture de construction est liée à un chantier et à une étape du chantier
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('factures', function (Blueprint $table) {
            if (!Schema::hasColumn('factures', 'construction_id')) {
                $table->unsignedBigInteger('construction_id')->nullable()->after('vente_id');
                $table->index('construction_id');
            }
            if (!Schema::hasColumn('factures', 'etape_construction_id')) {
                $table->unsignedBigInteger('etape_construction_id')->nullable()->after('construction_id');
                $table->index('etape_construction_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('factures', function (Blueprint $table) {
            if (Schema::hasColumn('factures', 'etape_construction_id')) {
                $table->dropIndex(['etape_construction_id']);
                $table->dropColumn('etape_construction_id');
            }
            if (Schema::hasColumn('factures', 'construction_id')) {
                $table->dropIndex(['construction_id']);
                $table->dropColumn('construction_id');
            }
        });
    }
};