// Wandelt den osmium-Export (GeoJSON-Sequenz) in statische Kacheln mit
// Kühlen Orten nach Schema v0.1 um: <ziel>/<z>/<x>/<y>.json plus index.json.
// Aufruf (siehe scripts/osm-extrahieren.sh):
//   node scripts/osm-kacheln.mjs orte.geojsonseq public/kuehle-orte/osm [stand]

import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { elementZuKuehlemOrt } from '../src/osm.js';
import { KACHEL_ZOOM, kachelFuerPunkt } from '../src/kacheln.js';

function ringSchwerpunkt(ring) {
  let flaeche = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const kreuz = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    flaeche += kreuz;
    x += (ring[j][0] + ring[i][0]) * kreuz;
    y += (ring[j][1] + ring[i][1]) * kreuz;
  }
  if (Math.abs(flaeche) < 1e-14) {
    const n = ring.length;
    return { punkt: [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n], flaeche: 0 };
  }
  return { punkt: [x / (3 * flaeche), y / (3 * flaeche)], flaeche: Math.abs(flaeche / 2) };
}

/** Ein Punkt, der den Ort repräsentiert: bei Flächen der Schwerpunkt der größten Teilfläche. */
export function repraesentativerPunkt(geometrie) {
  switch (geometrie?.type) {
    case 'Point':
      return geometrie.coordinates;
    case 'LineString':
      return ringSchwerpunkt(geometrie.coordinates).punkt;
    case 'Polygon':
      return ringSchwerpunkt(geometrie.coordinates[0]).punkt;
    case 'MultiPolygon':
      return geometrie.coordinates.map((p) => ringSchwerpunkt(p[0])).sort((a, b) => b.flaeche - a.flaeche)[0].punkt;
    default:
      return null;
  }
}

const runde = (wert) => Math.round(wert * 1e5) / 1e5;

/** Eine Zeile des osmium-Exports -> Kühler Ort nach Schema (oder null). */
export function zeileZuKuehlemOrt(zeile) {
  const text = zeile.replace(/^\x1e/, '').trim();
  if (!text) return null;
  const feature = JSON.parse(text);
  const { '@type': typ, '@id': id, ...rest } = feature.properties ?? {};
  const tags = Object.fromEntries(Object.entries(rest).filter(([k]) => !k.startsWith('@')));
  const punkt = repraesentativerPunkt(feature.geometry);
  if (!punkt || !typ || id == null) return null;
  const ort = elementZuKuehlemOrt({ type: typ, id, lon: runde(punkt[0]), lat: runde(punkt[1]), tags });
  if (ort) delete ort.properties.lizenz; // steht einmal in index.json
  return ort;
}

export async function erzeugeKacheln(zeilen, ziel, stand) {
  const kacheln = new Map();
  const gesehen = new Set();
  let anzahl = 0;
  for await (const zeile of zeilen) {
    const ort = zeileZuKuehlemOrt(zeile);
    if (!ort || gesehen.has(ort.id)) continue;
    gesehen.add(ort.id);
    const [lon, lat] = ort.geometry.coordinates;
    const { x, y } = kachelFuerPunkt(lat, lon);
    const schluessel = `${x}/${y}`;
    if (!kacheln.has(schluessel)) kacheln.set(schluessel, []);
    kacheln.get(schluessel).push(ort);
    anzahl++;
  }

  await rm(ziel, { recursive: true, force: true });
  for (const [schluessel, orte] of kacheln) {
    const [x, y] = schluessel.split('/');
    await mkdir(join(ziel, String(KACHEL_ZOOM), x), { recursive: true });
    await writeFile(join(ziel, String(KACHEL_ZOOM), x, `${y}.json`), JSON.stringify(orte));
  }
  const index = {
    stand,
    erzeugt: new Date().toISOString(),
    quelle: 'OpenStreetMap-Mitwirkende, Extrakt von Geofabrik',
    lizenz: 'ODbL-1.0',
    zoom: KACHEL_ZOOM,
    anzahl,
    kacheln: [...kacheln.keys()].sort(),
  };
  await writeFile(join(ziel, 'index.json'), JSON.stringify(index));
  return index;
}

const direktAufgerufen = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direktAufgerufen) {
  const [quelle, ziel = 'public/kuehle-orte/osm', stand = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
  if (!quelle) {
    console.error('Aufruf: node scripts/osm-kacheln.mjs <orte.geojsonseq> [zielverzeichnis] [stand]');
    process.exit(2);
  }
  const zeilen = createInterface({ input: createReadStream(quelle), crlfDelay: Infinity });
  const index = await erzeugeKacheln(zeilen, ziel, stand);
  console.log(`${index.anzahl} kühle Orte in ${index.kacheln.length} Kacheln geschrieben (Stand ${index.stand}).`);
}
