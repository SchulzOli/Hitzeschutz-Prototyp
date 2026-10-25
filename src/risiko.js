// Leitet aus DWD-Warnstufe und persönlichem Profil allgemeine Verhaltenshinweise ab.
// Keine medizinische Beratung – nur die allgemein empfohlenen Hitzeschutz-Regeln,
// gewichtet nach Profil.

import { stufe } from './hitze.js';

export const NOTFALLHINWEIS =
  'Bei Verwirrtheit, Bewusstseinsstörungen, Krampfanfällen oder sehr hoher Körpertemperatur sofort den Notruf 112 wählen.';

const PERSOENLICHE_HINWEISE = {
  alter65: 'Das Durstgefühl lässt im Alter nach – feste Trinkzeiten über den Tag helfen.',
  pflege: 'Bitten Sie Angehörige oder Pflegedienst, an heißen Tagen öfter nach Ihnen zu sehen.',
  chronisch: 'Ist Ihre Trinkmenge ärztlich begrenzt (z. B. bei Herz- oder Nierenerkrankung), sprechen Sie das Vorgehen bei Hitze mit Ihrer Arztpraxis ab.',
  medikamente: 'Manche Medikamente beeinflussen Wärmeregulation oder Flüssigkeitshaushalt. Fragen Sie Arztpraxis oder Apotheke – nicht eigenmächtig absetzen. Medikamente kühl lagern.',
  schwanger: 'Körperliche Belastung reduzieren, ausreichend trinken und bei Kreislaufbeschwerden ärztlichen Rat einholen.',
  kleinkind: 'Kinder nie im geparkten Auto lassen. Schatten, leichte Kleidung und häufig zu trinken anbieten.',
  draussen: 'Arbeit und Sport in die kühleren Morgen- oder Abendstunden legen, Pausen im Schatten einplanen.',
  allein: 'Vereinbaren Sie an Hitzetagen einen täglichen Kontakt mit Angehörigen oder Nachbarn.',
};

const ALLGEMEINE_HINWEISE = [
  'Über den Tag verteilt regelmäßig trinken, bevorzugt Wasser.',
  'Anstrengung und direkte Sonne in der Mittagshitze meiden.',
  'Wohnung tagsüber verschatten, in den kühlen Nacht- und Morgenstunden lüften.',
  'Kühle Orte in der Nähe aufsuchen, wenn die Wohnung sich aufheizt.',
];

/**
 * @param {number} code      DWD-Code des gewählten Tages
 * @param {string[]} merkmale Profil-Merkmale (siehe profil.js)
 * @param {number} schwereKommend höchste Schwere der kommenden Tage (für Vorwarnung)
 */
export function bewerteRisiko(code, merkmale = [], schwereKommend = 0) {
  const s = stufe(code).schwere;
  const gefaehrdet = merkmale.length > 0;
  const persoenlich = merkmale.map((m) => PERSOENLICHE_HINWEISE[m]).filter(Boolean);

  if (s === 0) {
    return {
      einstufung: schwereKommend >= 3 ? 'vorbereiten' : 'keine',
      titel: schwereKommend >= 3 ? 'Heute keine Warnung – in den nächsten Tagen wird Hitze erwartet' : 'Keine Hitzewarnung',
      hinweise: schwereKommend >= 3 ? ['Jetzt vorbereiten: Getränke, Verschattung und kühle Orte in der Nähe planen.', ...persoenlich] : [],
      notfall: null,
    };
  }

  if (s <= 2) {
    return {
      einstufung: 'vorbereiten',
      titel: 'Hitze möglich – vorbereiten',
      hinweise: ['Wetterlage beobachten und Getränke, Verschattung und kühle Orte in der Nähe planen.', ...persoenlich],
      notfall: null,
    };
  }

  const titel = s === 4
    ? gefaehrdet ? 'Sehr hohes Risiko für Sie' : 'Extreme Wärmebelastung – hohes Risiko'
    : gefaehrdet ? 'Hohes Risiko für Sie' : 'Starke Wärmebelastung';

  return {
    einstufung: s === 4 || gefaehrdet ? 'hoch' : 'erhoeht',
    titel,
    hinweise: [...persoenlich, ...ALLGEMEINE_HINWEISE],
    notfall: NOTFALLHINWEIS,
  };
}
