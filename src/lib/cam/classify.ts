import type { Entity, Pt } from '../dxf/types';

// Rolle einer Kontur im Frästeil.
export type Role = 'outer' | 'inner' | 'hole' | 'open';

export const ROLE_LABEL: Record<Role, string> = {
  outer: 'Außenschnitt',
  inner: 'Ausschnitt',
  hole: 'Bohrung',
  open: 'offen',
};

export const ROLE_ORDER: Role[] = ['outer', 'inner', 'hole', 'open'];

// Frei stehender Kreis unter diesem Durchmesser gilt als Bohrung, sonst als rundes Teil.
const FREE_HOLE_MAX_DIAMETER = 30; // mm

// Automatische Klassifikation per Verschachtelungstiefe.
// Tiefe gerade = Material (außen), ungerade = Loch (innen). Kreise meist Bohrung.
// Der Vorschlag ist eine Heuristik, der Nutzer korrigiert per Klick.
export function classifyDoc(entities: Entity[]): Role[] {
  return entities.map((e, i) => classifyOne(e, i, entities));
}

function classifyOne(e: Entity, i: number, ents: Entity[]): Role {
  if (!isClosed(e)) return 'open';
  const pt = repPoint(e);
  let depth = 0;
  for (let j = 0; j < ents.length; j++) {
    if (j === i) continue;
    const o = ents[j];
    if (isClosed(o) && entityContains(o, pt)) depth++;
  }
  if (e.type === 'circle') {
    if (depth % 2 === 1) return 'hole';
    return e.r * 2 <= FREE_HOLE_MAX_DIAMETER ? 'hole' : 'outer';
  }
  return depth % 2 === 0 ? 'outer' : 'inner';
}

export function cycleRole(r: Role): Role {
  return ROLE_ORDER[(ROLE_ORDER.indexOf(r) + 1) % ROLE_ORDER.length];
}

// ---- Geometrie-Helfer (auch vom Hit-Test genutzt) ----

export function isClosed(e: Entity): boolean {
  return e.type === 'circle' || (e.type === 'polyline' && e.closed);
}

export function repPoint(e: Entity): Pt {
  switch (e.type) {
    case 'circle':
    case 'arc':
      return { x: e.c.x, y: e.c.y };
    case 'line':
      return { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
    case 'polyline': {
      let sx = 0, sy = 0;
      for (const p of e.pts) { sx += p.x; sy += p.y; }
      return { x: sx / e.pts.length, y: sy / e.pts.length };
    }
  }
}

export function entityContains(outer: Entity, pt: Pt): boolean {
  if (outer.type === 'circle') return dist(pt, outer.c) <= outer.r;
  if (outer.type === 'polyline' && outer.closed) return pointInPolygon(pt, outer.pts);
  return false;
}

// Grobe Flächenschätzung über die Bounding-Box, reicht fürs Hit-Test-Ranking.
export function bboxArea(e: Entity): number {
  switch (e.type) {
    case 'circle':
    case 'arc':
      return (2 * e.r) * (2 * e.r);
    case 'line':
      return Math.abs(e.a.x - e.b.x) * Math.abs(e.a.y - e.b.y) + 1;
    case 'polyline': {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of e.pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return (maxX - minX) * (maxY - minY) + 1;
    }
  }
}

function pointInPolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = (yi > pt.y) !== (yj > pt.y) &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
