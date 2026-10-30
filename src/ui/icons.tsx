import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  select: <path d="M5 3l12 6.5-5.2 1.6L9.3 16 5 3z" />,
  pen: <path d="M3 15c2.5-6 4.5-9 6.5-9 2.8 0 1 7 3.6 7 1.4 0 2.4-2 3.9-4.5" />,
  insert: (
    <>
      <path d="M2 14c3-7 11-7 16 0" />
      <circle cx="10" cy="8.8" r="2.2" />
      <path d="M10 2v3M8.5 3.5h3" />
    </>
  ),
  remove: (
    <>
      <path d="M2 14c3-7 11-7 16 0" />
      <circle cx="10" cy="8.8" r="2.2" />
      <path d="M8 3.5h4" />
    </>
  ),
  beach: (
    <>
      <path d="M2 6h4l10 9h2" />
      <path d="M2 15h16" opacity=".5" />
      <path d="M3 10c1 .8 2 .8 3 0s2-.8 3 0" />
    </>
  ),
  bench: <path d="M2 5v10h16M2 9h6v6M8 9h0" />,
  shelf: (
    <>
      <circle cx="14" cy="5" r="2.2" />
      <path d="M2 11h7l2 4h7" />
    </>
  ),
  deep: (
    <>
      <path d="M2 5h16" />
      <path d="M5 9c2 6 8 6 10 0" />
      <path d="M10 8v6M8 12l2 2 2-2" />
    </>
  ),
  deepen: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v8M7 11l3 3 3-3" />
    </>
  ),
  raise: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 14V6M7 9l3-3 3 3" />
    </>
  ),
  smooth: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M5.5 11c1.5-2 3-2 4.5 0s3 2 4.5 0" />
    </>
  ),
  flatten: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M5.5 10h9M7 7l3 2 3-2M7 13l3-2 3 2" />
    </>
  ),
  pan: <path d="M7 10V4.5a1.2 1.2 0 012.4 0V9m0-5.5a1.2 1.2 0 012.4 0V9m0-4a1.2 1.2 0 012.4 0v6c0 4-2 6-5.2 6-2.2 0-3.3-1-4.6-3L3 11.4a1.2 1.2 0 012-1.3L7 12" />,
  undo: <path d="M7 5L3 9l4 4M3 9h9a5 5 0 010 10h-2" transform="translate(0 -2)" />,
  redo: <path d="M13 5l4 4-4 4M17 9H8a5 5 0 000 10h2" transform="translate(0 -2)" />,
  chevron: <path d="M5 8l5 5 5-5" />,
  plus: <path d="M10 4v12M4 10h12" />,
  copy: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M13 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2" />
    </>
  ),
  trash: <path d="M4 6h12M8 6V4h4v2M5.5 6l.8 10h7.4l.8-10" />,
  download: <path d="M10 3v9M6 8l4 4 4-4M4 16h12" />,
  upload: <path d="M10 13V4M6 8l4-4 4 4M4 16h12" />,
  edit: <path d="M4 16l1-4 8-8 3 3-8 8-4 1z" />,
  fit: <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />,
  water: <path d="M10 3c3 4 5 6.5 5 9a5 5 0 01-10 0c0-2.5 2-5 5-9z" />,
  maximize: <path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6" />,
  minimize: <path d="M16 9h-5V4M4 11h5v5M11 9l6-6M9 11l-6 6" />,
  help: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7.8 7.8a2.3 2.3 0 114 1.6c-.9.7-1.8 1.1-1.8 2.3M10 14.2v.1" />
    </>
  ),
  check: <path d="M4 10.5l4 4 8-9" />,
  contours: (
    <>
      <path d="M3 10c0-4 3-7 7-7s7 3 7 7-3 7-7 7" />
      <path d="M6 10c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4" />
    </>
  ),
  heat: (
    <>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 9h14M3 13h14" opacity=".6" />
    </>
  ),
  top: (
    <>
      <path d="M10 3l7 4-7 4-7-4 7-4z" />
      <path d="M10 11v6" />
    </>
  ),
  camera: (
    <>
      <path d="M3 7h3l1.5-2h5L14 7h3v9H3z" />
      <circle cx="10" cy="11" r="2.8" />
    </>
  ),
  layers: <path d="M10 3l7 4-7 4-7-4 7-4zM3 11l7 4 7-4" />,
  split: (
    <>
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <path d="M10 4v12" />
    </>
  ),
  plan: (
    <>
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <path d="M6 13c1-4 6-6 8-3" />
    </>
  ),
  cube: (
    <>
      <path d="M10 2.5l6.5 3.7v7.6L10 17.5l-6.5-3.7V6.2z" />
      <path d="M3.5 6.2L10 10l6.5-3.8M10 10v7.5" />
    </>
  ),
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 18 }: { name: IconName | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}
