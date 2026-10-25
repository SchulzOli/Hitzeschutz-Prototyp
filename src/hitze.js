import { punktInGeometrie } from './geo.js';

// Warnstufen laut DWD-Datensatzbeschreibung "Hitzetrend DWD-Warnkreise".
// Tag 0 und 1 sind amtliche Warnungen, ab Tag 2 Hitzetrendvorhersage.
export const STUFEN = {
  0: { text: 'Keine Warnung', kurz: 'keine', schwere: 0, farbe: null },
  1: { text: 'Warnung vor starker Wärmebelastung', kurz: 'stark', schwere: 3, farbe: '#b67be6' },
  2: { text: 'Warnung vor extremer Wärmebelastung', kurz: 'extrem', schwere: 4, farbe: '#7a1fc2' },
  3: { text: 'Hitzetrend: Warnung möglich', kurz: 'Trend', schwere: 1, farbe: '#e9d8f7' },
  4: { text: 'Hitzetrend: Warnung Stufe 1 gering wahrscheinlich', kurz: 'Trend', schwere: 1, farbe: '#e9d8f7' },
  5: { text: 'Hitzetrend: Warnung Stufe 1 wahrscheinlich', kurz: 'Trend', schwere: 2, farbe: '#d3b3ef' },
  6: { text: 'Hitzetrend: Warnung Stufe 2 gering wahrscheinlich', kurz: 'Trend', schwere: 2, farbe: '#d3b3ef' },
  7: { text: 'Hitzetrend: Warnung Stufe 2 wahrscheinlich', kurz: 'Trend', schwere: 3, farbe: '#b67be6' },
};

export function stufe(code) {
  return STUFEN[code] ?? STUFEN[0];
}

export function istAmtlicheWarnung(code) {
  return code === 1 || code === 2;
}

/** Findet den DWD-Warnkreis, in dem der Punkt [lon, lat] liegt. */
export function findeWarnkreis(hitzeDaten, punkt) {
  return hitzeDaten.features.find((f) => punktInGeometrie(punkt, f.geometry)) ?? null;
}

/** Datum des Vorhersagetags (0 = Stand der Datei) als Date in UTC. */
export function datumFuerTag(stand, tag) {
  const d = new Date(`${stand}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tag);
  return d;
}

export function tagesbezeichnung(stand, tag) {
  if (tag === 0) return 'Heute';
  if (tag === 1) return 'Morgen';
  return datumFuerTag(stand, tag).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

/**
 * Demo-Modus (?demo in der URL): simuliert eine Hitzewelle, damit sich die
 * Anwendung auch außerhalb des Sommers vorführen lässt. Je südlicher, desto heißer.
 */
export function simuliereHitzewelle(hitzeDaten) {
  const verlauf = (breite) => {
    if (breite < 49.5) return [1, 2, 2, 7, 5, 4, 0, 0];
    if (breite < 51) return [1, 1, 2, 5, 5, 4, 0, 0];
    if (breite < 52.5) return [0, 1, 1, 5, 4, 0, 0, 0];
    return [0, 0, 1, 4, 0, 0, 0, 0];
  };
  const ersterPunkt = (g) => (g.type === 'Polygon' ? g.coordinates[0][0] : g.coordinates[0][0][0]);
  return {
    ...hitzeDaten,
    demo: true,
    features: hitzeDaten.features.map((f) => ({ ...f, properties: { ...f.properties, trend: verlauf(ersterPunkt(f.geometry)[1]) } })),
  };
}

/** Höchste Stufe der nächsten Tage – für "Was kommt auf mich zu?". */
export function hoechsteSchwere(trend, abTag = 0, tage = 3) {
  return trend.slice(abTag, abTag + tage).reduce((max, code) => Math.max(max, stufe(code).schwere), 0);
}
