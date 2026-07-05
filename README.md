# camly

Browser-Tool, das CNC-Frästeile aus DXF in fräsfertigen GRBL-G-Code übersetzt, mit KI-gestützten Fräsparametern. Gebaut für die [Maslow 4](https://www.maslowcnc.com), läuft mit jeder GRBL-CNC. Kein Cloud-Dienst, alles im Browser.

## Status

Welle 1, früh. Steht: **Schritt 3, Konturklassifikation mit Klick-Korrektur.** DXF-Import, Canvas-Vorschau, Setup-Leiste und automatische Außen-/Innen-/Bohrungs-Erkennung sind da, manuelle Korrektur per Klick möglich. KI-Parameter, CAM-Offset, Tabs, Dogbones und G-Code-Export kommen in den nächsten Schritten.

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

Zum Ausprobieren liegt `samples/demo-rechteck.dxf` bei (ein Rechteck mit zwei Bohrungen).

## Stack

Vite, Svelte, TypeScript. Der CAM-Kern in `src/lib/` ist framework-frei, dadurch ohne Svelte testbar und wiederverwendbar.

## Lizenz

MIT
