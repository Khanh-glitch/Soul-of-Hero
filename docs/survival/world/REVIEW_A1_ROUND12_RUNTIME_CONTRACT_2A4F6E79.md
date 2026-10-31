# REVIEW — A1 Round 12 runtime/source contract — 2a4f6e79

**Scoped implementer evidence verdict:** `A1_SOURCE_READY=PASS`; isolated and both composed `NATIVE_FIXTURE_PASS=PASS`; `PRODUCTION_MOUNTED=NOT_TESTED`; `PLAYER_PLAYABLE=NOT_TESTED`; `VISUALLY_ACCEPTED=FAIL/HOLD`. **Integration route: `HOLD_INTEGRATION` pending A0 production adoption.** PR20 remains open and unmerged. This is not an independent CT product-quality signoff.

## 1. Source intent and conscious exclusions

The correcting requirement is CT review [6542806027](https://github.com/Khanh-glitch/Soul-of-Hero/pull/20#issuecomment-6542806027): preserve canonical plan/chunk/art/A8/geographic/spawn integrity while replacing mutable Knight/controller byte identity with semantic physical/runtime checks. The source anchors actually rechecked are the 1024×768 `world_plan.v1.json`, all 192 chunk manifests/files, `a1_round12_runtime_contract.v1.json`, its vendored A8 reference hashes, the derived spawn index, A0's composer/ownership fences and the exact A0/A6 actor/controller sources.

No geography, POI coordinate, route, reward, source art, region, A8 mechanic, economy, SaveService, production mount, Gold or avatar presentation was changed. D051 Male/Female Adventurers remain permitted through a physical consumer-scene override; no Adventurer visual or production-native acceptance is claimed.

## 2. Patch and dependency forensics

Native target: **`2a4f6e7964ec38e41ce3af8344f2bc3c37f48cc6`** on `arena/e385312a-soul-of-hero` / PR20. Runtime contract SHA-256: **`a1a5b736aec8c459fe56714f87f3ce17f37704e4790a18eb4b38d198b29a13ca`**. The derived index still has **27,445 cells / 20 chunks**, rebound to that whole-file contract and the canonical world plan.

Changed implementation surface:

- `a1_runtime_compatibility.gd`: `validate`, `_validate_player`, `_validate_script`; real scene/script loading, body/shape/motion/camera/input and legacy API checks, observed hashes only.
- `a1_authored_world_reader.gd`: `configure`, `_configure_runtime`, chunk/source verification and spawn-index checks; override forwarding and fail-closed derived binding/source consistency.
- `a1_authored_world_stream.gd`: optional fourth `configure` argument forwards the consumer scene; no production auto-mount.
- `compile_round12_runtime.py`: runtime-contract validation and deterministic derived generation; mutable re-pinning is rejected.
- `round12_deep_world_native_test.gd`: actual composed body loading, reader/stream setup, frame-driven routes, dynamic reload and eight executed corruption probes.
- `validate_round12_native.py`: independent report/capture/source oracle. `test_round12_deep_world.py`: source, binding, mutable-drift and oracle regressions.
- `survival-world-reader.yml`: isolated plus two exact-owner composed profiles, exact A1 event SHA, provenance/tree/scope and anti-vacuity gates.
- Contract/spawn data and A1 documentation/records only. No A0/A6-owned production file was edited.

The first new-SHA run [41198402648](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41198402648) exposed a real oracle defect: Godot reported `res://game/...` while the oracle compared literally with `game/...`. Native drivers had passed, but all three independent-oracle steps failed. Commit `2a4f6e79` normalized only resource-path spelling and added correct/corrupted observation regressions; it did not relax hashes, interface policy or refusal requirements.

## 3. Exact Godot evidence

Engine: **Godot `4.7.stable.official.5b4e0cb0f`**. Workflow: [41199262481](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41199262481).

| Profile | A0 / A6 immutable pins | Pre-import composed tree | Job | Manifest |
|---|---|---|---|---|
| Isolated A1 | Repository runtime; no composed tree claimed | N/A | [124531620666](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41199262481/job/124531620666) | `23eb972ea529d9829fd03f6492f4237d139b8af5` |
| Frozen reproduction | A0 `62f6a32d08d319bfdcd28235786558f54f49b420`; A6 `6d71410a370df805f8b29a018b61380d6c233b65` | `efb776c3e430eeb21aaad9e33add45703552a524` | [124531620685](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41199262481/job/124531620685) | `1dd48a7abae5f58c02c01eea6b61fcaf986582a6` |
| Forward | A0 `86ac20ba6ad6e80e964ef15af8f1fe48f11ee020`; A6 `6518c09835a273ac1e7b91dc5e6712d6a4c3863e` | `e844bf142e858a5de070204b87fbad8c2bcf3665` | [124531620652](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41199262481/job/124531620652) | `19eaab7c425cb7b708197af78ca9a7dd50268eb3` |

A1 is `2a4f6e7964ec38e41ce3af8344f2bc3c37f48cc6` in every row. Each composed runner verified **280 exact A1 owner files**, pinned runtime provenance and zero out-of-scope source mutations.

Each independent profile reports:

- **263 native assertions, 132 oracle checks, zero failures**; 192 verified chunks.
- 37 completed driven journeys; 36 spawn cases with 12 physical drives; 69 byte-verified captures.
- Complete reader/stream setup, source/world/frame/chunk/policy/spawn bindings, canonical per-chunk cell hashes, region accounting and 3×3 source safety.
- Real no-teleport primary route/return, A8 outer approaches/returns, warned hazard retreats, dynamic visible body/reload/refusal/detour/return.
- `SOURCE_READY=PASS`, `NATIVE_FIXTURE_PASS=PASS`; production/player/visual gates remain independent.

All eight native negatives executed and refused with the required precise reason:

| Control | Observed refusal |
|---|---|
| Plan identity | `runtime_plan_hash` |
| Chunk integrity | `source_chunk_hash` |
| A8 source identity | `dependency_hash:a8_quarry` |
| Legacy tile art | `dependency_hash:legacy_tiles_texture` |
| Spawn cell semantics | `spawn_cells_hash` |
| Stale spawn binding | `spawn_index_stale` |
| Player shape | `runtime_interface:PLAYER_BODY_SHAPE_SIZE` |
| Missing legacy-world API | `runtime_interface:LEGACY_WORLD_METHOD_IS_WALKABLE` |

The primary reader and original plan remain valid after the probes. Source gates: **160/160 world pytest**, deterministic compiler `--check`, handoff validation and diff-check. Immutable isolated evidence was fetched through the Git-blob manifest and passed the complete oracle locally as well.

## 4. Native visual truth and blind spots

The 69-capture contact sheet and full-size 720p Quarry, Ember night and Verdant day frames were opened and reviewed. The composed Quarry frame was also opened directly; all 69 same-position capture hashes are identical across the three profiles. Frames are nonblank, the technical body and source proxies are visible, and capture dimensions cover 720p/1440p/2160p.

Visual acceptance remains **FAIL/HOLD**: sparse/repetitive fields, weak night landmark contrast, abrupt/rough banks and paths, and staged proxy composition remain visible. The Knight-hosted technical body is not D051 Adventurer identity evidence. These are source-stream fixture frames, not production scenes, player reachability, A8 interiors, combat, economy, UI/UX or human playtest evidence. Headless software rendering is not target-hardware performance certification.

## 5. R0–R5 review

| Layer | Verdict | Evidence / boundary |
|---|---|---|
| R0 — primary-source intent | **PASS (scoped)** | CT correction, canonical plan/chunks/A8 references and owner contracts rechecked; no new product/design claim. |
| R1 — patch/dependencies | **PASS** | Full semantic validator/reader/stream/compiler/driver/diff inspected; mutable observations cannot become hidden pins; composed owner fences enforced. |
| R2 — test oracle | **PASS** | Eight native refusals plus independent source/spawn/capture oracle; first-run path-comparison defect diagnosed and regression-tested. |
| R3 — Godot/visual truth | **PASS native / visual HOLD** | Three exact Godot profiles pass; actual captures inspected, but listed visual defects and non-production scope remain. |
| R4 — system/value/replay | **NOT_TESTED** | No production economy, player value, 14-day replay, game feel or human usability claim. |
| R5 — decision/route | **HOLD_INTEGRATION** | A1 contract defect is closed at the cited native target; A0 production mounting and CT/independent acceptance remain separate. |

## 6. Nine independent gates

| Gate | Verdict | Scope |
|---|---|---|
| `RESEARCH_PROVENANCE` | **PASS (scoped)** | Immutable source identity and CT requirement preserved. |
| `ARCHITECTURE` | **PASS** | Immutable data separated from semantic mutable runtime; owner fences retained. |
| `CODE_RUNTIME` | **PASS (fixture)** | Isolated/frozen/forward Godot reader/stream/runtime matrices only. |
| `TEST_ORACLE` | **PASS** | 132 checks/profile, eight named native refusals, local immutable-report revalidation. |
| `VISUAL_UX` | **FAIL / HOLD** | Actual fixture frames reviewed; existing visual defects are not cleared. |
| `SYSTEM_VALUE` | **NOT_TESTED** | No productive loop or player-value test. |
| `SAVE_MIGRATION` | **NOT_APPLICABLE** | No SaveService/schema/migration change; native fixture reports no save use. |
| `INTEGRATION` | **NOT_TESTED** | A0/A6 source composition passed; A0 production mounting did not run. |
| `BALANCE_REPLAY` | **NOT_TESTED** | No balance, long-run replay or human playtest. |

## 7. One precise A0 owner handoff

**A0:** on the A0-owned integration branch, compose the native-tested A1 target **`2a4f6e7964ec38e41ce3af8344f2bc3c37f48cc6`** with A0's chosen immutable A0/A6 pins, select the compatible D051 consumer scene through the existing reader/stream override, and run A0's production-mount acceptance for actual world authority, traversal/collision/build and save behavior. Publish that production composed tree and native report before enabling the continent by default; do not substitute this A1 fixture report for that gate.

**Merge/ship outcome:** none. No production activation, PR merge or independent reviewer signature is implied.
