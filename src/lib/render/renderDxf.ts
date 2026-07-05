import type { DxfDoc, Entity, Pt } from '../dxf/types';
import type { Role } from '../cam/classify';
import type { ToolPath } from '../cam/toolPath';
import { fitTransform, type ViewTransform } from './viewTransform';

// Farben pro Rolle. Ohne Rollen (Schritt 2) wird neutral gezeichnet.
const COLORS: Record<string, string> = {
  ink: '#141413',
  outer: '#141413',  // Außenschnitt
  inner: '#6A8CAF',  // Ausschnitt
  hole: '#D97757',   // Bohrung
  open: '#87867F',   // offen
};

const TOOL_COLOR = '#B04A3F';     // Fräser-Zentrumpfad, gestrichelt
const CONFLICT_COLOR = '#B04A3F'; // Konflikt-Markierung

export function renderDxf(
  canvas: HTMLCanvasElement,
  doc: DxfDoc,
  roles?: Role[],
  toolPaths?: ToolPath[],
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 800;
  const H = canvas.clientHeight || 500;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const t = fitTransform(doc.bbox, W, H, 28);
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  doc.entities.forEach((e, i) => {
    const role = roles ? roles[i] : undefined;
    const color = role ? COLORS[role] : (e.type === 'circle' ? COLORS.hole : COLORS.ink);
    drawEntity(ctx, e, t, color);
  });

  // Fräser-Zentrumpfade in Schritt 3, gestrichelt über der Original-Geometrie.
  if (toolPaths) {
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    for (const tp of toolPaths) {
      if (tp.pts.length === 0) continue;
      drawPath(ctx, tp.pts, tp.closed, t, TOOL_COLOR);
    }
    ctx.restore();

    // Konflikt-Markierungen: Kreuz im Zentrum der leeren Pfade.
    ctx.save();
    ctx.strokeStyle = CONFLICT_COLOR;
    ctx.fillStyle = CONFLICT_COLOR;
    ctx.lineWidth = 1.2;
    for (const tp of toolPaths) {
      if (!tp.conflict) continue;
      const e = doc.entities[tp.index];
      const center = entityCenter(e);
      if (!center) continue;
      const c = t.toCanvas(center);
      const s = 6;
      ctx.beginPath();
      ctx.moveTo(c.x - s, c.y - s);
      ctx.lineTo(c.x + s, c.y + s);
      ctx.moveTo(c.x + s, c.y - s);
      ctx.lineTo(c.x - s, c.y + s);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawEntity(ctx: CanvasRenderingContext2D, e: Entity, t: ViewTransform, color: string): void {
  ctx.strokeStyle = color;
  ctx.beginPath();

  switch (e.type) {
    case 'line': {
      const a = t.toCanvas(e.a);
      const b = t.toCanvas(e.b);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      break;
    }
    case 'polyline': {
      e.pts.forEach((p, i) => {
        const c = t.toCanvas(p);
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      if (e.closed) ctx.closePath();
      break;
    }
    case 'circle': {
      const c = t.toCanvas(e.c);
      ctx.arc(c.x, c.y, e.r * t.scale, 0, Math.PI * 2);
      break;
    }
    case 'arc': {
      const a0 = (e.a0 * Math.PI) / 180;
      let a1 = (e.a1 * Math.PI) / 180;
      if (a1 < a0) a1 += Math.PI * 2;
      const seg = 48;
      for (let i = 0; i <= seg; i++) {
        const ang = a0 + (a1 - a0) * (i / seg);
        const world = { x: e.c.x + e.r * Math.cos(ang), y: e.c.y + e.r * Math.sin(ang) };
        const c = t.toCanvas(world);
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      }
      break;
    }
  }

  ctx.stroke();
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  closed: boolean,
  t: ViewTransform,
  color: string,
): void {
  if (pts.length === 0) return;
  ctx.strokeStyle = color;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const c = t.toCanvas(p);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  if (closed) ctx.closePath();
  ctx.stroke();
}

function entityCenter(e: Entity): Pt | null {
  switch (e.type) {
    case 'circle':
    case 'arc':
      return e.c;
    case 'line':
      return { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
    case 'polyline': {
      let sx = 0, sy = 0;
      for (const p of e.pts) { sx += p.x; sy += p.y; }
      return { x: sx / e.pts.length, y: sy / e.pts.length };
    }
  }
}
