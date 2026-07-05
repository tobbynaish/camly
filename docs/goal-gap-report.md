# G-002 Konturklassifikation bauen — Gap-Report

## Done-Bedingung (Checkliste)

- [x] Schritt 3 gebaut (Stepper, UI-Block vorhanden)
- [x] Konturen werden als außen/innen/Bohrung klassifiziert (classify.ts, Heuristik per Verschachtelungstiefe)
- [x] Klick-Korrektur möglich (hitTest + cycleRole, Canvas-Klick in Schritt 3)
- [x] Fräser-Durchmesser greift in die Geometrie ein (toolPath.ts, Zentrumpfad live in Vorschau)
- [x] `npm run build && npm run check` grün
- [x] Demo-DXF zeigt klassifizierte Konturen (demo-tasche.dxf mit geschlossener Außen-Polyline, Ausschnitt, Bohrung)

## Soll-Ist-Abgleich

### Schon gebaut

- `src/lib/cam/classify.ts`: Role-Typ (outer/inner/hole/open), classifyDoc-Heuristik per Verschachtelungstiefe, cycleRole für Klick, Geometrie-Helfer (isClosed, entityContains, pointInPolygon, bboxArea).
- `src/lib/render/hitTest.ts`: Klick trifft kleinste umschließende geschlossene Kontur, sonst nächstgelegene.
- `src/lib/render/renderDxf.ts`: rollenbasierte Farben, Zeichnung aller Entity-Typen.
- `src/App.svelte`: Schritt-3-Block mit Legende, Klick-Handler, cycleRole.
- Setup-Leiste mit `toolDiameter`, `stockThickness`, `margin`.
- Demo-DXF (`samples/demo-rechteck.dxf`): Rechteck 300x200 mit zwei Kreisen (Bohrungen).

### Fehlt (die eigentliche G-002-Lücke)

- Fräser-Durchmesser wirkt nicht auf Geometrie. `toolDiameter` geht nur in `analyzeJob` (Platten-Hüllmaß) ein. Die Konturklassifikation und Vorschau ignorieren ihn.
- Kein Fräser-Zentrumpfad (Offset). Außenkonturen müssten den Fräser außen herumführen, Innenkonturen und Bohrungen innen. Heute wird nur die Original-Kontur gezeichnet.
- Keine Konflikt-Erkennung: Bohrungen mit Durchmesser kleiner als der Fräser-Ø sind nicht fräsbar (oder nur als Tasche). Heute keine Warnung.
- Keine visuelle Rückmeldung, dass der Fräser in die Geometrie eingreift (z.B. gestrichelter Zentrumpfad, Material-Schraffur, Hinweis-Chip bei zu kleinen Bohrungen).

### Abweichungen

- Demo-DXF nutzt `LINE`-Entitäten für das Rechteck statt `LWPOLYLINE` mit `closed=true`. `isClosed` liefert für Linien `false`, also werden sie als `open` klassifiziert. Der Nutzer muss per Klick korrigieren. Für die Verifikation "Demo-DXF zeigt klassifizierte Konturen" ist das kein Blocker, weil die Kreise als `hole` erkannt werden und das Rechteck per Klick auf `outer` gesetzt werden kann. Sauberer wäre ein zweites Demo mit geschlossener Polyline.

### Risiken

- Offset-Berechnung für Polylinien ist nicht trivial (Selbstschnitte, Innenringe). Für G-002 reicht ein einfacher konstanter Seitenversatz entlang der Normalen je Segment, ohne Selbstschnitte aufzulösen. Dokumentiert als bewusst vereinfacht.
- Bögen als Offset sind aufwändig. Für G-002 nur Kreise (Bohrungen) und Polylinien/Linien als Pfad-Elemente. Bögen in der Original-Geometrie werden als solche gezeichnet, der Fräserpfad für Bögen kommt in einem späteren Schritt.

## Plan (Priorität)

1. Neues Modul `src/lib/cam/toolPath.ts`: berechnet pro Entity einen Fräser-Zentrumpfad abhängig von Rolle und `toolDiameter`. Außen: Pfad außen (radius outward), Innen/Bohrung: Pfad innen (radius inward). Bohrung mit Ø < toolDiameter: Konflikt-Flag.
2. Neues Modul `src/lib/cam/toolConflicts.ts` (oder im gleichen Modul): listet Bohrungen und innere Konturen, die der Fräser nicht sauber schneiden kann.
3. `renderDxf.ts` erweitert: rollenfarbene Original-Kontur plus gestrichelter Fräser-Zentrumpfad in dezentem Grau, nur in Schritt 3.
4. `App.svelte`: Konflikt-Hinweis unter der Legende (z.B. "2 Bohrungen kleiner als Fräser-Ø 3 mm, als Tasche oder Vorbohren"), `toolDiameter` ändert Vorschau live.
5. Zweites Demo-DXF `samples/demo-tasche.dxf` mit geschlossener Außen-Polyline und einer inneren Ausschnitt-Polyline, damit die Verschachtelungs-Heuristik sauber triggeriert. Behält `demo-rechteck.dxf` bei.
6. `npm run build && npm run check` grün halten nach jedem Schritt.

## Aufwand

Mittel. Kern ist `toolPath.ts` mit Offset-Logik und Konflikt-Erkennung. Renderer und UI sind Folge-Edits.

## Bewusst offen

- Offset-Selbstschnitte auflösen (späterer Schritt).
- Bogen-Offset (späterer Schritt).
- Taschen-Fräsen für zu kleine Bohrungen (späterer Schritt, hier nur Hinweis).