# API – Lists & Words

Ez a rész a szólisták (`lists`) és a listán belüli szavak (`words`) végpontjait írja le.

A termék-követelmények összefoglalója a [`wordlist.txt`](./wordlist.txt) fájlban van; e dokumentum az API szerződését rögzíti.

## Követelmények összefoglalója (spec)

- **Lista neve** (`name`) változatlan fogalom: egy szólistának van neve (pl. „Angol szavak”).
- **Szavak generációkban**: egy listához GEN1 … GENN tartozik; **legalább egy szó** kell generációnként; a generációk **1-től N-ig** folytonosan bővíthetők.
- **`public`**: logikai mező a listán; alapból **false**, API-ból állítható.
- **Relációk** csak **szomszédos generációk** között: GEN1→GEN2, GEN2→GEN3, … (nem lehet kihagyott generáció vagy kereszt-generáció).
- **`notes`**: többsoros megjegyzés (textarea); az API **csak tárolja**, nem értelmezi.
- **`wordlist`**: nagy szövegmező; a felhasználó ide viheti előre összeállított, **pontosvesszővel** tagolt szavakat / generációkat. A **`*` karakterrel kezdődő sorok** az admin oldal „kakuktojás” szabályai szerinti változatok (ugyanolyan struktúra, de nem minden pozíció kötelező); **az API számára ez csak sima szöveg**, nincs szerver oldali szemantika.

### Admin felület (UX, nem API-kényszer)

- A **`notes`** mező tipikusan **2–3 soros** textarea.
- A **`wordlist`** mező tipikusan **kb. 6 soros**, **átméretezhető** textarea.
- Rövid magyarázat a wordlisthez: a **`;` a GEN elválasztó**; a **`*`-gal kezdődő sorok** kakuktojás szóként csak a generációs szavakat bővítik (üres `;` közök engedettek), **relációt nem alkotnak**. Élek csak * nélküli sorok szomszédos oszlopai közül.
- **„Szavak és relációk generálása a wordlistből”** gomb az adminban: a szöveget kliens oldalon értelmezi (oszlopok; * nélküli sorokban szomszédos oszlopok között irányított élek), majd feltölti a szavakat és a relációkat. Ha már vannak szavak (és esetleg relációk), **megerősítés** után felülírja őket.

---

## Adatmodell – lista (`lists`)

- `id`, `user_id`, `name`
- **`public`** (boolean, tipikusan alapértelmezés: `false`)
- **`notes`** (string, nullable) – többsoros szöveg
- **`wordlist`** (string, nullable) – nagy szövegblokk (admin szerkesztéshez)

## Adatmodell – szavak (`words`) – generációk

- `list_id`, `generation`, `word`
- `generation` (INT, >= 1) – GEN1..GENN logika
- `word` azonos generáción belül egyedi (`UNIQUE(list_id, generation, word)`)

Egy szólista generációi 1-től N-ig folytonosan kezelhetők.

## Auth

Minden itt leírt végpont **védett**: `auth:sanctum` szükséges.

### Bearer token header

```
Authorization: Bearer <TOKEN>
```

## Listák (lists)

### Megjegyzés és szöveges szólista (admin szerkesztéshez)

A lista rekordban két opcionális szövegmező van; az API **nem értelmezi** a tartalmukat, csak tárolja és visszaadja (az admin felület dolgozik belőlük):

- **`notes`**: többsoros megjegyzés (textarea), tetszőleges szöveg.
- **`wordlist`**: egy nagy szövegblokk; a felhasználó ide viheti előre összeállított szavakat. **Konvenció** (admin UI, nem API validáció):
  - a **`;` (pontosvessző)** a **GEN (oszlop) elválasztója**;
  - a **`*` karakterrel kezdődő sorok** az admin generátornál csak szókészletet adnak (ugyanaz az oszlop-struktúra, üres `; … ;` cellákkal is), relációt nem alkotnak; az API a szöveget csak tárolja.

### GET `/api/lists`

A bejelentkezett user **saját listái**.

- **200 OK**: lista tömb (elemekben: `id`, `user_id`, `name`, `public`, `notes`, `wordlist`, …)

### GET `/api/public-lists`

**Más felhasználók** által **publikusnak** jelölt listák – pl. www kliens; **az admin lista-nézet nem ezt** használja a saját listákra.

- **Auth**: kötelező (bejelentkezett user).
- **Szűrés**: `public === true` és a lista **nem** a hívó user tulajdona (`user_id != aktuális user`).
- **200 OK**: lista tömb; gyakran kiegészítve tulajdonos mezőkkel: `owner_username`, `owner_name`, `owner_email` (a részletes mezőnév a backend válaszától függ).

### POST `/api/lists`

Lista létrehozása.

- **Body**
  - `name` (string, kötelező, max 255)
  - `public` (boolean, opcionális, default: `false`)
  - `notes` (string, opcionális, többsor is lehet)
  - `wordlist` (string, opcionális, nagy szöveg; pl. pontosvesszővel tagolt szavak generációnként)

- **201 Created válasz**
  - lista rekord (legalább: `id`, `user_id`, `name`, `public`, `notes`, `wordlist`)

Példa:

```bash
curl -X POST http://localhost:8000/api/lists \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"angol szavak","public":true,"notes":"Saját jegyzet","wordlist":"door;world;sun;kes;villa"}'
```

### GET `/api/lists/{list}`

Egy lista lekérése **a szavaival együtt** (`words` reláció betöltve, generáció szerint rendezve).

- **Jogosultság**
  - Ha a lista nem a useré és nem `public`: **403** `{"error":"Nincs jogosultság"}`

### PUT `/api/lists/{list}`

Lista frissítése (név, láthatóság, megjegyzés, szöveges szólista).

- **Body**
  - `name` (string, kötelező, max 255)
  - `public` (boolean, opcionális; ha nincs megadva, marad a korábbi érték)
  - `notes` (string, opcionális; ha nincs megadva, marad a korábbi érték)
  - `wordlist` (string, opcionális; ha nincs megadva, marad a korábbi érték)

- **Jogosultság**
  - Ha nem a useré: **403**

### DELETE `/api/lists/{list}`

Lista törlése.

- **Mellékhatás**
  - a lista összes szava is törlődik (`words` rekordok)

- **Jogosultság**
  - Ha nem a useré: **403**

## Szavak (words) egy listán belül

### GET `/api/lists/{list}/words`

A lista szavai generációkra bontva.

- **200 OK válasz példa**

```json
{
  "list_id": 1,
  "generations": [
    {
      "generation": 1,
      "words": [
        { "id": 10, "word": "door" },
        { "id": 11, "word": "world" }
      ]
    },
    {
      "generation": 2,
      "words": [
        { "id": 12, "word": "kes" }
      ]
    }
  ]
}
```

- **Jogosultság**
  - Ha nem a useré: **403**

### POST `/api/lists/{list}/words`

Szó(k) hozzáadása egy adott generációhoz.

- **Body**
  - `generation` (integer, kötelező, >= 1)
  - `word` (string, opcionális) **vagy**
  - `words` (string tömb, opcionális, min 1)

- **Egyediség**
  - `(list_id, generation, word)` egyedi.

Példa:

```bash
curl -X POST http://localhost:8000/api/lists/1/words \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"generation":1,"words":["door","world","sun"]}'
```

### PUT `/api/lists/{list}/word-generations`

Teljes generációs struktúra cseréje egyben (frontend-kompatibilis mentés).

- **Body**
  - `generations`: tömb, min 1
  - minden elem:
    - `generation` (integer, >= 1)
    - `words` (string tömb, min 1)

- **Szabályok**
  - a generációk csak **1..N folytonosan** adhatók meg
  - minden generációhoz legalább 1 szó kötelező

Példa:

```json
{
  "generations": [
    { "generation": 1, "words": ["door", "world", "sun"] },
    { "generation": 2, "words": ["kes", "villa", "ollo"] },
    { "generation": 3, "words": ["utazas", "uszas", "varas"] }
  ]
}
```

### PUT `/api/lists/{list}/words/{word}`

Szó szerkesztése (részlegesen: legalább egy mező kell).

- **Body (opcionális mezők)**
  - `generation` (integer, >= 1)
  - `word` (string, max 255) – az adott generáción belül egyedi (a jelenlegi sor kivételével)

Ha egyik mező sincs: **422** `{"error":"Nincs frissítendő mező"}`.

- **Jogosultság és konzisztencia**
  - Ha a lista nem a useré: **403**
  - Ha a `{word}` nem ehhez a listához tartozik: **404** `{"error":"A szó nem ehhez a listához tartozik"}`

### DELETE `/api/lists/{list}/words/{word}`

Szó törlése.

- **Jogosultság és konzisztencia**
  - Ha a lista nem a useré: **403**
  - Ha a `{word}` nem ehhez a listához tartozik: **404**
  - Ha az adott generációban ez az utolsó szó lenne: **422**

## Szó-relációk (GENn -> GENn+1)

A relációkat csak **szomszédos generációk** között lehet megadni (példa a specből: GEN1-ből egy „one” szóhoz több GEN2 cél; GEN2→GEN3 hasonlóan):

- `GEN1 -> GEN2`
- `GEN2 -> GEN3`
- …

### GET `/api/lists/{list}/word-relations`

Relációk listázása.

- **Query (opcionális)**
  - `from_generation` (integer): ha megadod, csak az adott GEN-ből induló relációk jönnek vissza

### POST `/api/lists/{list}/word-relations`

Egy reláció létrehozása.

- **Body**
  - `from_word_id` (integer, kötelező)
  - `to_word_id` (integer, kötelező)

- **Szabály**
  - csak akkor engedett, ha `to.generation = from.generation + 1`

Példa:

```bash
curl -X POST http://localhost:8000/api/lists/1/word-relations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"from_word_id":10,"to_word_id":25}'
```

### PUT `/api/lists/{list}/word-relations/from/{fromWord}`

Egy adott „from” szó összes kimenő relációjának cseréje (admin szerkesztéshez kényelmes).

- **Body**
  - `to_word_ids` (integer tömb, kötelező; lehet üres tömb is)

### DELETE `/api/lists/{list}/word-relations/{relation}`

Reláció törlése.

## Frontend hívásminták (generation alapú)

Az alábbi minták ugyanazt a struktúrát használják, amit a frontendnek kezelnie kell.

### 1) Generációk lekérése

```bash
curl -X GET http://localhost:8000/api/lists/1/words \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Accept: application/json"
```

Válasz:

```json
{
  "list_id": 1,
  "generations": [
    { "generation": 1, "words": [ { "id": 101, "word": "door" } ] },
    { "generation": 2, "words": [ { "id": 102, "word": "kes" } ] }
  ]
}
```

### Lista létrehozása public flaggel és szövegmezőkkel

```bash
curl -X POST http://localhost:8000/api/lists \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name":"Angol szavak","public":true,"notes":"Saját megjegyzés","wordlist":"door;world;sun;kes;villa"}'
```

### Publikus listák (más tulajdonosoktól)

```bash
curl -X GET http://localhost:8000/api/public-lists \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Accept: application/json"
```

### 2) Szavak hozzáadása adott generációhoz

```bash
curl -X POST http://localhost:8000/api/lists/1/words \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"generation":2,"words":["villa","ollo","asztal"]}'
```

### 3) Teljes struktúra mentése egyben

```bash
curl -X PUT http://localhost:8000/api/lists/1/word-generations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "generations": [
      { "generation": 1, "words": ["door", "world", "sun"] },
      { "generation": 2, "words": ["kes", "villa", "ollo"] },
      { "generation": 3, "words": ["utazas", "uszas", "varas"] }
    ]
  }'
```

### 4) Egy szó módosítása

```bash
curl -X PUT http://localhost:8000/api/lists/1/words/101 \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"generation":3,"word":"utazas"}'
```

### 5) Egy szó törlése

```bash
curl -X DELETE http://localhost:8000/api/lists/1/words/101 \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Accept: application/json"
```

## Hol legyen ez dokumentálva?

Ezt a modul-specifikus API dokumentációt a `docs/api-lists-words.md` fájlban kell karbantartani; a követelmény-forrás a `docs/wordlist.txt`.
