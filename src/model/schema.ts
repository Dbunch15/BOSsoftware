/**
 * ProjectDoc — the single source of truth for a design. Everything is stored in METERS
 * (plan x/y, depths positive downward from the water surface). Units only affect display.
 */
import { z } from 'zod';

export const DOC_VERSION = 2;

export const Vec2Schema = z.object({ x: z.number(), y: z.number() });

/** Arc-length span along the outline, u ∈ [0,1). Travels in +u from u0 to u1, wrapping through 0. */
export const SpanSchema = z.object({
  u0: z.number().min(0).max(1),
  u1: z.number().min(0).max(1),
});

export const BeachEntrySchema = z.object({
  kind: z.literal('beachEntry'),
  id: z.string(),
  name: z.string().default('Beach entry'),
  span: SpanSchema,
  /** Horizontal run from the waterline to the end of the walkable beach. */
  runLength: z.number().positive(),
  /** Water depth at the end of the run. */
  endDepth: z.number().positive(),
  /** Slope of the "toe" beyond the run where the beach meets the pool floor (rise/run). */
  toeSlope: z.number().positive().default(0.3),
  /** Lateral fade at the ends of the span. */
  taper: z.number().nonnegative().default(1.2),
});

export const SunShelfSchema = z.object({
  kind: z.literal('sunShelf'),
  id: z.string(),
  name: z.string().default('Sun shelf'),
  polygon: z.array(Vec2Schema).min(3),
  depth: z.number(),
  /** Width of the transition between the shelf and surrounding floor. */
  blend: z.number().positive().default(0.4),
});

export const BenchSchema = z.object({
  kind: z.literal('bench'),
  id: z.string(),
  name: z.string().default('Bench'),
  span: SpanSchema,
  /** Seat width measured inward from the waterline. */
  width: z.number().positive(),
  seatDepth: z.number().positive(),
});

export const DeepZoneSchema = z.object({
  kind: z.literal('deepZone'),
  id: z.string(),
  name: z.string().default('Deep zone'),
  polygon: z.array(Vec2Schema).min(3),
  depth: z.number().positive(),
  blend: z.number().positive().default(3),
});

export const ZoneSchema = z.discriminatedUnion('kind', [BeachEntrySchema, SunShelfSchema, BenchSchema, DeepZoneSchema]);

export const ShellSchema = z.object({
  /** General floor depth where no zone applies. */
  baseDepth: z.number().positive().default(1.35),
  /** Horizontal distance over which the wall eases from the waterline down to floor depth. */
  wallRun: z.number().positive().default(0.9),
  /** Width of the sand lip outside the waterline. */
  lipWidth: z.number().nonnegative().default(0.45),
  /** Deck height above the water surface. */
  deckHeight: z.number().nonnegative().default(0.12),
});

/** Sparse sculpt layer: key "i,j" on a fixed world grid of `cellSize`; value = extra depth (m, + is deeper). */
export const SculptSchema = z.object({
  cellSize: z.number().positive().default(0.1),
  cells: z.record(z.string(), z.number()).default({}),
});

export const FEATURE_KINDS = [
  'grotto',
  'waterfall',
  'boulder',
  'jumpRock',
  'koiPond',
  'lighting',
  'landscaping',
  'decking',
  'retainingWall',
] as const;

/** Typed placeholder for the later-phase feature library. */
export const FeatureSchema = z.object({
  id: z.string(),
  kind: z.enum(FEATURE_KINDS),
  name: z.string(),
  position: Vec2Schema,
  rotation: z.number().default(0),
  size: Vec2Schema,
  polygon: z.array(Vec2Schema).optional(),
  placeholder: z.literal(true).default(true),
});

export const ROCK_TYPES = ['sandstone', 'granite', 'limestone', 'basalt'] as const;

/** Fraction range along a rockwork spine (0 = first point, 1 = last). */
export const SpineSpanSchema = z.object({ t0: z.number().min(0).max(1), t1: z.number().min(0).max(1) });

/**
 * Natural rockwork built from stacked boulders along a spine: a rock wall, optionally with a
 * waterfall spilling from its top and/or a grotto opening through it.
 */
export const RockworkSchema = z.object({
  id: z.string(),
  name: z.string().default('Rockwork'),
  /** Plan polyline the rocks are stacked along. */
  path: z.array(Vec2Schema).min(2),
  /** Top of the rockwork above the deck (m). */
  height: z.number().positive().default(1.2),
  /** Footprint depth across the spine (m). */
  thickness: z.number().positive().default(1.3),
  /** Typical boulder diameter (m). */
  boulderSize: z.number().positive().default(0.75),
  /** 0 = smooth river rock, 1 = sharp quarried rock. */
  jaggedness: z.number().min(0).max(1).default(0.5),
  rockType: z.enum(ROCK_TYPES).default('sandstone'),
  /** Layout seed; "reshuffle" picks a new one. */
  seed: z.number().int().default(1),
  waterfall: z
    .object({
      enabled: z.boolean().default(false),
      span: SpineSpanSchema.default({ t0: 0.35, t1: 0.65 }),
      /** sheet = smooth spill lip; cascade = water tumbling over stepped rocks. */
      type: z.enum(['sheet', 'cascade']).default('sheet'),
    })
    .default({ enabled: false, span: { t0: 0.35, t1: 0.65 }, type: 'sheet' }),
  grotto: z
    .object({
      enabled: z.boolean().default(false),
      span: SpineSpanSchema.default({ t0: 0.3, t1: 0.7 }),
      /** Clear height of the opening above the ground at its center (m). */
      openingHeight: z.number().positive().default(1.1),
    })
    .default({ enabled: false, span: { t0: 0.3, t1: 0.7 }, openingHeight: 1.1 }),
});

export const SpaSchema = z.object({
  placeholder: z.literal(true).default(true),
  position: Vec2Schema,
  diameter: z.number().positive(),
  depth: z.number().positive().default(0.95),
  spillover: z.boolean().default(true),
});

export const SiteSchema = z.object({
  placeholder: z.literal(true).default(true),
  /** Plan rotation of true north, degrees clockwise from plan up. */
  northAngle: z.number().default(0),
  notes: z.string().default(''),
});

export const RevisionSchema = z.object({
  rev: z.string(),
  date: z.string(),
  by: z.string(),
  note: z.string(),
});

export const MetaSchema = z.object({
  name: z.string().min(1),
  client: z.string().default(''),
  address: z.string().default(''),
  designer: z.string().default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
  templateId: z.string().optional(),
  revisions: z.array(RevisionSchema).default([]),
});

export const ProjectDocSchema = z.object({
  version: z.literal(DOC_VERSION),
  id: z.string().min(1),
  meta: MetaSchema,
  units: z.enum(['imperial', 'metric']).default('imperial'),
  finish: z.object({ id: z.string() }),
  outline: z.object({
    points: z.array(Vec2Schema).min(3),
    /** Catmull-Rom parameterisation: 0.5 = centripetal. */
    alpha: z.number().min(0).max(1).default(0.5),
  }),
  shell: ShellSchema,
  zones: z.array(ZoneSchema).default([]),
  sculpt: SculptSchema,
  features: z.array(FeatureSchema).default([]),
  rockwork: z.array(RockworkSchema).default([]),
  spa: SpaSchema.nullable().default(null),
  site: SiteSchema,
});

export type ProjectDoc = z.infer<typeof ProjectDocSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type ZoneKind = Zone['kind'];
export type BeachEntry = z.infer<typeof BeachEntrySchema>;
export type SunShelf = z.infer<typeof SunShelfSchema>;
export type Bench = z.infer<typeof BenchSchema>;
export type DeepZone = z.infer<typeof DeepZoneSchema>;
export type Shell = z.infer<typeof ShellSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type FeatureKind = Feature['kind'];
export type Spa = z.infer<typeof SpaSchema>;
export type Rockwork = z.infer<typeof RockworkSchema>;
export type RockType = Rockwork['rockType'];
export type Units = ProjectDoc['units'];
export type Span = z.infer<typeof SpanSchema>;

/**
 * Migration hook. Each entry upgrades a raw doc from version N to N+1.
 * Add `1: (raw) => ({ ...raw, version: 2, ... })` when the schema changes.
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // Version 0 was never shipped; treat missing version as a v1 draft.
  0: (raw) => ({ ...raw, version: 1 }),
  // v2 adds the rockwork builder.
  1: (raw) => ({ ...raw, version: 2, rockwork: Array.isArray(raw.rockwork) ? raw.rockwork : [] }),
};

export function migrateDoc(raw: unknown): ProjectDoc {
  if (!raw || typeof raw !== 'object') throw new Error('Not a project document');
  let doc = { ...(raw as Record<string, unknown>) };
  let version = typeof doc.version === 'number' ? doc.version : 0;
  if (version > DOC_VERSION) throw new Error(`Project was saved by a newer version (v${version})`);
  while (version < DOC_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`No migration from v${version}`);
    doc = step(doc);
    version = doc.version as number;
  }
  return ProjectDocSchema.parse(doc);
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
