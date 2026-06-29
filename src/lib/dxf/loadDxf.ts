import DxfParser from 'dxf-parser';
import type { Entity, DxfDoc, Pt, BBox } from './types';

// Liest DXF-Text und normalisiert ihn auf unsere Entity-Liste.
// Unterstützt heute: LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC.
// Alles andere landet in `skipped`, damit nichts still verschwindet.
export function parseDxf(text: string): DxfDoc {
  const parser = new DxfParser();
  const raw = parser.parseSync(text) as any;
  const rawEntities: any[] = raw?.entities ?? [];

  const entities: Entity[] = [];
  const skipped = new Set<string>();

  for (const e of rawEntities) {
    switch (e?.type) {
      case 'LINE': {
        const v = e.vertices ?? [];
        if (v.length >= 2) entities.push({ type: 'line', a: pt(v[0]), b: pt(v[1]) });
        break;
      }
      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const pts: Pt[] = (e.vertices ?? []).map(pt);
        if (pts.length >= 2) {
          entities.push({ type: 'polyline', pts, closed: Boolean(e.shape || e.closed) });
        }
        break;
      }
      case 'CIRCLE':
        if (e.center && typeof e.radius === 'number') {
          entities.push({ type: 'circle', c: pt(e.center), r: e.radius });
        }
        break;
      case 'ARC':
        if (e.center && typeof e.radius === 'number') {
          entities.push({ type: 'arc', c: pt(e.center), r: e.radius, a0: e.startAngle, a1: e.endAngle });
        }
        break;
      default:
        if (e?.type) skipped.add(e.type);
    }
  }

  return {
    entities,
    bbox: computeBBox(entities),
    counts: count(entities),
    skipped: [...skipped],
  };
}

function pt(p: any): Pt {
  return { x: Number(p?.x ?? 0), y: Number(p?.y ?? 0) };
}

function computeBBox(entities: Entity[]): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const ext = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const e of entities) {
    switch (e.type) {
      case 'line':
        ext(e.a.x, e.a.y);
        ext(e.b.x, e.b.y);
        break;
      case 'polyline':
        for (const p of e.pts) ext(p.x, p.y);
        break;
      case 'circle':
      case 'arc':
        // konservativ: Vollkreis-Hülle, etwas zu groß bei Bögen, aber sicher fürs Einpassen
        ext(e.c.x - e.r, e.c.y - e.r);
        ext(e.c.x + e.r, e.c.y + e.r);
        break;
    }
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

function count(entities: Entity[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const e of entities) c[e.type] = (c[e.type] ?? 0) + 1;
  return c;
}
