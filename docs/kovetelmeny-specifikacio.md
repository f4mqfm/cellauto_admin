# Követelményspecifikáció — Cellauto Admin (frontend)

**Dokumentum típusa:** szoftverkövetelmény-specifikáció (a jelenlegi kódbázis alapján visszafejtve)  
**Alkalmazás:** Sejtautomaták Admin felület (SPA)  
**Technológia:** React 19, TypeScript, Vite 8  
**API alap:** `VITE_API_BASE_URL` környezeti változó (alapértelmezés: `/api`) — részletek: [api-spec.md](./api-spec.md)

---

## 1. Cél és hatókör

### 1.1 Cél

A rendszer célja, hogy **hitelesített adminisztrátorok** (és a jogosultsági szabályok szerint más szerepkörök) egy böngészőben kezeljék a **felhasználókat**, a **szólistákat** és a **színpaletta-listákat**, amelyek a „Sejtautomaták” (Cellauto) ökoszisztéma részei. Az alkalmazás **csak frontend**: a tényleges üzleti logika és adattárolás a REST API-n keresztül érhető el.

### 1.2 Hatókör (mit fed le ez a specifikáció)

- Bejelentkezés, munkamenet megőrzése, kijelentkezés, aktuális felhasználó adatainak frissítése.
- Felhasználók CRUD + felfüggesztés/visszaaktiválás (admin szerepkörrel).
- Szólisták és szavak kezelése (lista- és szószintű műveletek, tömeges szófelvétel, sorrendezés).
- Színlisták és palettaszínek kezelése (előre definiált színválasztó, sorrendezés).

### 1.3 Kívül esik

- Backend implementáció, adatbázis-séma, jogosultságok szerveroldali érvényesítése (csak a kliens elvárásai vannak leírva).
- Mobilalkalmazás, offline mód.

---

## 2. Felhasználók és szerepkörök

| Szerepkör | A kódban használt azonosító | Megjegyzés |
|-----------|-----------------------------|------------|
| Vendég | `vendeg` | |
| Diák | `diak` | |
| Tanár | `tanar` | |
| Admin | `admin` | A **Felhasználók kezelése** oldal csak `admin` szerepkörnél érhető el a UI-ban. |

A felhasználó modell mezői (API): `id`, `username`, `name`, `email`, `role`, `active`, `suspended_at`, `email_verified_at`, `created_at`, `updated_at`.

**Állapot megjelenítése a felületen:** „Aktív”, ha `active === 1` és `suspended_at == null`; egyébként „Felfüggesztett”.

---

## 3. Funkcionális követelmények

### 3.1 Autentikáció és munkamenet

| ID | Követelmény |
|----|-------------|
| **AUTH-01** | Nem bejelentkezett állapotban a felület **bejelentkezési űrlapot** jelenít meg: kötelező mezők: email vagy felhasználónév (`login`), jelszó. |
| **AUTH-02** | Bejelentkezés: `POST /api/login` (relatív bázis) JSON body: `{ "login", "password" }`. Sikertelen válasz esetén hibaüzenet jelenik meg. |
| **AUTH-03** | Sikeres bejelentkezés után a kliens tárolja a **Bearer tokent** és a **felhasználó objektumot** a böngésző `localStorage`-ában (`cellauto_admin_token`, `cellauto_admin_user`). |
| **AUTH-04** | Oldal betöltésekor, ha van érvényes tárolt token és felhasználó, a felület **automatikusan bejelentkezett** állapotba kerül. |
| **AUTH-05** | Bejelentkezett felhasználó: a fejléc mutatja a **nevet**, **felhasználónevet**, **emailt** és **szerepkört**; elérhető a **Kijelentkezés** (törli a tárolt auth adatokat). |
| **AUTH-06** | **Profil frissítése:** `GET /api/user` Bearer tokennel; a válasz alapján frissül a felhasználó és a tárolt auth. |
| **AUTH-07** | Hitelesített kérések: `Authorization: Bearer <token>`, `Accept: application/json`. |

### 3.2 Navigáció és elrendezés

| ID | Követelmény |
|----|-------------|
| **NAV-01** | Menüpontok: **Felhasználók kezelése**, **Szólisták**, **Színlisták**; kiválasztás után a megfelelő modul jelenik meg. |
| **NAV-02** | Bejelentkezés után kezdetben nincs kiválasztott modul („Kezdőlap” üzenet); a felhasználónak menüből kell választania. |
| **NAV-03** | Aszinkron művelet (busy) alatt a menü és egyes gombok letilthatók a párhuzamos műveletek csökkentése érdekében. |

### 3.3 Felhasználók kezelése (csak `admin` szerepkör)

| ID | Követelmény |
|----|-------------|
| **USR-01** | Ha a bejelentkezett felhasználó szerepköre nem `admin`, csak egy **jogosultsági üzenet** jelenik meg; lista és műveletek nem. |
| **USR-02** | Felhasználók listája: `GET /api/users`; **Frissítés** gombbal újra lekérhető. |
| **USR-03** | **Keresés** (kliens oldali szűrés): szöveg alapján illeszkedés `id`, `username`, `name`, `email`, `role` mezőkre (kis-nagybetű érzéketlen). |
| **USR-04** | **Új felhasználó:** űrlap mezői: username, név, email, jelszó, role (választó: `vendeg`, `diak`, `tanar`, `admin`); `POST /api/users`. Siker után lista frissül. |
| **USR-05** | **Szerkesztés:** username, név, email, role; opcionális új jelszó (csak kitöltés esetén küldés); `PUT /api/users/{id}`. Ha a szerkesztett felhasználó az aktuális bejelentkezett felhasználó, a globális felhasználói állapot és a tárolt auth is frissül. |
| **USR-06** | **Törlés:** megerősítő párbeszéd után `DELETE /api/users/{id}`. |
| **USR-07** | **Felfüggesztés / aktiválás:** ha a felhasználó aktív és nincs felfüggesztve → `POST .../suspend`; egyébként `POST .../unsuspend`. Megerősítés szükséges. A válaszban elfogadott forma: közvetlen `User` objektum vagy `{ user: User }`. |

### 3.4 Szólisták és szavak

| ID | Követelmény |
|----|-------------|
| **LST-01** | Listák betöltése: `GET /api/lists`; **Frissítés** elérhető. |
| **LST-02** | **Új lista:** kötelező név (max. 255 karakter a UI-ban); opcionális kezdeti szavak szövegmezőből: **szóköz vagy sortörés** alapú tokenizálás, max. **255 karakter/szó**, duplikátumok kiszűrése. Lista létrehozása után a szavak egyenként `POST /api/lists/{id}/words` pozícióval (`0..n-1`). Részleges hiba esetén a lista létrejön, a sikertelen szavakról hibaüzenet. |
| **LST-03** | Listák táblázatban; név gombbal **kiválasztás**; **Törlés** megerősítéssel: `DELETE /api/lists/{id}`. |
| **LST-04** | Kiválasztott listánál **átnevezés:** `PUT /api/lists/{id}` `{ name }`. |
| **LST-05** | Szavak betöltése: elsődlegesen `GET /api/lists/{id}/words`; ha ez hibázik, fallback: `GET /api/lists/{id}` és a válasz `words` tömbje. |
| **LST-06** | Szavak **rendezése** megjelenítéskor: `position` szerint, egyenlőség esetén `id` szerint. |
| **LST-07** | **Új szavak tömeges hozzáadása:** ugyanaz a parsolás, mint új listánál; pozíciók a jelenlegi lista utolsó pozíciójától folytatva. Sikertelen elemek összegyűjtése és hibaüzenet. |
| **LST-08** | **Keresés** a szavak között: kliens oldali szűrés; aktív keresés mellett **drag-and-drop sorrendezés tiltva**. |
| **LST-09** | **Sorrendezés (drag-and-drop):** csak teljes lista nézetben (nincs keresés, nincs szó szerkesztés közben, nincs busy). Sorrend mentése **kétlépcsős** `position` frissítéssel (ideiglenes nagy bázis, majd `0..n-1`) az adatbázis egyedi `(list_id, position)` korlátjának elkerülésére. |
| **LST-10** | Szó **szerkesztése** sorban: szöveg szerkesztése, mentés, Escape **mégse**. |
| **LST-11** | Szó **törlése** megerősítéssel; törlés után a maradék elemek sorrendje újrapozícionálódik. |
| **LST-12** | Táblázat **Gen** oszlop: a teljes (nem szűrt) lista szerinti 1-től indexelt sorszám. |

### 3.5 Színlisták és palettaszínek

| ID | Követelmény |
|----|-------------|
| **CLR-01** | Színlisták: `GET /api/color-lists`; lista létrehozás, törlés, kiválasztás, átnevezés — funkcionálisan a szólistákhoz hasonló minta. |
| **CLR-02** | Színek betöltése: `GET /api/color-lists/{id}/colors`, fallback: `GET /api/color-lists/{id}` → `colors`. Rendezés: `position`, majd `id`. |
| **CLR-03** | **Színválasztás:** előre definiált **hex** színek gombhálózata (a kódban rögzített paletta); a felhasználó **nem gépel** színkódot hozzáadáskor, csak kattint. |
| **CLR-04** | **Új lista létrehozásakor** a kattintások **sorrendje** határozza meg a színek beszúrási sorrendjét (`position`: 0, 1, …). Várakozó sor törölhető / utolsó elem visszavonható. |
| **CLR-05** | **Meglévő listához** színek: várakozó sor ugyanígy; **„Hozzáadás a listához”** több szín egy menetben, pozíciók folytatva. |
| **CLR-06** | **Szerkesztés:** sorban „Szerkesztés” után ugyanaz a paletta; kattintásra **azonnal** ment (`PUT`) az új hex értékkel (max. 50 karakter hossz ellenőrzés a kliensen a szerkesztésnél). |
| **CLR-07** | **Keresés** a táblázatban (hex részlet); keresés közben **drag-and-drop tiltva** (szólistához hasonlóan). |
| **CLR-08** | **Sorrendezés:** kétlépcsős `position` frissítés, mint a szavaknál. |
| **CLR-09** | Táblázat: **Gen** (teljes lista szerinti sorszám), **pos** megjelenítés, színminta négyzet. |

---

## 4. Nem funkcionális követelmények

| ID | Követelmény |
|----|-------------|
| **NF-01** | **Hibakezelés:** HTTP hibák esetén a kliens megpróbálja kiolvasni a válasz JSON `error` / `message` / `msg` mezőjét, illetve Laravel-stílusú `errors` objektum első üzenetét; a hiba szöveghez hozzácsatolja a HTTP státuszkódot. Nem JSON válasz esetén rövidített szöveg. |
| **NF-02** | **Nyelv:** a felhasználói felület szövegei magyarul (bejelentkezés, menük, gombok, hibák). |
| **NF-03** | **Biztonság (kliens):** a token a `localStorage`-ban van; ez XSS esetén kitettséget jelent — éles környezetben a backend és a host oldali biztonsági fejlécek szerepe elsődleges. |
| **NF-04** | **Teljesítmény:** nincs külön lapozás a kódban; nagy felhasználó-/listaállomány esetén a teljes lista memóriában van — skálázási korlát backend és UX oldalon kezelendő. |
| **NF-05** | **Build:** `tsc -b` és `vite build` támogatott; fejlesztői szerver: `vite`. |

---

## 5. Környezeti változók

| Változó | Kötelező | Alapértelmezés | Hatás |
|---------|----------|----------------|--------|
| `VITE_API_BASE_URL` | Nem | `/api` | Az összes API hívás bázis URL-je. |

---

## 6. Függőségek és kapcsolódó dokumentumok

- **Backend REST API:** a funkciók csak a dokumentált végpontokkal működnek — részletes szerződés: [api-spec.md](./api-spec.md), továbbá [api-lists-words.md](./api-lists-words.md), [api-color-lists-colors.md](./api-color-lists-colors.md) ha a projektben külön részletezve vannak.
- **Böngésző:** modern böngésző `localStorage`, `fetch`, CSS `color-mix` (sor kiemeléshez) támogatással.

---

## 7. Állapot és változás követése

| Verzió | Dátum | Megjegyzés |
|--------|-------|------------|
| 1.0 | 2026-04-11 | Első verzió a jelenlegi frontend kódbázis alapján. |

---

*A dokumentum a `/var/www/cellauto/admin` tároló `src/` és `docs/` állapotából készült; eltérés esetén a forráskód az irányadó, amíg ezt a specifikációt explicit módon nem frissítik.*
