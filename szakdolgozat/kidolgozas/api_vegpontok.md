# API végpontok összefoglalója

Az alkalmazás REST szemléletű HTTP API-t kínál. Minden végpont az `/api` előtaggal érhető el (teljes példa: `GET /api/ping`).

## Közös megjegyzések

| Megjegyzés | Tartalom |
|------------|----------|
| Formátum | JSON (`Accept` / `Content-Type`: `application/json`) |
| Hitelesítés | Sanctum Bearer token (kivéve nyilvános végpontok) |
| Middleware | `auth:sanctum`, `active-session`; emelt jog: `staff`, `admin` |

Az `active-session` middleware ellenőrzi az érvényes tokent, a felhasználó aktív státuszát és az inaktivitási időkorlátot.

---

## Nyilvános végpontok

| Metódus | URI | Leírás |
|---------|-----|--------|
| GET | `/api/ping` | Egészség-/elérhetőség ellenőrzés (`ok`, `message`). |
| POST | `/api/login` | Bejelentkezés: body-ban `login`, `password`, `entry_point` (`www` \| `admin`). Válasz: token + felhasználó. |
| POST | `/api/access-logs/visit` | Látogatási esemény naplózása (nem feltétlenül bejelentkezett felhasználótól). |

---

## Bejelentkezett felhasználó (`auth:sanctum` + `active-session`)

### Munkamenet és felhasználó

| Metódus | URI | Leírás |
|---------|-----|--------|
| POST | `/api/logout` | Kijelentkezés; body: `entry_point` (`www` \| `admin`). Aktuális token törlése. |
| GET | `/api/user` | Bejelentkezett felhasználó adatai. |
| GET | `/api/users` | Felhasználók listája (alkalmazás logikája szerint). |
| GET | `/api/access-logs/me` | Saját hozzáférési naplóbejegyzések. |

### Szólisták (`lists_word`)

| Metódus | URI | Leírás |
|---------|-----|--------|
| GET | `/api/lists` | A bejelentkezett felhasználó saját listái. |
| GET | `/api/public-lists` | Nyilvános listák más felhasználóktól. |
| POST | `/api/lists` | Új lista létrehozása (`name`, opcionálisan `public`, `notes`, `wordlist`). |
| GET | `/api/lists/{list}` | Egy lista részletei (olvasás: saját vagy nyilvános lista). |
| PUT | `/api/lists/{list}` | Lista módosítása (csak tulajdonos). |
| DELETE | `/api/lists/{list}` | Lista törlése (csak tulajdonos). |

### Szavak és generációk

| Metódus | URI | Leírás |
|---------|-----|--------|
| GET | `/api/lists/{list}/words` | Szavak generációk szerint csoportosítva (JSON struktúra). |
| POST | `/api/lists/{list}/words` | Új szó(ok) egy generációban (csak tulajdonos). |
| PUT | `/api/lists/{list}/words/{word}` | Szó módosítása (csak tulajdonos). |
| DELETE | `/api/lists/{list}/words/{word}` | Szó törlése (csak tulajdonos). |
| PUT | `/api/lists/{list}/word-generations` | Teljes generációs struktúra felülírása (csak tulajdonos). |

### Generációs üzenetek

| Metódus | URI | Leírás |
|---------|-----|--------|
| GET | `/api/lists/{list}/word-gen-messages` | Üzenetek listája generációnként. |
| PUT | `/api/lists/{list}/word-gen-messages` | Üzenetek felülírása (csak tulajdonos). |

### Szókapcsolatok (GENn → GENn+1)

| Metódus | URI | Leírás |
|---------|-----|--------|
| GET | `/api/lists/{list}/word-relations` | Kapcsolatok listája; opcionális query: `from_generation`. |
| POST | `/api/lists/{list}/word-relations` | Új kapcsolat (`from_word_id`, `to_word_id`). |
| PUT | `/api/lists/{list}/word-relations/from/{fromWord}` | Egy kiinduló szó összes kimenő kapcsolatának cseréje (`to_word_ids`). |
| DELETE | `/api/lists/{list}/word-relations/{relation}` | Kapcsolat törlése. |

### Színlisták és színek

| Metódus | URI | Leírás |
|---------|-----|--------|
| GET | `/api/color-lists` | Saját színlisták. |
| POST | `/api/color-lists` | Új színlista (`name`). |
| GET | `/api/color-lists/{color_list}` | Egy színlista + színek (csak tulajdonos). |
| PUT | `/api/color-lists/{color_list}` | Színlista módosítása. |
| DELETE | `/api/color-lists/{color_list}` | Színlista törlése (színek is). |
| GET | `/api/color-lists/{color_list}/colors` | Színek listája. |
| POST | `/api/color-lists/{color_list}/colors` | Új szín (`color`, `position`). |
| PUT | `/api/color-lists/{color_list}/colors/{color}` | Szín módosítása. |
| DELETE | `/api/color-lists/{color_list}/colors/{color}` | Szín törlése. |

### Táblaállapot mentések (`board_save_groups`, `board_saves`)

Laravel `apiResource` – szabványos REST névkonvenció:

| Metódus | URI | Leírás |
|---------|-----|--------|
| GET | `/api/board-save-groups` | Mentéscsoportok listája. |
| POST | `/api/board-save-groups` | Új csoport. |
| GET | `/api/board-save-groups/{board_save_group}` | Egy csoport. |
| PUT | `/api/board-save-groups/{board_save_group}` | Csoport módosítása. |
| DELETE | `/api/board-save-groups/{board_save_group}` | Csoport törlése. |
| GET | `/api/board-save-groups/{board_save_group}/saves` | Csoport mentései. |
| POST | `/api/board-save-groups/{board_save_group}/saves` | Új mentés. |
| GET | `/api/board-save-groups/{board_save_group}/saves/{save}` | Egy mentés. |
| PUT | `/api/board-save-groups/{board_save_group}/saves/{save}` | Mentés módosítása. |
| DELETE | `/api/board-save-groups/{board_save_group}/saves/{save}` | Mentés törlése. |

### Feladatmentések és értékelések

**Csoportok és mentések** (`task_save_groups`, `task_saves`):

| Metódus | URI | Leírás |
|---------|-----|--------|
| GET | `/api/task-save-groups` | Feladatmentés-csoportok. |
| POST | `/api/task-save-groups` | Új csoport. |
| GET | `/api/task-save-groups/{task_save_group}` | Egy csoport. |
| PUT | `/api/task-save-groups/{task_save_group}` | Csoport módosítása. |
| DELETE | `/api/task-save-groups/{task_save_group}` | Csoport törlése. |
| GET | `/api/task-save-groups/{task_save_group}/saves` | Csoport feladatmentései. |
| POST | `/api/task-save-groups/{task_save_group}/saves` | Új feladatmentés. |
| GET | `/api/task-save-groups/{task_save_group}/saves/{save}` | Egy feladatmentés. |
| PUT | `/api/task-save-groups/{task_save_group}/saves/{save}` | Feladatmentés módosítása. |
| DELETE | `/api/task-save-groups/{task_save_group}/saves/{save}` | Feladatmentés törlése. |

**Értékelések** (a feladatmentés azonosítója a path-ban):

| Metódus | URI | Leírás |
|---------|-----|--------|
| GET | `/api/task-saves/{task_save}/evaluations` | Értékelések listája (láthatóság: tulajdonos/admin vs. saját). |
| POST | `/api/task-saves/{task_save}/evaluations` | Új értékelés. |
| PUT | `/api/task-saves/{task_save}/evaluations/{task_evaluation}` | Értékelés módosítása. |
| DELETE | `/api/task-saves/{task_save}/evaluations/{task_evaluation}` | Értékelés törlése. |

---

## Staff jogosultság (`staff` middleware)

| Metódus | URI | Leírás |
|---------|-----|--------|
| GET | `/api/staff/task-evaluations` | Értékelések listája oktatói/staff nézetben. |
| GET | `/api/staff/task-evaluations/{task_evaluation}` | Egy értékelés részletei. |

---

## Admin jogosultság (`admin` middleware)

| Metódus | URI | Leírás |
|---------|-----|--------|
| GET | `/api/admin/users/online-status` | Felhasználók online információi (token + utolsó napló). |
| GET | `/api/access-logs` | Teljes hozzáférési napló. |
| POST | `/api/users` | Új felhasználó létrehozása. |
| PUT | `/api/users/{id}` | Felhasználó módosítása. |
| DELETE | `/api/users/{id}` | Felhasználó törlése (korlátozásokkal). |
| POST | `/api/users/{id}/suspend` | Felhasználó felfüggesztése. |
| POST | `/api/users/{id}/unsuspend` | Felfüggesztés feloldása. |

---

## További dokumentáció

Részletes request body szabályok és példák egyes modulokhoz:

- `docs/api-board-saves.md` – táblaállapot mentések
- `docs/api-task-saves.md` – feladatmentések és értékelések
