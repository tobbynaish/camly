# camly

Browser-Tool, das CNC-Frästeile aus DXF in fräsfertigen GRBL-G-Code übersetzt, mit KI-gestützten Fräsparametern. Gebaut für die [Maslow 4](https://www.maslowcnc.com), läuft mit jeder GRBL-CNC. Kein Cloud-Dienst, alles im Browser.

## Status

Welle 1, alle sechs Schritte begehbar: **DXF rein, GRBL-G-Code raus.** DXF-Import, Canvas-Vorschau, Setup-Leiste, automatische Außen-/Innen-/Bohrungs-Erkennung mit Klick-Korrektur, Fräser-Zentrumpfad live in der Vorschau, Konflikt-Warnung bei zu kleinen Bohrungen. Schritt 4: Parameter-Engine für Birke Multiplex, Pappel, MDF und Massivholz auf der Maslow 4 mit Makita RT0701C (Drehzahl, Stellrad, Vorschub, Zustellung, Spanungsdicke), regelbasierte Begründung immer dabei, optional begründet Claude die Werte direkt im Browser (eigener API-Key, kein Server). Schritt 5: Haltestege und Dogbones mit Vorschau. Schritt 6: GRBL-Export mit Mehrfach-Durchgängen, Bohrungen zuerst, Außenschnitte zuletzt, Download als .nc. Bogen-Offset und Gravur offener Konturen kommen noch.

## Pipeline

```
DXF → Konturklassifikation → KI-Parameter → CAM (Offset, Tabs, Dogbones) → G-Code → Export
      (außen/innen/Bohrung)   (Tabelle + KI)
```

## Entwicklung

```sh
npm install
npm run dev
```

Zum Ausprobieren liegt `samples/demo-rechteck.dxf` bei (ein Rechteck mit zwei Bohrungen) und `samples/demo-tasche.dxf` (geschlossene Außenkontur mit Ausschnitt und Bohrung, triggert die Verschachtelungs-Heuristik sauber).

## Stack

Vite, Svelte, TypeScript. Der CAM-Kern in `src/lib/` ist framework-frei, dadurch ohne Svelte testbar und wiederverwendbar.

## Lizenz

MIT
