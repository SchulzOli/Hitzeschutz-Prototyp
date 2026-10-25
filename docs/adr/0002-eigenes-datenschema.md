# ADR 0002: Eigenes, offenes Datenschema für Kühle Orte

- Status: Entwurf zur Diskussion
- Datum: 2026-10-25

## Kontext

Kommunen veröffentlichen Kühle Orte heute in sehr unterschiedlichen Formen: als PDF-Stadtplan,
in Geoportalen, auf Beteiligungsplattformen oder als Liste auf der Website. Die Bayerische
Staatsregierung hat 2026 auf Anfrage erklärt, dass keine Mindeststandards und keine zentrale
Erfassung bestehen (Drucksache 19/12542). Uns ist kein bundesweiter Austauschstandard bekannt.

Ohne gemeinsames Format kann keine Anwendung die Daten mehrerer Kommunen zusammenführen.

## Entscheidung

- Wir definieren `schema/kuehle-orte.schema.json` (JSON Schema 2020-12) als **GeoJSON-Profil**.
- Pflichtfelder sind bewusst minimal (`name`, `kategorie`, `quelle`, Punktgeometrie). So bleibt
  die Hürde für kleine Kommunen niedrig. Laut Staatsregierung könnten strenge Mindestanforderungen das Angebot verkleinern.
- Öffnungszeiten folgen der etablierten OSM-Syntax `opening_hours`, statt ein neues Format zu erfinden.
- Datensatz-Metadaten orientieren sich an DCAT-AP.de (Herausgeber, Lizenz, Stand).
- OpenStreetMap-Daten werden beim Laden in dasselbe Schema übersetzt. Die Tests prüfen, dass beide Quellen schema-konform sind.

## Folgen

- Kommunen können ihre Daten mit `npm run validieren -- datei.geojson` prüfen.
- Das Schema ist ein Vorschlag (v0.1). Ziel ist die Abstimmung mit Kommunen und Fachstellen,
  langfristig etwa als Codeliste/Standard über XRepository bzw. KoSIT.
