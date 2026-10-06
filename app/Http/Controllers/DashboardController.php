<?php
namespace App\Http\Controllers;
use App\Models\Bien;
use App\Models\Client;
use App\Models\Vente;
use App\Models\Location;
use App\Models\Construction;
use App\Models\Facture;
use App\Models\RendezVous;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index()
    {
        return response()->json([
            'stats' => [
                'biens_disponibles' => Bien::where('statut', 'disponible')->count(),
                'ventes_ce_mois' => Vente::whereMonth('created_at', Carbon::now()->month)->count(),
                'locations_actives' => Location::where('statut', 'actif')->count(),
                'chantiers_en_cours' => Construction::where('statut', 'en_cours')->count(),
                'clients_total' => Client::count(),
                'factures_impayees' => Facture::where('statut', 'en_retard')->count(),
            ],
            'rdv_aujourd_hui' => RendezVous::with(['client', 'user'])
                ->whereDate('date_heure', Carbon::today())
                ->orderBy('date_heure')
                ->get(),
            'activites_recentes' => Vente::with(['client', 'bien'])
                ->latest()
                ->take(5)
                ->get(),
        ]);
    }
}