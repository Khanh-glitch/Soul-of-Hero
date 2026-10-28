# Hollow Marches — Verification Status

Last updated against the working branch `arena/54306b59-soul-of-hero`.

This file is the honest scoreboard. It records what was **executed**, with
numbers, and what could **not** be executed in this environment. Every claim
below was produced by a command in this repository; nothing is inferred from a
green exit code.

## 1. Engine

A Godot **4.7-stable** editor binary was built from source in this sandbox
(`4.7.stable.custom_build`, scons 4.11.1 + a local `pkg-config` shim) because
every download path to the prebuilt release asset is blocked at the network
edge (TLS failure on the release CDN; `codeload.github.com` source zips are the
only reachable Godot artefact). The binary is capable and is what everything
below ran on:

- `godot --headless --path . --import` → exit 0
- `godot --headless --path . --check-only --script res://game/overworld/<file>.gd`
  → parses for all eight overworld scripts

## 2. What was executed, and the result

Static contracts:

| Command | Result |
| --- | --- |
| `python3 tools/overworld/author.py` | `baked OK` — 384×256, 23 338 solid cells, 6 328 detail cells, 6 184 props, all ten thresholds/camps/discoveries reachable with shortcuts **closed and** open |
| `python3 tools/validate_overworld_topology.py` | `OVERWORLD TOPOLOGY VALIDATION PASSED` — 10 landmarks, 4 camps, 8 discoveries, 4 shortcuts |
| `godot --headless --path . --script res://tests/overworld_regression_guard_test.gd` | `PASSED - 82 checks` |
| `godot --headless --path . --script res://tests/overworld_static_contracts_test.gd` | `PASSED - 38 checks` |

Native behaviour (real engine, real scene, real save files):

| Command | Result |
| --- | --- |
| `... --script res://tests/overworld_scene_runtime_test.gd` | `PASSED - 29 checks` |
| `... --script res://tests/overworld_movement_runtime_test.gd` | `PASSED - 7 checks` |
| `... --script res://tests/overworld_gate_runtime_test.gd` | `PASSED - 35 checks` |
| `... --script res://tests/overworld_provisions_runtime_test.gd` | `PASSED - 15 checks` |
| `... --script res://tests/overworld_shortcut_runtime_test.gd` | `PASSED - 30 checks` |
| `... --script res://tests/overworld_persistence_runtime_test.gd` | `PASSED - 26 checks` |
| `... res://game/app/app_root.tscn -- --overworld-roundtrip-test` | `PASSED - 27 checks` |
| `... res://game/app/app_root.tscn -- --overworld-acceptance-test` | `64 checks, 0 failures` |
| `... --script res://tests/overworld_knight_mini_test.gd` | `PASSED - 4 checks` |

The acceptance run is the end-to-end one: HOME → the campaign tab's
`BƯỚC VÀO VÙNG BIÊN` button → the Marches → walk → terrain collision → a
discovery (paid once) → a camp → a shortcut (collision + sprite) → L01 enterable
/ L10 sealed → the **real** `chapter_1_level_1` → the real completion screen →
back to the Marches → progress retained → save/reload. Account currency moves
0 → 40 (discovery) → 160 (the L01 clear bundle, `account_currency = 120`).

## 3. Visual evidence — native, and green in CI

`tools/captures/chapter1_overworld_native_capture.tscn` exits **2** with
`OVERWORLD CAPTURE BLOCKED - no display server` in this container: no `Xvfb`, no
`libGL` (`ldconfig -p | grep -c libGL` → `0`), no `/dev/dri`, so no framebuffer
can be created here. That is an environment limit, not a product finding.

In CI it renders, and has since the invocation was fixed. Latest green run
[`40684317214`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40684317214)
(commit `979b23ca`), job `VISUAL EVIDENCE`, 1 m 2 s:

| Check | Result |
| --- | --- |
| control capture (a scene known to work) | exit 0 |
| `Capture stations` (Xvfb + real GL) | exit 0, `OVERWORLD CAPTURE PASSED - 13 images` |
| PNGs on disk | 13, all 1280×720, every station `blank=false` |
| `world_overview.png` | 435 737 bytes, map occupies 60%×71% of the frame |
| `shortcut_before` / `shortcut_after` | both present, 262 003 / 262 095 bytes |
| `Script/engine errors:` section of the log | empty |
| `Verify PNG artifacts (fail-closed)` | passed |

The capture's log is gated by `tools/ci/gate_log.sh` like every other step, so a
`SCRIPT ERROR` inside the capture fails the step and the `OVERWORLD CAPTURE
PASSED` line must be present. That gate is the reason this section exists: it
found three silent failures — a Godot-3-only `clear_current()` call that aborted
the overview and produced no PNG and no failure, a boot-order race that left a
real startup `ERROR` in the evidence log, and a `Camera2D.zoom` sign error that
turned the "whole world" frame into a 4×2-tile close-up that passed every
structural check.

Supporting, explicitly **non-native** evidence still exists:
`python3 tools/overworld/evidence.py` composites the shipped atlas with Pillow
at the camera's real 2x zoom into 640×360 frames and writes eleven PNGs under
`docs/overworld/evidence/` (whole-world overview, eight station frames, and the
crucible bridge closed/open pair — the pair is measured, and opening the
shortcut changes 13.7% of the frame). It proves the art and the geography are
what `author.py` authored; it does **not** prove Godot drew them, and it is never
described as a screenshot.

## 4. Known gaps

1. **Native frames are rendered but not reviewed by eye here.** CI produces all
   thirteen; this sandbox cannot download the artifact (`gh run download` returns
   `EOF` at the blob host), so the art judgement rests on the offline composites
   built from the same atlas and framing. A human should look at the CI artifact
   before calling the art finished.
2. **The ten exterior identities are authored from a shared material culture**
   (grey-violet stone, rusted iron, dried cloth, cold relay cyan) with distinct
   silhouettes and furniture per landmark. They read as one place, which is the
   point, but they are generated pixel art, not hand-painted set pieces: the
   Beacon, Gate and Throne carry the most individual detail, the Archive and
   Reliquary the least.
3. **Dungeon-interior art is untouched** — the overworld work is additive by
   design (see `REVIEW.md`).
