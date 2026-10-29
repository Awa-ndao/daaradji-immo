@extends('impression.base')
@section('contenu')
@use('App\Support\Montant')
<div class="titre"><h1>Bulletin de salaire</h1><span class="num">{{ $numero ? 'N° ' . $numero : '' }}</span></div>
<div class="meta">Période : <b>{{ $periode }}</b> —
  @if ($salaire->statut === 'paye')
    <span class="statut ok">Payé le {{ \Carbon\Carbon::parse($salaire->date_paiement)->format('d/m/Y') }}</span>
  @else
    <span class="statut attente">En attente de paiement</span>
  @endif
</div>

<div class="blocs">
  <div class="bloc">
    <h3>Employé</h3>
    <b>{{ $employe?->name ?? '—' }}</b><br>
    {{ $roles[$employe?->role] ?? $employe?->role }}<br>
    {{ $employe?->email }}
  </div>
  <div class="bloc">
    <h3>Employeur</h3>
    <b>{{ config('agence.nom') }}</b><br>
    {{ config('agence.adresse') ?: config('agence.ville') }}
    @if (config('agence.ninea'))<br>NINEA {{ config('agence.ninea') }}@endif
  </div>
</div>

<table>
  <thead><tr><th>Élément</th><th class="num-col">Montant</th></tr></thead>
  <tbody>
    <tr><td>Salaire mensuel de base</td><td class="num-col">{{ Montant::fcfa($salaire->salaire_base) }}</td></tr>
    @if ($salaire->prime > 0)<tr><td>Prime</td><td class="num-col">+ {{ Montant::fcfa($salaire->prime) }}</td></tr>@endif
    @if ($salaire->retenue > 0)<tr><td>Retenue (avance, absence…)</td><td class="num-col">− {{ Montant::fcfa($salaire->retenue) }}</td></tr>@endif
  </tbody>
</table>
<table class="totaux">
  <tr class="total"><td>Net à payer</td><td class="num-col">{{ Montant::fcfa($salaire->net) }}</td></tr>
</table>
<div class="lettres">Arrêté le présent bulletin à la somme de <b>{{ Montant::enLettres($salaire->net) }}</b>.</div>

@if ($salaire->note)<p><b>Observation :</b> {{ $salaire->note }}</p>@endif

@if ($salaire->statut === 'paye')
<table>
  <tbody>
    <tr><td style="width:40%">Mode de paiement</td><td>{{ $modes[$salaire->mode_paiement] ?? $salaire->mode_paiement }}</td></tr>
    @if ($salaire->reference)<tr><td>Référence</td><td>{{ $salaire->reference }}</td></tr>@endif
  </tbody>
</table>
@endif

<div class="signatures">
  <div><div class="ligne">Signature de l'employé<br><small>(pour acquit)</small></div></div>
  <div><div class="ligne">Cachet et signature de l'agence</div></div>
</div>
@endsection
