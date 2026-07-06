import { buildToolPaths } from '../src/lib/cam/toolPath.ts';
import { classifyDoc, entityContains, repPoint } from '../src/lib/cam/classify.ts';
import { suggestParams, localExplanation } from '../src/lib/params/engine.ts';

const ents = [
  { type: 'polyline', pts: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }], closed: true },
  { type: 'polyline', pts: [{ x: 40, y: 40 }, { x: 160, y: 40 }, { x: 160, y: 110 }, { x: 40, y: 110 }], closed: true },
  { type: 'circle', c: { x: 100, y: 75 }, r: 5 },
] as any;

const roles = classifyDoc(ents);
console.log('roles:', roles.join(','));
const rpInner = repPoint(ents[1]);
console.log('repPoint inner:', JSON.stringify(rpInner));
console.log('outer contains inner rp:', entityContains(ents[0], rpInner));
console.log('inner contains inner rp (self):', entityContains(ents[1], rpInner));
console.log('circle contains inner rp:', entityContains(ents[2], rpInner));

const res3 = buildToolPaths(ents, roles, 3);
console.log('tool=3 conflicts:', res3.conflicts);
for (const tp of res3.paths) {
  console.log('  idx', tp.index, 'role', tp.role, 'pts', tp.pts.length, 'conflict', tp.conflict, tp.conflictReason ?? '');
}

const res8 = buildToolPaths(ents, roles, 8);
console.log('tool=8 conflicts:', res8.conflicts);
for (const tp of res8.paths) {
  console.log('  idx', tp.index, 'role', tp.role, 'pts', tp.pts.length, 'conflict', tp.conflict, tp.conflictReason ?? '');
}

const res12 = buildToolPaths(ents, roles, 12);
console.log('tool=12 conflicts:', res12.conflicts);
for (const tp of res12.paths) {
  console.log('  idx', tp.index, 'role', tp.role, 'pts', tp.pts.length, 'conflict', tp.conflict, tp.conflictReason ?? '');
}

// Demo-Rechteck: 4 offene Linien (Rechteck) plus 2 Bohrungen Ø16
const ents2 = [
  { type: 'line', a: { x: 0, y: 0 }, b: { x: 300, y: 0 } },
  { type: 'line', a: { x: 300, y: 0 }, b: { x: 300, y: 200 } },
  { type: 'line', a: { x: 300, y: 200 }, b: { x: 0, y: 200 } },
  { type: 'line', a: { x: 0, y: 200 }, b: { x: 0, y: 0 } },
  { type: 'circle', c: { x: 60, y: 100 }, r: 8 },
  { type: 'circle', c: { x: 240, y: 100 }, r: 8 },
] as any;
const roles2 = classifyDoc(ents2);
console.log('rechteck roles:', roles2.join(','));
const res2 = buildToolPaths(ents2, roles2, 3);
console.log('rechteck tool=3 conflicts:', res2.conflicts);
for (const tp of res2.paths) {
  console.log('  idx', tp.index, 'role', tp.role, 'pts', tp.pts.length, 'conflict', tp.conflict, tp.conflictReason ?? '');
}
// Parameter-Engine: Birke mit typischen Fräsern
console.log('\n--- Parameter-Engine ---');
for (const [d, z] of [[3, 2], [6, 2], [8, 1]] as const) {
  const s = suggestParams({ materialId: 'birke-multiplex', toolDiameter: d, flutes: z, stockThickness: 9 });
  console.log(
    `Birke D${d} z${z}: rpm=${s.rpm} (Stellrad ${s.dial}) feed=${s.feed} plunge=${s.plunge} ` +
    `doc=${s.depthPerPass}x${s.passCount} chipload=${s.chipload} warn=${s.warnings.length}`,
  );
}
const sPappel = suggestParams({ materialId: 'pappel-sperrholz', toolDiameter: 6, flutes: 2, stockThickness: 6 });
console.log(`Pappel D6 z2: feed=${sPappel.feed} doc=${sPappel.depthPerPass}x${sPappel.passCount} chipload=${sPappel.chipload}`);
const sBig = suggestParams({ materialId: 'birke-multiplex', toolDiameter: 12, flutes: 2, stockThickness: 18 });
console.log(`Birke D12 z2: feed=${sBig.feed} chipload=${sBig.chipload} warnings=${JSON.stringify(sBig.warnings)}`);
console.log('\nLokale Begründung (Birke D6 z2, 9mm):');
console.log(localExplanation(
  { materialId: 'birke-multiplex', toolDiameter: 6, flutes: 2, stockThickness: 9 },
  suggestParams({ materialId: 'birke-multiplex', toolDiameter: 6, flutes: 2, stockThickness: 9 }),
));
