# camly

Browser-Tool, das CNC-Frästeile aus DXF in fräsfertigen GRBL-G-Code übersetzt, mit KI-gestützten Fräsparametern. Gebaut für die [Maslow 4](https://www.maslowcnc.com), läuft mit jeder GRBL-CNC. Kein Cloud-Dienst, alles im Browser.

## Status

Welle 1, früh. Steht: **Schritt 3, Konturklassifikation mit Klick-Korrektur und Fräser-Eingriff.** DXF-Import, Canvas-Vorschau, Setup-Leiste, automatische Außen-/Innen-/Bohrungs-Erkennung, manuelle Korrektur per Klick, Fräser-Zentrumpfad live in der Vorschau, Konflikt-Warnung bei zu kleinen Bohrungen. KI-Parameter, Tabs, Dogbones und G-Code-Export kommen in den nächsten Schritten.

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
