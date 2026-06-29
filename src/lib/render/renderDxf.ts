import type { DxfDoc, Entity } from '../dxf/types';
import type { Role } from '../cam/classify';
import { fitTransform, type ViewTransform } from './viewTransform';

// Farben pro Rolle. Ohne Rollen (Schritt 2) wird neutral gezeichnet.
const COLORS: Record<string, string> = {
  ink: '#141413',
  outer: '#141413',  // Außenschnitt
  inner: '#6A8CAF',  // Ausschnitt
  hole: '#D97757',   // Bohrung
  open: '#87867F',   // offen
};

export function renderDxf(canvas: HTMLCanvasElement, doc: DxfDoc, roles?: Role[]): void {
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
