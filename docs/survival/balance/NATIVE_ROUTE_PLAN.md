# Native route plan — what would have to run, and what each rung is allowed to claim

A7 owns verification, not the engine. This file exists so the next person can run the
three probes reproducibly instead of reading an assertion about them, and so nobody
can mistake a green workflow for a player experience.

Everything below is read-only with respect to owner code: the probes extend A0's own
normal-entry test, so the shell, the menu route, the save and the second OS process
are A0's, not a harness invented here.

## 1. Commands

```bash
# once per checkout; imports assets into an isolated user dir
godot --headless --path . --user-data-dir artifacts/ud_b0 --import

# route: walk -> press interact -> receipt -> refuse -> cache -> receipt
xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 \
  --script res://tests/survival/balance_native/first_hour_route_probe.gd

# durability: death -> recover the bag -> same save -> second OS process
xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 \
  --script res://tests/survival/balance_native/bed_death_bag_probe.gd -- --verify-separate-process

# avatar: choose male/female, spawn, die, reload, never fall back to the Knight
xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 \
  --script res://tests/survival/balance_native/avatar_body_probe.gd

# opt-in only: prove the guarded branch is not broken *once mounted*
xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 \
  --script res://tests/survival/balance_native/first_hour_route_probe.gd -- --force-branch
```

Exit codes are part of the contract: `0` every check held, `1` a real check failed,
`2` the probe was blocked before the thing it measures (never a pass).
`--force-branch` sets `survival/a0_waystation_candidate` at runtime, so its output is
labelled `PASSED_UNDER_FORCED_FLAG ... SOURCE_PRESENT_BEHIND_GUARD, not acceptance`.

## 2. The ladder, and what each rung may claim

| rung | evidence | may claim | may not claim |
| --- | --- | --- | --- |
| L0 static | pinned bytes + sha256, this repo | `SOURCE_PRESENT`, `SOURCE_ABSENT`, `RUNTIME_UNKNOWN` | that anything runs |
| L1 parse | `godot --import` clean on the pinned sha | scripts parse on *this* commit | that a route is reachable |
| L2 same process | probe exits 0 in one process | the route works in one process | durability |
| L3 forced flag | `--force-branch` exit 0 | the guarded branch is functional | that a shipped build reaches it |
| L4 two processes | `--verify-separate-process` exit 0 | the save survives a real restart | human quality |
| L5 human | a person playing a shipped build | S5 | — |

A workflow-level green tick is *not* a rung. `evidence.py` requires the run's
`head_sha` to equal the pinned head, the proving **step** to have succeeded and the
assertion phrase to appear in the log; anything else is `STALE_HEAD`, `FAILED` or
`NOT_TESTED` (adversary probes P10–P12 execute exactly those three disguises).

## 3. What the probes assert today

All three are pinned-bytes-only until a run exists; `data/survival/balance/results/
native_probes.json` records `PROBES_STATICALLY_SOUND_NOT_EXECUTED`, `executed: false`.
The static verdict means: no forbidden shortcut (position assignment, `add_child`,
`.call(&"begin_overworld_death")`, item grants) and every symbol they name exists.

### 3.1 route probe — blocked, and honestly so

`first_hour_route_probe.gd` stops at exit 2 with

> B0 ROUTE PROBE BLOCKED - no WaystationRuntime under the mounted overworld (survival/a0_waystation_candidate is false)

because `a0.project.godot` does not declare the key, while
`chapter1_overworld.gd` only builds `WaystationRuntime` when it is on. The probe then
prints the A0 action rather than mounting anything itself.

**Minimum A0 fix, in order of cost:**

1. `survival/a0_waystation_candidate=true` in `project.godot` — the mount code,
   the host, the five points, the range/stand checks and the authored strings all
   already exist behind it.
2. Re-vendor A3's `data/survival/items/world_source_bindings.v3.json` (and
   `sources.json`) into `data/survival/` — A0's mirror carries two bindings whose
   cache instance is `node_waystation_cache`, A3 `c5e80922` authorises
   `si:r_ashen_crown:waystation_cache:01`. Without this the locker pays and the cache
   answers `unknown_source_instance` (A3 line 402) — visible to the player as
   "The Waystation could not record that action."
3. Nothing else. The route is not blocked by art, physics or A8.

### 3.2 death probe — blocked, one edge away

The overworld has no damage source. `begin_overworld_death` exists and is reachable,
but nothing mounted calls it, so no player can die in a shipped build. The probe walks
into whatever the world publishes as dangerous (hazard groups, non-hero
`CharacterBody2D`s whose script or API admits damage) and finds none, then stops with

> B0 DEATH PROBE BLOCKED - the composed overworld mounts 0 hazard/hostile bodies ...
> death is only reachable from a fixture, so bed/same-bag recovery is RUNTIME_UNKNOWN

It does not call the death function itself: that is exactly the fake this file exists
to prevent. A5 or A0 adds one hazard that calls it; bag spawn, recovery, same-save
reload and the second process then run unchanged.

### 3.3 avatar probe — blocked, and the seam does not exist

`Q-09` (static) already answers this at the byte level: no A0 production file
references A6's `avatar_appearance_adapter` or `avatar_art_manifest`, no production
UI offers a male/female choice, and `main.tscn` instances `knight.tscn`. The probe
expresses the same contract natively and stops at the first check
("normal entry offers a male/female body choice (found none)").

A6's side is `SOURCE_BLOCKED`: grade-0 paths are empty in `avatar_art_manifest.json`,
so an adapter could only answer "missing" today. Order is therefore A6 (import one
grade-0 sheet set for 555940 / 419402) → A0 (a chooser + mount the adapter result) →
this probe.

## 4. Why a green run still would not be S4

S4 is a five-clause conjunction (`evidence.S4_CLAUSES`). Today every clause is
`NOT_HOLDS`; a single green probe run moves at most C2. C3 needs the second OS
process on the same sha, C4 needs the receipt to come from `a0_waystation_player_input`
(not from `a3_authority_fixture` — probe P08 shows a perfect green fixture still
leaves C4 `NOT_HOLDS`), and C5 needs a replay refusal recorded in a separate process.
S5 additionally needs a human with frames; A7 does not grant it.

## 5. What has not been run here

No Godot binary exists in this sandbox, so nothing in this repository claims a native
result. The plan is reproducible on a machine that has one; until then every owner
claim is graded from pinned bytes and the CI recording, and says so.
