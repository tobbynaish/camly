# G-002 Konturklassifikation bauen — Completion-Report

## Goal
G-002: Schritt 3 gebaut, Konturen werden als außen/innen/Bohrung klassifiziert, Klick-Korrektur möglich, Fräser-Durchmesser greift in die Geometrie ein.

## Ergebnis: erledigt

## Umgesetzt

- `src/lib/cam/toolPath.ts` (neu): Fräser-Zentrumpfad pro Kontur abhängig von Rolle und `toolDiameter`. Außen: Versatz nach außen, Innen/Bohrung: Versatz nach innen, Bohrung mit Ø < Fräser-Ø: Konflikt-Flag mit leerem Pfad. Polylinien-Versatz mit Eckenschnitt, Kreise mit Radius plus/minus toolRadius.
- `src/lib/cam/classify.ts`: Verschachtelungs-Heuristik robuster gemacht. Statt nur des Schwerpunkts werden mehrere Stützpunkte geprüft und die kleinste Verschachtelungstiefe gewinnt. Behebt den Fall, dass der Schwerpunkt einer Innenkontur zufällig in einer Bohrung liegt.
- `src/lib/render/renderDxf.ts`: renderDxf akzeptiert optional `toolPaths`. Zeichnet gestrichelten Fräser-Zentrumpfad über der Original-Geometrie und ein Kreuz an Konflikt-Konturen.
- `src/App.svelte`: `toolPaths` reactive aus `buildToolPaths`, live-Aktualisierung bei `toolDiameter`-Wechsel. Konflikt-Hinweis unter der Legende, Hinweiszeile zum gestrichelten Zentrumpfad.
- `src/app.css`: Styles für `.tool-note` und `.conflict`.
- `samples/demo-tasche.dxf` (neu): 200x150 Außen-Polyline, 120x70 Innen-Polyline, Bohrung Ø10. Triggert die Verschachtelungs-Heuristik sauber.
- `README.md`: Status auf "Schritt 3 mit Fräser-Eingriff" aktualisiert, neues Demo erwähnt.
- `docs/goal-gap-report.md`: Checkliste aktualisiert.
- `scripts/smoketest.ts` (neu): Logik-Check für classify und toolPath ohne Browser. Aufrufbar mit `npx vite-node scripts/smoketest.ts`.

## Verifikation (alle grün)

- `npm run check`: svelte-check 0 errors, 0 warnings.
- `npm run build`: erfolgreich, 82.5 KB JS gzip 29.4 KB, PWA precache 5 Einträge.
- `npx vite-node scripts/smoketest.ts`: Demo-Tasche klassifiziert als `outer,inner,hole`. Fräser Ø 3 mm und 8 mm: 0 Konflikte. Fräser Ø 12 mm: 1 Konflikt (Bohrung Ø 10 mm < Fräser Ø 12 mm), Pfad leer, Konfliktgrund gesetzt.
- Demo-Rechteck: 4 offene Linien als `open`, 2 Bohrungen als `hole`. Klick-Korrektur im UI bleibt wie in G-001.

## Bewusst offen

- Offset-Selbstschnitte werden nicht aufgelöst (bei stark konkaven Konturen kann der Versatz-Pfad sich selbst schneiden). Kommt in einem späteren CAM-Schritt.
- Bogen-Offset: Bögen werden als Pfad übernommen, nicht verschoben. Kommt später.
- Taschen-Fräsen für zu kleine Bohrungen: nur Hinweis, keine automatische Lösung.
- Keine automatisierten Unit-Tests im Repo (kein Test-Framework installiert). Smoketest läuft via `npx vite-node`. Wenn Tobias einen echten Test-Stack will (vitest), im nächsten Goal anlegen.

## Was Tobias noch tun kann (optional)

- `npx vite-node scripts/smoketest.ts` einmal selbst laufen lassen, um die Logikausgabe zu sehen.
- Im Browser `npm run dev` starten, `samples/demo-tasche.dxf` laden, Fräser-Ø in Schritt 2 hochstellen und in Schritt 3 prüfen, ob der gestrichelte Zentrumpfad live nachzieht und bei Ø 12 mm das Konflikt-Kreuz in der Bohrung erscheint.
- `samples/demo-tasche.dxf` in einen CAD-Viewer laden, falls die Maße plausibel sein sollen (200x150 außen, 40..160 x 40..110 innen, Bohrung bei 100,75 Ø 10).

## Geänderte Dateien

- `src/lib/cam/toolPath.ts` (neu)
- `src/lib/cam/classify.ts` (Heuristik robuster)
- `src/lib/render/renderDxf.ts` (toolPaths-Rendering, Konflikt-Kreuze)
- `src/App.svelte` (toolPaths reactive, Konflikt-Hinweis)
- `src/app.css` (.tool-note, .conflict)
- `samples/demo-tasche.dxf` (neu)
- `scripts/smoketest.ts` (neu)
- `README.md` (Status, Demo-Hinweis)
- `docs/goal-gap-report.md` (Checkliste)
- `docs/goal-completion-report.md` (neu, diese Datei)

## Verweise

- Goal-ID: G-002
- Branch: feature/g-002-konturklassifikation