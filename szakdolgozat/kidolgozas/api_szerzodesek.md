# 3.5. API-szerződés és kommunikációs elvek

Az alkalmazás kliens-szerver kommunikációja REST szemléletű HTTP API-n keresztül valósul meg, egységes `/api` útvonal-előtaggal. A szerződés célja, hogy stabil, egyértelmű és verziózható interfészt biztosítson a frontend és backend komponensek között.

## 3.5.1. Adatformátum és fejlécek

A kommunikáció JSON formátumban történik. A kliens oldalon az alábbi fejlécek használata tekinthető alapértelmezettnek:

- `Accept: application/json`
- `Content-Type: application/json`

Hitelesített hívások esetén a kliens Sanctum tokennel azonosítja magát (Bearer token használatával).

## 3.5.2. Erőforrás-orientált végpontstruktúra

Az API erőforrásokra szervezett, ahol az URI-k a domain objektumokat reprezentálják, a HTTP metódusok pedig a műveleti szándékot fejezik ki:

- `GET`: lekérdezés,
- `POST`: létrehozás,
- `PUT`: módosítás/felülírás,
- `DELETE`: törlés.

A nested (beágyazott) útvonalak az összetartozó adatok relációját jelzik (pl. lista -> szavak, csoport -> mentések).

## 3.5.3. Hitelesítés és jogosultsági szerződés

A végpontok három jogosultsági rétegre bonthatók:

1. **Nyilvános végpontok** (pl. `POST /api/login`, `GET /api/ping`, `POST /api/access-logs/visit`)
2. **Hitelesített felhasználói végpontok** (`auth:sanctum` + `active-session`)
3. **Emelt jogosultságú végpontok** (`staff`, illetve `admin` middleware)

Az `active-session` middleware a token érvényessége mellett a felhasználó aktuális állapotát (aktív/felfüggesztett) és az inaktivitási időkorlátot is ellenőrzi, így a szerződés nem pusztán tokenlétezésre épül.

## 3.5.4. Válaszok és hibakezelés

A válaszok egységesen JSON formátumban érkeznek. Sikeres műveleteknél az API jellemzően az alábbi mintákat használja:

- létrehozás: `201 Created` + létrehozott erőforrás,
- módosítás/lekérdezés: `200 OK` + erőforrás vagy lista,
- törlés: `200 OK` + rövid státuszobjektum (pl. `{ "ok": true }`).

A hibakezelésnél a frontend robusztus módon több válaszmezőt is képes értelmezni:

- `error` (általános hibaüzenet),
- `message` (framework-szintű vagy üzleti üzenet),
- `errors` (mezőszintű validációs hibák).

Ez heterogén hibaformátum mellett is stabil kliensműködést tesz lehetővé.

## 3.5.5. Kulcsfontosságú végpontcsoportok (aktuális állapot)

Az API szerződés fő funkcionális blokkjai:

- **Auth és session**
  - `POST /api/login`
  - `POST /api/logout`
  - `GET /api/user`
- **Felhasználók és adminisztráció**
  - `GET /api/users`
  - admin: `POST /api/users`, `PUT /api/users/{id}`, `DELETE /api/users/{id}`
  - admin: `POST /api/users/{id}/suspend`, `POST /api/users/{id}/unsuspend`
  - admin: `GET /api/admin/users/online-status`
- **Szólisták és szavak**
  - `GET/POST /api/lists`, `GET/PUT/DELETE /api/lists/{list}`
  - `GET/POST /api/lists/{list}/words`
  - `PUT/DELETE /api/lists/{list}/words/{word}`
  - `PUT /api/lists/{list}/word-generations`
- **Generációs üzenetek és szókapcsolatok**
  - `GET/PUT /api/lists/{list}/word-gen-messages`
  - `GET/POST /api/lists/{list}/word-relations`
  - `PUT /api/lists/{list}/word-relations/from/{fromWord}`
  - `DELETE /api/lists/{list}/word-relations/{relation}`
- **Színlisták és színek**
  - `GET/POST /api/color-lists`, `GET/PUT/DELETE /api/color-lists/{color_list}`
  - `GET/POST /api/color-lists/{color_list}/colors`
  - `PUT/DELETE /api/color-lists/{color_list}/colors/{color}`
- **Táblaállapot-mentések**
  - `apiResource /api/board-save-groups`
  - `apiResource /api/board-save-groups/{board_save_group}/saves`
- **Feladatmentések és értékelések**
  - `apiResource /api/task-save-groups`
  - `apiResource /api/task-save-groups/{task_save_group}/saves`
  - `GET/POST /api/task-saves/{task_save}/evaluations`
  - `PUT/DELETE /api/task-saves/{task_save}/evaluations/{task_evaluation}`
- **Staff nézet**
  - `GET /api/staff/task-evaluations`
  - `GET /api/staff/task-evaluations/{task_evaluation}`
- **Naplózás**
  - `POST /api/access-logs/visit`
  - `GET /api/access-logs/me`
  - admin: `GET /api/access-logs`

## 3.5.6. Kommunikációs konzisztencia és bővíthetőség

Az API-szerződés kialakítása támogatja a hosszú távú karbantarthatóságot:

- egységes URI- és metóduskonvenciók,
- middleware-alapú, rétegezett hozzáférésvédelem,
- relációt kifejező beágyazott útvonalak,
- JSON alapú, géppel jól feldolgozható válaszstruktúra.

Ennek eredményeként a frontend és backend fejlesztése részben függetleníthető, miközben az adatcsere szerződéses kerete stabil marad.
