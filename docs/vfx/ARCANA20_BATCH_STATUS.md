# ARCANA20 batch import — status matrix (2026-11-03)

Pipeline: `web/src/game/arcana_d20/source/c/` vendors the source-C package
(engine + all 20 spells) **unmodified**; `cRunner.ts` runs each SpellDef on the
C Frame with the real SOH world region as ground/base and composites on CPU
with the source `gl.ts` MAIN_FS equation; presented as one `frame` layer via the
existing single WebGL2 presenter (`arcana_lab.ts`). #20 keeps its A+C semantic
bridge (`arcana20.ts`). Catalog + selector in FX Lab (F9). All visual-only QA;
no HP/charge/save changes.

| # | Skill | Status | Note |
|---:|---|---|---|
| 01 | Cinder Crown | FUSION_PREVIEW | A+C recipe per vote; C preview shown |
| 02 | Furnace Wyrm | SOURCE_PREVIEW | single lead B (C preview shown as source study) |
| 03 | Meteor Loom | SOURCE_PREVIEW | single lead B |
| 04 | Ashen Guillotine | REDESIGN_STUDY | creator rejected all; study preview only |
| 05 | Abyssal Bloom | FUSION_PREVIEW | A+C |
| 06 | Riptide Calligraphy | REDESIGN_STUDY | rejected |
| 07 | Mirrorfrost Basilica | SOURCE_PREVIEW | C |
| 08 | Undertow Maw | SOURCE_PREVIEW | B |
| 09 | Chain Verdict | FUSION_PREVIEW | A+B+C |
| 10 | Thunderloom | SOURCE_PREVIEW | C |
| 11 | Volt Carousel | FUSION_PREVIEW | A + C(#9) |
| 12 | Skybreaker Script | REDESIGN_STUDY | rejected |
| 13 | Rootwake | REDESIGN_STUDY | rejected |
| 14 | Spore Nebula | REDESIGN_STUDY | rejected |
| 15 | Thorn Opera | SOURCE_PREVIEW | C |
| 16 | Worldseed | FUSION_PREVIEW | A+C |
| 17 | Event Horizon | SOURCE_PREVIEW | C |
| 18 | Chronoshard | REDESIGN_STUDY | rejected |
| 19 | Constellation Engine | SOURCE_PREVIEW | D lead kept via #19 pipeline; A combat later |
| 20 | Reality Ripper | FUSION_PREVIEW | semantic A+C bridge (donor spell on C Frame) |

Counts: 8 SOURCE_PREVIEW, 6 FUSION_PREVIEW, 6 REDESIGN_STUDY = 20 registered.
All 20 verified runnable (tests/arcana-d20-semantic.test.ts batch test) and
captured in `web/evidence/avfx-20/gallery-*.png` (CI WebGL2 run for GPU frames).
Blockers: none. A/B/D native adapters ARE vendored and routed (phases 2-4); fusions use the semantic contribution contract.


## Phase 2 (source-correct import, per CT 6604192200)
Reusable native-semantic adapters — no per-spell shader rewrites:
- `source/a/` + `aRunner.ts` — vendored A Lab (416x234 HDR, fixed-step sim), world injected as arena background.
- `source/b/` + `bRunner.ts` — vendored B CPU HDR renderer (384x216), world injected as floor albedo.
- `source/c/` + `cRunner.ts` — unchanged. D: existing D19 bridge; #19 routes to it. #20 routes to the A+C semantic bridge.
Manifest now separates `approvedVisualLead` / `currentlyRenderedSource` / `fusionStatus` / `artAcceptance`; FX Lab (F9) has per-skill lead / C-study / fusion? modes.

Honest counts: 20/20 accessible; source-faithful leads implemented = 10 (B #02/#03/#08, C #07/#10/#15/#17, D #19, A #11, A+C #20); fusion candidates assembled = 5 (#01/#05/#09/#11/#16, CANDIDATE_ONLY_NOT_APPROVED); redesign study = 6 (#04/#06/#12/#13/#14/#18, nonfinal). F9 (not F4) opens the lab.


## Phase 3 (semantic fusion recipes, per CT 6606101609)
- `source/fusionRecipe.ts` — ONE data-driven recipe engine: each recipe declares
  lead component + secondary components with engine/skillId/role/phase. Compose =
  one world base, lead structure render, secondary components merged as SIGNED
  DELTAS vs the same world (never RGB-averaging composited frames; center-aligned,
  no top-left crop). Recipes: #01 A#01+C#01, #05 A#05+C#05, #09 A#09+C#09+B#09,
  #11 **A#11 + C#09 arcs** (phase 0.25-0.95), #16 A#16+C#16. #20 keeps its A+C bridge.
- Routing fixed: #11 lead = pure A#11, study = C#11, fusion = A#11+C#09 recipe.
- Source-window boundary feathered into the real world (14px smoothstep ramp on the
  frame region edges) — B #02/#03/#08 no longer show a hard dark rectangle.
- QA: gallery 20 + phase-3 trio gallery-11-lead/study/fusion + gallery-02-lead.
- Counts: 20/20 accessible; 10 source-faithful leads (B3 C4 D1 A#11 A+C#20);
  5 recipe candidates; 6 redesign studies (nonfinal).


## Phase 4 (source-contribution contract, per CT 6607037204)
- `sourceContract.ts` + `CRunner.extractArcs/extractLight` + `ARunner.anchorsFor/renderWithContributions`:
  recipe components now declare `extract: 'arc' | 'light'` and roles actually control
  extraction. 'arc' captures the source spell's AUTHORED bolt draw events (polyline +
  probed core/halo light via a recording Frame proxy), remaps each arc's endpoints onto
  the LEAD spell's MOVING anchors (similarity transform, shape preserved) and replays
  them with the lead engine's own line primitive. 'light' uses the source's pure HDR
  light channel on a black world. No complete source RGB imagery is ever composited.
- #11: lead = pure A#11; study = C#11; fusion = A#11 + C#09 arc packets bound to A#11
  ring connectors (segPos) at every phase. Proven at 3 phases (t=1.0/3.0/5.3): packets
  extracted, anchors move, fused frame differs from pure A lead. Same machinery for
  #01/#05/#09/#16. #20 keeps its A+C bridge. 14px edge feather kept for B window.
- QA: gallery-11-{lead,study,fusion} + 6 phase captures gallery-11-{open,build,peak}-{lead,fusion}.
- Tests 118/118. PR #39 unmerged; no gameplay changes.


## Root-cause closure (CT 6608364694)
Fail-closed contract enforced at the boundary: world snapshot (exact size, current
camera/cast context) is mandatory for every fusion render — missing/wrong input
throws, no stale/lab fallback. Arc mapping requires >=2 DISTINCT anchors and
rejects degenerate pairs; #09 uses A arena anchors, #11 uses A#11 moving segPos.
Signed HDR light preserved (incl. negative-only); ink/displacement/mask/fragments
declared UNSUPPORTED (CAPABILITIES), never approximated as RGB. validateRecipe
rejects bad engine/skillId/role/extract/phase before rendering; cold-start uses
real source duration (no `|| 1`). Lifecycle: cast/seek-back/OUT/recast reset state.
Evidence classes: 141/141 tests (parameterized 5-recipe matrix + negative tests),
QA gallery incl. #09 fusion/OUT/recast, B#02 day/night, #11 3-phase lead/fusion,
#01/#05/#16 fusions on real WebGL2 CI artifact.


## Final contract round (per CT 6618842670)
- **B source window eliminated at the channel boundary**: BRunner renders the effect
  twice per frame (with/without the effect) at natural ambient and composes
  `world + (effectFrame - baseFrame)` — the source tonemap/ambient curve cancels,
  untouched world pixels are EXACT, effect-local shade/decals/lights/sprites are
  preserved. The 14px feather is now a no-op safety net, not the fix.
- **Capability-aware fail-closed validation**: CAPABILITIES declares lead=A only,
  extract per engine (B: light; C: arc+light), ink role UNSUPPORTED — invalid
  recipes throw named errors before rendering.
- **Per-engine source clocks**: each component samples its own engine's duration
  (B#09 uses B's 8.5s, not C's 7.8s).
- **World-snapshot revision in the render cache**: same tick+camera with a changed
  world (day/night) re-renders — no stale baked frames.
- **Authored arc width** preserved via A streak() with the captured ribbon width.
- Tests 146/146 incl. negative validation, B-boundary pixel-exactness, #09
  nondegenerate arcs, per-engine clocks. PR #39 unmerged.


## Visual quality completion (per CT visual directive)
- **6 REDESIGN slots implemented as NEW authored compositions** (`source/redesign.ts`,
  built from vendored C primitives — not copies of rejected A/B/C spells):
  #04 diagonal guillotine cut with delayed rupture + directional cracks,
  #06 calligraphic water strokes + pool, #12 sky rune ring + verdict bolt,
  #13 branching root canopy with glowing tips, #14 spore nebula bloom,
  #18 chronoshard fall/split/clock-sweep. Each has anticipation→peak→impact→aftermath→OUT
  and returns the world unchanged (tested). Status: REDESIGN_IMPLEMENTED_CANDIDATE
  (creator approval still pending — not claimed final).
- FX Lab (F9): timeline scrub slider + open/peak/out phase jump buttons.
- Offline pixel inspection: scripts/render-offline.ts renders all 20 lead frames
  via the CPU runners; evidence/offline-inspect/ has per-spell PNGs + contact sheet.
- B window fix verified in pixels (B#02 serpent on un-darkened world).
- Tests 152/152. PR #39 unmerged; no gameplay changes.


## Deterministic lifecycle rework (RCA 6620636979 -> CT decision 6620732812)
- **RED on frozen a4c2ea4** committed as evidence (`evidence/rca/RED-a4c2ea4-lifecycle.txt`,
  `tests/arcana-lifecycle-contract.test.ts`): identity wrap to C#20 on backward seek,
  non-deterministic reseed hashes, OUT residue — all reproduced.
- **Root fix (one contract, not 6 patches)**: CRunner first-class custom registration
  (`registerCustom`/`castCustom`): fixed per-spell seed, owned duration/climax,
  `recast()` on backward seek rebuilds the SAME custom instance. RedesignRunner casts
  only on id change; arcana_lab uses authored redesign clocks. seekAsync handles
  backward seeks. OUT gate: redesigns draw nothing at/after declared dur, so output
  is bit-identical to the no-effect baseline through the same compositor.
- **GREEN**: 161/161; per-spell report `evidence/offline-inspect/redesign-after/
  lifecycle-report.txt`: all six backward==mid and OUT==baseline:true.
- Art status: 6 redesigns + 5 fusion candidates = **CANDIDATE_AWAITING_CREATOR_REVIEW**
  (technical PASS only, no art GOLD). PR #39 unmerged; PR #38 owns gameplay.

## Active-frame source-window closure (CT decision 6622564987, frozen baseline 354054e)
- **Root cause (demonstrated, not guessed)**: the C/redesign frame path pasted the
  runner's fully composited 384x216 window opaquely into the region (presenter
  `FRAME_FS` replace). The source compositor applies FULL-FRAME ops (fx.flash /
  shake / kick) to the whole source window, so at peak/impact ~92-94% of ALL window
  pixels changed vs the scene, including the 14px edge ring (edgeMean 10-24,
  edgeMax up to 235) -> straight-edged "pasted window" rectangle. Measured on the
  real captured SOH world region (fixtures in `evidence/avfx20-rect/fixtures/`).
- **Fix (shared seam, no per-spell repaint)**: the lab now submits a SIGNED delta
  `active - noEffectBaseline` (baseline is bit-exact == raw world sample, asserted)
  plus an effect-local influence mask from the live source Frame channels
  (HDR light incl. negative, ink, displacement, ground decals; full-frame ops are
  NOT in the mask). `FRAME_FS` renders `scene + delta * influence` (texelFetch
  orientation, consistent with COMPOSITE_FS). B/A/fusion lead paths keep the
  legacy opaque+feather contract (controls unchanged). The 14px feather is no
  longer used on the C/redesign path.
- **Result (CPU emulation of the frame graph, real world, day+night, all six
  redesigns x open/peak/impact/out)**: edge ring change collapses (e.g. #4 day peak
  edgeMean 16.2 -> 3.1, fracChanged 0.93 -> 0.20; #14/#18 peak edgeMean -> 0.0);
  OUT bit-identical to scene; backward-seek/replay delta bit-identical; negative
  (darkening) delta preserved. Evidence: `evidence/avfx20-rect/` (before/after/raw
  PNGs + rect-evidence.json), regression suite `tests/arcana-frame-delta.test.ts`.
- **Tests**: 175/175 (161 previous + 14 new), tsc clean, vite build clean, QA
  fallback smoke clean. Real WebGL2 (software) before/after gallery: CI
  reality-ripper-20 artifacts at the pushed SHA (see PR #39).
- Art status unchanged: 6 redesigns + 5 fusions = **CANDIDATE_AWAITING_CREATOR_REVIEW**.
  PR #39 unmerged; PR #38 owns gameplay; technical pass only.

## GL 1282 minimal root-cause fix (CT decision 6624135398, RCA comment 6624082177)
- **Fix (one seam, both frame modes):** in `present()` the frame branch now binds the
  integer sampler `infl` to a valid R8UI texture (`inflFrameTex`, unit 2) in BOTH the
  signed-delta and the legacy path — previously the legacy path left `infl` at unit 0
  (RGBA8 accumulator), a sampler-type mismatch that made the first legacy frame draw
  raise GL_INVALID_OPERATION (1282). Inert when `signedDelta=0` (shader never samples).
- **Instrumentation:** presenter records `firstGlError {code, stage}` + `glErrHistory`
  via `checkGl(stage)` after world-upload, accum-seed, each layer draw
  (`layer:<kind>:<i>:signed|legacy`), zero-cast post, final post, and frame uploads.
  Errors are recorded, never silently consumed.
- **CI gate:** `qa-avfx-20.mjs` exits 3 unless `glError===0` and `firstGlError` is null
  (plus existing page-error exit 1); same gate added to `qa-avfx-m1.mjs`. Fallback mode
  (no GL) records 0/null and still passes.
- **Validation coverage in qa-avfx-20 (real WebGL2 on CI):** all 20 lead casts (B#02
  day/night, C leads, A leads, redesigns), #11 lead/study/fusion + motion phases,
  #09 fusion + OUT + recast, fusions #01/#05/#16, legacy<->signed switching across
  the gallery loop, zero-cast frames, #20 replay scenes. Unit suite unchanged:
  175/175, tsc clean, build clean.

## GL 1282 eliminated — undersized placeholder uploads guarded (CT 6624135398)
- **Runtime-confirmed first error stage** (per-stage `checkGl` instrumentation, stage
  encoded into the QA gate exit code readable from check-run annotations):
  avfx-20 exit 111 = `layer-warp-upload:0` → the generic per-layer code uploaded
  `L.warp` at fixed 480×270 RGBA32F, but frame layers submit a 4-element placeholder
  (`warp: new Float32Array(4)`) → undersized `texImage2D` → GL_INVALID_OPERATION.
  m1 exit 108 = same class via the R8UI influence upload. The earlier `infl` sampler
  binding fix (R8UI on unit 2 in BOTH frame modes) is kept — it was a real latent
  mismatch — but the first producing call was the placeholder upload. Note: the old
  `lastGlError` only reflected the LAST frame, so the BEFORE artifact's glError=0 did
  not prove the run was error-free; the new cumulative `firstGlError`/`glErrHistory`
  records the first error + stage for the whole session.
- **Fix:** warp/influence uploads now happen only when the buffer is full-size
  (480*270*4 floats / 480*270 bytes); placeholder layers keep the previous texture
  content, which their shaders never sample. Signed-delta frame contract unchanged.
- **CI 4/4 SUCCESS at `bb396d0` (run 41786966833→… see PR) with the GL gate active:**
  qa-avfx-20 / qa-avfx-m1 exit 3 unless `glError===0` AND `firstGlError===null`
  (stage encoded in exit code: 101-112). All jobs green ⇒ zero GL errors across
  B#02 day/night, #09/#11, C leads, all 6 redesigns, mode switching, zero-cast, OUT,
  replay, D19 ticks. Unit suite 175/175, tsc clean, build clean, fallback smoke clean.
