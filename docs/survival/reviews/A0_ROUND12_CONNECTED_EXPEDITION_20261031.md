# A0 Round 12 — connected player expedition, native evidence at `4367edb6`

Status: **DRAFT FOR PR #21. Not B0. Not merged.** Every number below was produced
by running the code in this branch on a locally built Godot 4.7
(`4.7.stable.custom_build`, built from the 4.7-stable tarball in this sandbox).
Where an obligation could not be executed here, it says NOT_TESTED and names the
reason; nothing is inferred from a method existing.

## 1. What the PLAYER can actually do after this SHA

| Step | State after this SHA | Evidence |
| --- | --- | --- |
| New game → identity → Home (A6 flow) | available in the composed tree | A6-owned; A0 seat check + A6 suites |
| Walk with real keys, gather scrap/wood/reed | **yes** | `survival_normal_input_gather_test` 19 checks pass before the pointer-placement leg |
| Craft the starter kit at the real station, collect it | **yes** | same run: 20 checks, incl. escrow + GUI collect |
| Place a paid workbench by clicking a cell | **NOT TESTED here** — blocked by the sandbox, not by the code (see §5) | run stops at this check with a measured pointer trace |
| Stone pick → wear → iron harvest → durable save → relaunch | **yes** | `survival_a0_player_return_test` 26 + 17 checks over two OS processes |
| Funded offline job, settle/claim once after a relaunch | **yes (economy/tool scope)** | `survival_a0_tool_and_offline_test` 47 + 9 |
| Run identity, 264 h/336 h boundaries, rollback refusal | **yes** | `survival_a0_run_lifecycle_test` 49 + 14 |
| One world-owned threat that really damages the player | **yes, and it is optional (default off)** | `survival_a0_production_threat_test` 25 + 15 |
| Die to that threat and wake in the bed with a recoverable bag | **NO — not reachable at current balance**; death/bed routing is proven only by the labelled deterministic probe | `survival_a0_damage_death_probe_test` 19 + 11 (composition probe, not combat) |
| Mount an A8 POI at its A1-authored cell | **NO — A1's runtime world does not reach any A8 site**; the authority refuses with a named reason | `survival_a0_poi_mount_test` 31 |

## 2. Native command set and results (one process per suite)

Godot binary: `/home/user/godot-native/src/bin/godot.linuxbsd.editor.x86_64` (4.7.stable.custom_build).

```
godot --headless --path . --script res://tests/<suite>.gd [-- <flags>]
```

| Suite | Flags | Result |
| --- | --- | --- |
| `survival_foundation_test` | — | **PASSED 144 checks** |
| `survival_a0_pin_fence_test` | — | **PASSED 10** |
| `survival_a0_profile_port_test` | `--keep-profile` / `--verify-profile` | **PASSED 49 / 15** |
| `survival_a0_run_lifecycle_test` | `--survival-run-clock-test --keep-run` / `… --verify-run` | **PASSED 49 / 14** |
| `survival_a0_tool_and_offline_test` | `--keep-tool` / `--verify-tool-offline` | **PASSED 47 / 9** |
| `survival_a0_player_return_test` | `--keep-return` / `--verify-return` | **PASSED 26 / 17** |
| `survival_a0_damage_death_probe_test` | `--keep-death` / `--verify-death-probe` | **PASSED 19 / 11** |
| `survival_a0_production_threat_test` | `--keep-threat` then `--verify-threat --keep-threat` | **PASSED 25 / 15** |
| `survival_a0_poi_mount_test` (composed tree) | — | **PASSED 31** |
| `survival_normal_input_gather_test` | — | **FAILED 1/20** at `ordinary placement input pays for the physical workbench` (see §5) |
| `survival_normal_home_journey_test` | — | **FAILED 1/20**, same single check |
| `survival_normal_entry_home_restart_test` | — / `--verify-separate-process` | **FAILED 1/34**, same single check (33 pass) |
| composed import | `--import` | clean: 0 `SCRIPT ERROR` / `Parse Error` |

A defect found and fixed by running: a suite that overrode its own console exited
`PASSED` after a GDScript error killed the body. The threat suite now asserts the
body completed, so an error can no longer read as a pass.

## 3. Producer threat (WP-A0.3)

`game/survival/a0_threat_mount.gd` mounts **one** shipped `SkeletonEnemy` through
the existing optional-encounter seam, behind `survival/a0_optional_threat`
(default **off**). Measured run:

- placement: site cell `[82, 227]`, 26 tiles from the spawn, chosen by 123 live
  probes through the seam's own `validate_site` (no hard-coded coordinate);
- one enemy in the whole world, `score_reward == 0`, `loot_drop_processed` sealed,
  durable pre-spawn receipt kept;
- real damage through the Hero's own i-frame: **5 hits, 14 contact damage each,
  1100 → 1016 HP**; no score, no inventory change, no death counter;
- after ~5 hits the seam frees the enemy past its 160 px leash and does not
  re-arm while the player stands inside 320 px, so the engagement ends;
- second process with the setting off: no encounter node, no enemy, no extra
  death, no bag, no transaction, same run id/epoch and same score.

**Honest limits.** With contact damage 14 against a 1100 HP Hero inside a 160 px
leash, this source cannot kill a full-health player. A lethal demonstration would
need either injected damage (forbidden this round) or an authorised damage/leash
balance change (A3/A5 authority). So player death from this source is
**NOT_TESTED**; the durable death/bag/bed path is exercised only by the labelled
deterministic owner-composition probe (`survival_a0_damage_death_probe_test`),
which is reported as a composition probe, never as combat.

## 4. Player journey and economy (WP-A0.2 / WP-A0.4)

- Fresh run: bare-handed stone outcrop → 3 stone chunks, oak → 2 wood, hand recipe
  queued (`job_000001`) reserving exactly `oak 2→0, stone 4→1`, job completes on
  the real station clock, collecting mints **one** unique pick (`soh_i_…`).
- Harvest: the owned pick is the tool A3 allows on the mounted iron vein; one
  commit pays 1 iron, wears the pick by exactly 1 and advances the tool revision
  once; exactly one tool-use receipt exists.
- Second OS process: stone/oak/iron exactly conserved, the same unique instance
  survives, condition and revision are not re-rolled, no extra receipt, no extra
  transaction, save revision never goes backwards, no death.
- Refusals executed, not described: stale tool revision, unknown node kind,
  foreign tool identity, full bag (29 slots) with no condition cost and no partial
  grant, broken tool, empty interval, future interval, rolled-back interval.

### 4a. Real receipt timeline from one kept profile (`a0_player_return.json`, revision 17)

Dumped from the profile the two-process run left on disk — commit order, not a plan:

```
soh.a0.run.start.run-1793425231-c4d3a3d0        run_id=run-… epoch=1 (expires +1209600 s)
survival.harvest.stone_outcrop@102,150.1        bare-handed stone: 3 stone_chunk
survival.harvest.oak_tree@21,206.1              bare-handed wood: 2 oak_wood
soh.a3.enqueue.16b812d4…                        stone_pick job queued (job_000001)
soh.a3.advance.* (×6, hand.1..hand.6)           the same job completes on the station clock
soh.a3.collect.baf1debc…                        one unique pick minted: soh_i_000000000002_…
soh.a3.tool_use.86b92f47…                       one iron swing at iron_vein@101,126 → 1 iron_scrap,
                                                condition −1, tool revision +1
```

Counts in that document: **13 applied transactions, revision 17, run state `active`,
`site_transition` empty, `death_bags` empty**. The second process re-read the same
file and asserted conservation of stone/oak/iron, the same instance id, unchanged
condition and revision, and no extra receipt or transaction.

## 5. Why three journey checks stop here (environment, not product)

A headless Godot `DisplayServer` reports a **0x0** window. Consequences measured
in this sandbox:

- stretch transform collapses to `0.1` (fixed for the harness by declaring the
  1280x720 window the run represents; the transform becomes the same `2.0` a real
  720p window uses);
- `get_mouse_position()` stays `(0, 0)` after `Input.warp_mouse`,
  `Input.parse_input_event(motion)` **and** `Viewport.push_input(motion)`.
  Build placement targets `camera.get_global_mouse_position()`, so the preview
  stays at the world origin and the click is refused as `solid_terrain`:
  `NORMAL_BUILD_TRACE … window=(545.98,265.95) preview=(12,177) mouse_view=(0.0,0.0)
  hovered=ClickBlocker rejection=solid_terrain`.

There is no X server, no `libGL`, no `Xvfb` and no root in this sandbox, so a real
pointer cannot be produced. The check is **NOT_TESTED** here, not passed and not
weakened; `a0-round12-composition.yml` runs the pointer journeys on a display in
CI, and `.github/workflows/a0-normal-home-journey.yml` carries the original route.

## 6. A8 site mount (WP-A0.5)

`game/survival/a0_poi_mount.gd` is the only A0 code allowed to mount an A8 POI.
It resolves the site through A8's package **and** A1's route graph **and** the
live runtime world, then requires the explicit `survival/a0_a8_site_mount` opt-in.

Measured in the composed tree (A8 `6337533f`, A1 `9ca1453c`, A3 `b44e22df`):

```
poi_crown_south_quarry  cell [30,280]  -> A1_RUNTIME_WORLD_EXTENT_ABSENT (world 384x256)
poi_crown_south_orchard cell [140,360] -> A1_RUNTIME_WORLD_EXTENT_ABSENT
poi_crown_south_mill    cell [120,300] -> A1_RUNTIME_WORLD_EXTENT_ABSENT
```

A1's authored route graph names those exact cells; A1's **only runtime world
document** (`data/overworld/hollow_marches.json` at `9ca1453c`) declares
`world_bounds 384x256`, so the sites are outside the playable world. A1 also
authors the waystation at `[408,200]`, equally outside it. A0 may not author
geography, so nothing is mounted and no distance is faked.

Reward authority is separate and also fails closed: an A8 action with no A3
binding returns `A3_BINDING_ABSENT` and commits nothing; an A3-approved action
(waystation `cache_restock` → `a1_waystation_roadside_cache_v3`) resolves to its
exact binding and still grants nothing from this path (`A0_INTENT_HOST_PENDING`).

Transition receipts are one-per-site in the single SaveService (`site_transition`
section, own sanitizer), run-bound: a stale record injected through the public
commit path is refused with `A0_RUN_IDENTITY_MISMATCH`; a return replayed into a
new run epoch is refused and the run boundary leaves no record behind.

## 7. Composition (WP-A0.1)

Exact pins: A1 `9ca1453c`, A3 `b44e22df`, A6 `81c1f57e`, A8 `6337533f`.
`tools/a0/compose_owners.py` copies only declared scopes, refuses everything else
with counts, requires one ruling per shared file, applies A0's reviewed merges
from `tools/a0/merges/*.gd.merged`, and fails on an unresolved conflict.
`tools/a0/check_composition.py` resolves 2,090 seats: **0 problems, 2 known-stale**
(both printed with an owner action).

Two composition defects were found *by running*, not by reading:

1. A ruling that accepted an owner's file outside its declared scope was not
   copied, so `survival_build.missing_summary()` did not exist and the world
   failed to parse. Fixed: `accept_owner` rulings copy even outside the scope.
2. A committed merge artifact ended in `.gd`, so Godot registered a second
   `class_name LivingArsenalSaveService` and refused to load the real SaveService
   on import. Merge artifacts now use `.gd.merged`.

Attribution of the old V4 failure stays as recorded in
`A0_ROUND12_COMPOSITION_MAP_20261031.md`: the eight suite names the old V4
workflow runs exist only at A6 `8bc0af5a`; none exists at `81c1f57e`, so a V4
failure today is a pin/name mismatch, not evidence about current code.

## 8. R5 nine gates at this SHA

| Gate | Verdict | Scope |
| --- | --- | --- |
| RESEARCH_PROVENANCE | **PASS (scoped)** | owner SHAs pinned and re-resolved; source files read, not summarised |
| ARCHITECTURE | **PASS (scoped)** | one SaveService, one run authority, one economy session; no second wallet/clock |
| CODE_RUNTIME | **PASS (native, headless)** | the suites in §2 run green on a locally built 4.7 |
| TEST_ORACLE | **PASS (scoped)** | negative variants executed (stale revision, full bag, wrong run epoch, replay, rollback) |
| VISUAL_UX | **NOT_TESTED** | no GPU, no display; 720/1440/2160 frames were not viewed |
| SYSTEM_VALUE | **FAIL** | the threat cannot kill; the A8 sites are unreachable; the loop is not yet a complete homecoming |
| SAVE_MIGRATION | **PASS (scoped)** | new optional `site_transition` section; old profiles load with 0 errors |
| INTEGRATION | **FAIL** | A1 runtime extent excludes every A8 site; A6 withdrew `expedition_workspace.tscn` |
| BALANCE_REPLAY | **NOT_TESTED** | balance block recorded (14 damage vs 1100 HP, 160 px leash) |

## 9. What A0 needs from the owners (exact, fail-closed)

- **A1** — publish a runtime world document that contains the authored cells, or
  extend `world_bounds`: the three A8 sites `[30,280] [140,360] [120,300]` and the
  waystation `[408,200]` are outside `384x256`. Until then `A0_POI_MOUNT` refuses
  with `A1_RUNTIME_WORLD_EXTENT_ABSENT` and must keep refusing.
- **A6** — publish the current name of the research workspace scene (or confirm it
  is out of Round 12 scope). `expedition_workspace.tscn` is gone from `81c1f57e`
  while A0's modal-composition test still names it.
- **A3/A5** — decide the intended contact damage / health ratio for a starter
  threat; today 14 vs 1100 HP cannot kill, so no authentic death can be shown.
- **CI** — the Round 12 composition job is queued at `4367edb6`; its result is not
  claimed here.
