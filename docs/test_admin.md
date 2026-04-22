# A programban alkalmazott tesztelesi technologia es tesztelesi megkozelites

Ez a fejezet a szakdolgozat szamara osszefoglalja, hogy a webes rendszer fejlesztese soran milyen minosegbiztositasi es tesztelesi eszkozok kerultek alkalmazasra.

## 1. Alkalmazott tesztelesi technologiak

A projekt frontend es backend komponense eltero technologiai kornyezetben fut, ezert a teszteles is tobb eszkoz kombinaciojara epul.

### 1.1 Frontend (React + TypeScript)

A frontend oldalon a minosegbiztositas fo elemei:

- **ESLint**: statikus kodelemzo eszkoz, amely mar fejlesztes kozben jelzi a potencialis kodminosegi problemakat, hibagyanus szerkezeteket es stilusbeli eltereseket.
- **TypeScript fordito (`tsc`)**: build elott tipusellenorzest vegez, ezaltal csokkenti a futasideju hibak lehetoseget.
- **Vite build folyamat**: a frontend fordithatosaga es telepithetosege build lepesben ellenorizheto.

A frontend eseteben a hangsuly a statikus ellenorzesen (lint + tipusellenorzes), valamint a funkcionis kezi tesztelesen van.

### 1.2 Backend (Laravel API)

A backend oldalon az alkalmazott fo tesztelesi technologia:

- **PHPUnit**: automatizalt tesztkeretrendszer, amely alkalmas az uzleti logika, a vegpontok es a kulonbozo alkalmazasi komponensek ellenorzesere.

Ez a megkozelites lehetove teszi, hogy a kritikus szerveroldali folyamatok reprodukalhato modon legyenek ellenorizhetok.

## 2. Altalanos tesztelesi strategia

A rendszer tesztelese tobb szinten tortenik:

- **Statikus ellenorzes**: linteles es tipusellenorzes a kodhibak korai felismeresere.
- **Egysegteszteles (unit szemlelet)**: kisebb, elszigetelt logikai egysegek vizsgalata (kulonosen backend oldalon).
- **Integracios teszteles**: a frontend es backend kozotti API kommunikacio helyes mukodesenek ellenorzese.
- **Funkcionalis teszteles**: a felhasznaloi folyamatok vegigprobalaasa az admin feluleten (pl. bejelentkezes, adatok kezelese, modositas, listazas).
- **Regresszios szemleletu ujrateszteles**: uj funkcio vagy modositott viselkedes bevezetese utan a korabbi mukodes ellenorzese.

## 3. Kezi teszteles szerepe a projektben

A projekt jellegabol adodoan kiemelt szerepet kap a kezi, forgatokonyv alapu teszteles, mert:

- jol vizsgalhato vele a felhasznaloi elmeny es a kezelofelulet logikaja,
- gyors visszacsatolast ad az uzleti folyamatok helyessegerol,
- tamogatja az adminisztracios folyamatok vegponttol vegpontig torteno validalasat.

A kezi teszteles jellemzoen valos adatokkal vagy valos adatszerkezetet koveto tesztadatokkal tortenik, hogy a rendszer gyakorlati hasznalatahoz kozeli eredmenyek szulessenek.

## 4. Osszegzes

A program tesztelesi megkozelitese kombinlja a statikus kodelemzest, a tipusellenorzest, az automatizalt backend tesztelest es a funkcionis kezi tesztelest. Ez a gyakorlatban kiegyensulyozott minosegbiztositasi strategiat ad: egyszerre segiti a korai hibafelismerest, az uzleti logika ellenorzeset es a valos felhasznaloi folyamatok validalasat.
