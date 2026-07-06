// Dogbones: an konvexen Ecken eines Ausschnitts lässt der runde Fräser eine
// Rundung stehen. Der Dogbone fährt vom versetzten Eckpunkt entlang der
// Winkelhalbierenden in Richtung Original-Ecke, bis die Fräserkante die Ecke
// erreicht (Abstand ein Fräserradius), und wieder zurück. So passen eckige
// Teile in den Ausschnitt.

import type { Entity, Pt } from '../dxf/types';
import type { ToolPath } from './toolPath';

const MIN_TURN_ANGLE = (20 * Math.PI) / 180; // flachere Knicke brauchen keinen Dogbone
const MIN_BONE_LENGTH = 0.2; // mm, darunter lohnt der Extra-Weg nicht

export function insertDogbones(
  entities: Entity[],
  paths: ToolPath[],
  toolRadius: number,
): ToolPath[] {
  return paths.map((tp) => {
    if (tp.role !== 'inner' || tp.conflict || !tp.closed || tp.pts.length < 3) return tp;
    const e = entities[tp.index];
    if (!e || e.type !== 'polyline' || !e.closed) return tp;
    // Der Polygon-Versatz liefert genau einen Punkt pro Original-Ecke. Wenn die
    // Anzahl nicht stimmt (entartete Segmente), ist das Mapping unklar: auslassen.
    if (e.pts.length !== tp.pts.length) return tp;

    const orig = e.pts;
    const off = tp.pts;
    const n = orig.length;

    // Orientierung für den Konvexitätstest (gleiche Konvention wie toolPath.ts).
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = orig[i];
      const b = orig[(i + 1) % n];
      area += (b.x - a.x) * (b.y + a.y);
    }
    const isCW = area > 0;

    const out: Pt[] = [];
    let bones = 0;
    for (let i = 0; i < n; i++) {
      // offsetPolygon schneidet Segment i mit Segment i+1: off[i] gehört zur
      // Original-Ecke orig[(i+1) % n], nicht zu orig[i].
      const cur = orig[(i + 1) % n];
      const prev = orig[i];
      const next = orig[(i + 2) % n];
      out.push(off[i]);

      const v1 = { x: cur.x - prev.x, y: cur.y - prev.y };
      const v2 = { x: next.x - cur.x, y: next.y - cur.y };
      const cross = v1.x * v2.y - v1.y * v2.x;
      const dot = v1.x * v2.x + v1.y * v2.y;
      // Konvexe Ecke der Ausschnitt-Fläche: dort kommt der Fräser nicht hin.
      const convex = isCW ? cross < 0 : cross > 0;
      if (!convex) continue;
      const turn = Math.atan2(Math.abs(cross), dot);
      if (turn < MIN_TURN_ANGLE) continue;

      // off[i] liegt auf der Winkelhalbierenden innerhalb des Ausschnitts.
      const dx = cur.x - off[i].x;
      const dy = cur.y - off[i].y;
      const d = Math.hypot(dx, dy);
      if (d - toolRadius < MIN_BONE_LENGTH) continue;
      const bone: Pt = {
        x: cur.x - (dx / d) * toolRadius,
        y: cur.y - (dy / d) * toolRadius,
      };
      out.push(bone);
      out.push(off[i]);
      bones++;
    }

    if (bones === 0) return tp;
    return { ...tp, pts: out };
  });
}
