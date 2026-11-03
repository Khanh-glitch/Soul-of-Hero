# ARCANA #19 — primary Web transfer attempt (not playtest-ready)

## Handoff / pinned baselines

- This artifact is on the AVFX Arena branch `arena/c7b0c4e8-soul-of-hero`; it
  does **not** modify gameplay branch `arena/4795760e-soul-of-hero`.
- Exact tested gameplay HEAD: `3b37ae90601dee098066cbc4cf465552f1eb6f04`
  (PR #38). The earlier `1f1c937767007c5c21841d5f710922ff84cbb76e` was
  refreshed during the work; their `web/src/` files are identical. All final
  captures below were regenerated on the newer HEAD.
- PixelFX PR #39 head `6798b1bd9ca54f98ddaf25752e2838999951c6f8` as last
  checked. Its presentation lifecycle/depth ideas are relevant, but its atlas
  compositor is not the original ARCANA source. It modifies `render.ts` and
  `Game.tsx` too; shared-seam owner review/rebase is still necessary. This
  experiment has **not** been joined or tested against the PR #39 branch.
- `primary-19.patch` SHA-256
  `c842e38ce349a03bc4434efa1ae8500ab6a09c0847e6321d6bcd84eda930816e`.
  `git apply --check` and `git apply` succeeded on the exact gameplay HEAD
  above. The patch was tested in a separately materialized copy of that tree.
  It changes only the two small event/render seams in `web/src/ui/Game.tsx`
  and `web/src/game/render.ts`, adds `web/src/game/arcana20/**`, five browser
  scripts and one test file. It does not replace the owner's `sim.ts`,
  `engine.ts`, `catalog.ts`, map, inventory or persistence.

For an integration owner with a clean checkout of the pinned gameplay tree,
obtain the patch file from this AVFX commit and run at the repo root:

```
git apply --check /path/to/primary-19.patch
git apply /path/to/primary-19.patch
cd web && npm ci && npx tsc --noEmit && npm test && npm run build
npm run dev -- --port 4192 --strictPort
```

The test route `?arcana19Bridge=1` is only active in Vite development mode.
The patch is **not** an approved production integration and must not be
presented as a finished ARCANA skill. Browser QA uses Playwright; set
`CHROMIUM_PATH`/`SOH_URL` as needed, then run
`node scripts/qa-arcana19-rgba8.mjs`, `qa-arcana19-lifecycle.mjs`,
`qa-arcana19-primary.mjs`, and `qa-arcana19-perf.mjs`. The primary capture
script uses `ARCANA_LIGHT=day` or `night`; QA fixture grants an existing Ember
Core and creates a real boar through the game's engine APIs. It alters QA run
setup but does not fabricate HP, hits, or receipts. For the original standalone
reference use `SOURCE_HTML=/absolute/path/to/Elemental_VFX_Lab_FIXED_Standalone.html node scripts/capture-original-d19.mjs`.

## Actual functionality and honest scope

The primary game currently has four ordinary Core behaviors and no committed
ARCANA #19 gameplay item/receipt. Therefore the narrowly scoped opt-in bridge
observes a **real existing Ember Core** commit, reads the real player's
position, aim and simulation clock, and starts the D19 visual source. It does
not call, replace or pretend to be a #19 gameplay cast. Existing gameplay
remains authoritative; the boar's 200→155 HP is the ordinary Ember projectile,
not a D19 contact. The presentation adapter has per-cast source/cast/run IDs,
seed 97, simulation-time sampling, independent overlap, cancel and cleanup;
its target ID is null and anchors are frozen at cast. Owner-supplied #19 item,
cast/actor/target identities, confirmed impact receipts and moving-target
behavior are still absent. No gameplay/persistence file was replaced.

The D source-derived fixed-step commands, sprites, ribbons, nodes, star and
warp are submitted to a live-world WebGL diagnostic before the game's sorted
actors and roofs. The current world compositor is **still an incomplete LDR
port**, not a generalized semantic-pass renderer: no faithful D bloom/post,
shared source post, foreground/on-actor pass or true depth/occlusion. It is
active only by explicit opt-in. Source canvas requires WebGL2. This attempt
**does not pass the #19 milestone**, the B/#02 or A+C/#16 gates, or 20/20.

## Source boundary investigated and corrected

Original D `Renderer.frame` first writes `FLOOR_FS` to an RGBA8 scene FBO,
then additively draws the source `g` layer. The old web transfer combined the
unbounded floor result and light before tone mapping; a negative shimmer floor
could therefore subtract source emission even though the original RGBA8 write
clamps the floor first. This patch clamps the floor and then the combined scene
before the existing LDR tone-difference operation. It does **not** clamp the
warp field, suppress source shimmer, use a brightness mask, or change D source
geometry. It reproduces the stage ordering only approximately: intermediate
RGBA8 quantization, original scene post, color space and full world contract
are not yet reproduced. The ordinary prior laboratory and P0 remain unchanged.

Synthetic regression `qa-arcana19-rgba8.mjs` deliberately isolates that
boundary: one sample was RGB 59 old vs 167 corrected. This is a **synthetic
unit probe**, not a visual target or game screenshot. A matched real-scene
ablation `worldNoShimmer` is saved only as diagnostic evidence and is **never
shown in gameplay**. It indicates the source-authored floor shimmer accounts
for the observed bands in that frame; it does not justify removing shimmer.
The corrected live image remains visibly dim/banded and fails fidelity review.

## Captures actually opened

- `evidence/original-d-8.3-reference.png`: unmodified original standalone D,
  stepped to 8.3s. It contains the original lab floor/markers and post and is
  a **reference only**, not imported into the game.
- `day-climax-source.png`, `day-climax-worldLegacy.png`,
  `day-climax-worldAfterD.png`, `day-climax-worldNoShimmer.png`,
  `day-climax-full-1280.png` and `night-climax-full-1280.png` were opened.
  The source star is bright; after world composition it is muted, and the
  later actor/roof and especially night-light passes obscure it further.
  These are **not** matched screenshots of the original world and cannot prove
  parity. The other per-stage, opening/build/OUT screenshots are available in
  `evidence/`. `source` is 480×270; world stages are 640×360; the full game
  screenshots are 1280×720 with the real DOM HUD.
- Day/night source times and fixture/charge/HP logs are in `day-run.jsonl` and
  `night-run.jsonl`; source times around climax were 8.42/8.43s, not exactly
  8.3s. Weather and game state differ from the standalone reference.

## Checks and limitations

- Latest target + patch: `npm ci`, `npx tsc --noEmit`, `npm test` **22/22**,
  `npm run build`: PASS. `npm ci` reported six dependency advisories (1 low,
  1 moderate, 2 high, 2 critical); no dependency audit fix was applied.
- Actual primary-game input: QA fixture core charge 3→2, one `core.commit`
  receipt; real boar HP 200→155; a single Ember projectile hit; D visual
  naturally retired and no page exceptions. Day and night passed. These are
  **Ember** gameplay facts, not #19 combat or source parity.
- Real pre-commit right-click cancel: charge stayed 3, no visual. Two Ember
  commits: two casts coexisted, charge 3→1, two receipts. Explicit dev
  `cancelAll()` retired visual states; isolated unit tests separately check
  per-cast cancel, overlap, run change and natural retirement. A real owner
  #19 cancellation, moving target and complete visual cleanup are unverified.
- Non-capture timing on the latest target, Linux headless Chromium/SwiftShader,
  one run to 2s: baseline rAF p50/p95 66.6/150ms, with cast 116.7/216.7ms;
  source generation p50/p95 0.1/1.1ms, raster 0.3/1.1ms, CPU-observed
  compositor submission 1.4/3.8ms (GPU work may be deferred). Single noisy
  software sample, not a target-GPU benchmark. Capture-run timing is polluted
  by screenshot/readback and must not be used as performance evidence.
- Target gameplay baseline CI: [shipping](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41568509791/job/125695680617), [dev_delta](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41568509791/job/125695680734), [salt](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41568509791/job/125695680518) all PASS. These ran on the gameplay branch **without** this patch. No remote CI run of this patch is claimed.
- Automatic WebGL software fallback and Canvas readback warnings were observed;
  no `/dev/dri` and no measured real GPU. No creator approval or quality tier
  approval. A startup race in the baseline app reproduced twice under immediate
  automated launch; waiting for title initialization allowed both final runs;
  underlying gameplay-start issue was not changed or conclusively diagnosed.

## Next exact action

Coordinate an owner-authored #19 cast/receipt event and true actor IDs/anchors;
then build one shared same-frame world/actor/HDR/post owner that preserves the
original D scene/FBO ordering and the real HUD boundary. Compare fixed-tick D
scene/post intermediates against the original source and actual game before
adding #02/#16. Do not declare the transfer ready based on this partial fix.
