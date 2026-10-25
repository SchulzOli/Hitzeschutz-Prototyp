import { describe, expect, it } from 'vitest';
import { entfernungMeter, formatiereEntfernung, punktInGeometrie } from '../src/geo.js';

const quadrat = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] };

describe('punktInGeometrie', () => {
  it('erkennt Punkte innen, außen und im Loch', () => {
    expect(punktInGeometrie([1, 1], quadrat)).toBe(true);
    expect(punktInGeometrie([11, 1], quadrat)).toBe(false);
    expect(punktInGeometrie([5, 5], quadrat)).toBe(false);
  });

  it('unterstützt MultiPolygon', () => {
    const multi = { type: 'MultiPolygon', coordinates: [quadrat.coordinates, [[[20, 20], [30, 20], [30, 30], [20, 20]]]] };
    expect(punktInGeometrie([28, 22], multi)).toBe(true);
  });
});

describe('entfernungMeter', () => {
  it('liefert plausible Werte (Berlin Hbf – Brandenburger Tor ≈ 1,6 km)', () => {
    const m = entfernungMeter([13.3696, 52.5251], [13.3777, 52.5163]);
    expect(m).toBeGreaterThan(1000);
    expect(m).toBeLessThan(1300);
  });

  it('formatiert Meter und Kilometer deutsch', () => {
    expect(formatiereEntfernung(243)).toBe('240 m');
    expect(formatiereEntfernung(1530)).toBe('1,5 km');
  });
});
