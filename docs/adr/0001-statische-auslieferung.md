# ADR 0001: Statische Auslieferung, DWD-Daten per Build-Pipeline

- Status: angenommen
- Datum: 2026-10-25

## Kontext

Die Hitzewarnungen und der Hitzetrend des DWD liegen als JSON-Datei auf `opendata.dwd.de`.
Der Server sendet **keine CORS-Header**, ein Browser kann die Datei also nicht direkt laden.
Die Geometrien der Warnkreise (`maps.dwd.de`, WFS) sind dagegen per CORS abrufbar.

Die Anwendung soll ohne eigenen Server betreibbar sein (Kosten, Betrieb, Datenschutz),
damit Kommunen sie einfach übernehmen können.

## Entscheidung

- Die Seite wird **statisch** ausgeliefert (GitHub Pages oder jeder beliebige Webserver).
- `scripts/fetch-dwd.mjs` lädt beim Build die neueste `hwtrend_YYYYMMDD.json` und die
  Warnkreis-Geometrien, verknüpft sie über die Kennung `CCC` und schreibt `public/data/hitze.geojson`.
- Ein GitHub-Actions-Workflow baut die Seite mehrmals täglich neu.

## Folgen

- Kein Backend, keine Personendaten auf Servern, keine laufenden Kosten.
- Die angezeigten Warnungen können bis zu einige Stunden alt sein. Der Datenstand wird in der Oberfläche angezeigt.
- Kurzfristige Unwetter-Aktualisierungen sind damit nicht abgebildet. Für den Hitzeschutz, der auf Tagesbasis arbeitet, reicht das aus.
