// Persönliches Hitze-Profil. Es verlässt den Browser nie: Speicherung nur in
// localStorage, keine Übertragung an einen Server (docs/adr/0003-profil-nur-lokal.md).

const SPEICHERSCHLUESSEL = 'hitzeschutz-profil-v1';

// Gruppen mit erhöhtem Risiko, wie sie der DWD und das Hitzewarnsystem nennen.
export const MERKMALE = [
  { id: 'alter65', text: '65 Jahre oder älter' },
  { id: 'pflege', text: 'Pflegebedürftig oder in der Mobilität eingeschränkt' },
  { id: 'chronisch', text: 'Chronische Erkrankung (z. B. Herz-Kreislauf, Niere, Lunge, Diabetes)' },
  { id: 'medikamente', text: 'Regelmäßige Einnahme von Medikamenten' },
  { id: 'schwanger', text: 'Schwanger' },
  { id: 'kleinkind', text: 'Säugling oder Kleinkind im Haushalt' },
  { id: 'draussen', text: 'Arbeit oder Sport im Freien' },
  { id: 'allein', text: 'Ich lebe allein' },
];

export function leeresProfil() {
  return { merkmale: [], wohnort: null };
}

export function ladeProfil(speicher = globalThis.localStorage) {
  try {
    const roh = speicher?.getItem(SPEICHERSCHLUESSEL);
    if (!roh) return leeresProfil();
    const profil = JSON.parse(roh);
    return { ...leeresProfil(), ...profil, merkmale: (profil.merkmale ?? []).filter((m) => MERKMALE.some((x) => x.id === m)) };
  } catch {
    return leeresProfil();
  }
}

export function speichereProfil(profil, speicher = globalThis.localStorage) {
  try {
    speicher?.setItem(SPEICHERSCHLUESSEL, JSON.stringify(profil));
  } catch {
    // Privater Modus o. Ä.: Profil gilt dann nur für diese Sitzung.
  }
}

export function loescheProfil(speicher = globalThis.localStorage) {
  try {
    speicher?.removeItem(SPEICHERSCHLUESSEL);
  } catch {
    // ignorieren
  }
}
