<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>{{ $titre }} {{ $numero ?? '' }} — {{ config('agence.nom') }}</title>
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; }
  /* Imprime aussi les couleurs de fond (filet doré, en-têtes de tableau) */
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: "Helvetica Neue", Arial, sans-serif; color: #1F2A24; font-size: 12.5px; line-height: 1.5; }
  .page { max-width: 180mm; margin: 0 auto; }
  .entete { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
            padding-bottom: 14px; border-bottom: 3px solid #0B4D2A; position: relative; }
  .entete::after { content: ""; position: absolute; left: 0; right: 0; bottom: -6px; height: 2px; background: #D4A017; }
  .entete img { height: 52px; }
  .agence { text-align: right; font-size: 11px; color: #5E6B63; }
  .agence b { color: #0B4D2A; font-size: 12px; }
  .titre { margin: 26px 0 4px; display: flex; justify-content: space-between; align-items: baseline; }
  .titre h1 { margin: 0; font-size: 22px; color: #0B4D2A; letter-spacing: .5px; text-transform: uppercase; }
  .titre .num { font-weight: 700; font-size: 14px; }
  .meta { color: #5E6B63; margin-bottom: 18px; }
  .blocs { display: flex; gap: 14px; margin-bottom: 18px; }
  .bloc { flex: 1; border: 1px solid #C9D3CC; border-radius: 6px; padding: 10px 12px; }
  .bloc h3 { margin: 0 0 4px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .6px; color: #8A6A12; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; }
  th { background: #0B4D2A; color: #fff; text-align: left; padding: 7px 10px; font-size: 11.5px; }
  td { padding: 8px 10px; border-bottom: 1px solid #E3E8E4; vertical-align: top; }
  .num-col { text-align: right; white-space: nowrap; }
  .totaux { margin-left: auto; width: 55%; }
  .totaux td { border: none; padding: 4px 10px; }
  .totaux tr.total td { border-top: 2px solid #0B4D2A; font-weight: 700; font-size: 14px; color: #0B4D2A; padding-top: 8px; }
  .lettres { background: #FBF3DC; border-left: 4px solid #D4A017; padding: 8px 12px; margin: 10px 0 18px; }
  .statut { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; }
  .statut.ok { background: #E3F1E8; color: #0B4D2A; } .statut.attente { background: #FBF3DC; color: #8A6A12; }
  .statut.retard { background: #FBE4E2; color: #B3261E; }
  h2 { font-size: 13px; color: #0B4D2A; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: .4px; }
  p { margin: 0 0 8px; text-align: justify; }
  .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 34px; }
  .signatures div { flex: 1; text-align: center; }
  .signatures .ligne { margin-top: 56px; border-top: 1px solid #1F2A24; padding-top: 4px; font-size: 11px; color: #5E6B63; }
  .pied { margin-top: 30px; padding-top: 8px; border-top: 1px solid #C9D3CC; font-size: 10px; color: #5E6B63; text-align: center; }
  @media screen { .page { padding: 24px 0; } }
  @media print { .page { max-width: none; } }
</style>
</head>
<body>
<div class="page">
  <div class="entete">
    <img src="data:image/png;base64,{{ base64_encode(file_get_contents(resource_path('images/logo-daaradji.png'))) }}" alt="{{ config('agence.nom') }}">
    <div class="agence">
      <b>{{ config('agence.nom') }}</b><br>
      @if (config('agence.adresse')) {{ config('agence.adresse') }}<br> @endif
      @if (config('agence.telephone')) Tél. {{ config('agence.telephone') }}<br> @endif
      @if (config('agence.email')) {{ config('agence.email') }}<br> @endif
      @if (config('agence.ninea')) NINEA {{ config('agence.ninea') }} @endif
    </div>
  </div>
  @yield('contenu')
  <div class="pied">{{ config('agence.nom') }} — document généré le {{ now()->format('d/m/Y à H:i') }}</div>
</div>
</body>
</html>