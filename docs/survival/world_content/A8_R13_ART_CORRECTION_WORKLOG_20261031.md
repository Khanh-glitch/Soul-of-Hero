# A8 R13 POI2 art correction worklog — 2026-10-31

**Disposition: `PARTIAL_WITH_BLOCKERS`.** Continue PR #26 only on `arena/2d7e6d7a-soul-of-hero`; no new POI, PR, merge, production-approval, A0 integration, A3 authorization, or human-play claim. Baseline branch head before this correction was `5bf5c8f93e5905db96f98e2f20e716e0bffbce68`; the exact correction SHA and exact-head workflow outcomes must be recorded after push. The current PR remains open/unmerged.

## Scope and ownership

- Only A8-owned site art/layout, source manifest/evidence, visual compositor, clean-capture mode, tests, and this documentation are changed.
- South Quarry remains `poi_crown_south_quarry` at A1 cell `[30,280]`; South Orchard remains `poi_crown_south_orchard` at `[140,360]`. Neither POI identity or any non-visual JSON field changed. A direct comparison against the branch baseline confirmed both site definitions are semantically identical outside `visual_layout`.
- Physical doors, blockers, collisions, approach/retreat routes, transitions, owner-projection requirements, revisit and neutral interactions are unchanged. A8 adds no reward, cost, economic/save authority, damage, drowning, hazard penalty, or inventory effect.
- A0 still owns production mounting/composition, identity, reachability, transitions, SaveService, restart/idempotency. A1 still owns canonical geography/placement. A3 still owns economic authorization. No A0/A1/A3-owned source was edited.

## Art-source reconciliation and composition

- Current A1 PR #20 art head reviewed: `e1e4e9a4d4a0f7f0d38360d638715a0c9f144208`. A8 now byte-copies the full current A1 terrain and prop atlases (1,759 terrain frames; 138 props) and uses their current frame catalogue/coordinates. Exact image hashes, dimensions, frame-catalogue hashes, and per-used-frame RGBA crop hashes are in `data/survival/world_content/a1_atlas_compatibility.v1.json`.
- Quarry composition uses ash/basalt/cinder/gravel strata, source-backed blend/fissure detail, a broad cart-return track with real east/west branches, gate/deep-route visual states, workface/ore, bracing, wheel, connected pump/tank/pipe station and a lamp that receives the exact A1 archive radial only in owner-projected powered presentation.
- Orchard composition uses forest/grass/soil transitions, orchard trees and canopy with actor-relative draw order, source irrigation hardware, bank reeds/mud, the existing fixed boardwalk and deadfall cue, a broken rail, and narrow/still versus widened/rippled flowing water. Water depth stays `UNKNOWN`; graft storytelling is foliage, not a grant.
- Creator confirms asset rights are secured. Cainos, Ocean Cainos, Chapter 1 archive/crypt and top-down dungeon files were opened and recorded by exact file/hash/frame evidence. Current A1 SOH art was selected for coherent pixel palette/view/scene semantics; the archive radial is the sole Chapter 1 crop used. The other packs were excluded for art fit, not licensing. Details are in [`A8_R13_ASSET_REVIEW_20261031.md`](A8_R13_ASSET_REVIEW_20261031.md).
- Clean source-composed, exact-pixel/idle-Hero previews (before, after, Quarry closed/powered, Orchard still/flowing) were generated at 1280×720, 2560×1440 and 3840×2160 under `.artifacts/r13-art-review/previews/`. These previews are **not native Godot captures** and are not visual acceptance.

## Local validation so far

- `python -m unittest discover -s tests/survival/world_content -p 'test_*.py'`: **PASS, 34 tests** (source-byte/frame/crop evidence, authored data, physical identity/transform, owner boundaries, and static visual contracts).
- `python3 tools/survival/world_content/author_site.py --check`: **PASS**, all 4 site files/references resolved.
- `gdformat --check` and `gdlint` (gdtoolkit 4.5.0): **PASS** on all changed GDScript/test/capture files.
- `git diff --check`: **PASS**.
- No local Godot executable is installed. No local Godot import, native physical journey, screenshot, or local screen-eye check is claimed.

## Evidence classes (must remain separate)

| Evidence class | Current status | Boundary |
|---|---|---|
| **Native input/physics journeys** | `PENDING_EXACT_HEAD_CI` | Existing continuous-input Quarry/Orchard journeys remain the oracle. Native evidence must cover approach, physical collision, transition, retreat, revisit and owner-projected states; no teleport or injected completion. |
| **Visual / rendering** | `SOURCE_PREVIEWS_ONLY_NATIVE_PENDING` | Pixel-backed Pillow previews are available, not engine evidence. Exact-head Godot captures at 1280×720, 2560×1440 and 3840×2160 still need generation, retrieval and human eye review. Harness HUD is hidden in journey/capture mode; diagnostics remain available separately. |
| **Owner integration** | `NOT_TESTED` | No A0 production composition, mount, route-reachability proof, SaveService restart, durable site-instance identity, or no-duplicate receipt proof. |
| **Human play** | `NOT_TESTED` | No human qualitative review or playthrough is represented by these source previews or fixture journeys. |

## R0–R5 review

| Layer | Status | Evidence or blocker |
|---|---|---|
| **R0 — source/provenance and contract** | `PASS_SCOPED` | Current A1 atlas source, full byte identity, frame coordinates, source-crop proofs and reviewed alternate-file decisions are recorded. Existing POI identities/anchors and all non-visual fields are preserved. |
| **R1 — code and ownership** | `PASS_SCOPED` | A8 art/data/tests/capture only; no A0/A1/A3 source edits or production authority changes. |
| **R2 — test oracle** | `PASS_STATIC_NATIVE_PENDING` | 34 Python tests, authoring check and GDScript lint pass. Godot runtime journey/capture steps still require exact-head CI. |
| **R3 — physical/rendered behavior** | `PARTIAL` | Physical contracts are unchanged by data comparison. Source previews show composition only; native collision/transition behavior and 3-resolution screenshots remain unverified on this SHA. |
| **R4 — system value/economics** | `BLOCKED_OWNER_AUTHORIZATION` | No costs/yields/rewards are added. Existing A3 authorization status remains the authority; no balance or replay claims. |
| **R5 — production composition/acceptance** | `NOT_TESTED` | A0 mount/reachability/SaveService and human play/acceptance are absent. |

## Nine strict gates

| Gate | Status | Evidence / blocker |
|---|---|---|
| `RESEARCH_PROVENANCE` | `PASS_SCOPED` | Current A1 atlas hash/head and inspected source files/frames are pinned; creator rights confirmation is respected. |
| `ARCHITECTURE` | `PASS_A8_BOUNDARY` | The art changes remain visual-only. A0 owns production mounting/transitions/identity/save; A3 owns economic authorization. |
| `CODE_RUNTIME` | `PENDING_EXACT_HEAD_CI` | Local parser/lint pass; no local Godot binary. |
| `TEST_ORACLE` | `PASS_STATIC_NATIVE_PENDING` | Static suite passes; native physical journeys must pass on the pushed SHA. |
| `VISUAL_UX` | `PARTIAL_NATIVE_CAPTURE_AND_EYE_REVIEW_PENDING` | Source-composed previews are available but do not prove engine rendering. Need clean native before/after views at all three target resolutions and human inspection. |
| `SYSTEM_VALUE` | `BLOCKED_AUTHORIZATION` | No A3-approved Quarry source/cost/yield/cooldown or Orchard grant; A8 adds none. |
| `SAVE_MIGRATION` | `NOT_TESTED` | No A8 SaveService. A0 must prove durable reload/restart/idempotency. |
| `INTEGRATION` | `NOT_TESTED` | Both scenes remain unmounted local worksite fixtures; no A0 world composition/reachability proof. |
| `BALANCE_REPLAY` | `NOT_TESTED` | No authorized outcomes, validated risk/economy terms, 14-day replay or human preference evidence. |

## Next proof steps

1. Run the exact pushed SHA through A8 native workflow; verify focused Quarry and Orchard physical-input journeys, gate/power/retreat/revisit, visual state contract, and 720/1440/2160 captures.
2. Retrieve and inspect the native player-view images; do not treat the Pillow previews or a successful image-generation step as eye review.
3. Keep visual/state tests separate from A0 owner integration, A3 authorization, and human play. Update R0–R5 and all nine gates from observed exact-head results only.
4. No merge or completion claim until the relevant owner, visual, and human gates are independently evidenced.
