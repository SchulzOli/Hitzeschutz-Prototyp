import { describe, expect, it } from 'vitest';
import { bewerteRisiko, NOTFALLHINWEIS } from '../src/risiko.js';
import { ladeProfil, speichereProfil } from '../src/profil.js';

describe('bewerteRisiko', () => {
  it('ohne Warnung keine Hinweise', () => {
    const r = bewerteRisiko(0, ['alter65']);
    expect(r.einstufung).toBe('keine');
    expect(r.hinweise).toEqual([]);
  });

  it('warnt vor, wenn in den nächsten Tagen Hitze kommt', () => {
    expect(bewerteRisiko(0, [], 3).einstufung).toBe('vorbereiten');
  });

  it('stuft gefährdete Menschen bei starker Wärmebelastung hoch ein', () => {
    expect(bewerteRisiko(1, []).einstufung).toBe('erhoeht');
    const r = bewerteRisiko(1, ['medikamente', 'allein']);
    expect(r.einstufung).toBe('hoch');
    expect(r.titel).toBe('Hohes Risiko für Sie');
    expect(r.hinweise[0]).toMatch(/Medikamente/);
    expect(r.hinweise[1]).toMatch(/täglichen Kontakt/);
    expect(r.notfall).toBe(NOTFALLHINWEIS);
  });

  it('extreme Wärmebelastung ist immer hoch', () => {
    expect(bewerteRisiko(2, []).einstufung).toBe('hoch');
  });
});

describe('Profil', () => {
  function speicher() {
    const daten = new Map();
    return { getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => daten.set(k, v), removeItem: (k) => daten.delete(k) };
  }

  it('speichert und lädt lokal, verwirft unbekannte Merkmale', () => {
    const s = speicher();
    speichereProfil({ merkmale: ['alter65', 'unbekannt'], wohnort: { lat: 1, lon: 2, bezeichnung: 'X' } }, s);
    expect(ladeProfil(s)).toEqual({ merkmale: ['alter65'], wohnort: { lat: 1, lon: 2, bezeichnung: 'X' } });
  });

  it('übersteht kaputten Speicher', () => {
    const s = { getItem: () => '{kaputt', setItem: () => {}, removeItem: () => {} };
    expect(ladeProfil(s).merkmale).toEqual([]);
  });
});
