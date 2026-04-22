# API teszteles

## 1. A teszteles celja

A backend fejlesztesenek egyik kiemelt celja az volt, hogy az alkalmazas API-retege stabil, kiszamithato es biztonsagos modon mukodjon. Ennek megfeleloen a tesztelesi folyamat a kovetkezo teruletekre fokuszalt:

- vegpontok helyes mukodese (helyes valaszformatumok, statuszkodok),
- hitelesitesi es jogosultsagi szabalyok ellenorzese,
- hibas bemenetek kezelesenek vizsgalata,
- adatintegritas es relacios viselkedes validalasa.

A teszteles ket szinten tortent: manualis API-hivasokkal es automatizalt Laravel tesztfuttatassal.

## 2. Alkalmazott tesztelesi megkozelites

### 2.1 Manualis API teszteles

A vegpontok kezdeti ellenorzese manualis HTTP hivasokkal tortent (`curl`/API kliens alapu probak). A vizsgalat soran minden vegpontnal ellenorizheto volt:

- a keresi parameterek ervenyesitese,
- a JSON valaszok szerkezete,
- a sikeres es hibas allapotokhoz tartozo HTTP kodok (pl. `200`, `201`, `401`, `403`, `404`, `422`).

A vedett vegpontok eseteben Sanctum Bearer token hitelesites tortent, igy kulon ellenorizheto volt a jogosultsagkezeles es a tulajdonosi hozzaferes.

### 2.2 Automatizalt backend teszteles

A projekt Laravel alapu, beepitett tesztkeretrendszerrel rendelkezik (PHPUnit + `php artisan test`). A teszteles futtatasa a kovetkezo modokon erheto el:

- `composer test`
- `php artisan test`

A rendszerben kulon `Unit` es `Feature` tesztsuite-ok vannak definialva, ami lehetove teszi az uzleti logika es az API viselkedes kulon-kulon torteno vizsgalatat.

## 3. Tesztkornyezet

A tesztfuttatas dedikalt `testing` kornyezetben tortenik. A konfiguracio alapjan a tesztek in-memory SQLite adatbazist hasznalnak, ami gyors es izolalt futtatast biztosit:

- `APP_ENV=testing`
- `DB_CONNECTION=sqlite`
- `DB_DATABASE=:memory:`

Ez az elrendezes ket fontos elonnyel jar:

1. a tesztek nem modositjak az eles vagy fejlesztoi adatbazist,
2. a futtatas gyors, ezaltal gyakori regresszios ellenorzes vegezheto.

## 4. Ellenorzott funkcionlis teruletek

A teszteles soran a kovetkezo API-teruletek kaptak hangsulyt:

- hitelesites es session/token allapot,
- felhasznaloi eroforrasok elerese,
- szolistak, szavak es relaciok kezelese,
- tablamentesek/feladatmentesek CRUD muveletei,
- naplozasi esemenyek lekerdezese.

Kiemelt szempont volt annak igazolasa, hogy a jogosultsagi szabalyok miatt egy felhasznalo csak a sajat adataihoz ferjen hozza, valamint hogy ervenytelen bemenet eseten a rendszer kovetkezetes hibavalaszt adjon.

## 5. Eredmeny es kovetkeztetes

A tesztelesi folyamat alapjan az API mukodese konzisztensnek tekintheto: a vegpontok a specifikacionak megfelelo statuszkodokat es valaszstrukturat adnak, a hitelesites es jogosultsagkezeles pedig megfeleloen ervenyesul. Az automatizalt tesztfuttatas jelenlete jo alapot biztosit a tovabbi fejleszteshez, mert csokkenti a regresszios hibak kockazatat.

Szakdolgozati szempontbol a teszteles igazolja, hogy a rendszer nem csak funkcionalisan mukodokepes, hanem uzemeltetesi es karbantarthatosagi oldalrol is megfelel egy modern API-alapu alkalmazassal szemben tamasztott kovetelmenyeknek.
