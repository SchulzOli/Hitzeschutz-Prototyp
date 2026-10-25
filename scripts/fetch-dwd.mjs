// Lädt die DWD-Hitzewarnungen/-trends und die Geometrien der DWD-Warnkreise
// und schreibt beides verknüpft nach public/data/hitze.geojson.
//
// Grund für den Umweg über ein Build-Skript: opendata.dwd.de sendet keine
// CORS-Header, der Browser kann die Datei also nicht direkt abrufen.
// Siehe docs/adr/0001-statische-auslieferung.md.

import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HWTREND_VERZEICHNIS = 'https://opendata.dwd.de/climate_environment/health/forecasts/heat/';
const WARNKREISE_WFS =
  'https://maps.dwd.de/geoserver/dwd/ows?service=WFS&version=2.0.0&request=GetFeature' +
  '&typeName=dwd:Warngebiete_Kreise&outputFormat=application/json' +
  '&propertyName=CCC,NAME,SHAPE&srsName=EPSG:4326';

const ZIEL = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/hitze.geojson');

async function holeJson(url) {
  const antwort = await fetch(url, { headers: { 'User-Agent': 'Hitzeschutz-Prototyp (github.com/SchulzOli/Hitzeschutz-Prototyp)' } });
  if (!antwort.ok) throw new Error(`${url} -> HTTP ${antwort.status}`);
  return antwort.json();
}

async function neuesteHwtrendDatei() {
  const antwort = await fetch(HWTREND_VERZEICHNIS);
  if (!antwort.ok) throw new Error(`Verzeichnis nicht lesbar: HTTP ${antwort.status}`);
  const html = await antwort.text();
  const dateien = [...html.matchAll(/hwtrend_(\d{8})\.json/g)].map((m) => m[1]);
  if (dateien.length === 0) throw new Error('Keine hwtrend-Datei im DWD-Verzeichnis gefunden');
  const neueste = dateien.sort().at(-1);
  return { datum: `${neueste.slice(0, 4)}-${neueste.slice(4, 6)}-${neueste.slice(6, 8)}`, url: `${HWTREND_VERZEICHNIS}hwtrend_${neueste}.json` };
}

export function verknuepfe(warnkreise, hwtrend, stand) {
  const features = warnkreise.features
    .filter((f) => hwtrend[f.properties.CCC])
    .map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        ccc: f.properties.CCC,
        name: hwtrend[f.properties.CCC].Name ?? f.properties.NAME,
        trend: hwtrend[f.properties.CCC].Trend,
      },
    }));
  return {
    type: 'FeatureCollection',
    stand,
    abgerufen: new Date().toISOString(),
    quelle: 'Deutscher Wetterdienst (DWD): Hitzewarnungen/Hitzetrend und Warngebiete Kreise',
    lizenz: 'CC BY 4.0',
    features,
  };
}

async function main() {
  const { datum, url } = await neuesteHwtrendDatei();
  const [hwtrend, warnkreise] = await Promise.all([holeJson(url), holeJson(WARNKREISE_WFS)]);
  const ergebnis = verknuepfe(warnkreise, hwtrend, datum);
  await mkdir(dirname(ZIEL), { recursive: true });
  await writeFile(ZIEL, JSON.stringify(ergebnis));
  console.log(`hitze.geojson geschrieben: ${ergebnis.features.length} Warnkreise, Stand ${datum}`);
}

const direktAufgerufen = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direktAufgerufen) {
  main().catch(async (fehler) => {
    // Ohne Netz soll die lokale Entwicklung mit der zuletzt geladenen Datei weiterlaufen.
    const vorhanden = await access(ZIEL).then(() => true, () => false);
    console.error(`DWD-Abruf fehlgeschlagen: ${fehler.message}`);
    if (vorhanden && !process.env.CI) {
      console.error('Verwende vorhandene public/data/hitze.geojson.');
    } else {
      process.exit(1);
    }
  });
}
