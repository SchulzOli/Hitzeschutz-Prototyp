import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';

import { entfernungMeter, formatiereEntfernung } from './geo.js';
import { stufe, findeWarnkreis, tagesbezeichnung, hoechsteSchwere, istAmtlicheWarnung, simuliereHitzewelle } from './hitze.js';
import { ladeKuehleOrteAusOsm } from './osm.js';
import { bewerteRisiko } from './risiko.js';
import { MERKMALE, ladeProfil, speichereProfil, loescheProfil, leeresProfil } from './profil.js';
import { KATEGORIEN } from './kategorien.js';

const BASIS = import.meta.env.BASE_URL;
const UMKREIS_WOHNORT = 1500;
const MAX_UMKREIS_ANSICHT = 2000;
const MIN_ZOOM_ORTE = 14;
const LISTENLAENGE = 10;

const $ = (id) => document.getElementById(id);

const zustand = {
  profil: ladeProfil(),
  hitze: null,
  tagHeute: 0,
  tag: 0,
  warnkreis: null,
  orte: new Map(),
  sichtbar: new Set(Object.keys(KATEGORIEN)),
};

// ---------- Karte ----------

const karte = L.map('karte', { zoomControl: true }).setView([51.16, 10.45], 6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende | Hitze: <a href="https://www.dwd.de">DWD</a>',
}).addTo(karte);

const hitzeEbene = L.geoJSON(null, {
  style: (f) => stilFuerWarnkreis(f),
  onEachFeature: (f, ebene) => ebene.bindTooltip(() => `${f.properties.name}: ${stufe(f.properties.trend[zustand.tag]).text}`, { sticky: true }),
}).addTo(karte);

const orteEbene = L.layerGroup().addTo(karte);
let wohnortMarker = null;

function stilFuerWarnkreis(feature) {
  const s = stufe(feature.properties.trend[zustand.tag]);
  const markiert = zustand.warnkreis?.properties.ccc === feature.properties.ccc;
  return {
    color: markiert ? '#222' : s.farbe ?? '#999',
    weight: markiert ? 2.5 : s.farbe ? 1 : 0.3,
    opacity: s.farbe || markiert ? 0.9 : 0.4,
    fillColor: s.farbe ?? '#ffffff',
    // Im Stadtmaßstab nur leicht einfärben, damit Straßen lesbar bleiben.
    fillOpacity: s.farbe ? (karte.getZoom() >= 12 ? 0.15 : 0.45) : 0,
    dashArray: istAmtlicheWarnung(feature.properties.trend[zustand.tag]) ? null : '4 3',
  };
}

const legende = L.control({ position: 'bottomleft' });
legende.onAdd = () => {
  const div = L.DomUtil.create('div', 'legende');
  div.innerHTML = `
    <strong>DWD-Hitzewarnung</strong>
    <span><i style="background:#7a1fc2"></i>extreme Wärmebelastung</span>
    <span><i style="background:#b67be6"></i>starke Wärmebelastung</span>
    <span><i class="trend" style="background:#d3b3ef"></i>Hitzetrend (Vorhersage)</span>`;
  return div;
};
legende.addTo(karte);

function symbolFuer(kategorie, offiziell) {
  const k = KATEGORIEN[kategorie] ?? KATEGORIEN.sonstiges;
  return L.divIcon({
    className: '',
    html: `<span class="ort-symbol${offiziell ? ' offiziell' : ''}" style="--farbe:${k.farbe}" aria-hidden="true">${k.symbol}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

// ---------- Daten laden ----------

async function ladeHitze() {
  try {
    const antwort = await fetch(`${BASIS}data/hitze.geojson`);
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    zustand.hitze = await antwort.json();
    if (new URLSearchParams(location.search).has('demo')) {
      zustand.hitze = simuliereHitzewelle(zustand.hitze);
      const banner = document.createElement('p');
      banner.className = 'demo-banner';
      banner.setAttribute('role', 'alert');
      banner.textContent = 'Demo-Modus: simulierte Hitzewelle – das sind keine echten DWD-Warnungen.';
      document.querySelector('.kopf').append(banner);
    }
  } catch (fehler) {
    $('hitzelage').innerHTML = `<p class="fehler">Hitzedaten konnten nicht geladen werden (${fehler.message}).</p>`;
    return;
  }
  const heute = new Date();
  const heuteUtc = Date.UTC(heute.getFullYear(), heute.getMonth(), heute.getDate());
  const standUtc = Date.parse(`${zustand.hitze.stand}T00:00:00Z`);
  zustand.tagHeute = Math.min(7, Math.max(0, Math.round((heuteUtc - standUtc) / 86400000)));
  zustand.tag = zustand.tagHeute;

  hitzeEbene.addData(zustand.hitze);
  $('datenstand').textContent = `DWD-Datenstand: ${new Date(`${zustand.hitze.stand}T12:00:00Z`).toLocaleDateString('de-DE')}`;
  zeichneTage();
}

async function ladeKommunaleDaten() {
  try {
    const antwort = await fetch(`${BASIS}kuehle-orte/index.json`);
    if (!antwort.ok) return;
    const dateien = await antwort.json();
    for (const datei of dateien) {
      const daten = await (await fetch(`${BASIS}kuehle-orte/${datei}`)).json();
      fuegeOrteHinzu(daten.features.map((f) => ({ ...f, properties: { lizenz: daten.metadaten?.lizenz, ...f.properties } })));
    }
  } catch {
    // Kommunale Daten sind optional.
  }
}

let laufendeAbfrage = null;
async function ladeOrteUm(lat, lon, radius) {
  laufendeAbfrage?.abort();
  laufendeAbfrage = new AbortController();
  $('orte-status').textContent = 'Kühle Orte werden aus OpenStreetMap geladen – das kann bei ausgelasteten Servern bis zu einer Minute dauern …';
  try {
    fuegeOrteHinzu(await ladeKuehleOrteAusOsm(lat, lon, radius, { signal: laufendeAbfrage.signal }));
    $('orte-status').textContent = '';
  } catch (fehler) {
    if (laufendeAbfrage.signal.aborted) return;
    $('orte-status').textContent = `${fehler.message}. `;
    const nochmal = document.createElement('button');
    nochmal.type = 'button';
    nochmal.className = 'zweitrangig';
    nochmal.textContent = 'Erneut versuchen';
    nochmal.addEventListener('click', () => ladeOrteUm(lat, lon, radius));
    $('orte-status').append(nochmal);
  }
  zeichneOrteListe();
}

function fuegeOrteHinzu(features) {
  for (const f of features) zustand.orte.set(f.id, f);
  zeichneOrteAufKarte();
}

// ---------- Ort wählen ----------

function setzeWohnort(lat, lon, bezeichnung, { zoomen = true } = {}) {
  zustand.profil.wohnort = { lat, lon, bezeichnung };
  speichereProfil(zustand.profil);

  if (wohnortMarker) wohnortMarker.setLatLng([lat, lon]);
  else {
    const icon = L.divIcon({ className: '', html: '<span class="wohnort-symbol" aria-hidden="true">🏠</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
    wohnortMarker = L.marker([lat, lon], { icon, title: 'Ihr Ort', keyboard: true, zIndexOffset: 1000 }).addTo(karte);
  }
  wohnortMarker.bindPopup(`<strong>Ihr Ort</strong><br>${escape(bezeichnung)}`);

  if (zoomen) {
    // Die Umkreisabfrage um den Wohnort deckt diese Ansicht schon ab.
    ueberspringeNaechsteBewegung = true;
    karte.setView([lat, lon], 15);
  }
  $('ort-status').textContent = bezeichnung;
  aktualisiereHitzelage();
  ladeOrteUm(lat, lon, UMKREIS_WOHNORT);
}

$('suche').addEventListener('submit', async (ereignis) => {
  ereignis.preventDefault();
  const q = $('suchfeld').value.trim();
  if (!q) return;
  $('ort-status').textContent = 'Suche läuft …';
  try {
    // Nominatim-Nutzungsrichtlinie: nur bei Absenden, keine Autovervollständigung.
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=de&q=${encodeURIComponent(q)}`;
    const treffer = await (await fetch(url, { headers: { 'Accept-Language': 'de' } })).json();
    if (!treffer.length) {
      $('ort-status').textContent = 'Kein Ort gefunden. Bitte anders schreiben.';
      return;
    }
    setzeWohnort(Number(treffer[0].lat), Number(treffer[0].lon), treffer[0].display_name);
  } catch {
    $('ort-status').textContent = 'Die Ortssuche ist gerade nicht erreichbar.';
  }
});

$('standort').addEventListener('click', () => {
  if (!navigator.geolocation) {
    $('ort-status').textContent = 'Ihr Browser unterstützt keine Standortabfrage.';
    return;
  }
  $('ort-status').textContent = 'Standort wird ermittelt …';
  navigator.geolocation.getCurrentPosition(
    (pos) => setzeWohnort(pos.coords.latitude, pos.coords.longitude, 'Aktueller Standort'),
    () => ($('ort-status').textContent = 'Standort konnte nicht ermittelt werden.'),
    { enableHighAccuracy: false, timeout: 10000 },
  );
});

karte.on('click', (e) => setzeWohnort(e.latlng.lat, e.latlng.lng, `Gewählter Punkt (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`, { zoomen: karte.getZoom() < 13 }));

let verzoegerung = null;
let ueberspringeNaechsteBewegung = false;
karte.on('zoomend', () => hitzeEbene.setStyle(stilFuerWarnkreis));
karte.on('moveend', () => {
  clearTimeout(verzoegerung);
  if (ueberspringeNaechsteBewegung) {
    ueberspringeNaechsteBewegung = false;
    return;
  }
  if (karte.getZoom() < MIN_ZOOM_ORTE) {
    if (!zustand.profil.wohnort) $('orte-status').textContent = 'Zoomen Sie weiter hinein oder wählen Sie einen Ort, um kühle Orte zu sehen.';
    return;
  }
  verzoegerung = setTimeout(() => {
    const mitte = karte.getCenter();
    const ecke = karte.getBounds().getNorthEast();
    const radius = Math.min(MAX_UMKREIS_ANSICHT, entfernungMeter([mitte.lng, mitte.lat], [ecke.lng, ecke.lat]));
    ladeOrteUm(mitte.lat, mitte.lng, radius);
  }, 600);
});

// ---------- Darstellung ----------

function zeichneTage() {
  const container = $('tage');
  container.innerHTML = '';
  const beispiel = zustand.hitze.features[0]?.properties.trend ?? [];
  for (let t = zustand.tagHeute; t < beispiel.length; t++) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.textContent = bezeichnungFuerTag(t);
    knopf.dataset.tag = String(t);
    knopf.setAttribute('aria-pressed', String(t === zustand.tag));
    knopf.addEventListener('click', () => {
      zustand.tag = t;
      for (const k of container.children) k.setAttribute('aria-pressed', String(k.dataset.tag === String(t)));
      hitzeEbene.setStyle(stilFuerWarnkreis);
      aktualisiereHitzelage();
    });
    container.append(knopf);
  }
  faerbeTage();
}

// Index t bezieht sich auf den Datenstand; "Heute"/"Morgen" auf das echte Datum.
function bezeichnungFuerTag(t) {
  const abstand = t - zustand.tagHeute;
  if (abstand === 0 || abstand === 1) return tagesbezeichnung(zustand.hitze.stand, abstand);
  return tagesbezeichnung(zustand.hitze.stand, t);
}

function faerbeTage() {
  for (const knopf of $('tage').children) {
    const code = zustand.warnkreis?.properties.trend[Number(knopf.dataset.tag)];
    const farbe = code != null ? stufe(code).farbe : null;
    knopf.style.setProperty('--tagfarbe', farbe ?? 'transparent');
    knopf.title = code != null ? stufe(code).text : '';
  }
}

function aktualisiereHitzelage() {
  const ziel = $('hitzelage');
  const wohnort = zustand.profil.wohnort;
  if (!zustand.hitze || !wohnort) return;

  zustand.warnkreis = findeWarnkreis(zustand.hitze, [wohnort.lon, wohnort.lat]);
  hitzeEbene.setStyle(stilFuerWarnkreis);
  faerbeTage();

  if (!zustand.warnkreis) {
    ziel.innerHTML = '<p class="hinweis">Für diesen Punkt liegt kein DWD-Warnkreis vor (außerhalb Deutschlands?).</p>';
    return;
  }

  const { name, trend } = zustand.warnkreis.properties;
  const code = trend[zustand.tag];
  const risiko = bewerteRisiko(code, zustand.profil.merkmale, hoechsteSchwere(trend, zustand.tag + 1, 3));
  const abstand = zustand.tag - zustand.tagHeute;
  const tagText = abstand === 0 ? 'heute' : abstand === 1 ? 'morgen' : `am ${bezeichnungFuerTag(zustand.tag)}`;

  ziel.innerHTML = `
    <p class="warnkreis">${escape(name)}, ${tagText}:</p>
    <p class="stufe" style="--stufenfarbe:${stufe(code).farbe ?? '#d9d9d9'}">${escape(stufe(code).text)}</p>
    <div class="risiko risiko-${risiko.einstufung}">
      <h3>${escape(risiko.titel)}</h3>
      ${risiko.hinweise.length ? `<ul>${risiko.hinweise.map((h) => `<li>${escape(h)}</li>`).join('')}</ul>` : ''}
      ${risiko.notfall ? `<p class="notfall">${escape(risiko.notfall)}</p>` : ''}
      ${zustand.profil.merkmale.length === 0 && code !== 0 ? '<p class="hinweis">Tipp: Im Hitze-Profil unten erhalten Sie Hinweise passend zu Ihrer Situation.</p>' : ''}
    </div>`;
}

function popupFuer(f) {
  const p = f.properties;
  const k = KATEGORIEN[p.kategorie] ?? KATEGORIEN.sonstiges;
  const zeilen = [
    `<strong>${escape(p.name)}</strong>`,
    `${k.name}${p.offiziell_ausgewiesen ? ' · <em>offiziell ausgewiesen</em>' : ''}`,
    p.adresse && escape(p.adresse),
    p.oeffnungszeiten && `Öffnungszeiten: ${escape(p.oeffnungszeiten)}`,
    p.klimatisiert && 'Klimatisiert',
    p.barrierefrei && `Barrierefrei: ${escape(p.barrierefrei)}`,
    p.website && `<a href="${encodeURI(p.website)}" rel="noopener" target="_blank">Website</a>`,
    `<small>Quelle: ${escape(p.quelle)}${p.quelle_id ? ` (${escape(p.quelle_id)})` : ''}</small>`,
  ];
  return zeilen.filter(Boolean).join('<br>');
}

const markerNachId = new Map();
function zeichneOrteAufKarte() {
  orteEbene.clearLayers();
  markerNachId.clear();
  for (const f of zustand.orte.values()) {
    if (!zustand.sichtbar.has(f.properties.kategorie)) continue;
    const [lon, lat] = f.geometry.coordinates;
    const marker = L.marker([lat, lon], { icon: symbolFuer(f.properties.kategorie, f.properties.offiziell_ausgewiesen), title: f.properties.name })
      .bindPopup(popupFuer(f));
    orteEbene.addLayer(marker);
    markerNachId.set(f.id, marker);
  }
  zeichneOrteListe();
}

function zeichneOrteListe() {
  const liste = $('orte-liste');
  const bezug = zustand.profil.wohnort
    ? [zustand.profil.wohnort.lon, zustand.profil.wohnort.lat]
    : [karte.getCenter().lng, karte.getCenter().lat];
  const naechste = [...zustand.orte.values()]
    .filter((f) => zustand.sichtbar.has(f.properties.kategorie))
    .map((f) => ({ f, m: entfernungMeter(bezug, f.geometry.coordinates) }))
    .sort((a, b) => Number(!!b.f.properties.offiziell_ausgewiesen) - Number(!!a.f.properties.offiziell_ausgewiesen) || a.m - b.m)
    .slice(0, LISTENLAENGE);

  liste.innerHTML = '';
  for (const { f, m } of naechste) {
    const k = KATEGORIEN[f.properties.kategorie] ?? KATEGORIEN.sonstiges;
    const li = document.createElement('li');
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'ort-eintrag';
    knopf.innerHTML = `<span class="ort-symbol klein" style="--farbe:${k.farbe}" aria-hidden="true">${k.symbol}</span>
      <span><strong>${escape(f.properties.name)}</strong><br><small>${k.name} · ${formatiereEntfernung(m)}</small></span>`;
    knopf.addEventListener('click', () => {
      const [lon, lat] = f.geometry.coordinates;
      karte.setView([lat, lon], Math.max(karte.getZoom(), 16));
      markerNachId.get(f.id)?.openPopup();
    });
    li.append(knopf);
    liste.append(li);
  }
}

function zeichneFilter() {
  const feld = $('filter');
  for (const [id, k] of Object.entries(KATEGORIEN)) {
    if (id === 'sonstiges') continue;
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${id}" checked> <span class="ort-symbol klein" style="--farbe:${k.farbe}" aria-hidden="true">${k.symbol}</span> ${k.name}`;
    label.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) zustand.sichtbar.add(id);
      else zustand.sichtbar.delete(id);
      zeichneOrteAufKarte();
    });
    feld.append(label);
  }
}

function zeichneProfil() {
  const feld = $('merkmale');
  for (const m of MERKMALE) {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${m.id}"> ${m.text}`;
    const box = label.querySelector('input');
    box.checked = zustand.profil.merkmale.includes(m.id);
    box.addEventListener('change', () => {
      zustand.profil.merkmale = MERKMALE.map((x) => x.id).filter((id) => feld.querySelector(`input[value="${id}"]`).checked);
      speichereProfil(zustand.profil);
      aktualisiereHitzelage();
    });
    feld.append(label);
  }
  if (zustand.profil.merkmale.length) $('profil').open = true;

  $('profil-loeschen').addEventListener('click', () => {
    loescheProfil();
    zustand.profil = leeresProfil();
    for (const box of feld.querySelectorAll('input')) box.checked = false;
    wohnortMarker?.remove();
    wohnortMarker = null;
    zustand.warnkreis = null;
    hitzeEbene.setStyle(stilFuerWarnkreis);
    faerbeTage();
    $('ort-status').textContent = 'Profil und Ort wurden gelöscht.';
    $('hitzelage').innerHTML = '<p class="hinweis">Wählen Sie einen Ort, um die Hitzelage für Ihren Landkreis zu sehen.</p>';
  });
}

function escape(text) {
  return String(text).replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[z]);
}

// ---------- Start ----------

zeichneFilter();
zeichneProfil();
await ladeHitze();
ladeKommunaleDaten();
if (zustand.profil.wohnort) {
  const { lat, lon, bezeichnung } = zustand.profil.wohnort;
  setzeWohnort(lat, lon, bezeichnung);
}
