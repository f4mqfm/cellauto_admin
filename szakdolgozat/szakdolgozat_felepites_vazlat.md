# Szakdolgozat — fejezetvázlat (tartalomjegyzék)

Ez a fájl a `szakdolgozat_felepites_vazlat.pdf` szöveges, szerkeszthető változataként szolgál. A hierarchia a repóban lévő bővített LaTeX-forrásból van összerakva: `thesis-cellauto-hu-bovitett.tex` és az `include/bov-*.tex` fájlok (lásd `UTMUTATO.txt` — „minta szerinti fejezetstruktúra”).

---

## Előzetes részek (`bov-ch00-front.tex`)

- **Címlap** (`\maketitle`)
- **Feladatkiírás** (beszkenált / melléklet a tanszék szerint)
- **Szakdolgozati témaválasztó adatlap** (hivatkozás, szinkron a címmel)
- **Nyilatkozat**
- **Köszönetnyilvánítás** (opcionális)
- **Kivonat** + kulcsszavak
- **Minta szerinti fejezetstruktúra** (számozott összefoglaló a tartalomjegyzék előtt)
- **Tartalomjegyzék**

---

## Főszöveg — fejezetek és alfejezetek

### 1. Bevezetés és célkitűzés (`bov-ch01-bevez-es-elmelt.tex`)

- **1.1** Motiváció
- **1.2** Indoklás — összhang a szakdolgozati témaválasztó adatlappal
  - Miért választottam ezt a témát?
  - Szakmai és képzési relevancia
  - Oktatási és felhasználói hasznosság
  - Technológiai és piaci indoklás
  - Személyes motiváció és tanulási cél
  - Kockázatok és vállalás
- **1.3** A fejlesztés tárgya
- **1.4** Célkitűzés
- **1.5** A dolgozat határa

### 2. Irodalomkutatás és elméleti háttér (`bov-ch01-bevez-es-elmelt.tex`, folytatás)

- **2.1** Sejtautomata fogalma
- **2.2** Szomszédságok és dimenzió
- **2.3** Stephen Wolfram elemi automatái (emlékeztető)
- **2.4** Conway Életjátéka
- **2.5** Oktatási és demonstrációs alkalmazások
- **2.6** Kapcsolódó szoftverek és eszközök (rövid áttekintés)
- **2.7** Technológiai háttér (választás indoklása)

### 3. Követelmények és specifikáció (`bov-ch02-kovet-es-arch.tex`)

- **3.1** Funkcionális követelmények (összefoglaló)
- **3.2** Nem funkcionális követelmények

### 4. Rendszerarchitektúra (`bov-ch02-kovet-es-arch.tex`, folytatás)

- **4.1** Komponensdiagram (logikai)
- **4.2** Hitelesítési folyamat
- **4.3** Jogosultsági rétegek

### 5. Adatbázis tervezés és felépítés (`bov-ch03-adatbazis.tex`)

- **5.1** Globális megközelítés
- **5.2** Üzleti táblák áttekintése
- **5.3** ER és UML
- **5.4** Laravel infrastruktúra táblák
- **5.5** Nem funkcionális szempontok (adat)

### 6. Részletes oszlopleírások és SQL (`bov-ch03b-oszlopok-reszletes.tex`)

- **6.1** Részletes oszlopleírások (üzleti táblák)
  - `lists` és `words`
  - `color_lists` és `colors`
  - `board_save_groups` és `board_saves`
- **6.2** SQL sémarészletek (illusztráció)
  - `lists` és `words` — `CREATE TABLE`

### 7. A REST API teljes dokumentációja (`bov-ch04-api.tex`)

- **7.1** Általános szerződés
- **7.2** Végpontok összesítő táblázata
- **7.3** Bejelentkezés és ping
  - `POST /api/login`
  - `GET /api/ping`
- **7.4** Felhasználók (`api/docs/api-users.md`)
  - `GET /api/user` és `GET /api/users`
  - Admin műveletek
- **7.5** Szólisták és szavak (`api/docs/api-lists-words.md`)
- **7.6** Színpaletták (`api/docs/api-color-lists-colors.md`)
- **7.7** Táblaállapot mentések
  - Üzleti követelmény és implementáció eltérése
  - Payload séma (ajánlott, `api-board-saves.md`)
- **7.8** cURL példák (rövid)

### 8. Táblaállapot mentések — részletes API (`bov-ch04b-board-save-teljes.tex`)

- **8.1** Fogalmak
- **8.2** Hitelesítés
- **8.3** Csoport végpontok
- **8.4** Mentés végpontok
- **8.5** Payload séma — kötelező meta kulcsok
- **8.6** Cellák tárolása
- **8.7** Opcionális UI-kontextus
- **8.8** Példa payload (JSON)
- **8.9** Implementációs eltérések jegyzőkönyve

### 9. Az admin és a publikus kliens megvalósítása (`bov-ch05-frontend-uzem-zaras.tex`)

- **9.1** Admin (React, TypeScript, Vite)
- **9.2** A `www` kliens

### 10. Telepítés, tesztelés, biztonság (`bov-ch05-frontend-uzem-zaras.tex`, folytatás)

- **10.1** Telepítés
- **10.2** Tesztelés
- **10.3** Biztonság

### 11. Összegzés és továbbfejlesztés (`bov-ch05-frontend-uzem-zaras.tex`, folytatás)

- **11.1** Eredmény
- **11.2** Irányok

### Irodalomjegyzék

- A LaTeX `\begin{thebibliography}` blokk szerint (Wolfram, Laravel, React, Cellauto projekt dokumentáció).

### Függelék

- **Forráskód és dokumentáció helye** (`collect-sources.sh`, `UTMUTATO.txt`)

---

## Rövidebb változat — `thesis-cellauto-hu.tex` (alternatív felosztás)

Ha a rövidebb, nem bővített sablont használod, a fejezetek:

1. Bevezetés (motiváció, dolgozat felépítése)
2. Elméleti háttér: sejtautomaták
3. Rendszerterv és architektúra
4. Backend: Laravel REST API
5. Adminisztrációs felület
6. A publikus sejtautomata kliens (`www`)
7. Adatmodell és táblaállapot-mentések
8. Tesztelés, minőség, továbbfejlesztés
9. Összegzés
10. Projektdokumentumok és forrásgyűjtés

---

*Utolsó szinkron a repó LaTeX struktúrájával: a fenti felsorolás a `include/` mappában lévő `\chapter` / `\section` / `\subsection` címek tükrözése.*
