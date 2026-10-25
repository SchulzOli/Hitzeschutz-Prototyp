# ADR 0003: Persönliches Profil bleibt auf dem Gerät

- Status: angenommen
- Datum: 2026-10-25

## Kontext

Hinweise werden besser, wenn die Anwendung weiß, ob jemand z. B. älter, chronisch krank oder
schwanger ist. Das sind **Gesundheitsdaten** (besondere Kategorie nach Art. 9 DSGVO).

## Entscheidung

- Profil und gewählter Ort werden ausschließlich im `localStorage` des Browsers gespeichert.
- Es gibt kein Benutzerkonto und kein Backend. Die Bewertung (`src/risiko.js`) läuft im Browser.
- Nutzer können Profil und Ort jederzeit mit einem Klick löschen.

## Folgen

- Keine Verarbeitung von Gesundheitsdaten auf Servern, keine Einwilligungsverwaltung nötig.
- Push-Benachrichtigungen bei neuer Warnung sind so nicht möglich. Eine spätere Lösung müsste
  ohne Profilübertragung auskommen, etwa über ein Abo nur auf den Warnkreis.
- Hinweis: Bei Ortssuche (Nominatim) und Kartenkacheln (OpenStreetMap) sehen diese Dienste die
  IP-Adresse und den angefragten Kartenausschnitt. Für den Produktivbetrieb sollten sie selbst
  gehostet werden. Die kühlen Orte kommen bereits vom eigenen Server (siehe ADR 0004).
