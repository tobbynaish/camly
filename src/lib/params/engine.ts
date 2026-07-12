// Parameter-Engine: rechnet aus Material, Fräser und Materialstärke einen
// Fräsparameter-Vorschlag. Kern ist die Chipload-Formel
//   Vorschub = Drehzahl x Schneidenzahl x Spanungsdicke
// plus die Maschinengrenzen der Maslow 4 aus der Lookup-Tabelle.

import {
  MAKITA_RT0701C,
  MASLOW,
  chiploadFor,
  materialById,
  type Material,
  type SpindleDial,
} from './materials';

export interface ParamInput {
  materialId: string;
  toolDiameter: number; // mm
  flutes: number; // Schneidenzahl, meist 1 oder 2
  stockThickness: number; // mm
}

export interface ParamSuggestion {
  rpm: number;
  dial: number; // Makita-Stellrad
  feed: number; // mm/min
  plunge: number; // mm/min
  depthPerPass: number; // mm
  passCount: number;
  chipload: number; // effektive Spanungsdicke mm/Zahn
  chiploadMin: number;
  chiploadMax: number;
  warnings: string[];
  material: Material;
}

// Stellrad-Wahl nach Fräser-Ø: kleine Fräser laufen stabiler mit mehr Drehzahl,
// große Fräser so langsam wie möglich, damit der Vorschub im Maslow-Limit bleibt.
function pickDial(toolDiameter: number): SpindleDial {
  if (toolDiameter <= 2) return MAKITA_RT0701C[3]; // 22000
  if (toolDiameter <= 3.2) return MAKITA_RT0701C[1]; // 12000
  return MAKITA_RT0701C[0]; // 10000
}

export function suggestParams(input: ParamInput): ParamSuggestion {
  const material = materialById(input.materialId);
  const range = chiploadFor(material, input.toolDiameter);
  const targetChipload = (range.min + range.max) / 2;
  const spindle = pickDial(input.toolDiameter);
  const warnings: string[] = [];

  // Vorschub aus der Chipload-Formel, dann Maschinengrenze.
  let feed = spindle.rpm * input.flutes * targetChipload;
  if (feed > MASLOW.maxFeed) {
    feed = MASLOW.maxFeed;
  }
  feed = Math.round(feed / 10) * 10;

  // Effektive Spanungsdicke nach dem Klemmen prüfen.
  const chipload = feed / (spindle.rpm * input.flutes);
  if (chipload < range.min) {
    warnings.push(
      `Spanungsdicke ${chipload.toFixed(3)} mm liegt unter dem Minimum von ${range.min} mm. ` +
        'Der Fräser reibt statt zu schneiden, Brandgefahr. Einschneider verwenden oder Drehzahl senken.',
    );
  }

  let plunge = Math.round((feed * 0.4) / 10) * 10;
  if (plunge > MASLOW.maxPlunge) plunge = MASLOW.maxPlunge;

  // Zustellung: Faktor vom Ø, gedeckelt durch Maslow-Steifigkeit und Materialstärke.
  let docMax = material.docFactor * input.toolDiameter;
  if (docMax > MASLOW.maxDocAbs) docMax = MASLOW.maxDocAbs;
  if (docMax < 0.5) docMax = 0.5;
  if (docMax > input.stockThickness) docMax = input.stockThickness;

  const passCount = Math.max(1, Math.ceil(input.stockThickness / docMax));
  const depthPerPass = Math.round((input.stockThickness / passCount) * 10) / 10;

  if (input.toolDiameter > MASLOW.maxSaneToolDiameter) {
    warnings.push(
      `Fräser Ø ${input.toolDiameter} mm ist groß für die Maslow 4. Ab Ø ${MASLOW.maxSaneToolDiameter} mm steigt die Abdrängung spürbar.`,
    );
  }
  if (input.flutes > 2) {
    warnings.push(
      `${input.flutes} Schneiden treiben den nötigen Vorschub über das Maslow-Limit. Ein- oder Zweischneider sind hier die bessere Wahl.`,
    );
  }

  return {
    rpm: spindle.rpm,
    dial: spindle.dial,
    feed,
    plunge,
    depthPerPass,
    passCount,
    chipload: Math.round(chipload * 1000) / 1000,
    chiploadMin: range.min,
    chiploadMax: range.max,
    warnings,
    material,
  };
}

// Regelbasierte Begründung. Läuft immer, auch ohne Claude-Key.
export function localExplanation(input: ParamInput, s: ParamSuggestion): string {
  const lines: string[] = [];
  lines.push(
    `Für ${s.material.label} mit einem ${input.flutes}-Schneider Ø ${input.toolDiameter} mm zielt die Tabelle auf eine Spanungsdicke von ${s.chiploadMin} bis ${s.chiploadMax} mm pro Zahn.`,
  );
  lines.push(
    `Aus Vorschub = Drehzahl x Schneiden x Spanungsdicke ergibt das bei ${s.rpm.toLocaleString('de-DE')} U/min (Makita-Stellrad ${s.dial}) einen Vorschub von ${s.feed} mm/min, effektive Spanungsdicke ${s.chipload} mm.`,
  );
  lines.push(
    `Die Drehzahl ist bewusst niedrig gewählt: die Maslow 4 schafft maximal etwa ${MASLOW.maxFeed} mm/min Vorschub, mehr Drehzahl würde die Spanungsdicke nur unter das Minimum drücken und das Holz verbrennen.`,
  );
  lines.push(
    `Zustellung: ${s.depthPerPass} mm pro Durchgang (Faktor ${s.material.docFactor} vom Fräser-Ø, gedeckelt bei ${MASLOW.maxDocAbs} mm). Bei ${input.stockThickness} mm Materialstärke sind das ${s.passCount} ${s.passCount === 1 ? 'Durchgang' : 'Durchgänge'}.`,
  );
  lines.push(`Eintauchen mit ${s.plunge} mm/min, rund 40 Prozent vom Vorschub.`);
  lines.push(`Materialhinweis: ${s.material.note}`);
  return lines.join('\n\n');
}
