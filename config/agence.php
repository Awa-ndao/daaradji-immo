<?php

// Coordonnées de l'agence imprimées en tête des factures, reçus et contrats (à compléter dans .env)
return [
    'nom'       => env('AGENCE_NOM', 'DAARADJI IMMO'),
    'adresse'   => env('AGENCE_ADRESSE', ''),
    'telephone' => env('AGENCE_TELEPHONE', ''),
    'email'     => env('AGENCE_EMAIL', ''),
    'ninea'     => env('AGENCE_NINEA', ''),
    'ville'     => env('AGENCE_VILLE', 'Mbour'),
];
