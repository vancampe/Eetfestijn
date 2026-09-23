# Eetfestijn Kassa (Supabase + Netlify)

Mobiele POS-webapp voor het eetfestijn. Meerdere toestellen kunnen tegelijk
gebruikt worden — alles wordt live gesynchroniseerd via Supabase.

- **Tafels** → nieuwe tafel starten (tafelnummer + naam), eventueel gesplitst in a/b/c/d
- **Bestelling** → items per categorie aantikken, "ronde" versturen → print-ticket + rekening telt automatisch op
- **Rekening** → betaalwijze + wisselgeld, afrekenen
- **Geschiedenis** → afgerekende tafels + omzet per betaalwijze
- **Menu** → items toevoegen/bewerken/verwijderen vanuit de app
- **Beheer (gebruikers)** → wie mag inloggen, met welke rol
- **Printers** → geheugensteun voor welke printer bij welke beheerder hoort
- **Overzicht** → volledige transactielijst, exporteerbaar als .xlsx

Enkel **Beheerder**-gebruikers zien alle tabs (via "Meer" onderaan).
**Opnemer**-gebruikers zien enkel de tab **Tafels** — dat volstaat om tafels
te openen, te bestellen en af te rekenen.

## 1. Supabase-project aanmaken / bijwerken

1. Ga naar [supabase.com](https://supabase.com) → **New project** (of gebruik je bestaande project).
2. Open **SQL Editor** → **New query**, plak de inhoud van `supabase/schema.sql`,
   en klik **Run**. Dit zet alles in één keer klaar: tafels, bestellingen,
   menu, gebruikers (met de onderstaande standaardaccounts), printers, en
   realtime-synchronisatie.

   > Draaide je dit project al eerder (zonder de nieuwste functies)? Voer dan
   > enkel de nieuwe migratie(s) uit die je nog niet hebt gedraaid:
   > `supabase/02_menu_items.sql` en/of `supabase/03_roles_printers_overzicht.sql`.
3. Ga naar **Project Settings → API** voor je **Project URL** en **anon public key**.

### Standaard-inloggegevens

| Naam | Categorie | Wachtwoord |
|---|---|---|
| Rudi | Beheerder | Bravo |
| Christophe | Opnemer | Alpha |
| Karen | Opnemer | Papa |
| RVC | Opnemer | Tango |

Pas deze aan (of voeg gebruikers toe) via de tab **Beheer** in de app, zodra
je als Beheerder bent ingelogd.

> **Beveiliging:** wachtwoorden staan in leesbare tekst in de databank en de
> toegangspolicies staan open voor iedereen met de anon-key — bewust simpel
> gehouden voor intern gebruik tijdens het evenement. Gebruik geen
> wachtwoorden die je ook elders gebruikt.

## 2. Lokaal testen

```bash
npm install
cp .env.example .env
# vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in .env in
npm run dev
```

## 3. Deployen op Netlify

Zie de eerdere uitleg (GitHub-koppeling of `netlify deploy --prod --dir=dist`).
Vergeet niet `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` in te stellen bij
**Site settings → Environment variables**.

## Printen via QZ Tray

Deze app print via **[QZ Tray](https://qz.io)**, geïnstalleerd op de PC van de
beheerder (dezelfde PC waarmee de printer verbonden is). Zo werkt het:

1. **QZ Tray installeren** op de beheerder-PC (gratis, [qz.io/download](https://qz.io/download)).
   Vereist Java — de installer van QZ Tray biedt dit meestal automatisch aan.
2. Zorg dat QZ Tray **draait** (icoontje in het Windows-systeemvak).
3. Ga in de app naar de tab **Printers** (als Beheerder ingelogd):
   - **Nieuwe printer** → vul de **exacte printernaam** in zoals Windows die
     kent (Instellingen → Printers en scanners), koppel een beheerder, en
     laat **QZ Tray netwerkadres** leeg als je dit instelt op de PC met de
     printer zelf.
   - Klik **Test verbinding** om te controleren of de app de printer vindt.
   - Klik **Maak actief** — er kan maar één printer tegelijk actief zijn; die
     wordt gebruikt door alle toestellen (ook de iPads van de opnemers).
4. **Voor de iPads (of andere toestellen dan de beheerder-PC)**: vul bij die
   printer het **IP-adres van de beheerder-PC** in het veld "QZ Tray
   netwerkadres" in (bv. `192.168.1.50` — te vinden via Windows
   Instellingen → Netwerk, of `ipconfig` in een terminal). Alle toestellen
   moeten op **hetzelfde wifi-netwerk** zitten.
5. **Eerste keer printen**: QZ Tray toont op de beheerder-PC mogelijk een
   toestemmingsvenster ("Website wil verbinden — toestaan?"). Vink
   "onthouden" aan zodat dit niet telkens terugkomt.

Twee soorten afdrukken, beide op **A5-formaat**:
- **Bij "Ronde versturen"** → automatisch een keukenticket (Opnemer, Datum,
  Tijd, items van die ronde).
- **Bij "Print" op de Rekening** → de volledige afgerekende rekening met
  clublogo, in de opmaak die je aanleverde.

Lukt het printen niet (QZ Tray niet actief, verkeerd IP, printer niet
gevonden), dan toont de app een duidelijke foutmelding — de bestelling zelf
gaat wel altijd door, ook als het printen mislukt.

## Tafels splitsen (a/b/c/d) en bezette tafels

Bij het starten van een nieuwe tafel kun je een letter (A/B/C/D) toevoegen.
Tafel "12" en tafel "12A" zijn dan volledig aparte, gelijktijdig open sessies
met elk hun eigen naam en rekening. Kies je een combinatie die al open staat,
dan toont de app **"Tafel bezet"** en kun je niet aanmaken tot die tafel is
afgerekend (of je kiest een andere letter).

## Tabblad Overzicht

Toont één rij per bestelde regel van afgerekende tafels: Datum, Tafel, Naam,
Item, Aantal, Bedrag, Betalingswijze, In_Kas (= Bedrag als Cash, anders 0),
Dag, Categorie, AM/PM (Voormiddag/Namiddag/Avond) en Opnemer. Met de
knop bovenaan (spreadsheet-icoon) exporteer je dit meteen als `.xlsx`-bestand.

## Projectstructuur

```
├── netlify.toml
├── supabase/
│   ├── schema.sql                        # volledig schema (alles in één)
│   ├── 02_menu_items.sql                 # incrementeel: menu
│   ├── 03_roles_printers_overzicht.sql   # incrementeel: login/rollen/printers/tafel-letter
│   └── 04_qz_tray_printers.sql           # incrementeel: QZ Tray-koppeling + actieve printer
├── .env.example
└── src/
    ├── menu.js             # weergave-helpers: geldnotatie, categorie-volgorde/-kleur
    ├── branding.js          # clubnaam, bedankregel en logo (base64) voor het printticket
    ├── supabaseClient.js   # Supabase-verbinding
    ├── db.js               # alle databasequeries
    ├── print.js            # QZ Tray-koppeling: keukenticket + kassabon (A5)
    ├── overzicht.js        # Overzicht-rijen opbouwen + .xlsx-export
    └── App.jsx              # volledige UI incl. login, rollen en alle tabs
```

## Datamodel

- **beheer** — gebruikers: naam, categorie (Beheerder/Opnemer), paswoord.
- **sessions** — tafel-sessie: tafelnummer, optionele letter (a/b/c/d), naam,
  status (open/paid), betaalwijze, totaal, wie de tafel opende (opnemer).
- **order_items** — één rij per besteld item per ronde, met naam, categorie
  en prijs op het moment van bestellen, en wie de ronde verstuurde.
- **menu_items** — het menu: naam, categorie, prijs. Beheerbaar via de app.
- **printers** — printernaam, gekoppelde beheerder, QZ Tray-netwerkadres
  (`qz_host`), en welke printer `active` (geselecteerd) is.
