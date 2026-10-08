# ICANN gTLD Tracker

En modern webbapplikation för att visualisera, söka och analysera ICANNs nya gTLD-ansökningar (2026). 
Applikationen är byggd med React, TypeScript, Tailwind CSS och Vite. Den läser in CSV-data direkt i webbläsaren och presenterar ansökningarna i ett responsivt gränssnitt.

## Funktioner
* **Dra-och-släpp CSV:** Importera gTLD-data lokalt utan att ladda upp till en server.
* **Avancerad filtrering:** Filtrera på domäntyper (Brand, GEO, Community, IDN m.m.).
* **Färgkodning & Status:** 
  * Mörkgrön: Garanterad / Låst
  * Ljusgrön: Hög sannolikhet
  * Gul: Möjlig (krock)
  * Mörkgul: Osannolik reserv
  * Röd: Ute ur leken
* **Region-/Land-sökning:** Hitta snabbt ansökningar från specifika geografiska områden.
* **Prestanda-optimerad:** Hanterar tusentals ansökningar blixtsnabbt med React `useMemo`.
* **Dark Mode:** Inbyggt och fullt stöd för mörkt tema som standard (med fallback till webbläsarens inställningar och manuell toggle).

## Teknikstack
* **Frontend:** React 18, TypeScript, Tailwind CSS v3
* **Ikoner:** Lucide React
* **Parsning:** PapaParse (för CSV-filer)
* **Byggverktyg:** Vite

## Kom igång för utveckling

1. Klona arkivet
2. Installera beroenden:
   ```bash
   npm install
   ```
3. Starta utvecklingsservern:
   ```bash
   npm run dev
   ```

## Publicering

Det här projektet är optimerat för att publiceras som en statisk webbplats, till exempel via **Cloudflare Pages**. 

För att bygga projektet lokalt:
```bash
npm run build
```
Detta genererar en minifierad produktionsversion i `dist/`-mappen.

## Licens
Skapad av S4m.dev
