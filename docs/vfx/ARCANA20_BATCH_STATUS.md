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
