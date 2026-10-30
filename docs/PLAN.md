# Naturi Pool Studio — Plan

> Living plan for the Naturi Pool Studio build. Each phase ships as its own PR to the default branch.
> Later sessions: read this first. Decisions listed here are settled — don't re-ask.

## Background

Bunch Outdoor Services (Western NY: Prestige Pools, concrete, snow, landscape) wants a browser-based
pro design tool for free-form Naturi / bio-design beach-entry sand pools. These pools have a
resin-bound quartz/marble finish, the Sorgiva circulation system (permeable floor), and layered
waterproofing over a structural base.

The main goal is to let the company's **designers** channel their artistic touch into a real
structural plan. Designers edit on desktop/laptop. **Clients only view**, using a presentation mode
on iPad/laptop/phone. The visual bar is "AAA game like renders". It is a design and schematic tool,
not stamped engineering.

The repo started new and empty. The owner's PC has no Node, so all building and testing happens in
cloud sessions. Deploys go through Netlify linked to the repo (build `npm run build`, publish `dist`).

## Decisions already made (don't re-ask)

- **Branding:** Bunch Outdoor Services (group-level), with a sector line "Prestige Pools division" on
  title blocks. Use a text wordmark until the logo is supplied.
- **Units:** imperial ft-in default, with a metric toggle. Store everything internally in **meters**
  and format only at display/export.
- **Constraints:** warn, then flag on plans. Live amber/red highlights in 2D and 3D plus a warnings
  panel. Export is never blocked, but open violations print on sheets as a "Design review required"
  note.
- **Spec values** (max beach slope, min/max depth, layer thicknesses, spa wall widths, min curve
  radius, etc.): researched defaults, each tagged `verified: false` with a source note, editable on a
  Constraints & Specs settings page later.
- **Finishes:** the full documented Naturi range (Caraibi, Hawai, Panama, Rosa Corallo, Maldive, and
  the rest; mark unconfirmed ones).
- **Feature library** (later phases): beach entry, sun shelf, benches, spa + spillover,
  boulders/waterfall/grotto/jump rock, lighting + night mode, landscaping & decking, land grading,
  retaining walls, koi ponds.
- **Exports** (phase 4): tabloid 11x17 PDF schematic sheet set with title block, plus SVG/PNG per
  sheet. Sheets: dimensioned plan, contours + spot elevations, 2 sections, structural build-up
  details, Sorgiva schematic, callouts/notes, BOM.
- **v1 extras** (later phases): Sorgiva/materials BOM, cost estimate with editable price book, site
  photo overlay with scale calibration, structural/excavation notes.
- No connection to the company's separate homeowner designer website.

## Phases (one PR each)

| Phase | Scope |
| --- | --- |
| 0 | Setup |
| 1 | Core |
| 2 | AAA render pass: PBR finishes, full water shader with refraction/caustics/shoreline, post stack, physical sky + time-of-day, night mode, spa, boulders, instanced landscaping, presentation mode, path-traced photo render via three-gpu-pathtracer |
| 3 | Site & terrain |
| 4 | Construction sheets |
| 5 | Quantities / BOM / cost |

## Phase 0: setup

Vite + React 18 + TypeScript strict, `@react-three/fiber` + `@react-three/drei` +
`@react-three/postprocessing`, Zustand (+ `immer`) with `zundo` for undo/redo, `zod`, `idb-keyval`,
Vitest, Playwright, ESLint. Add `netlify.toml` (build `npm run build`, publish `dist`, SPA redirect)
and a GitHub Actions CI that runs typecheck, tests and build.

## Architecture (must hold; this keeps 3D and 2D in sync)

A single `ProjectDoc` lives in the Zustand store (undoable). A pure, memoized `buildModel(doc)`
(`src/model/buildModel.ts`) derives:

- `floorField`, a ~10 cm heightfield grid of floor elevations (`src/model/floorField.ts`);
- contours via marching squares (`src/model/contours.ts`);
- area, volume, perimeter and max depth;
- `violations[]` from pure rule functions in `src/rules/` against a spec table in
  `src/specs/naturiSpecs.ts`.

`<Viewport3D>` (`src/viewport/`) and the 2D `<PlanEditor>` (`src/editor/`, SVG) both render from
`model`, never from raw doc geometry. Move `buildModel` into a Web Worker if it gets heavy.

The doc schema (`src/model/schema.ts`, zod, with a version field + migration hook) has these parts:

- `outline`: closed centripetal Catmull-Rom control points.
- `zones`: `beachEntry` (edge span + run length + end depth), `sunShelf` (polygon + depth), `bench`
  (edge-offset band + seat depth), `deepZone` (polygon + depth).
- `sculpt`: a sparse delta layer.
- `finish`, `units`, `meta` (name, client, address, designer, revision log).
- Typed placeholders for `features[]`, `site` and `spa`.

To build the floor field: compute the signed distance to the outline, take the base depth from zones
by priority with smooth blending, ramp the beach by distance from its edge span, then add the sculpt
deltas.

## Phase 1: core deliverables

- **App shell:** top bar (project switcher, undo/redo, units toggle), left tool rail, a center split
  view of the 2D plan and 3D (either can go full screen), a right inspector with a warnings panel,
  and a bottom status strip (area, volume, max depth, warning count). Polished and pro, good
  typography, dark-neutral UI that lets the render shine.
- **Projects:** a `ProjectRepository` interface (list/get/save/duplicate/delete/rename) with an
  `IndexedDbRepository` implementation, debounced autosave, and JSON import/export. Backend-ready.
- **Templates gallery on new project:** lagoon beach-entry, kidney with spa placeholder, compact
  plunge + shelf, long beach with grotto placeholder, koi pond + pool placeholder.
- **Designer tools (artistic first):**
  - a freehand outline stroke that gets fitted to an editable spline;
  - control-point drag, insert and delete;
  - zone painting/placing;
  - floor sculpt brushes (deepen, raise, smooth, flatten-to-depth), with size/strength sliders and
    pen pressure via pointer events;
  - keyboard shortcuts.
- **3D, a solid first pass toward AAA:**
  - the shell mesh built from `floorField`, with a sand lip at the edge;
  - HDRI image-based lighting (a CC0 Poly Haven HDRI);
  - soft sun shadows;
  - a first water shader: depth-based absorption color (turquoise over shallow sand), Fresnel,
    animated normals;
  - a finish color/texture per chosen finish, ACES/AgX tone mapping, SMAA, and N8AO;
  - orbit controls.
- **Live warnings, first 5 rules:** max beach slope, max floor slope, min/max depth, min curve
  radius, bench width. Highlight them in both the 2D and 3D views.
- **Units:** ft-in/metric formatting everywhere.

## Phase 1 — done means

- Vitest covers floor-field depths for the templates, beach slope math, contour closure,
  area/volume against circle and rectangle analytic shapes, each rule (pass and fail), and
  repository CRUD/duplicate.
- A Playwright smoke test passes: new project → template → drag an outline point → the 3D mesh and
  plan contours both update → a steep-beach warning shows in both → undo restores → switch project
  and back → reload persists.
- CI is green.
- The PR description includes screenshots of the 3D view and the plan for 2 templates, plus Netlify
  setup steps.
- Every invented spec value is marked `verified: false` in `naturiSpecs.ts` and listed in the PR.
