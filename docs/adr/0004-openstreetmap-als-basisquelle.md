# ADR 0004: OpenStreetMap als Basisquelle für Kühle Orte

- Status: angenommen für den Prototyp, Ablösung des Live-Abrufs geplant
- Datum: 2026-10-25

## Kontext

Nur wenige Kommunen veröffentlichen Kühle Orte maschinenlesbar. OpenStreetMap enthält aber
bundesweit Trinkwasserstellen, Bibliotheken, Gotteshäuser, Museen, Parks und Badestellen.
Diese Orte werden in Hitzeaktionsplänen typischerweise als Kühle Orte bzw. Räume genannt.

## Entscheidung

- Der Prototyp fragt OSM live über die öffentliche Overpass API im Umkreis des gewählten Ortes ab
  und probiert bei Fehlern mehrere Server nacheinander.
- OSM-Orte gelten als `offiziell_ausgewiesen: false`. Kommunale Daten im eigenen Schema werden
  in der Liste bevorzugt angezeigt.

## Folgen und offene Punkte

- **Beobachtet am 25.10.2026:** Die öffentlichen Overpass-Server waren stark ausgelastet. Antworten kamen
  nach 35 s oder liefen ins Zeitlimit. Für Produktivbetrieb ist der Live-Abruf ungeeignet.
- **Nächster Schritt:** In der Build-Pipeline den Geofabrik-Deutschland-Extrakt mit `osmium`
  filtern und als statische Kacheln ausliefern. Dann gibt es keine Laufzeitabhängigkeit, keine
  Weitergabe von Standortdaten an Dritte und Antworten in Millisekunden.
- Lizenz: ODbL 1.0. Die Namensnennung ist in Karte und Fußzeile enthalten.
