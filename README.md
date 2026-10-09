# ICANN gTLD Tracker (2026)

En modern och prestandaoptimerad webbapplikation för att visualisera, söka och analysera ICANNs nya gTLD-ansökningar (2026-rundan). Applikationen är byggd med React, TypeScript, Tailwind CSS och Vite, och erbjuder ett kraftfullt responsivt gränssnitt för att utforska domänkonflikter och ansökningsstatus.

## Huvudfunktioner

* **Automatisk Datahämtning:** Applikationen letar automatiskt upp och laddar ner den allra senaste CSV-datan från vår server (`assets.s4m.dev`) vid uppstart, helt sekventiellt. Observera att datan inte hämtas live direkt från ICANN, utan från vår egna speglade datakälla.
* **Manuell Uppladdning (Drag-and-Drop):** Stöd för lokal uppladdning av CSV-filer för testning av egna eller anpassade dataset direkt i webbläsaren.
* **Smart Färgkodning & Status:** Algoritmer analyserar konflikter (contention sets) och kategoriserar varje TLD (domän) baserat på dess chanser att bli delegerad:
  * **Mörkgrön:** Garanterad / Låst (Denna TLD är säker och kommer garanterat att delegeras till någon)
  * **Ljusgrön:** Hög sannolikhet (Är ett aktivt förstahandsval, men alla sökande har fortfarande möjlighet att byta till sin reserv)
  * **Gul:** Möjlig krock (Är endast en reserv, men sökande kan bli tvingade hit på grund av konkurrens på deras förstahandsval)
  * **Mörkgul:** Osannolik reserv (Är endast en reserv, och de sökande får troligen sina förstahandsval istället)
  * **Röd:** Ute ur leken (Inga aktiva ansökningar finns kvar, TLD:n kommer inte att delegeras)
* **Intelligenta Statusramar (Outlines):** Valbara ramar (Guld, Blå, Röd) som omedelbart indikerar om ett enskilt företag vunnit en strid, har möjlighet att byta till sin reserv, eller har förlorat, oavsett vilken TLD de kollar på.
* **Avancerad Filtrering & Sortering:**
  * Filtrera på domäntyper (Brand, GEO, Community, IDN).
  * Fritextsökning på regioner och länder.
  * Detaljerad sökning på specifika sökande (företag) med interaktiva popups.
  * Sortera resultaten efter namn, färgkod, namnlängd eller antal sökande.
* **Beständiga Inställningar:** Användarens val av sortering, ram-visning och mörkt/ljust tema sparas lokalt (`localStorage`) i webbläsaren.
* **Mörkt Tema:** Inbyggt Dark Mode som respekterar systeminställningar men även kan växlas manuellt av användaren.

## Teknisk Stack

* **Frontend:** React 18, TypeScript, Tailwind CSS v3
* **Komponenter & Ikoner:** Lucide React
* **Databehandling:** PapaParse (för effektiv CSV-analys)
* **Byggverktyg:** Vite

## Kom Igång

För att köra projektet lokalt krävs Node.js.

1. Klona arkivet till din maskin.
2. Navigera in i projektmappen (`gtld-app`).
3. Installera alla nödvändiga beroenden:
   ```bash
   npm install
   ```
4. Starta utvecklingsservern:
   ```bash
   npm run dev
   ```

## Publicering

Projektet är helt statiskt (Client-Side Rendering) utan krav på en backend och är optimerat för plattformar som Cloudflare Pages, Vercel eller Netlify.

För att bygga en produktionsklar version:
```bash
npm run build
```
Resultatet hamnar i mappen `dist/` och kan laddas upp direkt till valfritt webbhotell eller statisk värd.

## Om Projektet

Skapad och underhållen av S4m.dev. Besök gärna projektet live på tld.s4m.dev.
