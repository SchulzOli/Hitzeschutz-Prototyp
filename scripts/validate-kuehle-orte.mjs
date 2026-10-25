// Prüft alle Datensätze in daten/ und public/kuehle-orte/ gegen das Schema.
// Kommunen können damit ihre Daten vor der Veröffentlichung testen:
//   node scripts/validate-kuehle-orte.mjs pfad/zur/datei.geojson

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { erstelleValidator } from '../src/schema.js';

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function geojsonDateien(verzeichnis) {
  const eintraege = await readdir(verzeichnis).catch(() => []);
  return eintraege.filter((n) => n.endsWith('.geojson')).map((n) => join(verzeichnis, n));
}

const schema = JSON.parse(await readFile(join(wurzel, 'schema/kuehle-orte.schema.json'), 'utf8'));
const pruefe = erstelleValidator(schema);

const dateien = process.argv.length > 2
  ? process.argv.slice(2)
  : [...(await geojsonDateien(join(wurzel, 'daten'))), ...(await geojsonDateien(join(wurzel, 'public/kuehle-orte')))];

let fehlerhaft = 0;
for (const datei of dateien) {
  const daten = JSON.parse(await readFile(datei, 'utf8'));
  if (pruefe(daten)) {
    console.log(`OK      ${datei} (${daten.features.length} Orte)`);
  } else {
    fehlerhaft++;
    console.log(`FEHLER  ${datei}`);
    for (const f of pruefe.errors) console.log(`        ${f.instancePath || '/'} ${f.message}`);
  }
}
process.exit(fehlerhaft ? 1 : 0);
