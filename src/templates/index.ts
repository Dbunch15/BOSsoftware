/** New-project templates. Shapes are generated parametrically, then stored as editable control points. */
import { DEFAULT_FINISH_ID } from '../specs/finishes';
import type { Vec2 } from '../model/geometry';
import { DOC_VERSION, type Feature, type ProjectDoc, type Spa, type Zone, newId } from '../model/schema';
import { controlPointUs } from '../model/spline';

export interface TemplateInfo {
  id: string;
  name: string;
  blurb: string;
  build: () => Omit<ProjectDoc, 'id' | 'meta'>;
}

const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function polar(n: number, rx: number, ry: number, r: (th: number) => number, cx = 0, cy = 0): Vec2[] {
  const pts: Vec2[] = [];
  for (let k = 0; k < n; k++) {
    const th = (2 * Math.PI * k) / n;
    const rr = r(th);
    pts.push({ x: round(cx + Math.cos(th) * rx * rr), y: round(cy + Math.sin(th) * ry * rr) });
  }
  return pts;
}

function ellipse(cx: number, cy: number, rx: number, ry: number, n = 8, wobble = 0): Vec2[] {
  return polar(n, rx, ry, (th) => 1 + wobble * Math.sin(3 * th + 0.7), cx, cy);
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** Span between two control-point indices (travelling forward). */
function spanBetween(points: Vec2[], i0: number, i1: number) {
  const us = controlPointUs(points, 0.5);
  return { u0: round(us[i0 % points.length]), u1: round(us[i1 % points.length]) };
}

const baseShell = { baseDepth: 1.35, wallRun: 0.9, lipWidth: 0.45, deckHeight: 0.12 };
const emptySculpt = { cellSize: 0.1, cells: {} };
const site = { placeholder: true as const, northAngle: 0, notes: '' };

function doc(
  points: Vec2[],
  zones: Zone[],
  extra: Partial<{ shell: Partial<typeof baseShell>; features: Feature[]; spa: Spa | null; finish: string }> = {},
): Omit<ProjectDoc, 'id' | 'meta'> {
  return {
    version: DOC_VERSION,
    units: 'imperial',
    finish: { id: extra.finish ?? DEFAULT_FINISH_ID },
    outline: { points, alpha: 0.5 },
    shell: { ...baseShell, ...extra.shell },
    zones,
    sculpt: { ...emptySculpt, cells: {} },
    features: extra.features ?? [],
    spa: extra.spa ?? null,
    site: { ...site },
  };
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: 'lagoon',
    name: 'Lagoon beach entry',
    blurb: 'Organic 46×26 ft lagoon with a wide walk-in beach and a soft deep end.',
    build: () => {
      const pts = polar(16, 7, 4, (th) => 1 + 0.08 * Math.sin(2 * th + 0.6) + 0.05 * Math.cos(3 * th));
      return doc(pts, [
        {
          kind: 'beachEntry',
          id: newId(),
          name: 'Beach entry',
          span: spanBetween(pts, 6, 10),
          runLength: 5.5,
          endDepth: 0.75,
          toeSlope: 0.3,
          taper: 1.2,
        },
        { kind: 'deepZone', id: newId(), name: 'Deep end', polygon: ellipse(4.3, 0.1, 1.8, 1.5), depth: 1.85, blend: 3 },
      ]);
    },
  },
  {
    id: 'kidney-spa',
    name: 'Kidney + spa',
    blurb: 'Classic kidney with a bench in the inner curve and a raised spa placeholder.',
    build: () => {
      const pts = polar(14, 5, 2.9, (th) => 1 - 0.32 * Math.exp(-(angDiff(th, Math.PI / 2) ** 2) / 0.25));
      return doc(
        pts,
        [
          {
            kind: 'bench',
            id: newId(),
            name: 'Inner-curve bench',
            span: spanBetween(pts, 2, 5),
            width: 0.45,
            seatDepth: 0.5,
          },
          { kind: 'deepZone', id: newId(), name: 'Deep lobe', polygon: ellipse(2.6, -0.3, 1.4, 1.2), depth: 1.8, blend: 2.6 },
        ],
        {
          shell: { baseDepth: 1.3 },
          spa: { placeholder: true, position: { x: -6.4, y: -1.7 }, diameter: 2.2, depth: 0.95, spillover: true },
          finish: 'panama',
        },
      );
    },
  },
  {
    id: 'plunge-shelf',
    name: 'Compact plunge + shelf',
    blurb: 'Small-yard 19×12 ft plunge with a sun shelf and a side bench.',
    build: () => {
      const a = 2.9;
      const b = 1.8;
      const pts = polar(16, 1, 1, (th) => {
        const c = Math.abs(Math.cos(th));
        const s = Math.abs(Math.sin(th));
        return Math.pow(c ** 4 / a ** 4 + s ** 4 / b ** 4, -0.25);
      });
      return doc(
        pts,
        [
          {
            kind: 'sunShelf',
            id: newId(),
            name: 'Sun shelf',
            polygon: [
              { x: 1.55, y: -2.4 },
              { x: 3.4, y: -2.4 },
              { x: 3.4, y: 2.4 },
              { x: 1.55, y: 2.4 },
            ],
            depth: 0.3,
            blend: 0.4,
          },
          {
            kind: 'bench',
            id: newId(),
            name: 'Side bench',
            span: spanBetween(pts, 10, 13),
            width: 0.4,
            seatDepth: 0.45,
          },
        ],
        { shell: { baseDepth: 1.5, wallRun: 0.7 }, finish: 'maldive' },
      );
    },
  },
  {
    id: 'long-beach-grotto',
    name: 'Long beach + grotto',
    blurb: 'A 59 ft resort-style pool with a long shallow beach and a grotto placeholder.',
    build: () => {
      const pts = polar(20, 9, 3.2, (th) => 1 + 0.05 * Math.sin(3 * th) + 0.04 * Math.cos(5 * th + 1));
      return doc(
        pts,
        [
          {
            kind: 'beachEntry',
            id: newId(),
            name: 'Long beach',
            span: spanBetween(pts, 7, 13),
            runLength: 8,
            endDepth: 0.9,
            toeSlope: 0.3,
            taper: 1.2,
          },
          { kind: 'deepZone', id: newId(), name: 'Grotto deep end', polygon: ellipse(5.5, 0, 2.2, 1.6), depth: 1.9, blend: 3.2 },
        ],
        {
          shell: { baseDepth: 1.4 },
          features: [
            {
              id: newId(),
              kind: 'grotto',
              name: 'Grotto',
              position: { x: 9.8, y: -0.8 },
              rotation: 0,
              size: { x: 3, y: 2.4 },
              placeholder: true,
            },
          ],
        },
      );
    },
  },
  {
    id: 'koi-pool',
    name: 'Koi pond + pool',
    blurb: 'Beach-entry swim pool beside a koi pond placeholder.',
    build: () => {
      const pts = polar(14, 4.6, 2.6, (th) => 1 + 0.07 * Math.sin(2 * th + 1.2));
      return doc(
        pts,
        [
          {
            kind: 'beachEntry',
            id: newId(),
            name: 'Beach entry',
            span: spanBetween(pts, 5, 9),
            runLength: 4,
            endDepth: 0.55,
            toeSlope: 0.3,
            taper: 1.0,
          },
          { kind: 'deepZone', id: newId(), name: 'Deep zone', polygon: ellipse(2.2, 0, 1.4, 1.1), depth: 1.7, blend: 2.4 },
        ],
        {
          shell: { baseDepth: 1.3 },
          finish: 'hawai',
          features: [
            {
              id: newId(),
              kind: 'koiPond',
              name: 'Koi pond',
              position: { x: 0.5, y: 5.2 },
              rotation: 0,
              size: { x: 5, y: 2.6 },
              polygon: ellipse(0.5, 5.2, 2.5, 1.3, 9, 0.08),
              placeholder: true,
            },
          ],
        },
      );
    },
  },
  {
    id: 'blank',
    name: 'Blank — sketch your own',
    blurb: 'A simple oval to reshape, or draw a fresh outline with the pen.',
    build: () => doc(polar(10, 4.5, 2.6, () => 1), []),
  },
];

export function templateById(id: string): TemplateInfo {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export function createFromTemplate(id: string, name?: string, now = new Date().toISOString()): ProjectDoc {
  const t = templateById(id);
  return {
    ...t.build(),
    id: newId(),
    meta: {
      name: name ?? t.name,
      client: '',
      address: '',
      designer: '',
      createdAt: now,
      updatedAt: now,
      templateId: t.id,
      revisions: [{ rev: 'A', date: now.slice(0, 10), by: '', note: `Created from “${t.name}” template` }],
    },
  };
}
