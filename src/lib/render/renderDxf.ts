import type { DxfDoc, Entity } from '../dxf/types';

const INK = '#141413';   // Schnittkonturen
const CLAY = '#D97757';  // Kreise = Bohrungen, farblich abgesetzt

// Zeichnet ein DxfDoc in den Canvas, einpassend und zentriert.
// DXF-Y zeigt nach oben, Canvas-Y nach unten, deshalb wird Y gespiegelt.
export function renderDxf(canvas: HTMLCanvasElement, doc: DxfDoc): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 800;
  const H = canvas.clientHeight || 500;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const { minX, minY, maxX, maxY } = doc.bbox;
  const pad = 28;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  const X = (x: number) => offX + (x - minX) * scale;
  const Y = (y: number) => H - (offY + (y - minY) * scale);

  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const e of doc.entities) drawEntity(ctx, e, X, Y, scale);
}

function drawEntity(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  X: (n: number) => number,
  Y: (n: number) => number,
  scale: number,
): void {
  ctx.strokeStyle = e.type === 'circle' ? CLAY : INK;
  ctx.beginPath();

  switch (e.type) {
    case 'line':
      ctx.moveTo(X(e.a.x), Y(e.a.y));
      ctx.lineTo(X(e.b.x), Y(e.b.y));
      break;

    case 'polyline': {
      const p = e.pts;
      ctx.moveTo(X(p[0].x), Y(p[0].y));
      for (let i = 1; i < p.length; i++) ctx.lineTo(X(p[i].x), Y(p[i].y));
      if (e.closed) ctx.closePath();
      break;
    }

    case 'circle':
      ctx.arc(X(e.c.x), Y(e.c.y), e.r * scale, 0, Math.PI * 2);
      break;

    case 'arc': {
      // Selbst gesampelt statt ctx.arc, um die Y-Spiegelung sauber zu halten.
      // dxf-parser liefert Grad, DXF-Bögen laufen gegen den Uhrzeigersinn.
      const a0 = (e.a0 * Math.PI) / 180;
      let a1 = (e.a1 * Math.PI) / 180;
      if (a1 < a0) a1 += Math.PI * 2;
      const seg = 48;
      for (let i = 0; i <= seg; i++) {
        const t = a0 + (a1 - a0) * (i / seg);
        const px = e.c.x + e.r * Math.cos(t);
        const py = e.c.y + e.r * Math.sin(t);
        if (i === 0) ctx.moveTo(X(px), Y(py));
        else ctx.lineTo(X(px), Y(py));
      }
      break;
    }
  }

  ctx.stroke();
}
