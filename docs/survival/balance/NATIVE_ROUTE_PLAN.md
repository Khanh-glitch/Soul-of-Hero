# Native route plan (A7, round 6)

The question this plan answers: **what would have to happen, in a real Godot 4.7
process, before anyone may say a player can walk to the Waystation, take what A3
authorises, and keep it after a restart?**

It is written so the answer is a reproducible ladder, not a paragraph. Each rung
is a command with an exit code. A rung that cannot run reports *blocked* and exits
2; 2 is never a pass.

Owner heads this plan is pinned to: A0 `9269739e`, A1 `939720d5`, A3 `c5e80922`,
A6 `08ccb834`, A8 `c8b4bc88`.

## What A7 can and cannot execute

A7's sandbox has no Godot binary, so the two probe files are **audited, not run**.
`sohbalance/probes.py` checks each probe extends the shipped chain, contains none
of the constructs that would fabricate its own result (teleport, injected node,
forced death, granted item, direct inventory write), and names only symbols that
exist in the pinned owner bytes. The artifact says
`PROBES_STATICALLY_SOUND_NOT_EXECUTED` / `NATIVE_UNEXECUTED`, and gate assertion
`A33` fails if anyone tries to relabel it.

That is the honest ceiling of this document: **it does not close S4.** It defines
exactly what would.

## The ladder

| rung | what it proves | current state |
| --- | --- | --- |
| L0 boot | the production shell loads and reaches the title screen | inherited, green on the old sha, `STALE_HEAD` on this one |
| L1 entry | real menu → real Home map → campaign gate → overworld | inherited, same |
| L2 mount | A0 mounts `WaystationRuntime` on that world | **blocked**: the branch is behind `survival/a0_waystation_candidate`, absent from the shipped `project.godot` |
| L3 reach | ordinary movement walks the Hero to A0's own stand cell | blocked behind L2 |
| L4 interaction | one left click, at the point the player is standing next to, commits one A3 receipt | blocked behind L2 |
| L4b identity | the **cache** pays out under the instance id the host actually sends | blocked behind L2; the static oracle says it would fail (`unknown_source_instance`) |
| L5 durability | an independent second OS process reloads the receipt and the counts | blocked behind L4 |

L0 and L1 are already implemented by A0's own chain. The two A7 probes add L2–L5
and nothing else, by subclassing that chain:

```
tests/survival_normal_input_gather_test.gd          (base: movement, save, teardown)
  └─ tests/survival_normal_home_journey_test.gd      (paid shelter by ordinary input)
       └─ tests/survival_normal_entry_home_restart_test.gd  (menu → home → world → second process)
            ├─ tests/survival/balance_native/first_hour_route_probe.gd   (L2–L5)
            └─ tests/survival/balance_native/bed_death_bag_probe.gd      (death + same bag)
```

The probes use the inherited `_after_home_continuation()` hook, so they run after
the paid home, keep the inherited `world_slice` comparison across processes, and
never re-implement the entry journey.

## Reproduce

```bash
# 1. import once, isolated user dir so nothing touches a real profile
godot --headless --path . --user-data-dir artifacts/ud_b0 --import

# 2. first process: menu -> home -> shelter -> walk to the Waystation -> interact
xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 \
  --script res://tests/survival/balance_native/first_hour_route_probe.gd

# 3. independent second process, same disk profile
xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 \
  --script res://tests/survival/balance_native/first_hour_route_probe.gd -- --verify-separate-process

# 4. death and same-bag recovery (blocked today: no mounted threat)
xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 \
  --script res://tests/survival/balance_native/bed_death_bag_probe.gd
```

Exit codes: `0` every check passed, `1` a real check failed, `2` blocked before the
first player action.

## What each probe refuses to do

The interesting half of both files is the list of things they will not do:

* no `global_position =` — the Hero walks, using the same `move_*` actions a
  keyboard player uses (the audit fails the probe if a position is assigned);
* no `add_child(` — no injected node, no fake host, no stand-in world;
* no `begin_overworld_death()` / `call(&"_die")` — the death probe looks for a
  mounted threat and, finding none, reports **blocked**; that empty list *is* the
  finding;
* no item grant and no direct inventory write — the reward must arrive as an A3
  receipt in `world_slice`;
* no invented coordinates — interaction points and their stand cells come from
  A0's own `WaystationRuntime` (its `POINTS` table and its
  `matches_interaction()`), and the probe finds a stand cell by asking the host
  which neighbouring cell it accepts, not by hard-coding one;
* no private success path — the only diagnostic it will run is A3's read-only
  planner, clearly printed as `DIAGNOSTIC`, and only *after* a player-visible
  failure.

## What it would take for each rung to turn green

**L2 (A0, one line).** A0's `chapter1_overworld.gd` already builds the host at
`_build_economy_session` time; the only missing half is the setting. Add to
`project.godot`:

```ini
[survival]
survival/a0_waystation_candidate=true
```

Gate assertion `A16`/`A17` and claim C only reach `MOUNTED_BY_DEFAULT` when that
key is present *and* true — verified by
`GateClosureTests::test_blk1_closes_when_content_is_mounted`, which also asserts
that a scene reference alone is **not** enough.

**L4b (A0, re-vendor).** A0's `waystation_host.gd` sends
`si:r_ashen_crown:waystation_cache:01` for `cache_restock`. A3's canonical table
contains exactly that row (`a1_waystation_roadside_cache_v3`). A0's vendored copy
still says `node_waystation_cache`, and A0's own lookup is exact string equality,
so the request dies as `unknown_source_instance`. The fix is to re-vendor
`data/survival/items/world_source_bindings.v3.json` from A3 `c5e80922` — no code
change. The same re-vendor fixes `Q-03`: A3 recanonicalised `road_notes`,
`road_scrap` and `road_supplies` and A0's mirror of `sources.json` still carries
the old region/poi/instance names.

**L4b, second half (A0's fixture).** The only test that ever "earned" the cache
funds its own inventory, advances its own clock and sends
`node_waystation_cache` — an id the host never sends. Even green, it is S2. The
probe is the replacement, not an addition.

**L5 death (A0/A5).** `SurvivalService` exposes no environmental damage; the
composed overworld mounts no hazard, hostile or threat group. Death is reachable
only by a fixture calling `begin_overworld_death()`. Until something in the world
can kill the Hero, "bed and same-bag recovery after a real death" is
`RUNTIME_UNKNOWN`, not verified — and the probe says so with exit code 2.

## What a green run still would not prove

A green `first_hour_route_probe` would prove S4's five clauses **if and only if**
all five hold in the same run on an exact sha: exact source identity, real normal
entry, a separate OS process, an A3-authorised atomic transaction, and a negative
replay. That is necessary and not sufficient for B0:

* S5 needs inspected frames and a human judgement of the first hour — A7 will not
  manufacture a human E2;
* the avatar is still the Knight (BLK-5), so "the player sees their chosen body"
  stays wrong even with a perfect Waystation run;
* the visual corridor and the Quarry's safe alternatives are separate claims.

## Why this is not another blocker document

Every rung above is a command whose failure prints the missing edge and the exact
owner action. When A0 flips the flag or re-vendors the table, the probes run
unchanged and the same commands produce new evidence — no A7 edit, no re-pin, no
new report. That is the test of the design.
