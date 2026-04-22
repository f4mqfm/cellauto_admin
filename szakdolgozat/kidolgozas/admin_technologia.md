# Az admin projektben használt technológiák

Ez a fejezet a szakdolgozathoz összefoglalja a projekt technológiai hátterét, külön a kliensoldali (admin felület) és a szerveroldali komponensekre bontva.

## 1. Kliensoldal (admin felület)

Az admin felület modern, komponensalapú webalkalmazásként készült.

- **React 19**: a felhasználói felület felépítése, állapotkezelés és komponensstruktúra.
- **TypeScript**: típusos fejlesztés, jobb karbantarthatóság és kevesebb futásidejű hiba.
- **Vite**: gyors fejlesztői szerver és build rendszer.
- **React DOM**: a React komponensek böngészőbe renderelése.
- **CSS**: egyedi, kézzel írt stílusok az admin képernyőkhöz.

## 2. Szerveroldal (API)

Az admin felület egy külön API szolgáltatáshoz kapcsolódik.

- **PHP 8.2**
- **Laravel 12**: REST API végpontok, middleware-ek, üzleti logika, adatelérés.
- **Laravel Sanctum**: token alapú autentikáció/hozzáférés-kezelés.
- **Eloquent ORM**: adatbázis műveletek objektumorientált kezelése.
- **Laravel migrációk**: adatbázis-séma verziózott kezelése.

## 3. Adatkezelés és kommunikáció

- A frontend és backend között **HTTP alapú JSON kommunikáció** történik.
- A kliensoldal `fetch` hívásokkal éri el az API végpontokat.
- Fejlesztési környezetben a Vite proxy a `/api` útvonalat a Laravel szolgáltatás felé továbbítja.

## 4. Fejlesztési és minőségbiztosítási eszközök

- **ESLint**: statikus kódelemzés JavaScript/TypeScript kódra.
- **TypeScript compiler (`tsc`)**: típusellenőrzés build előtt.
- **PHPUnit** (backend oldalon): automatizált tesztelési lehetőség.
- **Laravel Pint**: PHP kódformázási és stílusellenőrzési eszköz.

## 5. Architektúra röviden

A rendszer **szétválasztott frontend–backend architektúrát** alkalmaz:

- a React + TypeScript admin kliens jeleníti meg a felületet,
- a Laravel API biztosítja az üzleti logikát és az adatelérést,
- a kommunikáció REST jellegű API hívásokkal történik.

Ez a felépítés jól támogatja a moduláris bővítést, a szerepkör alapú hozzáférés-kezelést és a hosszú távú karbantarthatóságot.
