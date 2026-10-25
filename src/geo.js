// Kleine Geometrie-Helfer, damit für zwei Funktionen keine Bibliothek nötig ist.

function punktInRing([x, y], ring) {
  let innen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) innen = !innen;
  }
  return innen;
}

function punktInPolygonKoordinaten(punkt, polygon) {
  const [aussen, ...loecher] = polygon;
  return punktInRing(punkt, aussen) && !loecher.some((loch) => punktInRing(punkt, loch));
}

/** punkt = [lon, lat]; geometrie = GeoJSON Polygon oder MultiPolygon */
export function punktInGeometrie(punkt, geometrie) {
  if (geometrie.type === 'Polygon') return punktInPolygonKoordinaten(punkt, geometrie.coordinates);
  if (geometrie.type === 'MultiPolygon') return geometrie.coordinates.some((p) => punktInPolygonKoordinaten(punkt, p));
  return false;
}

/** Luftlinie in Metern zwischen zwei Punkten [lon, lat] (Haversine). */
export function entfernungMeter([lon1, lat1], [lon2, lat2]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export function formatiereEntfernung(meter) {
  return meter < 1000 ? `${Math.round(meter / 10) * 10} m` : `${(meter / 1000).toFixed(1).replace('.', ',')} km`;
}
