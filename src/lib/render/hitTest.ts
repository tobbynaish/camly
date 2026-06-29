import type { DxfDoc, Pt } from '../dxf/types';
import { isClosed, entityContains, repPoint, bboxArea } from '../cam/classify';

// Findet die Kontur an einem Welt-Punkt. Bevorzugt die kleinste geschlossene
// Kontur, die den Punkt enthält (also die innerste, etwa ein Loch in einem Teil).
// Trifft das nichts, die dem Klick nächstgelegene Kontur.
export function hitTest(doc: DxfDoc, world: Pt): number {
  let best = -1;
  let bestArea = Infinity;
  doc.entities.forEach((e, i) => {
    if (isClosed(e) && entityContains(e, world)) {
      const a = bboxArea(e);
      if (a < bestArea) { bestArea = a; best = i; }
    }
  });
  if (best >= 0) return best;

  let nearest = -1;
  let nd = Infinity;
  doc.entities.forEach((e, i) => {
    const p = repPoint(e);
    const d = Math.hypot(p.x - world.x, p.y - world.y);
    if (d < nd) { nd = d; nearest = i; }
  });
  return nearest;
}
