# Kitchenbox árajánlatkezelő

Magyar adminfelület, a Kitchen Box GHL kontaktmezőire épített kalkuláció, PDF és később aktiválható automatikus email. TanStack Start + React, szerveroldali REST végpontok, Supabase PostgreSQL, Google Routes, Resend.

## Indítás

Node.js 24 vagy újabb:

```sh
npm ci
npm run dev
```

Előnézet: http://127.0.0.1:5180/ . Alaphelyzetben egyértelműen jelölt bemutatóadatot mutat; éles kontakt nincs a forrásban. A PDF előnézet és letöltés beállítás nélkül is kipróbálható, végösszeg és valódi ajánlat nélkül.

```sh
npm test
npm run typecheck
npm run build
npm start
```

A Node host a `dist/client` statikus fájljait és a `dist/server` SSR alkalmazását együtt szolgálja ki. Vibe saját futtatókörnyezetében a meglévő projekt build/host konfigurációja használandó.

## Ténylegesen beépített adatok

- GHL location: `sQwGiqEHji64YPHGXdEU` (Kitchen Box).
- A nyolc mező pontos kulcsa, azonosítója és választható értékei a GHL connectorból, 2026-10-22-i olvasással: `src/lib/fields.ts`.
- Címzett: natív `contact.email`; telefon: natív `contact.phone`; célcím: `contact.full_address` (a Contacts API natív címrészeiből).
- Alapár 4 900 000 Ft; gázgrill 397 000 Ft; Yakiniku 400 333 Ft; hűtő 129 000 Ft; TV 160 000 Ft; hangszórók 78 000 Ft.
- A mosogató és a főzőlap ára **null**, nem nulla. Csak kiválasztásuk akadályozza a kalkulációt.
- Kiszállítás: Békéscsaba, Bartók Béla út 37A → célcím, egyszeres közúti út × 280 Ft/km, egész forintra kerekítve. A többi ár nettó/bruttó jellege jelenleg tisztázandó, ezért az alapkonfiguráció nem véglegesíthető.
- A színek és munkapult anyaga jelenleg leíró, 0 Ft külön felárral a felhasználó megadott képlete szerint. A referencia-PDF Dekton-felárát nem emeltük át. Ha felár szükséges, a szabályok szerkeszthetők.

## Éles konfiguráció

1. Hozz létre Supabase projektet, és futtasd a `migrations/001_kitchenbox.sql` migrációt. A táblák RLS-védettek, a böngésző nem kap hozzáférést. A szerver service role kulcsot használ.
2. Másold `.env.example` tartalmát `.env` fájlba helyi futtatáshoz, vagy add meg ezeket a host Secrets felületén. Titkot tilos `VITE_` változóba vagy Gitbe tenni. Az app nem tudja felhasználni a Codex connector hitelesítését saját futtatókörnyezetében.
3. `GHL_TOKEN`: Kitchen Box sub-account privát integrációs token, legalább `contacts.readonly`, `contacts.write`, `locations/customFields.readonly` scope-okkal. A GHL kontakt duplikációs prioritásait az upsert tiszteletben tartja.
4. `ADMIN_TOKEN` és `WEBHOOK_TOKEN`: két külön véletlen titok, legalább 32 karakterrel. Az admin felületen kizárólag az admin tokent add meg; csak memóriában marad, újratöltéskor elveszik. A webhook külön Bearer titkot kér. HTTPS használata szükséges éles környezetben.
5. `GOOGLE_MAPS_API_KEY`: engedélyezett Google Routes API. A backend `DRIVE` módot használ. Részleges címegyezés, hiányzó placeId, hibás válasz vagy hiányzó kulcs esetén `blocked` állapot, nem 0 Ft és nem légvonal. A forrás és a lekérdezési idő az ajánlat kontaktpillanatképében és PDF-jében tárolódik. A fizetős Google API-fiók beállítását a felhasználó végzi.
6. Az Árazás lapon add meg az árak nettó/bruttó jellegét, az ÁFA mértékét, a grill szabályát, érvényességi időt, kiállítói adatokat és feltételeket. Jóváhagyás előtt az ajánlat blokkolt marad. Mind a nyolc mező GHL azonosítója illeszthető; a note azonosító a konfiguráció `noteFieldId` mezője.
7. `RESEND_API_KEY`, hitelesített `EMAIL_FROM`, majd `EMAIL_DOMAIN_VERIFIED=true`. A Resend szolgáltatónál a domain DNS-rekordjait hitelesíteni kell. A feladói domain GHL-ben való csatlakoztatása önmagában nem hitelesíti azt a Resendnél. Későbbi GHL-email adapterhez a GHL Conversations API attachment URL-t és megfelelő feltöltést kér; a jelenlegi adapter közvetlen PDF-mellékletet küld a Resend API-val.
8. A küldés alapból tiltott: `SEND_EMAIL_ENABLED=false`. Külön élesítési lépésként állítható `true`-ra. Jelen munkamenetben külső levelet nem küldtünk.

## Native GHL form / workflow

A meglévő GHL űrlap mentse a natív email-, telefon- és címmezőket, valamint a nyolc custom fieldet. Form Submitted vagy megfelelő kontaktváltozás trigger után egy **Custom Webhook** action:

```http
POST https://<publikált-app>/api/webhooks/ghl
Authorization: Bearer <WEBHOOK_TOKEN>
Content-Type: application/json

{"locationId":"sQwGiqEHji64YPHGXdEU","contactId":"{{contact.id}}"}
```

A backend a GHL-ből újraolvassa a kontaktot; a webhookból címzettet, árat vagy végösszeget nem fogad el. A bejövő webhook kizárólag a fenti autentikált workflow-szerződéshez készült; a Marketplace alkalmazások eltérő aláírású webhookjaihoz külön adapter szükséges.

Az admin „Új ajánlatkérés” űrlapja szintén szerveroldali upsertet végez. Az extrák GHL típusa jelenleg `TEXTBOX_LIST`: az opcióazonosítókhoz `1`/üres érték kerül. Meglévő szabad szöveges, nem egyértelmű extratartalom `ELLENŐRIZENDŐ` választássá válik, és nem kap csendben árat. A külső űrlap tényleges extraszerializációját élesítés előtt ellenőrizni kell egy valós form beküldéssel.

## Állapotok és eseményvédelem

- `blocked`: hiányzó adat/szabály/útvonal; csak „nem végleges” PDF-előnézet.
- `processing` → `ready`: tárolt végleges PDF. Megszakadt PDF-feldolgozás helyreállítható: `POST /api/quotes/{id}/recover` admin hitelesítéssel; nem küld levelet.
- `sending` → `submitted`: a szolgáltató átvette a levelet. **Ez nem kézbesítési igazolás.**
- `delivery_unknown`: hálózati vagy szolgáltatói bizonytalanság; nincs automatikus újraküldés. A `sending` állapotban megszakadt folyamatot is a szolgáltatónál kell ellenőrizni.

A kontakt és árlistapillanatkép SHA-256 ujjlenyomata PostgreSQL unique kulccsal védi a duplikált eseményeket. A send claim atomikus státuszváltás, a Resend idempotency kulcs másodlagos védelem (a szolgáltató 24 óráig őrzi). Küldés előtt a szerver újraellenőrzi a kontaktot, a címzettet és a DND állapotot. Árváltoztatás új konfigurációverziót és új ajánlatot eredményez.

A feldolgozás a webhook HTTP-kérésén belül megvárt, tartós állapotokkal. Nincs feltételezett, kérés után továbbfutó háttérszál. Éles hoston ellenőrizni kell a kérésidőkorlátot; nagy volumenhez külön üzenetsor/worker illeszthető a meglévő állapotkezeléshez. A listák jelenleg legfeljebb 100 kontaktot és 200 ajánlatot mutatnak.

## GitHub → cél Vibe projekt

Cél: https://app.maxai.hu/v2/location/sQwGiqEHji64YPHGXdEU/vibe/projects/1792651416273008908 . A helyi repo induláskor üres volt, commit és remote nélkül. A kapcsolt GitHub connector jelenleg csak `MaxAI936/zero-base` írási jogát látja; ez másik, MotoSziget projekt, ezért oda nem történt feltöltés.

A HighLevel hivatalos Git Sync funkciója a célprojekt **More → Git → GitHub** menüjében privát repót hoz létre. A felületen a vizsgálatkor ez a menü nem jelent meg. A funkció elérhetősége/jogosultsága, a `Manage Git & download code` engedély, illetve a MaxAI rollout ellenőrzendő. A GitHub Lead Connector app engedélyezését a felhasználó végzi. A szükséges következő adat a **Kitchenbox projekthez létrejött GitHub repository URL-je és szinkronizált branch neve**, és a connector számára annak hozzáférése.

Ezután az eredeti Vibe history megtartásával kell a változásokat a kapcsolt branchre felvinni, soha force push-sal. A Vibe exportált TanStack template-jének saját `vite.config.ts`/server host beállításait tartsd meg; a `src/lib`, `src/server`, route-ok, CSS, fontok és szükséges dependency-k kerüljenek át. A Git Sync React/Vite és TanStack Start projekteket támogat. A letöltött ZIP önmagában nem importmechanizmus.

## Ellenőrzés és források

22 teszt: kalkuláció és kerekítés, hiányzó extrák, ismeretlen értékek, nettó/bruttó, routing-hibák, többszörös/párhuzamos események és küldések, megváltozott címzett, DND, konfigurálatlan backend, webhook hitelesítés, többoldalas ékezetes PDF. A külső API-kat a tesztek mockolják; valós GHL-írás, routing-lekérdezés és email küldés nem történt. `npm audit`: 0 ismert sérülékenység a jelen lockfile-ban. A forrás template elavult TanStack/Vite verzióit javított kompatibilis verziókra frissítettük.

- https://help.gohighlevel.com/support/solutions/articles/155000009214-how-to-use-git-sync-in-ai-studio
- https://help.gohighlevel.com/support/solutions/articles/155000008701
- https://help.gohighlevel.com/support/solutions/articles/155000003305/
- https://marketplace.gohighlevel.com/docs/ghl/contacts/upsert-contact/
- https://marketplace.gohighlevel.com/docs/ghl/conversations/send-a-new-message/
- https://developers.google.com/maps/documentation/routes/compute_route_directions
- https://resend.com/docs/send-with-attachments
- https://www.resend.com/changelog/idempotency-keys
- https://kitchen-box.hu/konfigurator/

Az eredeti PDF vizuális sablonként kerül felhasználásra: a `public/templates/kitchenbox-template.pdf` megőrzi a kétoldalas vektoros elrendezést, táblázatot, logókat és fejlécet. A régi ügyféladatokat, dátumokat, árakat és a példa Dekton-felárát valódi PDF-redakcióval eltávolítottuk. A felhasználó kérésére a `www.innonest.hu` láblécszöveg minden oldalról eltűnt, az oldalszám és a logók maradtak. A hosszú megjegyzések és feltételek kiegészítő oldalra folytatódnak. A minta-PDF-ben az ismeretlen ÁFA és szállítás nem becsült érték. A DejaVu Sans és Bold betűk a referencia családjával egyeznek; licencük `public/fonts/DejaVu-LICENSE.txt`. A UI Noto Sans fontja SIL OFL licencű (`public/fonts/OFL.txt`). A forrásban szereplő egyedi árak nem válnak automatikusan üzleti szabállyá.
