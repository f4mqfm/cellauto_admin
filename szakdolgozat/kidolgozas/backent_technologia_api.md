# 3.2. Backend technológia (API)

## Bevezetés

A rendszer backend komponense egy REST alapú API, amely a kliensalkalmazások (felhasználói és admin felület) számára biztosít strukturált hozzáférést az üzleti funkciókhoz és az adatokhoz. A backend technológiai kialakításának célja a stabil működés, a biztonságos hozzáférés, valamint a hosszú távon fenntartható fejlesztés támogatása.

## Technológiai stack

A megvalósítás fő technológiai elemei:

- **PHP 8.2**: szerveroldali futtatókörnyezet.
- **Laravel 12**: alkalmazáskeretrendszer (routing, middleware, validáció, ORM-integráció).
- **Laravel Sanctum**: tokenalapú API-hitelesítés.
- **Eloquent ORM**: objektumorientált adatbázis-elérés és relációkezelés.
- **Migrációk**: adatbázisséma verziózott menedzsmentje.

Ez a stack gyors fejlesztést tesz lehetővé úgy, hogy közben megmarad az architekturális konzisztencia és a kód karbantarthatósága.

## API-centrikus backend felépítés

A backend működésének központi eleme az API-réteg, amely:

- erőforrás-alapú végpontokat biztosít (`/api/...`),
- HTTP metódusokkal fejezi ki a műveleteket (`GET`, `POST`, `PUT`, `DELETE`),
- JSON adatformátumban kommunikál,
- middleware-lánccal érvényesíti a hozzáférési szabályokat.

A rétegzett működés alapegységei:

- **route-ok**: végpont-definíciók és jogosultsági csoportok,
- **controller-ek**: kérések validálása és üzleti műveletek végrehajtása,
- **modellek**: táblák és relációk leképezése,
- **middleware-ek**: hitelesítés, session-ellenőrzés, szerepkör-alapú hozzáférés.

## Hitelesítés és hozzáférésvezérlés technológiája

A rendszer Sanctum tokeneket használ a védett API-hívások azonosítására. A hitelesítés technikai folyamata:

1. bejelentkezéskor token kiadás,
2. token továbbítása a védett hívásoknál,
3. middleware oldali token- és felhasználóállapot-ellenőrzés,
4. kijelentkezéskor token-visszavonás.

Az `active-session` middleware kiegészítő kontrollt ad:

- inaktív/felfüggesztett fiók kizárása,
- inaktivitási timeout kezelése,
- érvénytelen session automatikus lezárása.

Ezzel a backend nem csak autentikációt, hanem munkamenet-életciklus-kezelést is megvalósít.

## Adatkezelési technológia

Az adatbázis-kezelés Eloquent ORM-re és migrációkra épül:

- a modellek deklarálják az attribútum-készletet és típuskonverziókat (`casts`),
- a relációk (`belongsTo`, `hasMany`) egyszerűsítik az összetett lekérdezéseket,
- a migrációk verziózottan, reprodukálható módon kezelik a sémaváltozásokat.

Ez különösen fontos többmodulos rendszernél, ahol a domain-entitások (listák, mentések, értékelések, naplók) erősen összefüggnek.

## Hibatűrés és API-robosztusság

A backend a Laravel validációs és kivételkezelési mechanizmusaira támaszkodik. A kliens felé JSON hibaobjektumok kerülnek vissza, tipikusan:

- `error` (üzleti vagy hozzáférési hiba),
- `message` (általános keretrendszerüzenet),
- `errors` (mezőszintű validációs hibák).

Ez lehetővé teszi, hogy a frontend különböző hibatípusokra differenciáltan reagáljon.

## Üzemeltetési és fejlesztési támogatás

A Laravel ökoszisztéma több beépített eszközzel támogatja az API életciklusát:

- automatizált tesztfuttatás (PHPUnit),
- kódminőség-ellenőrzés (Pint),
- helyi fejlesztői futtatási folyamatok (artisan parancsok).

Ennek eredményeként a backend fejlesztése kontrollált, jól automatizálható folyamatban történhet.

## Összegzés

A backend technológiai megvalósítása korszerű, API-first szemléletű. A Laravel + Sanctum + Eloquent kombináció olyan stabil alapot biztosít, amely egyszerre támogatja a biztonságot, a gyors fejlesztést, a tiszta architektúrát és a jövőbeli bővíthetőséget. Ez a technológiai felépítés szakdolgozati szempontból is jól indokolható, mivel világos kapcsolatot teremt a tervezési elvek és a gyakorlati megvalósítás között.
