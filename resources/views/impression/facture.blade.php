@extends('impression.base')
@section('contenu')
@use('App\Support\Montant')
<div class="titre"><h1>Facture</h1><span class="num">N° {{ $facture->numero }}</span></div>
<div class="meta">
  Date de création : {{ \Carbon\Carbon::parse($facture->date_emission)->format('d/m/Y') }}
  @if ($facture->date_echeance) — Date limite de paiement : <b>{{ \Carbon\Carbon::parse($facture->date_echeance)->format('d/m/Y') }}</b> @endif
  — <span class="statut {{ $facture->statut === 'payee' ? 'ok' : ($facture->statut === 'en_retard' ? 'retard' : 'attente') }}">
    {{ ['payee' => 'Payée', 'en_retard' => 'En retard', 'en_attente' => 'En attente'][$facture->statut] ?? $facture->statut }}</span>
</div>
<div class="blocs">
  <div class="bloc"><h3>Client</h3>
    @if ($client) <b>{{ $client->prenom }} {{ $client->nom }}</b><br>{{ $client->telephone }}
      @if ($client->adresse)<br>{{ $client->adresse }}@endif
    @else — @endif
  </div>
  <div class="bloc"><h3>Bien concerné</h3>
    @if ($bien) <b>{{ ucfirst(str_replace('_', ' ', $bien->type)) }} — {{ $bien->localisation }}</b><br>Réf. {{ $bien->reference }} @else — @endif
  </div>
</div>
<table>
  <thead><tr><th>Désignation</th><th class="num-col">Montant</th></tr></thead>
  <tbody><tr><td>{{ $designation }}</td><td class="num-col">{{ Montant::fcfa($facture->montant) }}</td></tr></tbody>
</table>
<table class="totaux">
  <tr><td>Total facturé</td><td class="num-col">{{ Montant::fcfa($facture->montant) }}</td></tr>
  <tr><td>Déjà payé</td><td class="num-col">{{ Montant::fcfa($paye) }}</td></tr>
  <tr class="total"><td>Reste à payer</td><td class="num-col">{{ Montant::fcfa(max(0, $facture->montant - $paye)) }}</td></tr>
</table>
<div class="lettres">Arrêtée la présente facture à la somme de <b>{{ Montant::enLettres($facture->montant) }}</b>.</div>
@if ($facture->paiements->where('statut', 'paye')->count())
  <h2>Paiements reçus</h2>
  <table>
    <thead><tr><th>Date</th><th>Mode</th><th>Référence</th><th class="num-col">Montant</th></tr></thead>
    <tbody>
    @foreach ($facture->paiements->where('statut', 'paye') as $p)
      <tr><td>{{ \Carbon\Carbon::parse($p->date_paiement)->format('d/m/Y') }}</td>
          <td>{{ $modes[$p->mode_paiement] ?? $p->mode_paiement }}</td><td>{{ $p->reference ?: '—' }}</td>
          <td class="num-col">{{ Montant::fcfa($p->montant) }}</td></tr>
    @endforeach
    </tbody>
  </table>
@endif
<div class="signatures"><div></div><div><div class="ligne">Cachet et signature de l'agence</div></div></div>
@endsection
