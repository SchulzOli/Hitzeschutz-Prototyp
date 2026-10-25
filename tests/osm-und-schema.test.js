import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { elementZuKuehlemOrt, kategorieAusTags, overpassAbfrage, overpassZuFeatures } from '../src/osm.js';
import { erstelleValidator } from '../src/schema.js';

const schema = JSON.parse(readFileSync(new URL('../schema/kuehle-orte.schema.json', import.meta.url), 'utf8'));
const pruefe = erstelleValidator(schema);

const overpassAntwort = {
  elements: [
    { type: 'node', id: 1, lat: 52.5, lon: 13.4, tags: { amenity: 'drinking_water', wheelchair: 'yes' } },
    { type: 'way', id: 2, center: { lat: 52.51, lon: 13.41 }, tags: { leisure: 'park', name: 'Tiergarten' } },
    { type: 'node', id: 3, lat: 52.52, lon: 13.42, tags: { amenity: 'library', name: 'Stadtbibliothek', opening_hours: 'Mo-Fr 10:00-19:00', 'addr:street': 'Hauptstraße', 'addr:housenumber': '1', 'addr:postcode': '10115', 'addr:city': 'Berlin', website: 'https://example.org' } },
    { type: 'node', id: 4, lat: 52.53, lon: 13.43, tags: { leisure: 'sports_centre', sport: 'swimming', access: 'private' } },
    { type: 'node', id: 5, lat: 52.54, lon: 13.44, tags: { shop: 'bakery' } },
  ],
};

describe('OSM-Anbindung', () => {
  it('ordnet Tags den Schema-Kategorien zu', () => {
    expect(kategorieAusTags({ amenity: 'place_of_worship' })).toBe('gotteshaus');
    expect(kategorieAusTags({ leisure: 'bathing_place' })).toBe('badestelle');
    expect(kategorieAusTags({ shop: 'bakery' })).toBeNull();
  });

  it('übernimmt nur öffentlich nutzbare, passende Orte', () => {
    const features = overpassZuFeatures(overpassAntwort);
    expect(features.map((f) => f.id)).toEqual(['osm-node-1', 'osm-way-2', 'osm-node-3']);
  });

  it('nutzt bei Flächen den Mittelpunkt und füllt Felder', () => {
    const park = elementZuKuehlemOrt(overpassAntwort.elements[1]);
    expect(park.geometry.coordinates).toEqual([13.41, 52.51]);
    const bib = elementZuKuehlemOrt(overpassAntwort.elements[2]);
    expect(bib.properties.adresse).toBe('Hauptstraße 1, 10115 Berlin');
    expect(bib.properties.innenraum).toBe(true);
  });

  it('erzeugt eine Umkreis-Abfrage', () => {
    const q = overpassAbfrage(52.5, 13.4, 1500);
    expect(q).toContain('around:1500,52.50000,13.40000');
    expect(q).toContain('out center tags');
  });
});

describe('Datenschema Kühle Orte', () => {
  it('akzeptiert aus OSM erzeugte Orte', () => {
    const sammlung = {
      type: 'FeatureCollection',
      metadaten: { herausgeber: 'OpenStreetMap-Mitwirkende', lizenz: 'ODbL-1.0', stand: '2026-10-25' },
      features: overpassZuFeatures(overpassAntwort),
    };
    expect(pruefe(sammlung), JSON.stringify(pruefe.errors)).toBe(true);
  });

  it('akzeptiert den Beispieldatensatz einer Kommune', () => {
    const beispiel = JSON.parse(readFileSync(new URL('../daten/beispiel-musterstadt.geojson', import.meta.url), 'utf8'));
    expect(pruefe(beispiel), JSON.stringify(pruefe.errors)).toBe(true);
  });

  it('lehnt unbekannte Kategorien und fehlende Pflichtfelder ab', () => {
    const kaputt = {
      type: 'FeatureCollection',
      metadaten: { herausgeber: 'X', lizenz: 'CC-BY-4.0', stand: '2026-10-25' },
      features: [{ type: 'Feature', id: 'a', geometry: { type: 'Point', coordinates: [10, 50] }, properties: { name: 'X', kategorie: 'eisdiele' } }],
    };
    expect(pruefe(kaputt)).toBe(false);
  });
});
