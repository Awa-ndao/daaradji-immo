<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\BienController;
use App\Http\Controllers\MandatController;
use App\Http\Controllers\RendezVousController;
use App\Http\Controllers\SalaireController;
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
use App\Http\Controllers\UserController;
use App\Http\Controllers\ProprietaireTiersController;
use App\Http\Controllers\CorbeilleController;
use App\Http\Controllers\ImpressionController;

/*
| Accès par rôle
|   proprietaire   : tout
|   administrateur : tout ; gère les comptes des employés, pas ceux de la direction
|   agent          : biens, clients, propriétaires tiers, mandats, ventes, locations, constructions,
|                    achats, rendez-vous, contrats, démarches
|                    (il ne voit que SES dossiers : voir le trait PorteeAgent)
|   comptable      : factures, paiements, commissions, salaires (+ lecture des opérations pour les relier)
|   direction      : en plus, journal d'activité, corbeille (vider : propriétaire seulement)
|   receptionniste : clients, rendez-vous
|   tableau de bord : tout le monde
*/

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:api')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/refresh', [AuthController::class, 'refresh']);

    // Tout le monde
    Route::middleware('acces:proprietaire,administrateur,agent,comptable,receptionniste')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'index']);
        // Noms des agents actifs (pour choisir ou filtrer l'agent d'un dossier)
        Route::get('/agents', [UserController::class, 'agents']);
        // Consultation des biens et des clients (nécessaire aux listes des formulaires)
        Route::get('/clients/search', [ClientController::class, 'search']);
        Route::apiResource('/clients', ClientController::class)->only(['index', 'show']);
        Route::apiResource('/biens', BienController::class)->only(['index', 'show']);
    });

    // Clients (création, modification) et rendez-vous : direction, agents, réception
    Route::middleware('acces:proprietaire,administrateur,agent,receptionniste')->group(function () {
        Route::apiResource('/clients', ClientController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('/rendez-vous', RendezVousController::class)
            ->parameters(['rendez-vous' => 'rendezVous']);
    });

    // Opérations immobilières : consultation aussi pour la comptabilité (factures à relier)
    Route::middleware('acces:proprietaire,administrateur,agent,comptable')->group(function () {
        Route::apiResource('/locations', LocationController::class)->only(['index', 'show']);
        Route::apiResource('/ventes', VenteController::class)->only(['index', 'show']);
        Route::apiResource('/constructions', ConstructionController::class)->only(['index', 'show']);
        Route::get('/etapes-construction', [EtapeConstructionController::class, 'index']);
    });

    // Opérations immobilières : création et modification par la direction et les agents
    Route::middleware('acces:proprietaire,administrateur,agent')->group(function () {
        Route::apiResource('/biens', BienController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('/locations', LocationController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('/ventes', VenteController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('/constructions', ConstructionController::class)->only(['store', 'update', 'destroy']);
        Route::get('/etapes-construction/{id}', [EtapeConstructionController::class, 'show']);
        Route::match(['put', 'patch'], '/etapes-construction/{id}', [EtapeConstructionController::class, 'update']);
        Route::apiResource('/achats', AchatController::class);
        Route::apiResource('/contrats', ContratController::class);
        Route::get('/impression/contrat/{id}', [ImpressionController::class, 'contrat']);
        Route::apiResource('/proprietaires-tiers', ProprietaireTiersController::class)
            ->parameters(['proprietaires-tiers' => 'proprietaire']);
        Route::apiResource('/mandats', MandatController::class);
        Route::apiResource('/demarches-administratives', DemarcheAdministrativeController::class)
            ->parameters(['demarches-administratives' => 'demarcheAdministrative']);
    });

    // Comptabilité
    Route::middleware('acces:proprietaire,administrateur,comptable')->group(function () {
        Route::apiResource('/factures', FactureController::class);
        Route::apiResource('/paiements', PaiementController::class);
        Route::apiResource('/commissions', CommissionController::class)->only(['index', 'show', 'update']);
        Route::get('/impression/facture/{id}', [ImpressionController::class, 'facture']);
        Route::get('/impression/recu/{id}', [ImpressionController::class, 'recu']);
        // Salaires des employés
        Route::get('/salaires', [SalaireController::class, 'index']);
        Route::post('/salaires/preparer', [SalaireController::class, 'preparer']);
        Route::put('/salaires/{salaire}', [SalaireController::class, 'update']);
        Route::post('/salaires/{salaire}/payer', [SalaireController::class, 'payer']);
        Route::delete('/salaires/{salaire}', [SalaireController::class, 'destroy']);
        Route::get('/impression/bulletin/{id}', [ImpressionController::class, 'bulletin']);
    });

    // Journal d'activité et comptes
    Route::middleware('acces:proprietaire,administrateur')->group(function () {
        Route::apiResource('/logs', LogController::class)->only(['index', 'show']);
        Route::get('/corbeille', [CorbeilleController::class, 'index']);
        Route::post('/corbeille/{type}/{id}/restaurer', [CorbeilleController::class, 'restaurer']);
        // Gestion des comptes : le propriétaire, et l'administrateur pour les employés
        // (les limites de l'administrateur sont vérifiées dans UserController)
        Route::apiResource('/utilisateurs', UserController::class)
            ->parameters(['utilisateurs' => 'user']);
    });

    // Suppression définitive : propriétaire uniquement
    Route::middleware('acces:proprietaire')->group(function () {
        Route::delete('/corbeille/{type}/{id}', [CorbeilleController::class, 'supprimer']);
        Route::delete('/corbeille', [CorbeilleController::class, 'vider']);
    });
});
