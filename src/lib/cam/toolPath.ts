import type { Entity, Pt } from '../dxf/types';
import { type Role, isClosed } from './classify';

// Fräser-Zentrumpfad pro Kontur, abhängig von Rolle und Fräser-Ø.
// Außen: Pfad außen um toolRadius verschoben.
// Innen/Bohrung: Pfad innen um toolRadius verschoben.
// Offen: kein Versatz, nur der Original-Pfad (Freifahrt).
// Bohrung mit Ø < toolDiameter: Konflikt, Pfad entfällt, wird als Konflikt gemeldet.

export interface ToolPath {
  index: number;        // Index der zugehörigen Entity
  role: Role;
  pts: Pt[];            // Zentrumpfad (Welt-Koordinaten), ggf. leer bei Konflikt
  closed: boolean;
  conflict: boolean;    // true, wenn Fräser zu groß für die Kontur
  conflictReason?: string;
}

export interface ToolPathResult {
  paths: ToolPath[];
  conflicts: number;
}

export function buildToolPaths(entities: Entity[], roles: Role[], toolDiameter: number): ToolPathResult {
  const r = toolDiameter / 2;
  const paths: ToolPath[] = [];
  let conflicts = 0;

  entities.forEach((e, i) => {
    const role = roles[i];
    const tp = buildOne(e, i, role, r, toolDiameter);
    if (tp.conflict) conflicts++;
    paths.push(tp);
  });

  return { paths, conflicts };
}

function buildOne(e: Entity, i: number, role: Role, r: number, toolDiameter: number): ToolPath {
  switch (e.type) {
    case 'circle':
      return circlePath(e, i, role, r, toolDiameter);
    case 'polyline':
      return polylinePath(e, i, role, r);
    case 'line':
      // Offene Linie: kein Versatz. Rolle 'open' oder Nutzer-korrigiert.
      return { index: i, role, pts: [e.a, e.b], closed: false, conflict: false };
    case 'arc':
      // Bögen werden für G-002 nicht als Zentrumpfad verschoben, nur als Pfad übernommen.
      // Vollständiger Bogen-Offset kommt in einem späteren Schritt.
      return { index: i, role, pts: arcPoints(e), closed: false, conflict: false };
  }
}

function circlePath(
  e: Extract<Entity, { type: 'circle' }>,
  i: number,
  role: Role,
  r: number,
  toolDiameter: number,
): ToolPath {
  // Bohrung: Fräser muss rein. Konflikt, wenn Fräser-Ø größer als Bohrungs-Ø.
  if (role === 'hole') {
    const holeDiameter = e.r * 2;
    if (toolDiameter > holeDiameter) {
      return {
        index: i,
        role,
        pts: [],
        closed: true,
        conflict: true,
        conflictReason: `Bohrung Ø ${holeDiameter.toFixed(1)} mm < Fräser Ø ${toolDiameter} mm`,
      };
    }
    const innerR = e.r - r;
    if (innerR <= 0) {
      return {
        index: i,
        role,
        pts: [],
        closed: true,
        conflict: true,
        conflictReason: `Bohrung Ø ${holeDiameter.toFixed(1)} mm < Fräser Ø ${toolDiameter} mm`,
      };
    }
    return { index: i, role, pts: circlePoints(e.c, innerR), closed: true, conflict: false };
  }

  // Außenschnitt: Fräser außen herum, Pfad mit Radius e.r + r.
  if (role === 'outer') {
    return { index: i, role, pts: circlePoints(e.c, e.r + r), closed: true, conflict: false };
  }

  // Ausschnitt (inner): Fräser innen, Pfad mit Radius e.r - r.
  if (role === 'inner') {
    const innerR = e.r - r;
    if (innerR <= 0) {
      return {
        index: i,
        role,
        pts: [],
        closed: true,
        conflict: true,
        conflictReason: `Ausschnittradius ${e.r.toFixed(1)} mm < Fräserradius ${r.toFixed(1)} mm`,
      };
    }
    return { index: i, role, pts: circlePoints(e.c, innerR), closed: true, conflict: false };
  }

  // Offen: Kreis als offener Pfad, kein Versatz (Sonderfall, selten).
  return { index: i, role, pts: circlePoints(e.c, e.r), closed: false, conflict: false };
}

function polylinePath(
  e: Extract<Entity, { type: 'polyline' }>,
  i: number,
  role: Role,
  r: number,
): ToolPath {
  // Offene Polylinie: kein Versatz, Freifahrt entlang Original.
  if (!isClosed(e) || role === 'open') {
    return { index: i, role, pts: e.pts.slice(), closed: e.closed, conflict: false };
  }

  // Außen: Versatz nach außen, Innen: Versatz nach innen.
  // Richtung: Wir nehmen an, die Polylinie ist CCW (gegen den Uhrzeigersinn) für Außen,
  // CW für Innen. Da DXF keine feste Orientierung garantiert, wählen wir den Versatz
  // so, dass bei 'outer' die Fläche größer wird, bei 'inner' kleiner.
  const sign = role === 'outer' ? 1 : -1;
  const offsetPts = offsetPolygon(e.pts, r * sign);

  if (offsetPts.length < 3) {
    return {
      index: i,
      role,
      pts: [],
      closed: true,
      conflict: true,
      conflictReason: `Versatz ${r.toFixed(1)} mm entartet die Kontur`,
    };
  }

  return { index: i, role, pts: offsetPts, closed: true, conflict: false };
}

// Polygon-Versatz: jedes Segment wird um r entlang seiner Normalen verschoben,
// an den Ecken werden die Nachbar-Segmente geschnitten.
// Orientation: CCW-Polygon mit sign=1 vergrößert, mit sign=-1 verkleinert.
// Für CW-Polygone kehrt sich das um. Wir normalisieren erst auf CCW, versetzen,
// dann ggf. zurück.
function offsetPolygon(pts: Pt[], offset: number): Pt[] {
  if (pts.length < 3) return [];
  const n = pts.length;

  // Orientierung prüfen (Signed Area).
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    area += (b.x - a.x) * (b.y + a.y);
  }
  const isCW = area > 0;

  // Normalen-Vorzeichen so, dass positives offset nach außen zeigt für CCW.
  const normalSign = isCW ? -1 : 1;
  const effectiveOffset = offset * normalSign;

  const shifted: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    // Normale (rechts vom Richtungsvektor für CCW = außen).
    const nx = (dy / len) * effectiveOffset;
    const ny = (-dx / len) * effectiveOffset;
    shifted.push({ x: a.x + nx, y: a.y + ny });
    shifted.push({ x: b.x + nx, y: b.y + ny });
  }

  // Benachbarte verschobene Segmente schneiden, um Ecken zu glätten.
  // Wir haben 2n Punkte (Anfang/Ende je Segment). Fasse zu Linien zusammen und
  // schneide aufeinanderfolgende.
  if (shifted.length < 4) return shifted;

  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const segA1 = shifted[i * 2];
    const segA2 = shifted[i * 2 + 1];
    const nextIdx = (i + 1) % n;
    const segB1 = shifted[nextIdx * 2];
    const segB2 = shifted[nextIdx * 2 + 1];
    const inter = lineIntersect(segA1, segA2, segB1, segB2);
    if (inter) {
      out.push(inter);
    } else {
      // Parallel oder zu kurz: nimm den Endpunkt.
      out.push(segA2);
    }
  }
  return out;
}

function lineIntersect(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const r1 = { x: a2.x - a1.x, y: a2.y - a1.y };
  const r2 = { x: b2.x - b1.x, y: b2.y - b1.y };
  const denom = r1.x * r2.y - r1.y * r2.x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((b1.x - a1.x) * r2.y - (b1.y - a1.y) * r2.x) / denom;
  return { x: a1.x + r1.x * t, y: a1.y + r1.y * t };
}

function circlePoints(c: Pt, radius: number): Pt[] {
  if (radius <= 0) return [];
  const N = 64;
  const pts: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    pts.push({ x: c.x + radius * Math.cos(ang), y: c.y + radius * Math.sin(ang) });
  }
  return pts;
}

function arcPoints(e: Extract<Entity, { type: 'arc' }>): Pt[] {
  const a0 = (e.a0 * Math.PI) / 180;
  let a1 = (e.a1 * Math.PI) / 180;
  if (a1 < a0) a1 += Math.PI * 2;
  const seg = 48;
  const pts: Pt[] = [];
  for (let i = 0; i <= seg; i++) {
    const ang = a0 + (a1 - a0) * (i / seg);
    pts.push({ x: e.c.x + e.r * Math.cos(ang), y: e.c.y + e.r * Math.sin(ang) });
  }
  return pts;
}