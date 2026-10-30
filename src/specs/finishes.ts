/**
 * Naturi finish range. Naturi markets ten standard colors plus custom blends. Five names are
 * confirmed by Bunch Outdoor Services; the remaining five slots are placeholders until the
 * official color chart is supplied. Swatch colors are approximations for rendering only
 * (`appearanceVerified: false`) — match against physical samples before client presentations.
 */

export interface Finish {
  id: string;
  name: string;
  /** Name confirmed as part of the Naturi range. */
  confirmed: boolean;
  appearanceVerified: false;
  description: string;
  /** Base binder/sand tone, linear-ish sRGB hex. */
  base: string;
  /** Aggregate grain colors with relative weights. */
  grains: Array<{ color: string; weight: number }>;
  roughness: number;
}

export const FINISHES: Finish[] = [
  {
    id: 'caraibi',
    name: 'Caraibi',
    confirmed: true,
    appearanceVerified: false,
    description: 'Bright Caribbean white sand — the classic turquoise-water look.',
    base: '#e9e1cf',
    grains: [
      { color: '#f7f3ea', weight: 5 },
      { color: '#d8ccb2', weight: 3 },
      { color: '#bfae8f', weight: 1 },
    ],
    roughness: 0.82,
  },
  {
    id: 'maldive',
    name: 'Maldive',
    confirmed: true,
    appearanceVerified: false,
    description: 'Very pale ivory-white blend; the lightest, most vivid water color.',
    base: '#f1ece2',
    grains: [
      { color: '#ffffff', weight: 5 },
      { color: '#e6dfd1', weight: 3 },
      { color: '#cfc5b3', weight: 1 },
    ],
    roughness: 0.8,
  },
  {
    id: 'panama',
    name: 'Panama',
    confirmed: true,
    appearanceVerified: false,
    description: 'Warm golden beach sand; water reads green-turquoise.',
    base: '#d6bc8a',
    grains: [
      { color: '#e8d3a6', weight: 4 },
      { color: '#c39e62', weight: 3 },
      { color: '#9c7a45', weight: 1 },
    ],
    roughness: 0.84,
  },
  {
    id: 'rosa-corallo',
    name: 'Rosa Corallo',
    confirmed: true,
    appearanceVerified: false,
    description: 'Coral-pink sand with white and rose grains.',
    base: '#e3c3b4',
    grains: [
      { color: '#f2dcd2', weight: 4 },
      { color: '#d29e8c', weight: 3 },
      { color: '#ffffff', weight: 1 },
    ],
    roughness: 0.82,
  },
  {
    id: 'hawai',
    name: 'Hawai',
    confirmed: true,
    appearanceVerified: false,
    description: 'Dark volcanic sand; deep lagoon-blue water.',
    base: '#4a4743',
    grains: [
      { color: '#2a2826', weight: 4 },
      { color: '#6b6660', weight: 3 },
      { color: '#9b958c', weight: 1 },
    ],
    roughness: 0.78,
  },
  ...[6, 7, 8, 9, 10].map(
    (n, i): Finish => ({
      id: `tbc-${n}`,
      name: `Standard color ${n} (TBC)`,
      confirmed: false,
      appearanceVerified: false,
      description: 'Unconfirmed placeholder for the rest of the ten-color Naturi range — awaiting the official chart.',
      base: ['#cdbfa7', '#b9b2a6', '#d9cdb8', '#a89a84', '#8f8b84'][i],
      grains: [
        { color: ['#e0d4be', '#d0cac0', '#ece2cf', '#c2b39b', '#a9a49c'][i], weight: 4 },
        { color: ['#a99a80', '#8f877b', '#b8a98f', '#857660', '#6e6a64'][i], weight: 2 },
      ],
      roughness: 0.82,
    }),
  ),
];

export const DEFAULT_FINISH_ID = 'caraibi';

export function finishById(id: string): Finish {
  return FINISHES.find((f) => f.id === id) ?? FINISHES[0];
}
