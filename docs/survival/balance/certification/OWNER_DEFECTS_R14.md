# A7 · R14 — owner defect reports (filed, not fixed)

_2026-10-31. Independent QA. Every item below is a reading of a file at a pinned commit or of an
engine marker captured in CI — never an edit. A7 has changed **no** owner file, merged nothing,
granted nothing. Repro commands are copy-paste and were run on the pinned trees._

- composition under test: `f6d5cf789995ccd775cfab9b2f3c98a7ecc667b0`
- pins: A0 `a6e37978` · A1 `e1e4e9a4` · A3 `80fe8cec` · A6 `816cc22a` · A8 `5bf5c8f9`
- CI: run `41226124443` (head `a18b977f`), evidence commit `91beb49f`
- harness: `tools/survival/balance/a7_certify.py` (32 cases, 67/67 self-test controls)

Severity words here mean one thing only: **does the composed product run**. "Blocking" = the
authored world cannot be played in the certified composition.

---

## A0 — world authority (PR #21, pin `a6e37978`)

### A0-D1 · `COMPOSITION_DROPS_OWNER_WORK` — blocking, composition metadata

`tools/a0/ownership.json:82` declares an `a0_resolution` for
`game/overworld/chapter1_overworld.gd` whose `merge` is
`tools/a0/merges/chapter1_overworld.gd.merged`. That artifact **predates A0's own authority mount**:

| file | lines | blob | `world_authority` occurrences |
|---|---|---|---|
| `game/overworld/chapter1_overworld.gd` (A0 `a6e37978`, committed) | 1642 | `6924a52e…` | **34** — preload `:75`, `var world_authority: A0WorldAuthority` `:123`, `A0_WORLD_AUTHORITY.new()` `:284`, `world_authority.spawn_cell()` `:414` |
| `tools/a0/merges/chapter1_overworld.gd.merged` (installed by `:82`) | 1366 | `ab462427…` | **0** |

The composition therefore installs the 1366-line artifact over A0's 1642-line controller. The
composed product keeps only the *optional* A1 stream mount
(`survival/a0_authored_stream`, `:65` of the artifact, default off) and loses `A0WorldAuthority`
entirely, so the live world falls back to the legacy sidecar.

```
# on A0 a6e37978
grep -c world_authority tools/a0/merges/chapter1_overworld.gd.merged      # -> 0
grep -c world_authority game/overworld/chapter1_overworld.gd              # -> 34
grep -n 'A0_WORLD_AUTHORITY\|world_authority: A0WorldAuthority' game/overworld/chapter1_overworld.gd
# -> :75 preload, :123 declaration, :284 instantiation
```

Engine confirmation (composed tree, `r14_ci/probe.txt`):
`A7C AUTHORITY {"controller_lines":1367,"mounts_authority":false,"source_mount":"sidecar",
"live_source":"legacy_sidecar","live_frame":[384,256],"runtime_authority_verified":false}`

**Clears when:** the resolution at `ownership.json:82` ships a current artifact — regenerated from
A0 `a6e37978`'s controller — or the resolution is retired so the committed file is composed as-is;
and a new composed SHA is declared. A7 will not edit `ownership.json`.

### A0-D2 · `AUTHORITY_SCRIPT_DOES_NOT_RUN` — blocking, source

`game/survival/a0_world_authority.gd:157` calls `_spawn_cell()` inside `source_report()`.
No such function exists anywhere in the tree; the class defines `spawn_cell()` at `:265`.

```
grep -rn "_spawn_cell" --include=*.gd game/                      # only :157 (call site)
grep -n "func spawn_cell" game/survival/a0_world_authority.gd    # -> :265
```

Engine confirmation — the script **loads but cannot be instantiated**, in the composed tree *and*
in the reconciled control, so this is independent of A0-D1:

```
A7C NATIVE_LOAD {"authority_loads":true,"authority_can_instantiate":false,
                 "authority_error":"Function \"_spawn_cell()\" not found in base self.",
                 "authority_sha256":"cc823725…"}
composed.native.txt : "SCRIPT ERROR: Function _spawn_cell() not found in base self."
control.native.txt  : same, plus "Failed to compile depended scripts for chapter1_overworld.gd"
```

`runtime_authority_verified=false` in both trees; the control resolves `controller_mode="authored"`
but `live_frame=[0,0]`, `live_source=UNRESOLVED_AUTHORITY_NOT_RUNNABLE`.

**Clears when:** `authority_can_instantiate=true` in the probe on a new composed SHA, with a clean
`composed.native.txt` (no `SCRIPT ERROR`, no `Parse Error`, no `Failed to compile`).

---

## A3 — economy service (PR #19, pin `80fe8cec`)

### A3-D1 · `A3_SERVICE_REFUSED_BY_SCOPE` — blocking for Track 3 *attribution*, not for A3's code

The composition refuses seven A3 economy files and the product runs an older A0 vendored copy:

```
refused: game/survival/economy/{a3_economy_service,economy_service,meta_economy_planner,
         offline_operation_planner,quarry_source,roadside_source,world_source_adapter}.gd
shipped instead: game/survival/economy/vendor/a3_economy_service.gd  (1789 lines, 0 hits)
```

| tree | file | lines | `authenticate_source` |
|---|---|---|---|
| A3 `80fe8cec` | `game/survival/economy/a3_economy_service.gd` | 1234 | **`func authenticate_source(...)` at `:223`** |
| composed | `game/survival/economy/vendor/a3_economy_service.gd` | 1789 | **absent** |

```
git show 80fe8ceca6de02523985a6eb53e9567639885f0e:game/survival/economy/a3_economy_service.gd \
  | grep -n authenticate_source                            # -> :223
grep -c authenticate_source game/survival/economy/vendor/a3_economy_service.gd   # -> 0
```

Consequence for verdicts: this round's Track-3 source passes — `T3.6 FUEL_REQUIRED`,
`T3.7 DUPLICATE_REFUSED`, `T3.8 STALE_RUN_REFUSED` — are passes of **A0's fork**, not of A3's
delivered service. `T3.11` is graded `FAIL` for exactly that reason. A7 makes no claim about A3's
quality here; it claims the certified product does not contain A3's service.

**Clears when:** the composition installs A3's economy files (an A0 compose-map decision), or A0
re-vendors from A3 `80fe8cec` and declares it, and a new composed SHA is certified.

### A3 observations that are **not** defects (A7's own false verdicts, corrected)

- **No knife-named item id** in `data/survival/items/items.json` (57 ids; 0 knife-like). This is a
  catalog observation. It does **not** prove starting melee is unplayable — `T2.3` was corrected to
  `BLOCKED_NO_MELEE_RUN`; combat/equipment must be checked and a real swing run before any verdict.
- **V7 `condition_cost` / `apply_tool_use_plan` exist** in
  `economy_service.gd:255,269,280` and `a0_economy_adapter.gd:51`. A contract existing is not player
  tool wear: `T3.2` is `BLOCKED_NO_TOOL_WEAR_RUN` until an A0 consumer actually runs it.
- **Fuel escrow mismatch** is not source authentication. `T3.5` was corrected from a false `PASS` to
  `BLOCKED_NO_PROVENANCE_REJECTION`: the product must first be able to *reject* an unauthenticated
  source (see A3-D1 — the shipped fork cannot).

---

## A8 — South Crown content (PR #26, pin `5bf5c8f9`)

**No defect found this round.** Both canonical sites exist with shipped scenes:

| poi | canonical cell | scene | source-present |
|---|---|---|---|
| `poi_crown_south_quarry` | `30, 280` | present | yes |
| `poi_crown_south_orchard` | `140, 360` | present | yes |
| `poi_crown_south_mill` | `120, 300` | present | yes |

Current verdicts: `T2.1 BLOCKED_NO_ENTRY_RUN`, `T1.4 FAIL SITE_OUTSIDE_LIVE_WORLD` — the second is
graded against **A0's live world (384×256)**, not against A8's package: the cells are inside A1's
authored frame (1024×768). So the blocker is A0-D1/A0-D2, not A8.

**Request, not a defect:** do not relocate canonical cells without a package version bump — these
three cells are what A7 will re-verify. Entry evidence must come from a walked route in a run; a
teleport into a POI interior is not a route.

---

## A1 — continent reader (PR #20, pin `e1e4e9a4`)

**No defect found this round.** `T1.5 INPUT_BOOTSTRAP_INDEPENDENT` passes: the reader configures
input both before and after the application bootstrap, so a mid-run refusal is a harness/config gap
and is never scored as an A1 content defect.

`T1.3 SPAWN_OUTSIDE_LIVE_WORLD` (spawn `389,291`) and `T1.4` are consequences of the live world being
the legacy sidecar; they are filed against A0. A1's authored frame is verified only as a source
constant (`AUTHORED_FRAME := Vector2i(1024, 768)`, `a1_authored_source.gd:30`) — source presence, not
a running world.

---

## AVFX / Core (no open PR at this pin)

`T4.1` is `NOT_IMPLEMENTED FEATURE_ABSENT`: no `use_core` / `store_core` / `core_research` symbols in
`game/survival`. Nothing to fix and nothing to grade — the gate stays closed until a Core verb is
authored. `T4.4` and `T4.6` are `BLOCKED` (symbols exist, no run); `T4.2/T4.3/T4.5/T4.7` are
`NOT_IMPLEMENTED`.

---

## A6 — UX (pin `816cc22a`)

**No defect found.** A6's authored-stream mount ships in the composed controller
(`AUTHORED_STREAM_SETTING` `:65`, `A0AuthoredWorldMount.new()` `:278`) but `survival/a0_authored_stream`
is undefined in `project.godot` and therefore off. A6 content becomes gradable only after A0-D1/D2 are
cleared.

---

## Re-certification trigger (nothing on A7's side)

Full certification resumes only on a **new exact composed SHA** that shows all of:

1. recomputed `git write-tree` == declared tree;
2. `authority_can_instantiate=true`;
3. `controller_mode="authored"` and `runtime_authority_verified=true`;
4. `live_frame=[1024,768]`;
5. empty `composed.native.txt` (no script/parse/compile errors);
6. a walked two-site route with durable revisit, and one funded settlement across two processes.

Until then the harness is frozen at `PAUSE_DEPENDENCY`
(`A7_HARNESS_R14_PACKAGE.md`), report revision 3 is `A7_CERTIFICATION_R14.md`, and no full journey
suite is re-run on documentation or harness-only commits.
