import type { DxfDoc, Entity, Pt } from '../dxf/types';

export interface Setup {
  toolDiameter: number;   // mm
  stockThickness: number; // mm
  margin: number;         // mm Rand um die Teile herum
}

export interface JobInfo {
  plateW: number;     // mm, Bauteil-Hüllmaß plus Rand
  plateH: number;
  fitsMaslow: boolean;
  holeCount: number;  // Kreise = Bohrungen
  cutLength: number;  // mm, Summe der Konturlängen, eine Lage
}

// Maslow-4-Arbeitsfläche, in mm. Beide Orientierungen erlaubt (Platte drehbar).
const MASLOW_LONG = 2440;
const MASLOW_SHORT = 1220;

export function analyzeJob(doc: DxfDoc, setup: Setup): JobInfo {
  const w = doc.bbox.maxX - doc.bbox.minX;
  const h = doc.bbox.maxY - doc.bbox.minY;
  const plateW = w + 2 * setup.margin;
  const plateH = h + 2 * setup.margin;

  const fitsMaslow =
    (plateW <= MASLOW_LONG && plateH <= MASLOW_SHORT) ||
    (plateW <= MASLOW_SHORT && plateH <= MASLOW_LONG);

  let holeCount = 0;
  let cutLength = 0;
  for (const e of doc.entities) {
    if (e.type === 'circle') holeCount++;
    cutLength += entityLength(e);
  }

  return { plateW, plateH, fitsMaslow, holeCount, cutLength };
}

function entityLength(e: Entity): number {
  switch (e.type) {
    case 'line':
      return dist(e.a, e.b);
    case 'polyline': {
      let L = 0;
      for (let i = 1; i < e.pts.length; i++) L += dist(e.pts[i - 1], e.pts[i]);
      if (e.closed && e.pts.length > 1) L += dist(e.pts[e.pts.length - 1], e.pts[0]);
      return L;
    }
    case 'circle':
      return 2 * Math.PI * e.r;
    case 'arc': {
      let d = e.a1 - e.a0;
      if (d < 0) d += 360;
      return e.r * ((d * Math.PI) / 180);
    }
  }
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
