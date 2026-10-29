@extends('impression.base')
@section('contenu')
@use('App\Support\Montant')
@php $nomClient = $client ? $client->prenom . ' ' . $client->nom : '—'; @endphp
<div class="titre"><h1>{{ $titre }}</h1><span class="num">N° {{ $contrat->numero }}</span></div>
<div class="meta">Établi le {{ \Carbon\Carbon::parse($contrat->date_creation)->format('d/m/Y') }}
  @if ($contrat->date_signature) — signé le {{ \Carbon\Carbon::parse($contrat->date_signature)->format('d/m/Y') }} @endif
</div>

<h2>Entre les soussignés</h2>
<p><b>{{ config('agence.nom') }}</b>{{ config('agence.adresse') ? ', ' . config('agence.adresse') : '' }},
  représentée par son agent <b>{{ $agent?->name ?? '—' }}</b>, ci-après « l'Agence » ;</p>
<p>et <b>{{ $nomClient }}</b>{{ $client?->piece_identite ? ', pièce d\'identité : ' . $client->piece_identite . ' ' . $client->numero_piece : '' }},
  téléphone : {{ $client->telephone ?? '—' }}, ci-après « le Client ».</p>

<h2>Article 1 — Bien concerné</h2>
@php
  $typesBien = ['terrain' => 'Terrain', 'maison' => 'Maison', 'villa' => 'Villa', 'appartement' => 'Appartement', 'local_commercial' => 'Local commercial'];
  $feminin = in_array($bien->type ?? '', ['maison', 'villa'], true);
@endphp
<p>{{ $typesBien[$bien->type ?? ''] ?? ucfirst(str_replace('_', ' ', $bien->type ?? '')) }} {{ $feminin ? 'située' : 'situé' }} à <b>{{ $bien->localisation ?? '—' }}</b>, référence {{ $bien->reference ?? '—' }}{{ $bien?->superficie ? ', d\'une superficie de ' . $bien->superficie . ' m²' : '' }}.</p>

@if ($contrat->type === 'location')
  <h2>Article 2 — Durée</h2>
  <p>La location prend effet le <b>{{ \Carbon\Carbon::parse($operation->date_debut)->format('d/m/Y') }}</b>
     @if ($operation->date_fin)
       et se termine le <b>{{ \Carbon\Carbon::parse($operation->date_fin)->format('d/m/Y') }}</b>.
     @else
       pour une durée indéterminée.
     @endif
  </p>
  <h2>Article 3 — Loyer et caution</h2>
  <p>Le loyer mensuel est fixé à <b>{{ Montant::fcfa($operation->loyer_mensuel) }}</b> ({{ Montant::enLettres($operation->loyer_mensuel) }}), payable chaque mois.
     Une caution de <b>{{ Montant::fcfa($operation->caution) }}</b> est versée à la signature ; elle sera restituée en fin de bail, déduction faite des éventuelles réparations.</p>
  <h2>Article 4 — Obligations</h2>
  <p>Le Client s'engage à payer le loyer à la date convenue, à entretenir le bien et à le restituer en bon état. L'Agence s'engage à mettre le bien à disposition et à remettre une quittance pour chaque paiement.</p>
@elseif ($contrat->type === 'vente')
  <h2>Article 2 — Prix</h2>
  <p>La vente est consentie au prix de <b>{{ Montant::fcfa($operation->prix_vente) }}</b> ({{ Montant::enLettres($operation->prix_vente) }}),
     payable par {{ $modes[$operation->mode_paiement] ?? $operation->mode_paiement }}.</p>
  <h2>Article 3 — Transfert de propriété</h2>
  <p>Le transfert de propriété intervient après paiement complet du prix et accomplissement des formalités administratives (mutation, titre foncier) devant notaire.</p>
@else
  <h2>Article 2 — Objet et montant</h2>
  <p>L'Agence s'engage à réaliser une construction de <b>{{ $operation->niveaux }} niveau(x)</b>{{ $operation->superficie ? ' sur ' . $operation->superficie . ' m²' : '' }},
     pour un montant total de <b>{{ Montant::fcfa($operation->montant_total) }}</b> ({{ Montant::enLettres($operation->montant_total) }}).</p>
  <h2>Article 3 — Étapes et versements</h2>
  <p>Les travaux se déroulent en trois étapes successives — fondement, élévation, finition. Chaque étape donne lieu à un versement du Client et à une facture de l'Agence. Une étape ne commence qu'après la fin de la précédente.</p>
  <h2>Article 4 — Délai et livraison</h2>
  <p>Les travaux débutent le <b>{{ \Carbon\Carbon::parse($operation->date_debut)->format('d/m/Y') }}</b>. La livraison est constatée par un procès-verbal de remise des clés.</p>
@endif

<h2>Article final — Litiges</h2>
<p>En cas de désaccord, les parties rechercheront une solution à l'amiable avant toute action devant les juridictions compétentes du Sénégal.</p>

<p style="margin-top:18px">Fait à {{ config('agence.ville') }}, le {{ \Carbon\Carbon::parse($contrat->date_signature ?? $contrat->date_creation)->format('d/m/Y') }}, en deux exemplaires.</p>
<div class="signatures">
  <div><div class="ligne">Le Client<br><small>(lu et approuvé)</small></div></div>
  <div><div class="ligne">Pour l'Agence</div></div>
</div>
@endsection