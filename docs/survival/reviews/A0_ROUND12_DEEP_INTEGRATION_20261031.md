# A0 Round 12 — deep integration evidence (WP1 / WP2 focus)

SHA: `157af7299267923bad6a6fad6a6fda788c239aea` (branch `arena/dea2428e-soul-of-hero`, draft PR #21).
Owner pins used by the composition: A1 `9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf`,
A3 `b44e22df3af40939069189be14afc23ee1ce21c4`, A6 `81c1f57ea01396686eb155af5b36fe8a64921a52`,
A8 `6337533f7cc0d39487921e279d3967ac29a59297`.

Everything below was executed on this SHA with Godot `4.7.stable.custom_build` (headless) —
no hosted CI result is claimed, because the hosted logs for run `41173496737` are not
downloadable from this environment (`gh run view --log`, `--log-failed` and
`gh run download` all fail with `EOF` from the results blob store).

---

## 1. WP1 — why the hosted composition failed, reproduced locally

Hosted run `41173496737` (commit `d1068f33`) failed the job `compose` at the steps
*A0 composed player journeys* and *A6 suites in the same composition*; the threat and POI
steps were skipped. With the logs unreadable, the workflow was re-executed locally against
the same owner pins. Three independent causes were reproduced. All three are workflow/
owner defects, not A0 regressions:

| # | Cause | Evidence |
| - | ----- | -------- |
| 1 | A6's suites at `81c1f57e` are **Node scenes** (`extends Node` plus a `.tscn` launcher) and a main-scene flag gate, but the job ran them with `--script`. Godot refuses them outright: `Can't load the script … as it doesn't inherit from SceneTree or MainLoop`. | `godot --headless --path . --script res://tests/survival/ui/a6_ui_layer_test.gd` → that error, exit 1. Running `…/a6_ui_layer_test.tscn` → `A6 UI LAYER PASSED (110 checks)`. |
| 2 | `--user-data-dir` is a **no-op in Godot 4.7**, so all six A0 journey suites shared `~/.local/share/godot/app_userdata/SOUL OF HERO`. The later suites inherited the earlier suites' active run, minted tool and receipts. | `survival_a0_player_return_test` in the composition: **FAILED 10/26** with `no tool instance exists before crafting`, `harvest_grant_refused`; after `rm -rf "$USERDIR/tests"` the same suite on the same tree → **PASSED 26**. |
| 3 | A6's `game/ui/screens/avatar_choice/avatar_choice_screen.gd` at `81c1f57e` declares `_manifest_has_staged_art` **twice** (lines 122 and 139), so the script cannot load and no identity can ever be chosen. | `A6 AVATAR IDENTITY NATIVE TEST FAILED (full) — 9/27`, first error `Function "_manifest_has_staged_art" has the same name as a previously declared function`, then `AVATAR IDENTITY FAIL: choosing an identity enters Home`. Owner fix required — A0 does not edit A6 files. |

The workflow now: gives every suite a clean profile and its own save document, invokes A6's
suites the way A6 ships them (scenes + `-- --a6-consumer-phase=` + A6's own gate script),
and turns the identity step into a **fail-closed** gate — the job stays red unless the
failure is exactly the named A6 duplicate-function blocker, so a different regression can
never hide behind it.

### Composition state

```
python3 tools/a0/compose_owners.py --repo . --out /tmp/composed12 --copy-base \
  --owner a1=9ca1453c… --owner a3=b44e22df… --owner a8=6337533f… --owner a6=81c1f57e…
  a1 copied=295 out_of_scope=152 | a3 22/132 | a6 103/85 | a8 63/10
  conflicts=0 unresolved=0
python3 tools/a0/check_composition.py /tmp/composed12
  seat checks: 2059, problems: 0, known stale: 2 → COMPOSITION SEATS PASSED
```

Two known-stale seats are declared and unchanged: A6's `expedition_workspace.tscn`
(withdrawn in A6's rewritten history) and the dormant `tools/survival/web_probe.tscn`.
A1's own reader surface (`tests/survival/world/`) is now inside A1's declared scope, so A0
can mount the authored continent from the owner's code instead of forking a second reader;
the composition step asserts the required owner artifacts exist and fails with
`A0_REQUIRED_OWNER_ARTIFACT_ABSENT` if any seat silently disappears.

---

## 2. WP2 — the authored continent, measured

A0 production reads the authored world through **A1's own reader**
(`tests/survival/world/godot/chunk_reader.gd`, SURV-050A) via
`game/survival/a1_authored_source.gd`; it never re-implements it. The playable world stays
A0's `OverworldWorld`, because A1's connector explicitly says
`native_playable: false` and `unsupported_new_cells: SOLID_FAIL_CLOSED`.

`python3 … ; godot --headless --path . --script res://tests/survival_a0_authored_world_contract_test.gd -- --require-authored`
in the composition → **A0 AUTHORED WORLD CONTRACT PASSED - 22 checks**:

| Fact | Value |
| ---- | ----- |
| Authored frame (A1) | 1024 × 768 cells = **786 432** cells (16 px tiles) |
| Playable composed frame | 448 × 256 cells = **114 688** cells = **14.58 %** of the authored continent |
| Composition | legacy Marches 384 × 256 **plus** authored chunk `6:3` (one 64 × 64 annex) |
| Legacy identity | 98 256 / 98 256 non-carve cells byte-identical to the legacy bake |
| Authored seam carve | 48 delta cells applied verbatim; every layer write confined to `x 368…383, y 199…201` (142 writes) |
| Seam crossing | 3/3 clearance rows open on **both** sides of `x = 383 | 384` |
| Annex walkability | 4096 / 4096 authored-walkable annex cells walkable in the composed world |
| Annex build authority | 4096 cells: 1056 denied outright by A1, 3040 candidates that require A0 `validate_cell`, **0** allowed by A1 alone, 0 errors |
| Camera | connector limits 7168 × 4096 px match the composed extent; spawn `[56, 218] px` inside |
| Authored POIs | 118 total, **15 inside** the playable frame, **103 outside** |
| Authored regions | 11 declared, **1** sampled inside the playable frame |
| Authored hazards | `hz_crown_heat`, `hz_crown_rot`, `hz_crown_cold` rects intersect the playable frame |

Consequences that must not be papered over:

* **Multi-region traversal is not available.** The playable frame lies entirely in
  `r_ashen_crown`; WP2's "traverse multiple regions and return home" is blocked by A1's own
  connector decision (`STATIC_ONE_CHUNK_ANNEX_WITH_MINIMAL_LEGACY_CARVE`), not by A0 code.
  The contract prints `A0_AUTHORED_REGION_REACH playable=1 declared=11 MULTI_REGION_JOURNEY_NOT_AVAILABLE`.
* **103 authored POIs, including A8's three sites, are outside the playable frame.** A8's
  cells resolve in A1's authored graph (`[30,280]`, `[140,360]`, `[120,300]`) but not in A1's
  runtime world (`world_bounds 384 × 256`), hence
  `A1_RUNTIME_WORLD_EXTENT_ABSENT` at probe time (below).

### The composed world actually boots

`survival_production_waystation_candidate_test` on the **real production controller**
(`ow.configure()` → real Knight → real physics), **33 checks, PASSED** in *both* trees:

* A0 tree: `A0 WAYSTATION INPUT RESTART PASSED - 33 checks (PRODUCTION CONTROLLER, GUARDED CANDIDATE)`
* composition: identical result on the 448 × 256 world with A1's 12 authored obstacle bodies,
  the waystation + relay-shed slices, and the annex build guard (`annex_disabled_from_x = 384`).

Getting there required one honest A0 change: A1 republished the roadside treatment, atlas and
props sheet at `9ca1453c`, so A0's single pinned byte-state refused the mount and the composed
world could not build. A0 now pins **two reviewed byte-sets** of the same artifact (the one this
tree ships and A1's current one) and keeps the structural oracle as the real gate — three authored
instances on their exact cells, `collision_change: false`, atlas frames present. A third,
unreviewed state is still refused.

---

## 3. What the player can actually do at this SHA

Honest, per route (all numbers from native runs on this SHA):

| Player action | Status | Evidence |
| ------------- | ------ | -------- |
| Title → New Game → Home | PASS in the A0 tree (A0's own flow); **BLOCKED in the composition** | A6 avatar-choice parse error (§1.3) |
| Walk the legacy world with real key input | PASS | `survival_foundation_test` 144, `survival_a0_player_return_test` 26 |
| Harvest stone/oak bare-handed | PASS | player-return journey |
| Craft `stone_pick` at the hand station, collect one unique instance | PASS | player-return: 3 stone + 2 oak reserved, job completes on the real station clock |
| Harvest iron with the owned pick (one atomic wear+grant receipt) | PASS | player-return, tool/offline 47 |
| Run identity, expiry, profile port, save round-trip | PASS | run lifecycle 49, profile port 49, pin fence 10 |
| Offline/economy refusals (future interval, clock rollback, replay) | PASS | tool/offline 47 |
| Composed 448 × 256 world with A1 annex on the production controller | PASS (guarded candidate setting) | 33 checks, both trees |
| Read the authored 1024 × 768 continent | PASS (read-only contract) | 22 checks |
| A8 POI physical mount / transition | **NOT_TESTED** — `A1_RUNTIME_WORLD_EXTENT_ABSENT` for all three A8 sites | poi mount 31 (composition) |
| A8 rewards | **NOT_TESTED** — `A3_BINDING_ABSENT` (no A3 authorization for quarry/orchard/mill) | poi mount 31 |
| One fair hostile that can kill | PARTIAL — mounts and lands real damage, **death not reachable** | see §4 |
| Player death → bag → bed → recovery from *legitimate play* | **NOT_TESTED** (deterministic damage probe passes 19 checks) | damage/death probe 19 |
| Fuelled offline production chain across two processes | **NOT_TESTED** | see §5 |
| 720p / 1440p / 2160p captures | **NOT_TESTED** — no display in this sandbox | see §6 |

---

## 4. The threat, measured again at this SHA

```
A0_THREAT_MOUNT    {"attempts":123,"enabled":true,"mounted":true,"reward_free":true,"site_cell":[82,227]}
A0_THREAT_LETHALITY {"damage_per_hit":17,"enemy_contact_damage":14,"enemy_attack_range":38.0,
                     "hits":5,"hp_before":1100,"hp_after":1016,"max_health":1086,
                     "enemy_disengaged":true,"site_cell":[82,227]}
A0_THREAT_DEATH_NOT_TESTED a full-health Hero cannot be killed by this source at current balance
A0 PRODUCTION THREAT PASSED - 25 checks / (verify pass) - 15 checks
```

The 1100 HP pool is **owner content**, not A0's: `data/heroes/… base_stats.max_hp = 1100` in the
real saved profile (`config/gameplay_tuning.json` says only `player.max_health = 100` and is
overridden by the hero pool). With 14 contact damage per landed hit, 79 hits are required, and
the encounter's own 160 px leash ends the fight after ~5. Fabricating damage to force a death is
exactly what this round forbids, so the death loop is evidenced only by the labelled
deterministic probe (`A0 DAMAGE DEATH PROBE PASSED - 19 checks`), never as player combat.

Exact missing owner interface:
`A3_ENCOUNTER_DAMAGE_POLICY_ABSENT` — no authored survival damage-vs-health policy exists that
scales an opening-world hostile to the shipped 1100 HP pool (A3 owns damage formulas, A4 owns the
hero pool). Until that policy exists, WP4's "death from legitimate play" cannot be produced.

---

## 5. Offline / home production (WP6)

PASS: the A0 offline host is mounted inside the composition, plans on the real UTC interval, and
refuses `interval_in_future` and `clock_rollback`; a relaunch restores tool condition, revision,
iron and exactly one tool-use receipt and adds no receipt by itself (tool/offline 47 checks).

NOT_TESTED: the full *paid, fuelled, elapsed-time, second-process, once-only claim* chain.
Two concrete gaps, named:

* `A0_OFFLINE_ARM_INTERFACE_ABSENT` — A3 ships `arm_offline_operation(job_id, event_id)` in
  `a3_economy_service.gd`, but `game/survival/economy/economy_session.gd` exposes no player-facing
  arm/logout path, so an armed prepared job cannot be created from gameplay.
* The only fuelled authored recipes (`smelt_iron`, `smelt_ore`, `alloy_steel`, `charge_blank`)
  require a **placed furnace**, and placing a structure needs the pointer placement path that
  cannot be exercised headless in this sandbox (`get_mouse_position()` stays `(0,0)`).

---

## 6. Environment limits (unchanged, measured)

No X server (`/usr/bin/X*` absent), no `libGL`, no root (`apt-get` permission denied, `sudo -n`
fails), no `xvfb` Python distribution. Headless `get_mouse_position()` stays `(0,0)` after
`Input.warp_mouse`, `parse_input_event` and `Viewport.push_input`. Therefore: pointer-driven
journey legs and every 720p/1440p/2160p capture are **NOT_TESTED**, and `VISUAL_UX` stays
**NOT_TESTED** — no screenshot has been viewed this round.

---

## 7. R5 nine gates at `157af729`

| Gate | Status | Scope |
| ---- | ------ | ----- |
| RESEARCH_PROVENANCE | PASS (scoped) | every A1/A3/A6/A8 byte used is pinned by SHA + hash; two reviewed A1 art byte-sets documented |
| ARCHITECTURE | PASS (scoped) | one SaveService, one GameRoot, A0 world authority, A1 reader mounted read-only, no second planner |
| CODE_RUNTIME | PASS (native, headless) | all suites below executed on this SHA |
| TEST_ORACLE | PASS (scoped) | work-order oracles executed; no test weakened; POI/authorship suites fail closed by flag |
| VISUAL_UX | **NOT_TESTED** | no display; nothing viewed at 1× |
| SYSTEM_VALUE | FAIL | multi-region, A8 POI mount, death from play and offline chain are unavailable (§2, §4, §5) |
| SAVE_MIGRATION | PASS (scoped) | relaunch/round-trip proven; composition shares one SaveService |
| INTEGRATION | **FAIL** | A6 identity blocked by A6's own parse error; A8 sites outside A1 runtime extent |
| BALANCE_REPLAY | **NOT_TESTED** | a lethal encounter cannot be reached to measure time-to-death |

Native totals on this SHA (headless, clean profile per suite):
foundation 144 · authored world 22 · pin fence 10 · profile port 49 · run lifecycle 49 ·
tool/offline 47 · player return 26 · damage/death probe 19 · production threat 25 + 15 ·
POI mount 31 (composition) · production candidate 33 (both trees).
Pointer journeys remain **FAILED** for the measured sandbox reason (no display): the last
recorded trace is `input gather 1/20`, `home journey 1/20`, `entry/home/restart 2/34`, all on
the single check `ordinary placement input pays for the physical workbench`.

---

## 8. Owner asks (precise, fail-closed)

| Owner | Ask | A0's measured reason |
| ----- | --- | -------------------- |
| A6 | Fix the duplicate `_manifest_has_staged_art` in `game/ui/screens/avatar_choice/avatar_choice_screen.gd` (122 and 139) at the pinned SHA | `A6_AVATAR_CHOICE_DUPLICATE_FUNCTION`; identity gate 9/27 |
| A1 | Publish a runtime world document (or an authorized connector change) that reaches the authored cells of the A8 sites `[30,280] [140,360] [120,300]`, or confirm those cells are out of scope for Round 12 | `A1_RUNTIME_WORLD_EXTENT_ABSENT` against `world_bounds 384 × 256` |
| A1 | Decide whether the playable frame may exceed the single annex chunk; today the frame covers 14.58 % of the authored continent and 1 of 11 regions | `A0_AUTHORED_REGION_REACH playable=1 declared=11` |
| A3 | Author a survival damage-vs-health policy for the opening encounter (or confirm the 1100 HP pool is intended with 14 contact damage) | `A3_ENCOUNTER_DAMAGE_POLICY_ABSENT`; 79 hits needed, leash ends at 5 |
| A3 | Authorize (or refuse permanently) rewards for the three A8 site action ids | `A3_BINDING_ABSENT` |
| A3/A0 | Agree the player-facing offline arm/logout path so a paid, fuelled prepared job can exist | `A0_OFFLINE_ARM_INTERFACE_ABSENT` |

## 9. Reproduce

```
GODOT=/home/user/godot-native/src/bin/godot.linuxbsd.editor.x86_64
$GODOT --headless --path . --import
$GODOT --headless --path . --script res://tests/survival_a0_authored_world_contract_test.gd            # A0 tree: 9 checks
$GODOT --headless --path . --script res://tests/survival_production_waystation_candidate_test.gd        # 33 checks

python3 tools/a0/compose_owners.py --repo . --out /tmp/composed12 --copy-base \
  --owner a1=9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf \
  --owner a3=b44e22df3af40939069189be14afc23ee1ce21c4 \
  --owner a8=6337533f7cc0d39487921e279d3967ac29a59297 \
  --owner a6=81c1f57ea01396686eb155af5b36fe8a64921a52
python3 tools/a0/check_composition.py /tmp/composed12
cd /tmp/composed12 && $GODOT --headless --path . --import
$GODOT --headless --path . --script res://tests/survival_a0_authored_world_contract_test.gd -- --require-authored   # 22
$GODOT --headless --path . --script res://tests/survival_a0_poi_mount_test.gd -- --require-a8                      # 31
```
