# 3.4. Adatbázis és perzisztencia

## Bevezetés

A rendszer backend komponense relációs adatbázisra épülő perzisztenciát valósít meg. A perzisztencia célja, hogy az alkalmazás üzleti objektumai (felhasználók, listák, mentések, értékelések, naplóbejegyzések) konzisztens, visszakereshető és tranzakcióbiztos módon tárolódjanak.

## Adatbázis-modell alapelvei

A projekt adatmodellje relációs szemléletet követ, amelyben:

- a központi entitás a `users` tábla,
- a domain-specifikus táblák ehhez és egymáshoz kapcsolódnak idegen kulcsokon keresztül,
- az 1-N kapcsolatok dominálnak (pl. felhasználó -> listák, csoport -> mentések),
- több helyen összerendelő jellegű relációk jelennek meg (pl. szókapcsolatok, feladatértékelések).

Az adatszerkezet kialakítása támogatja az üzleti logika természetes leképezését az adatbázis szintjén.

## Sémakezelés és verziókövetés

Az adatbázis séma Laravel migrációkkal van kezelve. Ez a megközelítés biztosítja:

- a struktúra verziózott nyomon követhetőségét,
- a fejlesztői és éles környezetek közötti reprodukálhatóságot,
- a kontrollált és visszagörgethető sémamódosításokat.

A migrációk alkalmazása különösen fontos olyan rendszerben, ahol a domain folyamatosan bővül (pl. új értékelési mezők, új relációk, névkonvenciók változása).

## Perzisztencia megvalósítása az alkalmazásrétegben

Az alkalmazás Eloquent ORM-et használ, amely:

- modellek formájában reprezentálja a táblákat,
- relációkat deklarál (`belongsTo`, `hasMany`),
- mezőszintű típuskonverziókat ad (`casts`, pl. `array`, `datetime`, `integer`),
- egységes API-t biztosít az adatbázis-műveletekhez.

Ennek eredményeként a perzisztencia réteg jól olvasható és karbantartható módon integrálódik az üzleti logikába.

## Adatintegritás és konzisztencia

Az adatintegritást több szint együttesen biztosítja:

1. **Adatbázisszintű korlátok**
   - elsődleges kulcsok,
   - idegen kulcsok,
   - egyedi indexek,
   - `ON DELETE` szabályok (`CASCADE`, illetve `SET NULL`).

2. **Alkalmazásszintű validáció**
   - kötelező mezők és típuskényszerek ellenőrzése,
   - üzleti szabályok érvényesítése (például relációk érvényessége).

3. **Tranzakciókezelés**
   - több lépésből álló műveletek atomi végrehajtása,
   - részleges mentésekből adódó inkonzisztencia elkerülése.

## JSON mezők és strukturált adatok tárolása

A projekt bizonyos, dinamikus szerkezetű tartalmakat JSON mezőkben tárol (például mentett táblaállapot vagy kitöltött feladatállapot). Ez a hibrid megközelítés:

- megtartja a relációs modell előnyeit,
- ugyanakkor rugalmasan kezeli a változó belső adatszerkezeteket.

Így a perzisztencia egyszerre marad strukturált és bővíthető.

## Naplózás mint perzisztens auditréteg

A hozzáférési események (látogatás, bejelentkezés, kijelentkezés) külön táblában tárolódnak. Ez:

- támogatja az utólagos elemzést és hibakeresést,
- növeli az átláthatóságot üzemeltetési és biztonsági szempontból,
- részben auditfunkciót biztosít a rendszer működéséhez.

## Összegzés

A projekt adatbázis- és perzisztencia-megoldása stabil, rétegezett és gyakorlatban jól alkalmazható architektúrát valósít meg. A relációs adatmodell, a migrációalapú sémamenedzsment, az ORM-es adatelérés és az integritási kontrollok együtt biztosítják, hogy a rendszer adatai megbízhatóan, konzisztensen és hosszú távon fenntartható módon kezelhetők legyenek.
