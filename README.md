# Naturi Pool Studio

**Bunch Outdoor Services · Prestige Pools division**

A browser-based design tool for free-form Naturi / bio-design beach-entry sand pools. Designers
shape the pool on desktop; the same model drives a live 2D plan and a real-time 3D render.
It is a design and schematic tool, not stamped engineering.

See [`docs/PLAN.md`](docs/PLAN.md) for the brief, settled decisions and the phase plan.

## Running it

Everything builds in CI or in a cloud session, so you don't need Node on your own PC. For local work:

```bash
npm ci
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npm run build        # typecheck + production build → dist/
npm run e2e          # Playwright smoke test (needs `npm run build` first)
npm run screenshots  # regenerate docs/screenshots (slow on software WebGL)
```

### Finish photos

Each Naturi finish can use a photo of a physical sample instead of the procedural preview:
**Finish → Import sample photo**. The center square of the photo is turned into a seamless
2K or 4K tile, the lighting is evened out, and relief and roughness maps are derived from it.
Imported photos are stored per device. To ship a set to every designer and client, use
**Download maps** and add the files under [`public/materials/`](public/materials/README.md).
Only use photos you own or have permission to use.

### Rockwork

The **Rockwork** tool (`K`) builds natural boulder rockwork along a line you click. There are
three presets: rock wall, waterfall (sheet spill or cascade) and grotto (an opening under slab
roof stones). Height, depth, boulder size, character, rock type and the waterfall and grotto
spans are all editable, and **Reshuffle** re-stacks the boulders. Rocks sit on the modelled
floor and deck, and the same layout drives the plan and 3D views.

Add `?quality=low` to the URL for a cheaper render path on weak GPUs. It skips the transmission
pass, shadows and ambient occlusion.

## Deploying on Netlify

1. In Netlify, choose **Add new site → Import an existing project → GitHub**, then pick
   `Dbunch15/BOSsoftware`.
2. Netlify reads `netlify.toml`, so the build settings fill in automatically:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 22 (set in `netlify.toml`)
3. Leave the base directory empty. No environment variables are needed.
4. Deploy. Every push to `main` redeploys, and each pull request gets a deploy preview link.
5. Optional: under **Domain management**, add a custom domain such as `studio.bunchoutdoor.com`.

Projects live in the browser's IndexedDB, per device and per browser. Use **Projects → Export
JSON** to move a design between machines. A server-backed repository can replace IndexedDB later
without UI changes (see `src/persistence/ProjectRepository.ts`).

## How it fits together

```
ProjectDoc (zustand + immer, undo via zundo)
        │
        ▼
buildModel(doc)  — pure, memoized
  ├─ floorField   ~10 cm heightfield (signed distance → zones → walls → benches → beach → sculpt)
  ├─ contours     marching squares
  ├─ stats        area · volume · perimeter · max depth
  └─ violations   rules in src/rules against src/specs/naturiSpecs.ts
        │
        ├──► <PlanEditor>  (SVG, src/editor)
        └──► <Viewport3D>  (react-three-fiber, src/viewport)
```

Both views render from the model, never from raw doc geometry, so they can't drift apart.
All values are stored in meters and formatted only for display.

| Path | What |
| --- | --- |
| `src/model/schema.ts` | zod `ProjectDoc` schema, version + migration hook |
| `src/model/floorField.ts` | heightfield generation |
| `src/model/contours.ts` | marching-squares contours |
| `src/rules/` | constraint rules (pure functions) |
| `src/specs/naturiSpecs.ts` | spec table; every value is `verified: false` until confirmed |
| `src/specs/finishes.ts` | Naturi finish range (5 confirmed names + 5 TBC slots) |
| `src/templates/` | new-project templates |
| `src/persistence/` | `ProjectRepository` interface, IndexedDB + memory implementations, JSON I/O |
| `src/state/` | doc store (undoable), UI store, project lifecycle + autosave |
| `src/editor/` | plan editor, stroke fitting, sculpt brushes, shortcuts |
| `src/viewport/` | 3D scene, shell mesh, water, rockwork, procedural textures |
| `src/rockwork/` | seeded boulder layout for walls, waterfalls and grottos |
| `src/materials/` | sample-photo pipeline (seamless tile, normal/roughness), finish photo library |

## Keyboard

`V` select · `P` freehand outline · `I` add point · `X` remove point · `B` beach · `N` bench ·
`S` sun shelf · `D` deep zone · `K` rockwork · `E` deepen · `R` raise · `M` smooth · `F` flatten (Alt-click
samples a depth) · `H` pan · `[` `]` brush size · `Shift+[` `]` strength · `Ctrl+Z` /
`Ctrl+Shift+Z` undo/redo · `1` `2` `3` layouts · `.` frame · `T` 3D top view · `W` water ·
`U` units · `?` help.

## Credits

HDRI: *Rooitou Park* from [Poly Haven](https://polyhaven.com/a/rooitou_park) (CC0), via the pmndrs drei-assets mirror.
