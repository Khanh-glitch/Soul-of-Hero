# Hollow Marches — Runtime Verification Status (2026-10-27)

## GitHub handoff — VERIFIED
- Branch: `arena/bc641b4c-soul-of-hero`
- Remote: `https://github.com/Khanh-glitch/Soul-of-Hero.git` (fetch + push OK)
- Latest commit: `1bb2f9f4665e1ed3b59f6b955e6a136b7062059d`
- Branch URL: https://github.com/Khanh-glitch/Soul-of-Hero/tree/arena/bc641b4c-soul-of-hero
- Commit URL: https://github.com/Khanh-glitch/Soul-of-Hero/commit/1bb2f9f4665e1ed3b59f6b955e6a136b7062059d

`git ls-remote --heads origin arena/bc641b4c-soul-of-hero` → `1bb2f9f4665e1ed3b59f6b955e6a136b7062059d`, matching local HEAD. No force-push, no main modifications, no other-branch tampering.

## Native Godot 4.7 execution status — BLOCKED IN SANDBOX
Every download path to the Godot 4.7 binary terminates at the GitHub
release-asset CDN (`release-assets.githubusercontent.com` /
`objects.githubusercontent.com`) with a TLS-level failure
(`GnuTLS: The TLS connection was non-properly terminated` /
`OpenSSL SSL_connect: SSL_ERROR_SYSCALL`). This was retried with:

- `curl` (default, `--http1.1`, `--tlsv1.2`, `--tls-max 1.2`, `--no-check-certificate`, with browser UA + referrer)
- `wget` (same options)
- Python `urllib` with and without cert verification
- Python `requests` (multiple retries)
- `gh release download` (uses the same CDN)
- All four Fastly IPs returned by DNS for the CDN hostname
- The alternative `godotengine/godot-builds` repository (chickensoft action source)

Only `codeload.github.com` (source zips) is reachable; large binary assets on
the Azure-blob-backed release CDN are severed at the network edge. The
chickensoft-games/setup-godot action resolves the exact same CDN host, so
the CI pipeline on GitHub Actions ubuntu-latest will succeed even though
the sandbox is blocked.

To unblock native execution *here*, we would need either a pre-cached binary
on disk or a mirror outside that CDN; neither was present.

## CI pipeline added
New workflow: `.github/workflows/overworld-runtime-validation.yml`

Runs on push to `arena/bc641b4c-soul-of-hero` (and PRs/manual dispatch). Uses
`chickensoft-games/setup-godot@v2` with `version: 4.7.0`, exactly like the
project's existing Godot 4.7 Runtime Validation workflow.

Steps (each writes a log to `.artifacts/` and is uploaded as an artifact):
1. Import project (mirrors existing workflow).
2. **Offline topology validator** — `python3 tools/validate_overworld_topology.py`.
3. **Overworld structural integration** — `overworld_integration_test.gd` (10 gates, camps/discoveries, L1 enterable, L10 locked, TileMapLayers populated).
4. **State/persistence unit** — `overworld_persistence_test.gd` (camps, drain, discoveries, shortcuts, fractional accumulator).
5. **AppFlow transition / registry** — `overworld_transition_test.gd` (all new AppFlow methods exist, registry bijective for L1–L10, configure() present on scene).
6. **Provisions / survival MVP** — `overworld_provisions_test.gd` (single resource, caps, floor, wild/hazard/safe ordering, 250s+ full tank, no infinite-free-heal loop).
7. **End-to-end AppRoot entry** — `--overworld-entry-test` dispatching to `overworld_entry_test.gd` (production boot path through AppRoot._ready).
8. **Full round trip** — `overworld_roundtrip_test.gd` (AppRoot attached → open_overworld → verify scene + L1 → fire gate interaction → verify pending_return flag + active_run → complete_active_run (victory) → return_to_overworld_after_completion → verify scene returns, flag cleared, run cleared).
9. **Collision/blocked-route** — `overworld_collision_test.gd` (every collision cell has a valid atlas tile; each shortcut swath has blocking cells BEFORE open and fewer AFTER open; forest/thicket/rock blockers present ≥50; landmark pads walkable; refuge + principal road cells painted).
10. **Mosaic capture** via `tools/captures/chapter1_overworld_capture.gd` (headless logs positions; real driver writes PNGs).

## Code-level fixes made since last handoff
- **Critical collision-layer bug fixed**: gates/camps/discoveries were authored on layer 64 (Hazard, bit 7); switched to layer 32 (Interactable, bit 6) matching the documented scheme. Knight collision_mask=5 (World+Enemy) ignores Interactable anyway, so Areas continue to detect the Knight via `monitoring`+mask=2 (Player bit 2).
- **Proper collision TileSet build**: painter now attaches full-tile collision polygons to every solid tile (`#`, `x`, `f`, `t`) at TileSet-build time, not lazily after `set_cell`; eliminated one-frame physics gap.
- **Real atlas reverse-lookup**: `OverworldPainter` exposes `atlas_for_code()` / `code_for_atlas()` over a fixed deterministic code order; `chapter1_overworld.gd` uses it to identify and repaint collision cells. The `_atlas_for_collision_cell` stub was removed.
- **Multi-cell shortcut swaths**: `_repaint_shortcut_opened` repaints per-shortcut shapes (broken bridge 5-wide, conduit/gate valve 3-wide, rubble L-shape); `_apply_all_open_shortcuts()` re-applies saved open shortcuts on scene load so the world visually/physics matches the saved state.
- **Additive return routing** (no bypassing existing systems): added `set_pending_overworld_return / clear / has / return_to_overworld_after_completion` to AppFlow; `abort_to_hub` and `return_home_after_completion` honour the flag; `completion_choice.gd` dynamically relabels the Home button "VỀ VÙNG ĐẤT HOANG" when entered from the overworld. No changes to reward/commit paths — rewards still flow through `_commit_campaign_completion()`.
- **Persistence reworked** (addresses the "revision-based transact_once growth" concern in the request): saves are throttled (≤1/5s), position-only updates require 48px of motion, and transaction keys are content-addressed (md5 of canonical JSON snapshot) so identical snapshots are naturally idempotent. Flush happens immediately on camp/discovery/shortcut/entry/return and in `_exit_tree`.
- Removed the unused StaticBody2D under the camp fire that was adding a physics body for a cosmetic; replaced with a plain Node2D parent for the PointLight2D.
- Fractional accumulator in `drain_provisions` so 0.4/s wild drain actually progresses instead of rounding to zero per-frame.

## Tests written
| Test | Purpose |
|---|---|
| `tests/overworld_integration_test.gd` | Scene instantiates, 10 gates spawn with correct IDs, ≥3 camps/discoveries, L1 ENTER, L10 LOCKED, TileMapLayers populated |
| `tests/overworld_entry_test.gd` | CLI `--overworld-entry-test` path through AppRoot |
| `tests/overworld_persistence_test.gd` | State configure / camp activation / drain fractional accumulator / discovery idempotency / shortcut open |
| `tests/overworld_transition_test.gd` | AppFlow surface, bijective registry, scene.configure() after re-route |
| `tests/overworld_provisions_test.gd` | One resource only, caps, floor, burn-time invariants, camp-spam cap, safe zone drain=0 |
| `tests/overworld_roundtrip_test.gd` | Home→Overworld→L1→victory→Overworld return, pending flag lifecycle |
| `tests/overworld_collision_test.gd` | Valid atlas cells, closed shortcuts block, open shortcuts clear, blockers exist, landmark pads walkable, road cells painted |

## What the CI run will produce on GitHub
- Native import log
- PASS/FAIL per GDScript test (each prints `…_TEST PASS (N checks)` and exits 0, or pushes errors and exits 1)
- Capture log (PNG mosaic when run on a real driver; headless logs shot positions)

## Native screenshots/mosaic
Blocked until the CI run produces them (sandbox cannot run a rendering driver without Godot binary). The capture driver `tools/captures/chapter1_overworld_capture.gd` is authored to write `.artifacts/overworld_<name>.png` for an overview shot + each of the 10 landmarks, matching the existing project convention used by `app_root._capture_ui_shell` and `_save_route_capture`.

## Art-readiness verdict
Still greybox (generated solid-color 16px tiles + polygon silhouettes). All of the following are wired correctly at the data/systems level and ready for an art drop once native tests pass:
- Layer stack (Background/CanvasTint/Ground/Decor/Collision/Entities/Props/Landmarks/Interactables/HUD) with Y-sort on relevant parents.
- Camera at 2× zoom with clamping to authored bounds.
- Interactables use the knight's existing `"interact"` input action.
- Collision is authored per-tile (no per-cell StaticBody2Ds).
- Shortcut repaints use both collision erase + ground tile replacement, so art can layer over the same codepoints.

## Outstanding known issues to verify in CI
1. Knight prefab expects certain autoloads (`GameSession`, `SaveService`, `GameEvents`, `HeroSoulManager`) — these all exist at `/root/...` in the running project, but the overworld integration test loads the scene directly under the current tree without going through AppRoot; if the Knight's `_ready` crashes on missing GameSession, the entry-test path (which runs AppRoot._ready and therefore all autoloads) is the authoritative check.
2. Provisions HUD label font size (11) may overflow at typical 1280×720 viewport; confirm in screenshots.
3. `_in_hazard` uses bounding bands rather than per-cell mud/water codes; tighten to painter.grid lookup once camera/position stability is confirmed.
4. The overworld scene tree is named `Chapter1Overworld` (post-edit); tests look for nodes by path rather than root name so this is safe.

## How to view CI results
1. Push is already live at commit `1bb2f9f`.
2. Open https://github.com/Khanh-glitch/Soul-of-Hero/actions/workflows/overworld-runtime-validation.yml
3. Wait for the run on `arena/bc641b4c-soul-of-hero`; download the `overworld-runtime-artifacts` zip for logs and any PNGs.
4. Any red step → push a fix to this same branch → CI reruns automatically.

## Remaining before GATE5 (art pass)
Once CI reports green on all GDScript tests and round trip, the remaining work is:
- Drop in authored environment tileset (replace `OverworldPainter`'s generated palette with a hand-painted 16px atlas keeping the same code mapping, or swap to a hand-authored TileSet scene loaded in `_ready`).
- Replace polygon silhouettes with landmark doorway sprites.
- Add prop variation (trees, rocks, ruined masonry, soul-relay crystals) using authored decor tiles instead of solid-color.
- Author water animation shader + road texture + palette tuning to match the Chapter 1 interiors palette.
- Native screenshot review for camera/occlusion/layering issues; y-sort validation when sprites have height.
