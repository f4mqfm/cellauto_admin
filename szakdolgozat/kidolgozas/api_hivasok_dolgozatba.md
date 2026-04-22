# API hívások dokumentációja

## 1. Bevezetés

Jelen fejezet a rendszer backend API felületének összefoglaló dokumentációját tartalmazza, a szakdolgozati formai elvárásokhoz igazítva. Az interfész REST szemléletben készült, JSON alapú kérés-válasz kommunikációval.

Az összes végpont közös előtagja: `/api`.

## 2. Hitelesítés és jogosultságkezelés

A végpontok három fő jogosultsági szint szerint csoportosíthatók:

- nyilvános végpontok (hitelesítés nélkül),
- bejelentkezett felhasználói végpontok (`auth:sanctum`, `active-session`),
- emelt jogosultságú végpontok (`staff`, illetve `admin` middleware).

A hitelesített hívások esetén a kliensnek érvényes sessionnel és tokennel kell rendelkeznie.

## 3. Nyilvános végpontok

| HTTP metódus | URI | Funkció |
|---|---|---|
| GET | `/api/ping` | Elérhetőségi ellenőrzés (egészségügyi válasz). |
| POST | `/api/login` | Felhasználói bejelentkezés. |
| POST | `/api/access-logs/visit` | Látogatási esemény rögzítése. |

## 4. Hitelesített felhasználói végpontok

### 4.1. Munkamenet és felhasználói profil

| HTTP metódus | URI | Funkció |
|---|---|---|
| POST | `/api/logout` | Kijelentkezés. |
| GET | `/api/user` | A bejelentkezett felhasználó adatainak lekérdezése. |
| GET | `/api/users` | Felhasználók listázása (alkalmazási szintű nézet). |
| GET | `/api/access-logs/me` | Saját hozzáférési naplóbejegyzések lekérdezése. |

### 4.2. Szólisták kezelése

| HTTP metódus | URI | Funkció |
|---|---|---|
| GET | `/api/lists` | Saját szólisták lekérdezése. |
| GET | `/api/public-lists` | Nyilvános szólisták lekérdezése. |
| POST | `/api/lists` | Új szólista létrehozása. |
| GET | `/api/lists/{list}` | Egy szólista lekérdezése. |
| PUT | `/api/lists/{list}` | Szólista módosítása. |
| DELETE | `/api/lists/{list}` | Szólista törlése. |

### 4.3. Szavak és generációs üzenetek kezelése

| HTTP metódus | URI | Funkció |
|---|---|---|
| GET | `/api/lists/{list}/words` | Lista szavainak lekérdezése. |
| POST | `/api/lists/{list}/words` | Új szó felvétele a listába. |
| PUT | `/api/lists/{list}/words/{word}` | Egy szó módosítása. |
| DELETE | `/api/lists/{list}/words/{word}` | Egy szó törlése. |
| PUT | `/api/lists/{list}/word-generations` | Generációk cseréje (batch jelleggel). |
| GET | `/api/lists/{list}/word-gen-messages` | Generációs üzenetek lekérdezése. |
| PUT | `/api/lists/{list}/word-gen-messages` | Generációs üzenetek felülírása. |

### 4.4. Szókapcsolatok kezelése

| HTTP metódus | URI | Funkció |
|---|---|---|
| GET | `/api/lists/{list}/word-relations` | Szókapcsolatok lekérdezése. |
| POST | `/api/lists/{list}/word-relations` | Új szókapcsolat létrehozása. |
| PUT | `/api/lists/{list}/word-relations/from/{fromWord}` | Egy kiinduló szóhoz tartozó kapcsolatok cseréje. |
| DELETE | `/api/lists/{list}/word-relations/{relation}` | Szókapcsolat törlése. |

### 4.5. Színes listák és színek kezelése

| HTTP metódus | URI | Funkció |
|---|---|---|
| GET | `/api/color-lists` | Színes listák lekérdezése. |
| POST | `/api/color-lists` | Színes lista létrehozása. |
| GET | `/api/color-lists/{color_list}` | Egy színes lista lekérdezése. |
| PUT | `/api/color-lists/{color_list}` | Színes lista módosítása. |
| DELETE | `/api/color-lists/{color_list}` | Színes lista törlése. |
| GET | `/api/color-lists/{color_list}/colors` | A listához tartozó színek lekérdezése. |
| POST | `/api/color-lists/{color_list}/colors` | Új szín hozzáadása. |
| PUT | `/api/color-lists/{color_list}/colors/{color}` | Szín módosítása. |
| DELETE | `/api/color-lists/{color_list}/colors/{color}` | Szín törlése. |

### 4.6. Táblaállapot-mentések kezelése

| HTTP metódus | URI | Funkció |
|---|---|---|
| GET | `/api/board-save-groups` | Mentéscsoportok listázása. |
| POST | `/api/board-save-groups` | Mentéscsoport létrehozása. |
| GET | `/api/board-save-groups/{board_save_group}` | Egy mentéscsoport lekérdezése. |
| PUT | `/api/board-save-groups/{board_save_group}` | Mentéscsoport módosítása. |
| DELETE | `/api/board-save-groups/{board_save_group}` | Mentéscsoport törlése. |
| GET | `/api/board-save-groups/{board_save_group}/saves` | Csoporton belüli mentések lekérdezése. |
| POST | `/api/board-save-groups/{board_save_group}/saves` | Új mentés létrehozása. |
| GET | `/api/board-save-groups/{board_save_group}/saves/{save}` | Egy mentés lekérdezése. |
| PUT | `/api/board-save-groups/{board_save_group}/saves/{save}` | Mentés módosítása. |
| DELETE | `/api/board-save-groups/{board_save_group}/saves/{save}` | Mentés törlése. |

### 4.7. Feladatmentések és értékelések kezelése

| HTTP metódus | URI | Funkció |
|---|---|---|
| GET | `/api/task-save-groups` | Feladatmentés-csoportok listázása. |
| POST | `/api/task-save-groups` | Feladatmentés-csoport létrehozása. |
| GET | `/api/task-save-groups/{task_save_group}` | Egy feladatmentés-csoport lekérdezése. |
| PUT | `/api/task-save-groups/{task_save_group}` | Feladatmentés-csoport módosítása. |
| DELETE | `/api/task-save-groups/{task_save_group}` | Feladatmentés-csoport törlése. |
| GET | `/api/task-save-groups/{task_save_group}/saves` | Csoporton belüli feladatmentések lekérdezése. |
| POST | `/api/task-save-groups/{task_save_group}/saves` | Új feladatmentés létrehozása. |
| GET | `/api/task-save-groups/{task_save_group}/saves/{save}` | Egy feladatmentés lekérdezése. |
| PUT | `/api/task-save-groups/{task_save_group}/saves/{save}` | Feladatmentés módosítása. |
| DELETE | `/api/task-save-groups/{task_save_group}/saves/{save}` | Feladatmentés törlése. |
| GET | `/api/task-saves/{task_save}/evaluations` | Feladathoz tartozó értékelések lekérdezése. |
| POST | `/api/task-saves/{task_save}/evaluations` | Új értékelés létrehozása. |
| PUT | `/api/task-saves/{task_save}/evaluations/{task_evaluation}` | Értékelés módosítása. |
| DELETE | `/api/task-saves/{task_save}/evaluations/{task_evaluation}` | Értékelés törlése. |

## 5. Staf jogosultságú végpontok

| HTTP metódus | URI | Funkció |
|---|---|---|
| GET | `/api/staff/task-evaluations` | Értékelések listázása oktatói/staf nézetben. |
| GET | `/api/staff/task-evaluations/{task_evaluation}` | Egy értékelés részletes lekérdezése oktatói/staf nézetben. |

## 6. Admin jogosultságú végpontok

| HTTP metódus | URI | Funkció |
|---|---|---|
| GET | `/api/admin/users/online-status` | Felhasználók online állapotának lekérdezése. |
| GET | `/api/access-logs` | Teljes hozzáférési napló lekérdezése. |
| POST | `/api/users` | Új felhasználó létrehozása. |
| PUT | `/api/users/{id}` | Felhasználói adatok módosítása. |
| DELETE | `/api/users/{id}` | Felhasználó törlése. |
| POST | `/api/users/{id}/suspend` | Felhasználó felfüggesztése. |
| POST | `/api/users/{id}/unsuspend` | Felfüggesztés feloldása. |

## 7. Összegzés

Az API kialakítása rétegezett jogosultsági struktúrát követ, amely elkülöníti a nyilvános, a felhasználói, valamint az emelt jogosultságú (staf és admin) műveleteket. A végpontok többsége CRUD szemléletű, ezért jól illeszthető kliensoldali állapotkezeléshez és későbbi bővítésekhez.
