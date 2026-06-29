import type { BBox, Pt } from '../dxf/types';

// Einpassende Transformation zwischen DXF-Welt (Y oben) und Canvas (Y unten).
// Wird vom Renderer und vom Klick-Hit-Test gemeinsam genutzt, damit beide
// garantiert dasselbe Koordinatensystem sehen.
export interface ViewTransform {
  scale: number;
  toCanvas(p: Pt): { x: number; y: number };
  toWorld(cx: number, cy: number): Pt;
}

export function fitTransform(bbox: BBox, W: number, H: number, pad: number): ViewTransform {
  const spanX = bbox.maxX - bbox.minX || 1;
  const spanY = bbox.maxY - bbox.minY || 1;
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;

  return {
    scale,
    toCanvas(p: Pt) {
      return {
        x: offX + (p.x - bbox.minX) * scale,
        y: H - (offY + (p.y - bbox.minY) * scale),
      };
    },
    toWorld(cx: number, cy: number): Pt {
      return {
        x: (cx - offX) / scale + bbox.minX,
        y: (H - cy - offY) / scale + bbox.minY,
      };
    },
  };
}
