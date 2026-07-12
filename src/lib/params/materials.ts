// Lookup-Tabelle für Fräsparameter: Material-Kennwerte, Makita-Drehzahlstufen,
// Maslow-4-Maschinengrenzen. Framework-frei, alle Werte in mm und U/min.
//
// Die Zahlen sind Erfahrungswerte für 2-schneidige Spiralnutfräser auf einer
// Maslow 4 mit Makita RT0701C. Sie sind bewusst konservativ gewählt, weil die
// Maslow als Seilroboter weniger steif ist als eine Portalfräse.

// Spanungsdicke (Chipload) in mm pro Zahn, abhängig vom Fräser-Ø.
export interface ChiploadRange {
  maxDiameter: number; // gilt bis einschließlich diesem Ø
  min: number;
  max: number;
}

export interface Material {
  id: string;
  label: string;
  // Chipload-Klassen, aufsteigend nach maxDiameter. Letzter Eintrag gilt darüber hinaus.
  chiploads: ChiploadRange[];
  // Zustellung pro Durchgang als Faktor vom Fräser-Ø.
  docFactor: number;
  // Kurznotiz fürs UI und die Begründung.
  note: string;
}

export const MATERIALS: Material[] = [
  {
    id: 'birke-multiplex',
    label: 'Birke Multiplex',
    chiploads: [
      { maxDiameter: 3.2, min: 0.02, max: 0.04 },
      { maxDiameter: 6.5, min: 0.04, max: 0.06 },
      { maxDiameter: 99, min: 0.05, max: 0.08 },
    ],
    docFactor: 0.5,
    note: 'Harte Deckfurniere und Leimschichten, stumpft Fräser schneller ab. Konservative Zustellung.',
  },
  {
    id: 'pappel-sperrholz',
    label: 'Pappel-Sperrholz',
    chiploads: [
      { maxDiameter: 3.2, min: 0.03, max: 0.05 },
      { maxDiameter: 6.5, min: 0.05, max: 0.08 },
      { maxDiameter: 99, min: 0.07, max: 0.1 },
    ],
    docFactor: 0.7,
    note: 'Weich und leicht, verzeiht viel. Neigt bei zu kleinem Vorschub zum Ausfransen.',
  },
  {
    id: 'mdf',
    label: 'MDF',
    chiploads: [
      { maxDiameter: 3.2, min: 0.025, max: 0.045 },
      { maxDiameter: 6.5, min: 0.05, max: 0.07 },
      { maxDiameter: 99, min: 0.07, max: 0.1 },
    ],
    docFactor: 0.5,
    note: 'Homogen und gutmütig, aber viel feiner Staub. Absaugung wichtig.',
  },
  {
    id: 'fichte-massiv',
    label: 'Fichte/Kiefer massiv',
    chiploads: [
      { maxDiameter: 3.2, min: 0.025, max: 0.05 },
      { maxDiameter: 6.5, min: 0.05, max: 0.08 },
      { maxDiameter: 99, min: 0.06, max: 0.1 },
    ],
    docFactor: 0.6,
    note: 'Längs- und Querholz schneiden unterschiedlich. Äste können den Fräser verlaufen lassen.',
  },
];

export function materialById(id: string): Material {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
}

export function chiploadFor(m: Material, toolDiameter: number): ChiploadRange {
  for (const c of m.chiploads) {
    if (toolDiameter <= c.maxDiameter) return c;
  }
  return m.chiploads[m.chiploads.length - 1];
}

// Makita RT0701C: Stellrad 1 bis 6, Drehzahlen laut Datenblatt.
export interface SpindleDial {
  dial: number;
  rpm: number;
}

export const MAKITA_RT0701C: SpindleDial[] = [
  { dial: 1, rpm: 10000 },
  { dial: 2, rpm: 12000 },
  { dial: 3, rpm: 17000 },
  { dial: 4, rpm: 22000 },
  { dial: 5, rpm: 27000 },
  { dial: 6, rpm: 30000 },
];

// Maschinengrenzen der Maslow 4. Vorschub konservativ, die Community fräst
// Sperrholz meist mit 800 bis 1200 mm/min.
export const MASLOW = {
  maxFeed: 1200, // mm/min
  maxPlunge: 400, // mm/min
  maxDocAbs: 5, // mm pro Durchgang, Steifigkeitsgrenze
  maxSaneToolDiameter: 8, // mm, darüber Warnung
};
