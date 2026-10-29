<?php

namespace App\Support;

/** Montants en FCFA : formatage et écriture en toutes lettres (reçus, factures). */
class Montant
{
    public static function fcfa($valeur): string
    {
        return number_format((float) $valeur, 0, ',', ' ') . ' FCFA';
    }

    public static function enLettres($valeur): string
    {
        $n = (int) round((float) $valeur);
        if ($n === 0) {
            return 'zéro franc CFA';
        }
        $mots = trim(preg_replace('/\s+/', ' ', self::nombre($n)));
        if ($n === 1) {
            return 'un franc CFA';
        }
        // « un million de francs », mais « un million deux cent mille francs »
        return $mots . ($n % 1000000 === 0 ? ' de francs CFA' : ' francs CFA');
    }

    private static function nombre(int $n, bool $invariable = false): string
    {
        $unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze',
                   'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
        $dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

        if ($n >= 1000000000) {
            $q = intdiv($n, 1000000000);
            return self::nombre($q) . ' milliard' . ($q > 1 ? 's' : '') . ' ' . self::nombre($n % 1000000000);
        }
        if ($n >= 1000000) {
            $q = intdiv($n, 1000000);
            return self::nombre($q) . ' million' . ($q > 1 ? 's' : '') . ' ' . self::nombre($n % 1000000);
        }
        if ($n >= 1000) {
            $q = intdiv($n, 1000);
            // « cent » et « vingt » ne prennent pas de s devant « mille » : deux cent mille
            return ($q === 1 ? 'mille' : self::nombre($q, true) . ' mille') . ' ' . self::nombre($n % 1000);
        }
        if ($n >= 100) {
            $q = intdiv($n, 100);
            $r = $n % 100;
            $cent = $q === 1 ? 'cent' : $unites[$q] . ' cent' . ($r === 0 && !$invariable ? 's' : '');
            return $cent . ' ' . self::nombre($r, $invariable);
        }
        if ($n < 20) {
            return $unites[$n];
        }
        $d = intdiv($n, 10);
        $u = $n % 10;
        if ($d === 7 || $d === 9) {
            $u += 10; // soixante-dix, quatre-vingt-dix
        }
        $mot = $dizaines[$d];
        if ($u === 0) {
            return $d === 8 && !$invariable ? 'quatre-vingts' : $mot;
        }
        if (($u === 1 || $u === 11) && $d !== 8 && $d !== 9) {
            return $mot . ' et ' . $unites[$u];
        }
        return $mot . '-' . $unites[$u];
    }
}
