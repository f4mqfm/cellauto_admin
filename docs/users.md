# Felhasználókezelés – rövid leírás

A rendszerben a felhasználókezelés az admin felület egyik alapmodulja.  
A célja, hogy az adminisztrátor egy helyen tudja kezelni a fiókok teljes életciklusát: létrehozás, módosítás, felfüggesztés/aktiválás és törlés.

## Jogosultsági elv

A felhasználókezelés csak admin szerepkörrel érhető el.  
Ha nem admin jelentkezik be, a modul nem engedi a műveleteket, ezzel csökkentve a jogosulatlan adatváltoztatás kockázatát.

## Támogatott szerepkörök

A felhasználók több szerepkört kaphatnak (például: vendég, diák, tanár, admin).  
A szerepkör határozza meg, hogy a felhasználó a rendszer mely részeit látja és milyen műveleteket végezhet.

## Alapműveletek

- **Létrehozás:** új felhasználó felvétele kötelező adatokkal (felhasználónév, név, e-mail, jelszó, szerepkör).
- **Szerkesztés:** meglévő felhasználó adatainak frissítése, szerepkör módosítása.
- **Felfüggesztés / újraaktiválás:** ideiglenes hozzáférés-kezelés törlés nélkül.
- **Törlés:** végleges eltávolítás; bizonyos védelmi szabályok mellett (például saját fiók vagy admin fiók törlésének tiltása).

## Keresés és áttekinthetőség

A listanézetben szöveges keresés segíti a gyors szűrést (azonosító, név, felhasználónév, e-mail, szerepkör alapján).  
Ez különösen nagy felhasználószámnál fontos, mert csökkenti az adminisztrációs időt és a hibalehetőséget.

## Visszajelzés és működési biztonság

A felület minden művelet után állapot-visszajelzést ad (siker/hiba üzenetek).  
A kockázatos lépéseknél megerősítő ablak jelenik meg, így a rendszer támogatja a tudatos, kontrollált módosítást.

## Összegzés

A felhasználókezelés modul a jogosultságkezelés és az üzemeltetési kontroll központi eleme.  
Az admin számára gyors és átlátható kezelést biztosít, miközben a beépített korlátozásokkal védi a rendszer konzisztenciáját.
