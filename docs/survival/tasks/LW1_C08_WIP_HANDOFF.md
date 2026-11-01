# LW1 C08 — WIP handoff, 2026-11-01 UTC

Status: **NOT PLAYABLE / NOT TESTED / DO NOT MERGE**. Baseline PR #31 HEAD verified `fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1`; canonical rules `a8c718b55130cff29b3adc5e7c531f9211ca22df`, not the older file in PR31. Work order at `b07163ccc4009602c4bfff3435b65abb93e6ebd4`. PR31's original-main baseline comparison check was failing at inspection, other displayed checks passed; no C08 evidence follows from those checks.

## Source and reuse ledger

| Clause/component | SOH / prototype / external | Decision and remaining proof |
|---|---|---|
| D061/C08, local evidence | Skeleton `_can_detect_target`, `_has_line_of_sight`; phôi `src/sim/ai.ts:381-475` (work order analysis only) | ADAPT existing AI; no home target; real-input A/B/C pending |
| C08 movement | overworld `_process`; phôi `src/sim/reducer.ts:2389-2424` | ADAPT real movement only; no integration yet |
| C08 linked evidence | phôi `src/sim/types.ts:129-142`, `ai.ts:416-427` | WIP bounded index and direct next/previous link; synthetic unit only, not executed |
| K2 surfaces | `a0_world_authority.gd:cell_surface` | REUSE mounted A1 data; no invented biome coefficients; caller not connected |
| K8 clock/save | A0 SaveService; phôi `src/sim/offline.ts:73-142,240-249` | REUSE existing authority, persistence/clock integration missing |
| K5 collision | Skeleton physics and raycast; phôi `src/sim/navigation.ts:88-99,127-199` | REUSE existing collision; physical follow/path and obstacles pending |
| Last-known knowledge | The FOG `9c5cb03a9d9f895cd9194bcfa1b3c4821da7c4e7` | REFERENCE_ONLY, no code/assets imported; pinned LICENSE says MIT for code; separate art restrictions must be verified before any art reuse |
| Navigation | Godot demos `b761b4cd5718a7118f2c95eb55f181d0a5f004f1`, MIT | REFERENCE_ONLY; no scenes imported, no path implementation selected |
| LOS/pathfinding | rot.js v2.2.1 `46782e248c2db9d379a5e4f13bb8323f18dff04b`, GitHub registry reports BSD-3-Clause | REFERENCE_ONLY, no JS imported; pinned license contents not yet verified |
| Oracle | phôi `tests/contracts.test.ts:524-632`, line 592 inserts a trace | REJECT as real-input acceptance. Existing new test is also explicitly synthetic and is unit-only |

`ORIGINAL_ZIP_UNAVAILABLE_IN_ARENA`: attachment was not present under `/home/user`; hash and ZIP source were not directly inspected. The table uses the work order's analysis, not a claim of direct inspection. The source routes and license boundaries remain to be checked before any external adoption. Required takeover/Atlas/Docs reading is not complete. `DOCS_SYNC_PENDING` (no Docs write/readback).

## What is actually implemented

`game/survival/c08_trace_store.gd` is an **unmounted** run-local bounded spatial evidence store with explicit caller-supplied movement samples, lifetime and surface, link identity, expiry, and gap/reset handling. `tests/c08_trace_store_unit_test.gd` contains synthetic assertions. Neither has been parsed or run by Godot. They do not establish real movement, monster sensing, physics, gameplay, save, or fairness. No existing gameplay behavior is changed. This is only a starting component; in particular assess K8 timestamps, source identity, sample semantics, finite-number validation, retention/performance, and wall/door path validity before integration. `git diff --check` alone does not validate untracked files or GDScript.

## Environment / next atomic action

No `godot`, `godot4` or `xvfb-run` found. Attempted `gh release download 4.7-stable -R godotengine/godot-builds -p 'Godot_v4.7-stable_linux.x86_64.zip'`: redirect to `release-assets.githubusercontent.com` returned EOF (host outside allowed list). No native tests, image/video, 2PID or performance measurements were performed.

1. Provide/install an approved Godot 4.7 binary and run project import plus `godot --headless --path . --script res://tests/c08_trace_store_unit_test.gd`; fix failures and add bounded/invalid/eviction/expiry unit cases.
2. Read full mandated source and independently verify pinned upstream files/licenses; reconcile latest PR31 HEAD and owner state.
3. Connect truthful physics-input sampling to A0/K8 clock and real surface through appropriate owner seam; design approved save integration. Preserve default-OFF threat.
4. Adapt the existing Skeleton to sense physically local traces and follow only validated contiguous reachable links, lose knowledge on expiry/gaps, keep direct sight independent. No manually assigned target/home. Verify no traverse through physical blockers.
5. Run same-scene real-input A/B/C, existing regressions, save/new-run and two-process relaunch, performance, and real 720p visual inspection; publish truthful evidence. Until then, no C08 acceptance.
