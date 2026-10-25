import { describe, expect, it } from 'vitest';
import { findeWarnkreis, hoechsteSchwere, stufe, tagesbezeichnung } from '../src/hitze.js';
import { verknuepfe } from '../scripts/fetch-dwd.mjs';

const warnkreise = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { CCC: 'AAA', NAME: 'Kreis A' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } },
    { type: 'Feature', properties: { CCC: 'BBB', NAME: 'Kreis B' }, geometry: { type: 'Polygon', coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]] } },
    { type: 'Feature', properties: { CCC: 'ZZZ', NAME: 'Ohne Trend' }, geometry: { type: 'Polygon', coordinates: [[[5, 5], [6, 5], [6, 6], [5, 5]]] } },
  ],
};
const hwtrend = {
  AAA: { Name: 'Kreis A', Bundesland: '1', Trend: [1, 2, 5, 0, 0, 0, 0, 0] },
  BBB: { Name: 'Kreis B', Bundesland: '1', Trend: [0, 0, 0, 0, 0, 0, 0, 0] },
};

describe('verknuepfe (DWD-Pipeline)', () => {
  const daten = verknuepfe(warnkreise, hwtrend, '2026-07-01');

  it('verbindet Geometrie und Trend über die CCC-Kennung', () => {
    expect(daten.features).toHaveLength(2);
    expect(daten.features[0].properties).toEqual({ ccc: 'AAA', name: 'Kreis A', trend: [1, 2, 5, 0, 0, 0, 0, 0] });
    expect(daten.stand).toBe('2026-07-01');
    expect(daten.lizenz).toBe('CC BY 4.0');
  });

  it('findet den Warnkreis zu einem Punkt', () => {
    expect(findeWarnkreis(daten, [0.5, 0.5]).properties.ccc).toBe('AAA');
    expect(findeWarnkreis(daten, [1.5, 0.5]).properties.ccc).toBe('BBB');
    expect(findeWarnkreis(daten, [9, 9])).toBeNull();
  });
});

describe('Warnstufen', () => {
  it('bildet die DWD-Codes ab', () => {
    expect(stufe(1).text).toMatch(/starker/);
    expect(stufe(2).text).toMatch(/extremer/);
    expect(stufe(7).text).toMatch(/Stufe 2 wahrscheinlich/);
    expect(stufe(99)).toBe(stufe(0));
  });

  it('ermittelt die höchste Schwere der kommenden Tage', () => {
    expect(hoechsteSchwere([0, 0, 5, 1, 0], 1, 3)).toBe(3);
    expect(hoechsteSchwere([0, 0, 0, 0], 0, 3)).toBe(0);
  });

  it('beschriftet Tage', () => {
    expect(tagesbezeichnung('2026-07-01', 0)).toBe('Heute');
    expect(tagesbezeichnung('2026-07-01', 1)).toBe('Morgen');
    expect(tagesbezeichnung('2026-07-01', 2)).toMatch(/03\.07\./);
  });
});
