import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { erstelleKachelLader, kachelFuerPunkt, kachelnFuerUmkreis, KeineKachelnError } from '../src/kacheln.js';
import { erzeugeKacheln, repraesentativerPunkt, zeileZuKuehlemOrt } from '../scripts/osm-kacheln.mjs';
import { erstelleValidator } from '../src/schema.js';

const schema = JSON.parse(await readFile(new URL('../schema/kuehle-orte.schema.json', import.meta.url), 'utf8'));
const pruefe = erstelleValidator(schema);

// So sieht der Export von `osmium export -f geojsonseq --attributes=type,id` aus
// (Zeilen beginnen mit dem Record-Separator 0x1E).
const RS = '\x1e';
const zeilen = [
  `${RS}{"type":"Feature","geometry":{"type":"Point","coordinates":[13.4,52.5]},"properties":{"@type":"node","@id":1,"amenity":"drinking_water"}}`,
  `${RS}{"type":"Feature","geometry":{"type":"MultiPolygon","coordinates":[[[[13.0,52.0],[13.002,52.0],[13.002,52.002],[13.0,52.002],[13.0,52.0]]],[[[13.1,52.1],[13.1001,52.1],[13.1001,52.1001],[13.1,52.1]]]]},"properties":{"@type":"relation","@id":7,"leisure":"park","name":"Großer Park"}}`,
  `${RS}{"type":"Feature","geometry":{"type":"Point","coordinates":[13.41,52.51]},"properties":{"@type":"node","@id":3,"leisure":"sports_centre","sport":"fitness"}}`,
  `${RS}{"type":"Feature","geometry":{"type":"LineString","coordinates":[[13.4,52.5],[13.41,52.5]]},"properties":{"@type":"way","@id":4,"highway":"footway"}}`,
  `${RS}{"type":"Feature","geometry":{"type":"Point","coordinates":[13.4,52.5]},"properties":{"@type":"node","@id":1,"amenity":"drinking_water"}}`,
  '',
];

describe('Kachelmathematik', () => {
  it('berechnet XYZ-Kacheln wie Webkarten', () => {
    // Brandenburger Tor liegt auf Zoom 12 in Kachel 2200/1343.
    expect(kachelFuerPunkt(52.5163, 13.3777)).toEqual({ x: 2200, y: 1343 });
  });

  it('findet alle Kacheln eines Umkreises', () => {
    const kacheln = kachelnFuerUmkreis(52.5163, 13.3777, 1500);
    expect(kacheln).toContain('2200/1343');
    expect(kacheln.length).toBeGreaterThanOrEqual(1);
    expect(kacheln.length).toBeLessThanOrEqual(4);
  });
});

describe('osmium-Export -> Kühle Orte', () => {
  it('nimmt bei Multipolygonen den Schwerpunkt der größten Fläche', () => {
    const [lon, lat] = repraesentativerPunkt({ type: 'MultiPolygon', coordinates: [[[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]], [[[10, 10], [10.1, 10], [10.1, 10.1], [10, 10]]]] });
    expect(lon).toBeCloseTo(1);
    expect(lat).toBeCloseTo(1);
  });

  it('übersetzt Zeilen und verwirft Unpassendes', () => {
    expect(zeileZuKuehlemOrt(zeilen[0]).id).toBe('osm-node-1');
    expect(zeileZuKuehlemOrt(zeilen[1]).properties.name).toBe('Großer Park');
    expect(zeileZuKuehlemOrt(zeilen[2])).toBeNull();
    expect(zeileZuKuehlemOrt(zeilen[3])).toBeNull();
    expect(zeileZuKuehlemOrt('')).toBeNull();
  });

  describe('erzeugeKacheln', () => {
    let ziel;
    afterAll(() => rm(ziel, { recursive: true, force: true }));

    it('schreibt schema-konforme Kacheln, Index und entfernt Dubletten', async () => {
      ziel = await mkdtemp(join(tmpdir(), 'kacheln-'));
      const index = await erzeugeKacheln(zeilen, ziel, '2026-10-20');
      expect(index.anzahl).toBe(2);
      expect(index.stand).toBe('2026-10-20');

      const lader = erstelleKachelLader(`${ziel}/`, async (pfad) => {
        try {
          const text = await readFile(pfad, 'utf8');
          return { ok: true, status: 200, json: async () => JSON.parse(text) };
        } catch {
          return { ok: false, status: 404 };
        }
      });
      const orte = await lader.orteImUmkreis(52.5, 13.4, 500);
      expect(orte.map((o) => o.id)).toEqual(['osm-node-1']);
      const sammlung = { type: 'FeatureCollection', metadaten: { herausgeber: 'OSM', lizenz: index.lizenz, stand: index.stand }, features: orte };
      expect(pruefe(sammlung), JSON.stringify(pruefe.errors)).toBe(true);
    });
  });
});

describe('KachelLader', () => {
  it('meldet fehlende Kacheln, damit die App auf Overpass ausweichen kann', async () => {
    const lader = erstelleKachelLader('/x/', async () => ({ ok: false, status: 404 }));
    await expect(lader.orteImUmkreis(52.5, 13.4, 500)).rejects.toBeInstanceOf(KeineKachelnError);
  });
});
