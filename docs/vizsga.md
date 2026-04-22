# A „Vizsgák megtekintése” modul bemutatása

A „Vizsgák megtekintése” modul az admin felületen a teljesítményadatok ellenőrzését és elemzését szolgálja.  
A funkció célja, hogy az oktató/admin gyorsan át tudja tekinteni a mentett vizsgaeredményeket, majd egy kiválasztott sor részleteit részletesen is megvizsgálhassa.

## A modul szerepe a rendszerben

A vizsgamodul összeköti az értékelési folyamatot az adminisztratív döntéstámogatással.  
Segítségével nemcsak az látható, hogy egy felhasználó mikor és milyen eredményt ért el, hanem az is, hogy a hibák milyen jellegűek voltak (például cella- vagy mondatszintű eltérések).

## Listanézet és szűrés

A modul első szintje egy táblázatos listanézet, amely a legfontosabb adatokat jeleníti meg:

- vizsga dátuma,
- tanuló adatai,
- kapcsolódó feladat,
- cellaeredmény százalékos mutatója,
- mondateredmény százalékos mutatója,
- megjegyzés.

A lista szűrhető dátumtartomány, felhasználó, feladatnév és megjegyzés alapján.  
Ez a szűrési lehetőség különösen hasznos nagy adatmennyiségnél, amikor célzottan kell visszakeresni egy adott időszakot vagy felhasználót.

## Részletes nézet (modális ablak)

Egy sor kiválasztásakor a rendszer modális ablakban jeleníti meg a részletes vizsgaadatokat.  
Itt a felhasználó láthatja:

- az azonosító és időbélyeg információkat,
- az összegző teljesítménymutatókat,
- a cellák és mondatok számszerű bontását,
- a megjegyzést,
- a mondateredmény szöveges részleteit.

A modális megjelenítés előnye, hogy a felhasználó a lista kontextusának elhagyása nélkül tud részleteket elemezni.

## Használhatósági és működési szempontok

A modul kialakítása a gyakorlati használatot támogatja:

- az adatok lapozott formában jelennek meg, így nem terhelik túl az oldalt,
- a táblázat és a részletes nézet gyors átjárást biztosít a makro- és mikroszintű elemzés között,
- hosszabb tartalom esetén a modális ablak görgethető, a bezárási lehetőség pedig végig elérhető marad.

## Pedagógiai és adminisztratív jelentőség

A vizsgák áttekintése nemcsak technikai riportálás, hanem pedagógiai visszacsatolás is.  
Az oktató a részletes adatok alapján pontosabban azonosíthatja a tipikus hibamintákat, ezáltal célzottabban tud fejlesztő feladatokat adni.

## Összegzés

A „Vizsgák megtekintése” modul az értékelési folyamat egyik kulcseleme: áttekinthető listanézettel, célzott szűréssel és részletes modális elemzéssel támogatja a szakmai döntéshozatalt.  
Szakdolgozati szempontból ez a komponens jól szemlélteti, hogyan kapcsolódik az adatalapú kiértékelés a tanulási folyamat minőségének fejlesztéséhez.
