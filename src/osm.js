// Kühle Orte aus OpenStreetMap über die Overpass API.
// Die Ergebnisse werden in das eigene Schema (schema/kuehle-orte.schema.json)
// übersetzt, damit OSM- und kommunale Daten gleich behandelt werden.

export const OVERPASS_ENDPUNKTE = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const FILTER = [
  'nwr["amenity"="drinking_water"]',
  'nwr["amenity"="library"]',
  'nwr["amenity"="place_of_worship"]',
  'nwr["tourism"="museum"]',
  'nwr["leisure"="park"]',
  'nwr["leisure"~"^(bathing_place|swimming_area|water_park)$"]',
  'nwr["leisure"="sports_centre"]["sport"="swimming"]',
];

export function overpassAbfrage(lat, lon, radiusMeter) {
  const umkreis = `(around:${Math.round(radiusMeter)},${lat.toFixed(5)},${lon.toFixed(5)})`;
  return `[out:json][timeout:25];(${FILTER.map((f) => `${f}${umkreis};`).join('')});out center tags;`;
}

export function kategorieAusTags(tags = {}) {
  if (tags.amenity === 'drinking_water') return 'trinkwasser';
  if (tags.amenity === 'library') return 'bibliothek';
  if (tags.amenity === 'place_of_worship') return 'gotteshaus';
  if (tags.tourism === 'museum') return 'museum';
  if (tags.leisure === 'park') return 'park';
  if (['bathing_place', 'swimming_area', 'water_park'].includes(tags.leisure)) return 'badestelle';
  if (tags.leisure === 'sports_centre' && tags.sport === 'swimming') return 'badestelle';
  return null;
}

const STANDARDNAMEN = {
  trinkwasser: 'Trinkwasserstelle',
  bibliothek: 'Bibliothek',
  gotteshaus: 'Gotteshaus',
  museum: 'Museum',
  park: 'Park',
  badestelle: 'Badestelle',
};

function janein(wert) {
  if (wert === 'yes') return true;
  if (wert === 'no') return false;
  return undefined;
}

function adresse(tags) {
  const strasse = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const ort = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  return [strasse, ort].filter(Boolean).join(', ') || undefined;
}

/** Wandelt ein Overpass-Element in einen Kühlen Ort nach Schema v0.1 um (oder null). */
export function elementZuKuehlemOrt(element) {
  const tags = element.tags ?? {};
  const kategorie = kategorieAusTags(tags);
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (!kategorie || lat == null || lon == null) return null;
  // Private Anlagen (z. B. Hotelpools) sind für die Öffentlichkeit nicht nutzbar.
  if (['private', 'no', 'customers'].includes(tags.access)) return null;

  const eigenschaften = {
    name: tags.name ?? STANDARDNAMEN[kategorie],
    kategorie,
    offiziell_ausgewiesen: false,
    adresse: adresse(tags),
    oeffnungszeiten: tags.opening_hours,
    innenraum: ['bibliothek', 'gotteshaus', 'museum'].includes(kategorie) ? true : kategorie === 'park' || kategorie === 'trinkwasser' ? false : undefined,
    klimatisiert: janein(tags.air_conditioning),
    trinkwasser_kostenlos: kategorie === 'trinkwasser' ? tags.fee !== 'yes' : undefined,
    barrierefrei: { yes: 'ja', limited: 'teilweise', no: 'nein' }[tags.wheelchair],
    kostenfrei: tags.fee === 'yes' ? false : tags.fee === 'no' ? true : undefined,
    betreiber: tags.operator,
    website: tags.website?.startsWith('http') ? tags.website : undefined,
    quelle: 'OpenStreetMap',
    quelle_id: `${element.type}/${element.id}`,
    lizenz: 'ODbL-1.0',
  };
  for (const schluessel of Object.keys(eigenschaften)) {
    if (eigenschaften[schluessel] === undefined) delete eigenschaften[schluessel];
  }

  return {
    type: 'Feature',
    id: `osm-${element.type}-${element.id}`,
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: eigenschaften,
  };
}

export function overpassZuFeatures(antwort) {
  return (antwort.elements ?? []).map(elementZuKuehlemOrt).filter(Boolean);
}

const cache = new Map();

/** Lädt Kühle Orte im Umkreis. Probiert nacheinander mehrere öffentliche Overpass-Server. */
export async function ladeKuehleOrteAusOsm(lat, lon, radiusMeter, { signal } = {}) {
  const schluessel = `${lat.toFixed(3)},${lon.toFixed(3)},${Math.round(radiusMeter / 250)}`;
  if (cache.has(schluessel)) return cache.get(schluessel);

  const body = new URLSearchParams({ data: overpassAbfrage(lat, lon, radiusMeter) });
  let letzterFehler;
  for (const endpunkt of OVERPASS_ENDPUNKTE) {
    try {
      // Öffentliche Overpass-Server sind oft ausgelastet: nach 20 s den nächsten probieren.
      const zeitlimit = AbortSignal.timeout(20000);
      const antwort = await fetch(endpunkt, { method: 'POST', body, signal: signal ? AbortSignal.any([signal, zeitlimit]) : zeitlimit });
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
      const features = overpassZuFeatures(await antwort.json());
      cache.set(schluessel, features);
      return features;
    } catch (fehler) {
      if (signal?.aborted) throw fehler;
      letzterFehler = fehler;
    }
  }
  const grund = letzterFehler?.name === 'TimeoutError' ? 'Zeitüberschreitung' : letzterFehler?.message ?? 'unbekannt';
  throw new Error(`OpenStreetMap-Daten derzeit nicht erreichbar (${grund})`);
}
