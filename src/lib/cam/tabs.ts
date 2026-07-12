// Haltestege (Tabs): kleine Materialbrücken, die das Teil beim letzten
// Durchgang in der Platte halten. Tabs liegen als Bogenlängen-Regionen auf dem
// Zentrumpfad. In Durchgängen unterhalb der Tab-Höhe hebt der Fräser in der
// Region auf Tab-Höhe an und senkt danach wieder ab (senkrechte Tab-Flanken).

import type { Pt } from '../dxf/types';

export interface TabConfig {
  enabled: boolean;
  width: number; // mm Materialbreite des Stegs
  height: number; // mm Steghöhe ab Plattenunterseite
  spacing: number; // mm Zielabstand zwischen Stegen
  minPerimeter: number; // mm Umfang, darunter keine Stege
}

export const DEFAULT_TABS: TabConfig = {
  enabled: true,
  width: 8,
  height: 3,
  spacing: 250,
  minPerimeter: 120,
};

// Region als Bogenlängen-Intervall [start, end] entlang des geschlossenen Pfads.
export interface TabRegion {
  start: number;
  end: number;
}

export interface Pt3 {
  x: number;
  y: number;
  z: number;
}

export function pathLength(pts: Pt[], closed: boolean): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  if (closed && pts.length > 1) L += dist(pts[pts.length - 1], pts[0]);
  return L;
}

// Punkt bei Bogenlänge s auf dem geschlossenen Pfad.
export function pointAt(pts: Pt[], s: number): Pt {
  const n = pts.length;
  let rest = s;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const d = dist(a, b);
    if (rest <= d || i === n - 1) {
      const t = d === 0 ? 0 : Math.min(1, rest / d);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    rest -= d;
  }
  return pts[0];
}

// Tab-Regionen und Marker-Punkte für einen geschlossenen Pfad.
// Regionswickel über den Pfadanfang wird in zwei Regionen aufgeteilt.
export function computeTabs(
  pts: Pt[],
  cfg: TabConfig,
  toolDiameter: number,
): { regions: TabRegion[]; markers: Pt[] } {
  const L = pathLength(pts, true);
  if (!cfg.enabled || L < cfg.minPerimeter || pts.length < 3) {
    return { regions: [], markers: [] };
  }
  const count = Math.min(10, Math.max(2, Math.round(L / cfg.spacing)));
  // Regionsbreite auf dem Zentrumpfad: gewünschte Materialbreite plus Fräser-Ø.
  const w = cfg.width + toolDiameter;
  const regions: TabRegion[] = [];
  const markers: Pt[] = [];
  for (let k = 0; k < count; k++) {
    const center = (L * (k + 0.5)) / count;
    markers.push(pointAt(pts, center));
    let start = center - w / 2;
    let end = center + w / 2;
    if (start < 0) {
      regions.push({ start: start + L, end: L });
      start = 0;
    }
    if (end > L) {
      regions.push({ start: 0, end: end - L });
      end = L;
    }
    regions.push({ start, end });
  }
  regions.sort((a, b) => a.start - b.start);
  return { regions, markers };
}

// Ein Durchgang ohne Tabs: alle Punkte auf cutZ, Pfad geschlossen.
export function passPoints(pts: Pt[], cutZ: number): Pt3[] {
  const out: Pt3[] = pts.map((p) => ({ x: p.x, y: p.y, z: cutZ }));
  if (pts.length > 1) out.push({ x: pts[0].x, y: pts[0].y, z: cutZ });
  return out;
}

// Ein Durchgang mit Tabs: in Tab-Regionen wird auf tabZ angehoben.
export function passPointsWithTabs(
  pts: Pt[],
  cutZ: number,
  tabZ: number,
  regions: TabRegion[],
): Pt3[] {
  if (regions.length === 0 || tabZ <= cutZ) return passPoints(pts, cutZ);

  const inRegion = (s: number) => regions.some((r) => s >= r.start && s < r.end);
  const boundaries: number[] = [];
  for (const r of regions) {
    boundaries.push(r.start, r.end);
  }
  boundaries.sort((a, b) => a - b);

  const out: Pt3[] = [];
  const push = (x: number, y: number, z: number) => {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - x) < 1e-9 && Math.abs(last.y - y) < 1e-9 && Math.abs(last.z - z) < 1e-9) return;
    out.push({ x, y, z });
  };

  let z = inRegion(0) ? tabZ : cutZ;
  push(pts[0].x, pts[0].y, z);

  let s = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const d = dist(a, b);
    if (d === 0) continue;
    const s0 = s;
    const s1 = s + d;
    for (const bd of boundaries) {
      if (bd > s0 + 1e-9 && bd < s1 - 1e-9) {
        const t = (bd - s0) / d;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const newZ = inRegion(bd + 1e-9) ? tabZ : cutZ;
        if (newZ !== z) {
          push(x, y, z); // bis zur Kante auf alter Höhe
          push(x, y, newZ); // senkrechte Flanke
          z = newZ;
        }
      }
    }
    push(b.x, b.y, z);
    s = s1;
  }
  return out;
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
