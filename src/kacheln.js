// Statische Kacheln mit Kühlen Orten aus OpenStreetMap (erzeugt von
// scripts/osm-kacheln.mjs). Kachelschema wie bei Webkarten (XYZ, Web Mercator).

import { entfernungMeter } from './geo.js';

// Zoom 12: Kacheln von etwa 6 x 10 km in Deutschland – eine Umkreisabfrage
// von 1,5 km braucht damit meist nur 1 bis 4 kleine Dateien.
export const KACHEL_ZOOM = 12;

export function kachelFuerPunkt(lat, lon, z = KACHEL_ZOOM) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const breite = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(breite) + 1 / Math.cos(breite)) / Math.PI) / 2) * n);
  return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
}

/** Alle Kacheln, die das Rechteck um einen Kreis (Mittelpunkt, Radius in m) berühren. */
export function kachelnFuerUmkreis(lat, lon, radiusMeter, z = KACHEL_ZOOM) {
  const dLat = radiusMeter / 111320;
  const dLon = radiusMeter / (111320 * Math.cos((lat * Math.PI) / 180));
  const nordwest = kachelFuerPunkt(lat + dLat, lon - dLon, z);
  const suedost = kachelFuerPunkt(lat - dLat, lon + dLon, z);
  const kacheln = [];
  for (let x = nordwest.x; x <= suedost.x; x++) {
    for (let y = nordwest.y; y <= suedost.y; y++) kacheln.push(`${x}/${y}`);
  }
  return kacheln;
}

export class KeineKachelnError extends Error {}

export function erstelleKachelLader(basisUrl, holen = (url) => fetch(url)) {
  let index = null;
  const kacheln = new Map();

  async function ladeIndex() {
    index ??= holen(`${basisUrl}index.json`).then(async (antwort) => {
      if (!antwort.ok) throw new KeineKachelnError(`Kein Kachelindex (HTTP ${antwort.status})`);
      const daten = await antwort.json();
      return { ...daten, vorhanden: new Set(daten.kacheln) };
    });
    try {
      return await index;
    } catch (fehler) {
      index = null;
      throw fehler instanceof KeineKachelnError ? fehler : new KeineKachelnError(fehler.message);
    }
  }

  function ladeKachel(schluessel) {
    if (!kacheln.has(schluessel)) {
      const anfrage = holen(`${basisUrl}${KACHEL_ZOOM}/${schluessel}.json`).then((antwort) => {
        if (!antwort.ok) throw new Error(`Kachel ${schluessel}: HTTP ${antwort.status}`);
        return antwort.json();
      });
      anfrage.catch(() => kacheln.delete(schluessel));
      kacheln.set(schluessel, anfrage);
    }
    return kacheln.get(schluessel);
  }

  return {
    ladeIndex,
    /** Kühle Orte im Umkreis; wirft KeineKachelnError, wenn keine Kacheln veröffentlicht sind. */
    async orteImUmkreis(lat, lon, radiusMeter) {
      const { vorhanden } = await ladeIndex();
      const benoetigt = kachelnFuerUmkreis(lat, lon, radiusMeter).filter((k) => vorhanden.has(k));
      const orte = (await Promise.all(benoetigt.map(ladeKachel))).flat();
      return orte.filter((f) => entfernungMeter([lon, lat], f.geometry.coordinates) <= radiusMeter);
    },
  };
}
