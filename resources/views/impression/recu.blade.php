@extends('impression.base')
@section('contenu')
@use('App\Support\Montant')
<div class="titre"><h1>Reçu de paiement</h1><span class="num">N° {{ $numero }}</span></div>
<div class="meta">{{ config('agence.ville') }}, le {{ \Carbon\Carbon::parse($paiement->date_paiement)->format('d/m/Y') }}</div>
<p style="font-size:14px;margin:18px 0">
  Nous soussignés, <b>{{ config('agence.nom') }}</b>, reconnaissons avoir reçu de
  <b>{{ $client ? $client->prenom . ' ' . $client->nom : '—' }}</b> la somme de :
</p>
<div class="lettres" style="font-size:15px"><b>{{ Montant::fcfa($paiement->montant) }}</b> — {{ Montant::enLettres($paiement->montant) }}</div>
<table>
  <tbody>
    <tr><td style="width:40%">Objet</td><td>{{ $designation }}</td></tr>
    <tr><td>Facture</td><td>N° {{ $facture->numero }} ({{ Montant::fcfa($facture->montant) }})</td></tr>
    @if ($bien)<tr><td>Bien</td><td>{{ ucfirst(str_replace('_', ' ', $bien->type)) }} — {{ $bien->localisation }} (réf. {{ $bien->reference }})</td></tr>@endif
    <tr><td>Mode de paiement</td><td>{{ $modes[$paiement->mode_paiement] ?? $paiement->mode_paiement }}</td></tr>
    @if ($paiement->reference)<tr><td>Référence de la transaction</td><td>{{ $paiement->reference }}</td></tr>@endif
    <tr><td>Reste à payer sur la facture</td><td><b>{{ Montant::fcfa(max(0, $facture->montant - $paye)) }}</b></td></tr>
  </tbody>
</table>
<div class="signatures">
  <div><div class="ligne">Signature du client</div></div>
  <div><div class="ligne">Cachet et signature de l'agence</div></div>
</div>
@endsection
