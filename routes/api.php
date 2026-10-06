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

// Routes publiques
Route::post('/login', [AuthController::class, 'login']);

// Routes protégées par JWT
Route::middleware('auth:api')->group(function () {

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/refresh', [AuthController::class, 'refresh']);

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Clients
    Route::get('/clients/search', [ClientController::class, 'search']);
    Route::apiResource('/clients', ClientController::class);

    // Biens
    Route::apiResource('/biens', BienController::class);

    // Mandats
    Route::apiResource('/mandats', MandatController::class);

    // Rendez-vous
    Route::apiResource('/rendez-vous', RendezVousController::class);

    // Locations
    Route::apiResource('/locations', LocationController::class);

    // Ventes
    Route::apiResource('/ventes', VenteController::class);

    // Constructions
    Route::apiResource('/constructions', ConstructionController::class);

    // Etapes Construction
    Route::apiResource('/etapes-construction', EtapeConstructionController::class);

    // Contrats
    Route::apiResource('/contrats', ContratController::class);

    // Factures
    Route::apiResource('/factures', FactureController::class);

    // Paiements
    Route::apiResource('/paiements', PaiementController::class);

    // Commissions
    Route::apiResource('/commissions', CommissionController::class);

    // Demarches Administratives
    Route::apiResource('/demarches-administratives', DemarcheAdministrativeController::class);

    // Achats
    Route::apiResource('/achats', AchatController::class);

    // Logs
    Route::apiResource('/logs', LogController::class);
});