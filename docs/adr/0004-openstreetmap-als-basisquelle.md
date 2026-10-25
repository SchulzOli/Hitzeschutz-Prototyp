# ADR 0004: OpenStreetMap als Basisquelle, vorab als statische Kacheln

- Status: angenommen
- Datum: 2026-10-25 (aktualisiert am selben Tag: Live-Abruf durch Kacheln ersetzt)

## Kontext

Nur wenige Kommunen veröffentlichen Kühle Orte maschinenlesbar. OpenStreetMap enthält aber
bundesweit Trinkwasserstellen, Bibliotheken, Gotteshäuser, Museen, Parks und Badestellen.
Diese Orte werden in Hitzeaktionsplänen typischerweise als Kühle Orte bzw. Räume genannt.

Die erste Version fragte OSM live über die öffentliche Overpass API ab. Am 25.10.2026 waren
die öffentlichen Overpass-Server stark ausgelastet: Antworten kamen nach 35 s, mit HTTP 502
oder liefen ins Zeitlimit. Außerdem erfuhr dabei ein Dritter den Standort jeder Nutzerin und jedes Nutzers.

## Entscheidung

- Die Pipeline (`scripts/osm-extrahieren.sh`) lädt **einmal pro Woche** den Geofabrik-Extrakt
  (Standard: `europe/germany`), filtert mit `osmium tags-filter` die relevanten Objekte und
  exportiert sie mit `osmium export` als GeoJSON-Sequenz.
- `scripts/osm-kacheln.mjs` übersetzt sie mit derselben Logik wie die App (`src/osm.js`) in das
  eigene Schema. Flächen werden auf ihren Schwerpunkt reduziert. Das Ergebnis wird als
  **XYZ-Kacheln auf Zoom 12** (`kuehle-orte/osm/12/x/y.json` plus `index.json`) gespeichert.
- Die Kacheln liegen zwischen den Läufen im GitHub-Actions-Cache (Schlüssel: Region + Kalenderwoche).
  Die DWD-Daten werden weiterhin dreimal täglich aktualisiert, ohne jedes Mal Deutschland neu zu laden.
- Die App lädt für eine Umkreisabfrage nur die 1 bis 4 betroffenen Kacheln vom eigenen Webserver.
  **Overpass bleibt Rückfall**, wenn keine Kacheln veröffentlicht sind (z. B. in der lokalen Entwicklung).
- OSM-Orte gelten als `offiziell_ausgewiesen: false`. Kommunale Daten im eigenen Schema werden
  in der Liste bevorzugt angezeigt.

## Folgen

- Antworten in Millisekunden statt Sekunden und keine Abhängigkeit von fremden Servern zur Laufzeit.
- Der Standort der Nutzenden geht nicht mehr an Overpass.
- Die Daten sind bis zu eine Woche alt. Der OSM-Stand wird in der Fußzeile angezeigt.
- Test mit dem Bremen-Extrakt (21 MB): 625 Orte in 22 Kacheln, rund 200 KB.
- Schlägt der Download fehl, bleiben die Kacheln der Vorwoche in Gebrauch.
- Lizenz: ODbL 1.0. Die Namensnennung ist in Karte, Fußzeile und `index.json` enthalten.
