/**
 * Constraint & spec table. Every value here is a researched/assumed DEFAULT, not a confirmed
 * Naturi installation requirement: each entry is tagged `verified: false` with a source note
 * until Bunch Outdoor Services confirms it against Naturi's install documentation.
 * A Constraints & Specs settings page will make these editable (later phase).
 */

export type SpecUnit = 'm' | 'ratio' | 'mm';

export interface SpecEntry {
  label: string;
  value: number;
  unit: SpecUnit;
  verified: boolean;
  source: string;
  group: 'geometry' | 'depth' | 'features' | 'build-up' | 'spa';
}

export const NATURI_SPECS = {
  // ---- Rules in phase 1 ---------------------------------------------------------------
  beachMaxSlope: {
    label: 'Max beach slope',
    value: 1 / 7,
    unit: 'ratio',
    verified: false,
    source:
      'Assumed default. Mirrors the common 1:7 shallow-area floor slope limit in ANSI/APSP/ICC-5 (residential inground). Not confirmed for Naturi resin-bound beaches.',
    group: 'geometry',
  },
  floorMaxSlope: {
    label: 'Max floor slope (outside beach & walls)',
    value: 1 / 3,
    unit: 'ratio',
    verified: false,
    source: 'Assumed default. Typical 1:3 deep-area floor slope limit (ANSI/APSP/ICC-5). Not confirmed for Naturi.',
    group: 'geometry',
  },
  maxDepth: {
    label: 'Max water depth',
    value: 2.44,
    unit: 'm',
    verified: false,
    source: 'Assumed default (8 ft). Residential free-form practice; Naturi max depth not yet documented.',
    group: 'depth',
  },
  minFloorDepth: {
    label: 'Min general floor depth',
    value: 0.9,
    unit: 'm',
    verified: false,
    source: 'Assumed default (~3 ft) for the general swimming floor outside beach/shelf/bench zones.',
    group: 'depth',
  },
  sunShelfMinDepth: {
    label: 'Sun shelf min depth',
    value: 0.15,
    unit: 'm',
    verified: false,
    source: 'Assumed default (6 in). Typical tanning-ledge range 6–12 in.',
    group: 'depth',
  },
  sunShelfMaxDepth: {
    label: 'Sun shelf max depth',
    value: 0.46,
    unit: 'm',
    verified: false,
    source: 'Assumed default (18 in). Typical tanning-ledge range 6–12 in; 18 in upper bound for lounging.',
    group: 'depth',
  },
  benchMinWidth: {
    label: 'Bench min seat width',
    value: 0.35,
    unit: 'm',
    verified: false,
    source: 'Assumed default (~14 in). Common pool bench seat 12–18 in.',
    group: 'features',
  },
  benchMaxWidth: {
    label: 'Bench max seat width',
    value: 0.6,
    unit: 'm',
    verified: false,
    source: 'Assumed default (~24 in). Wider seats read as a shelf rather than a bench.',
    group: 'features',
  },
  benchSeatMinDepth: {
    label: 'Bench min seat depth',
    value: 0.35,
    unit: 'm',
    verified: false,
    source: 'Assumed default (~14 in below water).',
    group: 'features',
  },
  benchSeatMaxDepth: {
    label: 'Bench max seat depth',
    value: 0.6,
    unit: 'm',
    verified: false,
    source: 'Assumed default (~24 in below water).',
    group: 'features',
  },
  minCurveRadius: {
    label: 'Min outline curve radius',
    value: 0.6,
    unit: 'm',
    verified: false,
    source:
      'Assumed default (~2 ft). Practical limit for hand-troweling resin-bound quartz and lapping waterproofing membranes on tight curves.',
    group: 'geometry',
  },

  // ---- Build-up & later-phase values (used by sheets/BOM in phases 4–5) -----------------
  structuralShellThickness: {
    label: 'Structural shell (shotcrete) thickness',
    value: 150,
    unit: 'mm',
    verified: false,
    source: 'Assumed default (6 in). Typical residential shotcrete shell; site engineer to confirm.',
    group: 'build-up',
  },
  subBaseThickness: {
    label: 'Compacted stone sub-base',
    value: 150,
    unit: 'mm',
    verified: false,
    source: 'Assumed default (6 in). Freeze-thaw region (Western NY) practice; confirm with geotech.',
    group: 'build-up',
  },
  waterproofingLayers: {
    label: 'Waterproofing membrane coats',
    value: 2,
    unit: 'ratio',
    verified: false,
    source: 'Assumed default. "Layered waterproofing" per brief; coat count/product not yet documented.',
    group: 'build-up',
  },
  waterproofingThickness: {
    label: 'Waterproofing total thickness',
    value: 3,
    unit: 'mm',
    verified: false,
    source: 'Assumed default for a two-coat cementitious/polymer membrane.',
    group: 'build-up',
  },
  sorgivaLayerThickness: {
    label: 'Sorgiva diffusion layer',
    value: 50,
    unit: 'mm',
    verified: false,
    source:
      'Placeholder. Naturi describes a Sorgiva® diffusion network beneath the finish; layer build-up not published.',
    group: 'build-up',
  },
  finishThickness: {
    label: 'Resin-bound quartz/marble finish',
    value: 15,
    unit: 'mm',
    verified: false,
    source: 'Assumed default. Hand-troweled two-component resin + quartz/marble aggregate; thickness not published.',
    group: 'build-up',
  },
  sandLipWidth: {
    label: 'Sand lip width beyond waterline',
    value: 0.45,
    unit: 'm',
    verified: false,
    source: 'Design default (~18 in) for the finish wrapping onto the deck.',
    group: 'build-up',
  },
  spaWallWidth: {
    label: 'Spa dam / spillover wall width',
    value: 0.3,
    unit: 'm',
    verified: false,
    source: 'Assumed default (12 in). Typical raised-spa dam wall.',
    group: 'spa',
  },
  spaMaxDepth: {
    label: 'Spa max depth',
    value: 0.95,
    unit: 'm',
    verified: false,
    source: 'Assumed default (~37 in). Common residential spa depth.',
    group: 'spa',
  },
} satisfies Record<string, SpecEntry>;

export type SpecKey = keyof typeof NATURI_SPECS;
export type SpecTable = Record<SpecKey, SpecEntry>;

export const DEFAULT_SPECS: SpecTable = NATURI_SPECS;

export const specValue = (specs: SpecTable, key: SpecKey) => specs[key].value;
