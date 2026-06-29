// Framework-freie Geometrie-Typen. Der ganze CAM-Kern arbeitet auf diesen,
// unabhängig von Svelte oder dem DXF-Parser.

export interface Pt {
  x: number;
  y: number;
}

export type Entity =
  | { type: 'line'; a: Pt; b: Pt }
  | { type: 'polyline'; pts: Pt[]; closed: boolean }
  | { type: 'circle'; c: Pt; r: number }
  | { type: 'arc'; c: Pt; r: number; a0: number; a1: number }; // a0/a1 in Grad

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DxfDoc {
  entities: Entity[];
  bbox: BBox;
  counts: Record<string, number>;
  skipped: string[]; // DXF-Typen, die wir (noch) nicht zeichnen
}
