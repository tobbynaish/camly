// GRBL-G-Code-Generator. Nimmt die fertigen Zentrumpfade (inklusive Dogbones)
// und erzeugt ein Programm für die Maslow 4: Bohrungen zuerst, dann
// Ausschnitte, Außenschnitte zuletzt. Mehrere Tiefen-Durchgänge, Haltestege
// in den unteren Durchgängen. Nullpunkt: XY wie im DXF, Z0 auf der
// Materialoberseite, Zustellung ins Negative.

import type { Pt } from '../dxf/types';
import type { Role } from './classify';
import type { ToolPath } from './toolPath';
import {
  computeTabs,
  passPoints,
  passPointsWithTabs,
  pathLength,
  type Pt3,
  type TabConfig,
} from './tabs';

export interface GcodeParams {
  feed: number; // mm/min
  plunge: number; // mm/min
  rpm: number;
  depthPerPass: number; // mm
}

export interface GcodeJob {
  paths: ToolPath[];
  params: GcodeParams;
  stockThickness: number; // mm
  toolDiameter: number; // mm
  tabs: TabConfig;
  safeZ?: number; // mm über Material, Standard 5
  overcut?: number; // mm Durchfräsen ins Opferbrett, Standard 0.2
}

export interface GcodeStats {
  lineCount: number;
  pathCount: number;
  passCount: number;
  tabCount: number;
  cutLength: number; // mm, Summe aller Fräsbewegungen
  estMinutes: number;
  skippedOpen: number;
  skippedConflict: number;
}

export interface GcodeResult {
  text: string;
  stats: GcodeStats;
}

const RAPID_FEED = 4000; // mm/min, nur für die Zeitschätzung von G0

const ROLE_ORDER: Record<Role, number> = { hole: 0, inner: 1, outer: 2, open: 3 };
const ROLE_COMMENT: Record<Role, string> = {
  hole: 'Bohrung',
  inner: 'Ausschnitt',
  outer: 'Aussenschnitt',
  open: 'offen',
};

export function generateGcode(job: GcodeJob): GcodeResult {
  const safeZ = job.safeZ ?? 5;
  const overcut = job.overcut ?? 0.2;
  const { feed, plunge, rpm, depthPerPass } = job.params;

  const skippedConflict = job.paths.filter((p) => p.conflict).length;
  const cuttable = job.paths.filter((p) => !p.conflict && p.closed && p.pts.length >= 3 && p.role !== 'open');
  const skippedOpen = job.paths.length - skippedConflict - cuttable.length;
  const ordered = [...cuttable].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

  const totalDepth = job.stockThickness + overcut;
  const passCount = Math.max(1, Math.ceil(totalDepth / Math.max(0.1, depthPerPass)));
  const zs: number[] = [];
  for (let k = 1; k <= passCount; k++) zs.push(-(totalDepth * k) / passCount);
  const tabZ = -(job.stockThickness - job.tabs.height);

  const lines: string[] = [];
  let cutLength = 0;
  let minutes = 0;
  let tabCount = 0;
  let lastF = 0;
  let cur: Pt3 = { x: 0, y: 0, z: safeZ };

  const fmt = (n: number) => {
    const r = Math.round(n * 1000) / 1000;
    return Object.is(r, -0) ? '0' : String(r);
  };

  const rapid = (x: number, y: number, z: number) => {
    const parts: string[] = ['G0'];
    if (x !== cur.x) parts.push(`X${fmt(x)}`);
    if (y !== cur.y) parts.push(`Y${fmt(y)}`);
    if (z !== cur.z) parts.push(`Z${fmt(z)}`);
    if (parts.length === 1) return;
    lines.push(parts.join(' '));
    minutes += Math.hypot(x - cur.x, y - cur.y, z - cur.z) / RAPID_FEED;
    cur = { x, y, z };
  };

  const cut = (x: number, y: number, z: number) => {
    const vertical = x === cur.x && y === cur.y;
    const f = vertical ? plunge : feed;
    const parts: string[] = ['G1'];
    if (x !== cur.x) parts.push(`X${fmt(x)}`);
    if (y !== cur.y) parts.push(`Y${fmt(y)}`);
    if (z !== cur.z) parts.push(`Z${fmt(z)}`);
    if (parts.length === 1) return;
    if (f !== lastF) {
      parts.push(`F${fmt(f)}`);
      lastF = f;
    }
    lines.push(parts.join(' '));
    const d = Math.hypot(x - cur.x, y - cur.y, z - cur.z);
    cutLength += d;
    minutes += d / f;
    cur = { x, y, z };
  };

  lines.push('(camly G-Code, GRBL fuer Maslow 4)');
  lines.push(`(Nullpunkt: XY wie DXF, Z0 = Materialoberseite, Material ${fmt(job.stockThickness)} mm)`);
  lines.push(`(Fraeser D${fmt(job.toolDiameter)} mm, ${passCount} Durchgaenge, Zustellung ${fmt(totalDepth / passCount)} mm)`);
  lines.push('G21');
  lines.push('G90');
  lines.push('G94');
  lines.push('G17');
  lines.push(`S${fmt(rpm)} M3`);
  lines.push(`G0 Z${fmt(safeZ)}`);
  cur = { x: cur.x, y: cur.y, z: safeZ };

  for (const tp of ordered) {
    const useTabs =
      job.tabs.enabled && tp.role !== 'hole' && pathLength(tp.pts, true) >= job.tabs.minPerimeter;
    const tabs = useTabs
      ? computeTabs(tp.pts, job.tabs, job.toolDiameter)
      : { regions: [], markers: [] };
    tabCount += tabs.markers.length;

    lines.push(`(${ROLE_COMMENT[tp.role]} ${tp.index + 1})`);
    rapid(cur.x, cur.y, safeZ);
    rapid(tp.pts[0].x, tp.pts[0].y, safeZ);

    for (const z of zs) {
      const pass: Pt3[] =
        tabs.regions.length > 0 && z < tabZ
          ? passPointsWithTabs(tp.pts, z, tabZ, tabs.regions)
          : passPoints(tp.pts, z);
      // Anfahren auf Tiefe des ersten Punkts (kann in einer Tab-Region liegen).
      cut(pass[0].x, pass[0].y, pass[0].z);
      for (let i = 1; i < pass.length; i++) cut(pass[i].x, pass[i].y, pass[i].z);
    }
    rapid(cur.x, cur.y, safeZ);
  }

  lines.push('M5');
  lines.push('M2');

  return {
    text: lines.join('\n') + '\n',
    stats: {
      lineCount: lines.length,
      pathCount: ordered.length,
      passCount,
      tabCount,
      cutLength,
      estMinutes: minutes,
      skippedOpen,
      skippedConflict,
    },
  };
}

// Tab-Marker für die Vorschau in Schritt 5.
export function tabMarkersFor(paths: ToolPath[], cfg: TabConfig, toolDiameter: number): Pt[] {
  if (!cfg.enabled) return [];
  const markers: Pt[] = [];
  for (const tp of paths) {
    if (tp.conflict || !tp.closed || tp.role === 'hole' || tp.role === 'open') continue;
    if (pathLength(tp.pts, true) < cfg.minPerimeter) continue;
    markers.push(...computeTabs(tp.pts, cfg, toolDiameter).markers);
  }
  return markers;
}
