# Fisher's Point — Web map-art integration patch

**What this is.** A narrowly scoped, reproducible art patch for the **actual playable Web
game** on PR #38 (`arena/4795760e-soul-of-hero`). It turns the existing Fisher's Point
coastal / forest / resource corridor and its surrounding traversal into a visibly richer,
connected first-hour environment. It is **not** a separate showcase, not the obsolete
1024×768 GOLD world, and not a competing gameplay implementation.

**Baseline.** `acaa002746061d9e2abe828ccc8a10bba9fc891d` — `Merge PR #43: B2-B causal
world chronology`, fetched as the latest PR #38 HEAD before work began. All existing
`world_lab/` hero research, crop provenance and renderer experiments are preserved
unchanged on this branch and are **not** used as acceptance evidence.

**Delivery branch.** `arena/2e3cfbd2-soul-of-hero`. The exact delivery commit SHA is
reported in the Arena handoff message; everything below is committed and pushed there.
Arena branch rules prevent editing the PR #38 tree directly, so this is a patch +
screenshots handoff for the Gameplay owner, produced from a clean detached worktree at
the exact PR #38 HEAD above.

---

## Apply

```bash
cd <repo-root>                       # a checkout of PR #38 / arena/4795760e-soul-of-hero
git apply --check world_lab/web_art_patch/pr38_map_art.patch
git apply world_lab/web_art_patch/pr38_map_art.patch
cd web && npx tsc --noEmit && npm run build && npm test
```

Verified: `git apply --check` passes on a fresh worktree at `acaa0027…`, and that fresh
tree typechecks and builds. The patch contains **2 files / 390 insertions**:

| File | Change |
|---|---|
| `web/src/game/mapArt.ts` | **new** — the authored, data-driven map-art module (381 lines) |
| `web/src/game/render.ts` | **+9 lines** — one import + four labelled `MAP_ART_SEAM_*` hook calls |

`world.ts`, `core.ts`, `engine.ts`, `sim.ts`, `catalog.ts`, `content.ts`, `persist.ts`,
`art.ts`, all UI, all tests, all saves and all gameplay authority are **untouched**.
No collision, resource, POI, entity, economy, control or save change. No new gameplay law.

Full copies of both files are in `source/` for review without applying the patch.

## The seam (coordination with PixelFX / VFX)

`render.ts` is a shared file. The patch deliberately adds only four one-line call sites
and rewrites **no** particle, weather or lighting function:

1. `MAP_ART_SEAM_1` — `mapArtTexel()` at the top of `texel()`: returns an authored palette
   RGB inside the region, or `null` so the engine's original texel is used unchanged.
2. `MAP_ART_SEAM_2` — `mapArtGround()` right after the terrain chunks: animated surf,
   canopy contact shadows, resource glints, lantern bloom (under entities).
3. `MAP_ART_SEAM_3` — `mapArtDrawables(g, …)` spread into the **existing** y-sorted
   drawable list, so landmarks sort against the real player, creatures and resources.
4. `MAP_ART_SEAM_4` — `mapArtLights()` spread into `drawLight()`'s existing `lights`
   array, so authored lanterns reuse the game's real night-lighting VFX rather than
   faking a black scene or adding a second lighting pass.

If a concurrent PixelFX/VFX change moves those functions, these four insertions are
trivial to re-apply; no logic inside `drawFx`, `drawWeather` or `drawLight` was changed.

## What the player sees

- **Region** `x 20..146, y 140..196` (tile coords in the real 200×200 island):
  Fisher's Point spawn and Net Shed, the south-coast forest belt, the beach and surf,
  the lighthouse spit to the west and the Halcyon Hull wreck approach to the east.
  Edges are dither-feathered over 7 tiles so there is no hard rectangular seam.
- **Materials** — one shared 36-colour ladder (cool blue-violet darks → warm
  brass/ivory lights), 16px-grid-aligned, exact-palette pixels only: layered sea with
  broad stepped swells, warm wet/dry sand with hard dune contours, clustered forest
  floor with canopy darkening and leaf litter, stratified rock, and a clean compacted
  road with stone edge trim and brass waymarks. POI floors/walls, bridges, lava, snow,
  ash and toxic tiles deliberately fall back to the engine's original art.
- **Landmarks** (declarative table, y-sorted, non-interactive, non-blocking):
  a lit Fisher's Beacon, three cairns on the existing road, three rope lantern posts,
  a stranded dory in the surf, two standing-stone groups and a broken mast near the
  wreck. A landmark is skipped if a real resource or POI building occupies its tile.
- **Depth / light** — offset contact shadows, cool canopy cores, warm lantern pools
  that use the existing night-light VFX, and a low-alpha world-space bloom. Day and
  night both remain legible.
- **Navigation / discoverability / hazards** — the existing road becomes a readable
  leading line; cairns and brass waymarks mark it; one-pixel slow glints are derived
  from the authoritative source array (no new pickups); marsh reeds and rock strata
  make hazards readable.

## Real in-game screenshots

All images are **unmodified Chromium screenshots of the real game** with the existing
character, HUD, real movement and real clock. Before = pristine PR #38 production build;
after = the same build with this patch. Both at **640×360** (native 1×) and
**1280×720** (integer 2×), day and night, same spawn camera and same physical route.

| Condition | Before | After |
|---|---|---|
| Day, spawn | `evidence/before/day-spawn-{640x360,1280x720}.png` | `evidence/after/day-spawn-{640x360,1280x720}.png` |
| Night, spawn | `evidence/before/night-spawn-{640x360,1280x720}.png` | `evidence/after/night-spawn-{640x360,1280x720}.png` |
| Day, walked coast | `evidence/before/day-walk-{640x360,1280x720}.png` | `evidence/after/day-walk-{640x360,1280x720}.png` |
| Night, walked coast | `evidence/before/night-walk-{640x360,1280x720}.png` | `evidence/after/night-walk-{640x360,1280x720}.png` |
| HUD panels after traversal | — | `evidence/after/route-panels-640x360.png` |

Exact player coordinates, `dayTime`, `dark`, weather slot, seed and error list per shot
are in `evidence/{before,after}/manifest.json`. Before/after spawn coordinates are
identical `(1352, 2744)`; walked positions differ by **< 0.6 px** (`1204.10, 2895.63`
vs `1204.67, 2896.23`). Night `dark` = **0.774**, day `dark` = **0.233 / 0.193** in
both builds. No artificial teleport was used; night comes from the real in-game `+1h`
QA menu button and movement from real WASD key holds.

## Verification

| Check | Result |
|---|---|
| `git apply --check` on fresh `acaa0027…` worktree | PASS |
| Fresh patched tree `npx tsc --noEmit` | PASS |
| `npm run build` (vite + singlefile) | PASS, `dist/index.html` 661.40 kB |
| `npm test` (existing gameplay suite) | **84 / 84 passing** in 5 files |
| `capture.mjs` before / after | PASS, 0 page errors, 0 console errors |
| `traverse.mjs` focused browser traversal | PASS, 510.43 px walked, HP 100, alive, I/M/B/C panels opened and closed, 0 errors |
| Real route | Net Shed spawn → south through forest → beach/surf → west along the coast → return leg; `evidence/after/traverse.json` has every waypoint |

The full 336-hour game test was **not** run; this is an environmental-art slice.

## Shortcomings (honest)

- The beach still shows the original world generator's blocky, tile-aligned sand/forest
  edge; the art layer does not reshape geometry (that would change gameplay authority).
- The engine's own animated water dashes remain on top of the authored swells, so the
  surf is still a little busier than an ideal hand-authored tileset at 1280×720.
- The 11 landmarks are a first pass: the lighthouse spit at the far west and the
  Dev Delta layout are outside the authored region and keep the original terrain art.
- Decorative props have no collision (by design, to protect routes), so the player can
  walk through the beacon's legs; they read as scenery rather than solid objects.
- The minimap / title backdrop still uses `PAL[t][0]`, so it does not show the new
  materials — only the in-world camera does.
- No creator acceptance, no claim of full-game playability, no native Godot scene/import.

## Next actionable art improvement

Author a **tracked 16px coast/forest tileset PNG** (three terrain sheets: `surf`,
`dune`, `forest_floor`, plus a landmark sheet) and feed it into `mapArtTexel` through
the same `MAP_ART_SEAM_1` hook as a palette-indexed atlas instead of procedural
per-pixel rules. That would let an artist fix the blocky beach silhouette, add real
hand-drawn wave/dune/clump shapes and animate the surf with 3–4 frames — without
touching `world.ts`, collision or gameplay, and without another renderer rewrite.

## Sources of technique

`world_lab/` GOLD MapLab research (hard-edged 16px material transitions, hue-shifted
value ladder, contact shadows, trim), the tracked prototype tilesets' coast / forest /
road material vocabulary, the tracked asset library and the 36-colour hero palette.
All sprites are newly authored pixel-by-pixel in `mapArt.ts`; no third-party image and
no GOLD world is bundled into the Web app.
