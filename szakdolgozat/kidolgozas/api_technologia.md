# API technológiai összefoglaló

## Bevezetés

Ez a fejezet a projekt backend/API oldalán használt technológiai megoldásokat foglalja össze szakdolgozati célú formában. A rendszer egy modern, PHP-alapú webalkalmazás-backend, amely REST elven működő API-t biztosít a kliensalkalmazások számára.

## Alkalmazott fő technológiák

### 1. Programozási nyelv és futtatókörnyezet

- **PHP 8.2**

A backend szerveroldali logikája PHP nyelven készült. A választás előnye a széles körű webes támogatás, az érett ökoszisztéma és a framework-kompatibilitás.

### 2. Keretrendszer

- **Laravel 12**

A projekt a Laravel keretrendszerre épül, amely az alábbi kulcsfunkciókat biztosítja:

- routing és API-végpont kezelés,
- middleware alapú kérésfeldolgozás,
- beépített validáció,
- egységes hibakezelés,
- ORM-integráció.

### 3. Hitelesítés és jogosultság

- **Laravel Sanctum**

A védett API-végpontok tokenalapú hitelesítéssel működnek. A rendszer a Sanctum tokeneket használja a munkamenetek azonosítására, amelyet egyedi middleware (`active-session`) egészít ki az inaktivitás-kezelés és az aktív/felfüggesztett státusz ellenőrzésére.

### 4. Adatbázis-kezelés

- **Relációs adatbázis (MySQL-kompatibilis séma)**
- **Laravel Eloquent ORM**
- **Laravel migrációk**

Az adatelérés Eloquent modelleken keresztül történik, amelyek relációkat és típuskonverziókat is definiálnak.  
A táblaszerkezetek verziózott migrációkkal kezeltek, így az adatbázis-változások reprodukálhatóan telepíthetők.

### 5. Adatcsere és API-formátum

- **REST alapú HTTP API**
- **JSON kommunikáció**

A kliens-szerver kommunikáció JSON formátumban történik, tipikusan az alábbi fejlécekkel:

- `Accept: application/json`
- `Content-Type: application/json`

### 6. Fejlesztési és minőségbiztosítási eszközök

- **PHPUnit** (tesztelés)
- **Laravel Pint** (kódformázás, stílusellenőrzés)
- **Laravel Tinker** (interaktív fejlesztői eszköz)

Ezek az eszközök támogatják a megbízható fejlesztési folyamatot és a konzisztens kódminőséget.

## Architekturális jellemzők technológiai nézőpontból

A technológiai stack egy rétegezett backend architektúrát támogat:

- route -> middleware -> controller -> model -> adatbázis

Ez a felépítés jól skálázható, könnyen karbantartható, és lehetővé teszi a jogosultsági szabályok, valamint az üzleti logika központi érvényesítését.

## Összegzés

A projekt technológiai alapja korszerű, ipari gyakorlatban széles körben használt komponensekből áll. A Laravel ökoszisztéma, a Sanctum-alapú hitelesítés és a migrációval támogatott relációs adatkezelés együtt olyan stabil alapot ad, amely megfelel a szakdolgozati szinten elvárt tervezési, biztonsági és fenntarthatósági követelményeknek.
