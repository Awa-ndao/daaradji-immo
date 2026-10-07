<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\BienController;
use App\Http\Controllers\MandatController;
use App\Http\Controllers\RendezVousController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\VenteController;
use App\Http\Controllers\ConstructionController;
use App\Http\Controllers\EtapeConstructionController;
use App\Http\Controllers\ContratController;
use App\Http\Controllers\FactureController;
use App\Http\Controllers\PaiementController;
use App\Http\Controllers\CommissionController;
use App\Http\Controllers\DemarcheAdministrativeController;
use App\Http\Controllers\AchatController;
use App\Http\Controllers\LogController;
use App\Http\Controllers\DashboardController;

// Route publique
Route::post('/login', [AuthController::class, 'login']);

// Routes protégées
Route::middleware('auth:api')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/refresh', [AuthController::class, 'refresh']);
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/clients/search', [ClientController::class, 'search']);
    Route::apiResource('/clients', ClientController::class);
    Route::apiResource('/biens', BienController::class);
    Route::apiResource('/mandats', MandatController::class);
    Route::apiResource('/rendez-vous', RendezVousController::class);
    Route::apiResource('/locations', LocationController::class);
    Route::apiResource('/ventes', VenteController::class);
    Route::apiResource('/constructions', ConstructionController::class);
    Route::apiResource('/etapes-construction', EtapeConstructionController::class);
    Route::apiResource('/contrats', ContratController::class);
    Route::apiResource('/factures', FactureController::class);
    Route::apiResource('/paiements', PaiementController::class);
    Route::apiResource('/commissions', CommissionController::class);
    Route::apiResource('/demarches-administratives', DemarcheAdministrativeController::class);
    Route::apiResource('/achats', AchatController::class);
    Route::apiResource('/logs', LogController::class);
});