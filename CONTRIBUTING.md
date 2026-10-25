# Mitmachen

Danke für Ihr Interesse! Beiträge sind willkommen, ganz besonders von **Kommunen, Gesundheitsämtern,
Hitzeschutz-Fachleuten und Menschen aus der Praxis**, nicht nur von Entwicklerinnen und Entwicklern.

## Wie Sie beitragen können

| Sie möchten … | So geht's |
|---|---|
| **Daten Ihrer Kommune** zu Kühlen Orten bzw. Räumen einbringen | Issue mit der Vorlage „Kommunale Daten beitragen“ öffnen oder direkt einen Pull Request mit einer Datei nach dem Schema stellen (siehe unten). |
| **Das Datenschema** kommentieren oder erweitern | Issue mit der Vorlage „Idee oder Vorschlag“. Bitte beschreiben Sie, welches Feld in Ihrer Praxis fehlt und warum. |
| **Einen Fehler** melden (falsche Warnung, falscher Ort, Darstellungsproblem) | Issue mit der Vorlage „Fehler melden“. |
| **Hinweise oder Texte** fachlich verbessern | Issue oder Pull Request. Bitte möglichst mit Quelle (z. B. BZgA, RKI, DWD, Hitzeaktionsplan). |
| **Code** beitragen | Pull Request. Siehe „Entwicklung“. |

Fehler in OpenStreetMap-Daten (z. B. ein geschlossener Trinkbrunnen) korrigieren Sie am besten direkt
auf [openstreetmap.org](https://www.openstreetmap.org/). Die Karte übernimmt die Änderung mit der
nächsten wöchentlichen Aktualisierung.

## Kommunale Daten beitragen

1. Daten als GeoJSON nach [`schema/kuehle-orte.schema.json`](schema/kuehle-orte.schema.json) erstellen.
   Vorlage: [`daten/beispiel-musterstadt.geojson`](daten/beispiel-musterstadt.geojson).
2. Datei prüfen:

   ```bash
   npm run validieren -- pfad/zur/datei.geojson
   ```

3. Datei unter `public/kuehle-orte/<kommune>.geojson` ablegen und den Dateinamen in
   [`public/kuehle-orte/index.json`](public/kuehle-orte/index.json) eintragen.
4. Pull Request stellen. Bitte im PR angeben, **wer die Daten herausgibt** und unter **welcher Lizenz**
   (bevorzugt `dl-de/by-2-0`, `dl-de/zero-2-0` oder `CC-BY-4.0`).

Bitte nur Daten einreichen, die Sie veröffentlichen dürfen. Keine personenbezogenen Daten.

## Entwicklung

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run dev
npm test
```

- Architekturentscheidungen stehen in [`docs/adr/`](docs/adr). Wer eine grundlegende Entscheidung ändern will
  (z. B. ein Backend einführen), legt bitte ein neues ADR an.
- Code, Bezeichner und Texte sind auf Deutsch, damit Fachleute aus der Verwaltung mitlesen können.
- Neue Logik bitte mit Tests in `tests/`. Der Workflow prüft Tests, Datenschema und `publiccode.yml`.
- Die Oberfläche soll barrierearm bleiben: Tastaturbedienung, ausreichende Kontraste, Textalternative zur Karte.
- **Datenschutz:** Persönliche Angaben dürfen den Browser nicht verlassen (ADR 0003).

## Lizenz

Mit Ihrem Beitrag stimmen Sie zu, dass er unter der [EUPL-1.2](LICENSE) veröffentlicht wird.
