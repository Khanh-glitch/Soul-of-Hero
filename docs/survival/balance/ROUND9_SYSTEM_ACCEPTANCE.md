# Round 9 — system acceptance: the seam, the clock, the mover and the click

_Executed 2026-10-31 against compositions `ef2ad0f09310` (`r9_full`) and
`b5e787dbed49` (`r9_core`) with a real Godot `4.7.stable.custom_build` built from
`godotengine/godot@4.7-stable` (editor target, headless, scons).
Every verdict below is a line from `data/survival/balance/results/native_runs.v1.json`,
produced by
`python3 tools/survival/balance/run_native.py --composition refs/comp/r9_full --write`.
Logs live in `.artifacts/native_runs/ef2ad0f09310/` and are hashed into the ledger._

Round 9 exists because round 8's conclusion was wrong. Round 8 said the build HUD
intercepted placement; the product's placement code has no raycast to intercept.
That mistake is the reason this round is built the way it is: **every claim below
either drives the production object with ordinary input or measures the product's
own refusal, and every claim that cannot be measured says so on its own line.**

## 1. The composition, exactly

`tools/survival/balance/compose.py` builds an immutable commit from live owner refs.
Round 9 adds two profiles and a rename fix (`refs/live/e385312a` never existed; the
default A1 ref now resolves to `refs/live/arena-e385312a`, which had aborted every
profile with `git rev-parse` exit 128).

| profile | commit | files | overlays |
|---|---|---|---|
| `r9_core` | `b5e787dbed49` | 5425 | a1, a3 |
| **`r9_full`** | **`ef2ad0f09310`** | **5492** | **a1, a3, a6, a8** |

Sources: A0 `arena/dea2428e` `4b4b63f5` · A1 `arena/e385312a` `7d2b017c` ·
A3 `arena/7a12b27e` `35214ed8` · A6 `arena/443f004f` `63d3fae5` ·
A8 `arena/2d7e6d7a` `02ad8b72`.

`data/survival/balance/results/compositions.v1.json` now carries both rounds: the
round-8 rows are left exactly as they were pinned (A1 `178a5ba2`, A3 `a5d11141`) and
the two round-9 rows are added beside them, so neither round's provenance is rewritten.

Both compositions were run in full. **Every probe produced the same verdict on both**,
so nothing in this round depends on A6 or A8 being present.

## 2. Result at a glance

| verdict | count | what it means |
|---|---|---|
| PASS | 3 | executed and asserted on this composition |
| FAIL | 1 | implemented and violated — a real defect with an owner |
| BLOCKED | 2 | genuinely unmeasurable here, cause named |
| RED_NOT_IMPLEMENTED | 1 | the rule exists in A3 and has no A0 boundary to live on |

| probe | verdict | checks | what it established |
|---|---|---|---|
| `r9_economy_seam_probe.gd` | **FAIL** | 12 (1 failed) | one stale A0 data pin switches the whole survival economy off and makes the Waystation unmountable |
| `r9_run_clock_probe.gd` | PASS | 7 | the 14-day rule is implemented where a clock is handed to it; no shipped subsystem keeps one |
| `r9_shadow_physics_probe.gd` | PASS | 11 | A8's harness mover and the production Hero disagree about sliding — quantified |
| `r9_placement_cursor_probe.gd` | PASS | 10 | round 8's ClickBlocker claim retracted; placement commits exactly once for exactly its cost |
| `r9_economy_custody_probe.gd` | RED_NOT_IMPLEMENTED | 29 (3 missing) | A3's V7 custody rules are real and enforced; A0's runtime cannot reach them |
| `r9_waystation_walk_probe.gd` | BLOCKED | 5 | the authored stand geometry is exact; it cannot be walked because the host cannot mount |
| `r9_restart_replay_probe.gd` | BLOCKED | 12 | a committed action survives a genuine second OS process; the replayed Waystation click could not be measured |

## 3. The headline: it is one hash

A probe that asks "can the production Hero walk to the Waystation and click it"
came back `BLOCKED: the production overworld never reached READY`. That sentence
describes the harness, not the product, so the failure was followed to its cause —
and the cause is a single stale value in a file A0 owns.

The product's own chain, in its own words:

1. `chapter1_overworld._build_economy_session()` configures A3's session; on failure
   it warns *"Economy session unavailable; crafting remains disabled"* and sets
   `economy_session = null`.
2. `economy_session.configure()` calls A0's fence
   `a0_v5_source_pins.verify()` and refuses the session when it returns a mismatch.
3. With `survival/a0_waystation_candidate = true`, the overworld then calls
   `_fail("Waystation candidate requires the A3 economy session")`.

Measured, by recomputing every pin against the bytes on disk:

```
fence declares 7 data pins and 3 script pins
DRIFT res://data/survival/items/items.json
      pin=cc3c11659fc1  actual=cd1a27c48078
fence_verify="a3_data_pin_mismatch:res://data/survival/items/items.json"
economy_session_without_flag=null  survival_build=true  save=true  survival=true
```

Nine of ten pins match. The one that does not is A3's `items.json`, and it is not a
composition artefact: the composed file's sha256 is byte-identical to A3's own copy
on `arena-7a12b27e`. A0's fence still pins an older revision of a file it does not
own — the fence's own comment names commit `4bfba38d`, not A3's live ref.

Consequences, all measured in the same process:

| flag | what happens |
|---|---|
| shipped default (absent) | the overworld builds, `economy_session == null`, crafting and **every** meta-economy action are absent for a player |
| `survival/a0_waystation_candidate=true` | the overworld refuses to build at all: `build_error="Waystation candidate requires the A3 economy session"` |

This is not "the Waystation is switched off". It is "the Waystation's declared
prerequisite is failed by one hash", and it makes every interaction claim in this
round unmeasurable. **The fence, the drift detection and the fail-closed behaviour
are all correct and must stay**; only the pin needs refreshing.

## 4. The retraction: round 8 was wrong about the HUD

Round 8 (§3, §8 item 1) reported that a HUD `ClickBlocker` intercepted "the placement
ray" and told A0/A6 to filter HUD controls out of it. There is no placement ray.
Reading the product:

* the blocker is deliberate — `is_build_click_blocker()` exists so the placement door
  can *exempt* it;
* `try_place()` takes `preview_cell()`, which is
  `camera.get_global_mouse_position()` floored to a tile;
* round 8 never positioned the pointer, so the preview sat over solid ground and
  `solid_terrain` was the correct answer.

Measured now:

```
build_status.active=true blocker_visible=true
hovered=<none> is_build_click_blocker=false
after_build_mode_click_pending_gameplay_lmb=false
mouse_move_ok=true wanted=(58, 218) preview_cell=(57, 218)
validate_cell(solid=(17, 218))="solid_terrain"
API_NOT_CLICK try_place(cell=(56, 222))={"entity_id":"b1","ok":true,"reason":""}
oak_wood 40 -> 38
```

So: the blocker is recognised by name, is not what the pointer is over, swallows the
click without queueing an attack, placement commits exactly one structure, and the
cost is exactly the catalogue's two oak wood. The advice in round 8 §8 item 1 is
withdrawn; nothing was wrong with A0's or A6's input handling.

**`NOT_RENDERED`.** Headless has no display (`window=(0, 0)`), and the injected
pointer moves the preview but lands one cell off the aim (`(57,218)` for `(58,218)`).
"A player aimed at a cell and placed it" is therefore *unverified*, and the commit
above is labelled `API_NOT_CLICK`. Verifying click-precision placement needs a
display; no amount of retrying in this sandbox produces one.

## 5. There is no clock

D061/D066/D071 need a durable UTC anchor. A3 knows the numbers; nothing in A0 keeps
time.

| check | result |
|---|---|
| positive control: A3 declares `RUN_MAX_SECONDS := 1209600`, `RAGNAROK_START_SECONDS := 950400` | present |
| A0 `save_service.gd`, `chapter1_overworld.gd`, `a0_economy_adapter.gd` mention a run id, run start, run expiry, `1209600` or a season | **none**, 0 matches across 3/3 files |
| live profile keys | `applied_transactions, auxiliary_loadout, bestiary, currencies, hero_loadouts, inventory, legacy_audit, mastery, mode_progress, monster_parts, pending_rewards, progression, revision, schema_version, settings, soul_team, storage, tutorials` — no run-shaped or season key |
| planner with a caller-supplied clock, `now = start + 1209600 - 1` | not refused for expiry |
| same, `now = start + 1209600 + 1` | `run_expired` |

The rule is implemented wherever the clock is handed to it. What a restart means
today is *the same run*, as far as any durable record goes, and no expiry can fire
while the game is closed. Every meta-economy number in §7 is `MODEL_ORACLE` for
exactly this reason: the elapsed time has to be supplied by hand.

## 6. A8's walk is not a player's walk

A8's `native_poi_ragnarok_test.gd` asserts that a body "physically walks" routes. Its
actor issues **one `move_and_collide` for the whole distance**; the production
`Knight` runs `move_and_slide` at a bounded speed. Same body size, same world layer,
different everything else.

Measured on one fixture wall both bodies face, sixty frames of diagonal input:

| | production Hero | A8 harness mover |
|---|---|---|
| travel while pressed into the wall | `dx=25.5 dy=-95.7` | `dx=9.8 dy=-9.8` |
| behaviour at contact | slides up the wall, clears its top edge, keeps going | the rest of the step is discarded |
| body | `RectangleShape2D 12x16 @ (0,-8)`, layer 2, mask 5, `motion_mode=1` | same size, layer 2, **mask 1**, `motion_mode=0` |
| 30 frames of `move_right` | 54.85 px | one step: 54.85 px |

So A8's "reachable" is a claim about geometry with single-sweep collision; its
"blocked" is stricter than a player's route (the player slides around the corner the
harness calls impassable); and no claim of either kind can carry pacing. A7 accepts
either remedy: state the mover in the claim, or mount the production Knight.

## 7. The economy: real rules, unreachable runtime

`r9_economy_custody_probe.gd` runs A3's V7 code against A7's own double of
`soh.economy.a0_profile_port.v1` — never production, and every number carrying
`MODEL_ORACLE`. What it shows:

* **Vendor drift, again.** `game/survival/economy/vendor/a3_economy_service.gd`
  (the file A0's `save_service.gd:29` actually preloads) declares **none** of the
  nine meta methods: `configure_meta_profile_port`, `plan_meta_source_claim`,
  `apply_meta_source_claim`, `plan_meta_deposit`, `apply_meta_deposit`,
  `plan_meta_purchase`, `plan_meta_recycle`, `plan_meta_refund`. The canonical
  `economy_service.gd` declares all eight. (A seventh, `project_meta`, does not
  exist in A3 and is not claimed.)
* **No port, no plan.** Without an A0 boundary every meta plan returns
  `A0_PROFILE_BOUNDARY_ABSENT` — fail-closed by name, not silent.
* **The rules hold once fed.** Claims before hour 264 →
  `premature_ragnarok_claim` at 1 h, 263 h and 264 h−1 s; open exactly at 264 h
  (3 units). Past the limit → `run_expired`. Forged source generation →
  `source_generation_forgery`; depleted source → `source_not_openable`.
* **Deposits are physical.** A token the bag does not hold →
  `token_not_in_bag_custody:orphan_token`; wrong cell → `hero_not_at_endpoint`;
  not visited → `endpoint_not_visited_or_offline`; wrong run →
  `endpoint_identity_mismatch`; wrong endpoint kind → `endpoint_authority_absent`.
  The stale-revision case is refused *earlier*, by custody — recorded as refusal with
  the ordering named, not as a pass of the revision rule.
* **No printer.** A purchase against a zero secured balance →
  `insufficient_secured_currency`; the recycler's `profile_currency_delta` is `0`;
  the six elder stones are worth `currency_value = 0`; the policy names ten
  forbidden effects including `automatic_profile_credit_on_chest_open`,
  `automatic_profile_credit_on_run_expiry`, `recycler_profile_currency_output` and
  `stone_to_currency_conversion`.
* A refused plan writes nothing to the durable balance (`profile_writes` unchanged).

Missing from A0's side, named individually: the meta API in the adapter the runtime
loads, a `profile` namespace in the save, and the port surface itself
(`run_context`, `endpoint_authority`, `source_authority`, `read_profile`,
`apply_profile_delta`).

## 8. The Waystation: exact geometry, no door

Without a mount, the authored data is still checkable — and it is exact:

* 8 points, and the probe's table matches the shipped `POINTS` constant cell-for-cell;
* every stand cell is orthogonally adjacent to its point, so the host's own
  `<= 24.0 px` rule is always satisfied from the stand (a two-tile stand would pass
  the cell equality test and fail the distance test — that inconsistency is asserted
  absent);
* `matches_interaction` requires the production body's **exact** stand cell plus the
  distance test, so an unreachable stand is an unreachable interaction by
  construction.

What cannot happen: the walk, the click, the receipt. The host is inert until
`configure(world, hero, session)` and the world refuses to build with its own flag,
for the reason in §3.

## 9. Restart: the save boundary is real

Two OS processes, same binary, same tree, only the file between them:

```
receipts 1 -> 2, placed=1, oak_wood=38        (process A)
child_exit=0  child_report={"pid":15509,"save_loaded":true,"mounted":true,
              "receipts":2,"placed":1,"oak_wood":38.0}   (process B)
```

The action is a real one a player performs — committing a structure through the build
system, which writes the same durable receipt store the Waystation uses (`API_NOT_CLICK`,
because headless cannot aim). Durability across a genuine restart: measured. The
*replayed Waystation click pays nothing* claim: unmeasurable, and reported as such
rather than assumed either way.

## 10. Nine gates, binary

| gate | statement | verdict |
|---|---|---|
| G1 | the shipped overworld builds under its shipped `project.godot` | **yes** |
| G2 | the Waystation exists for a player | **no** — host requires the A3 economy session; a stale A0 pin disables it |
| G3 | a player can stand on every authored stand cell and interact | **not measurable** — G2 fails first; geometry itself is exact |
| G4 | a committed action survives a real OS restart | **yes** |
| G5 | a repeated click at the same point pays nothing | **not measurable** — G2 fails first |
| G6 | the build economy works through the product's own path | **yes** — commits once, costs exactly 2 oak wood, refuses solid terrain by name |
| G7 | a shipped player has the survival economy (crafting, meta actions) | **no** — `economy_session == null` |
| G8 | the 14-day clock is anchored durably and expires offline | **no** — no run record anywhere in A0 |
| G9 | route claims in A8's suite transfer to player movement | **no as written** — mover semantics differ, quantified in §6 |

## 11. R0–R5

| level | state |
|---|---|
| **R0** compiles and boots | **yes** — real Godot 4.7, headless, 7 round-9 probes plus round-8's 15, all on pinned SHAs |
| **R1** the journey runs | **partly** — placement works; the Waystation door does not exist |
| **R2** the run exists | **no** — no run record; A3's clock is correct and unreachable |
| **R3** the finale exists | **no** — unchanged from round 8 |
| **R4** the two economies hold | **no** — A3's rules are proven, A0's boundary is absent |
| **R5** the 14-day experience is coherent | **no** — gated on R2–R4 |

## 12. Owner fixes, in order

1. **A0 — refresh one hash.** `a0_v5_source_pins.DATA["res://data/survival/items/items.json"]`
   `cc3c1165… → cd1a27c4…` (the sha256 of A3's current owner bytes). Without it the
   survival economy is off for every player and the Waystation cannot mount, which is
   the single highest-value fix in this round.
2. **A0 — implement `soh.economy.a0_profile_port.v1`** (`run_context`,
   `endpoint_authority`, `source_authority`, `read_profile`, `apply_profile_delta`)
   and stop pinning the V5 vendored adapter, so A3's V7 economy can be mounted.
3. **A0 — a durable run record**: `run_id`, `run_started_at_unix`,
   `run_expires_at_unix = start + 1209600`, plus an ended-run state that stops
   mutations. Everything in D066/D071 is blocked on this and nothing else.
4. **A8 — state the mover in route claims**, or mount the production Knight.
5. **A7 — no action requested of A0/A6 for placement**; round 8's advice is withdrawn.

## 13. What the player can actually do on `ef2ad0f09310`

| The player can | The player cannot |
|---|---|
| boot, load a save, play the overworld, gather and build | see any survival crafting or meta-economy UI — the session never configures |
| place a structure for exactly its catalogue cost, with solid ground refused by name | reach the Waystation, its locker, cache, ledger, deadfall, three roadside caches or the relay crank |
| restart the game and find every committed action intact | bank a Ragnarok token, buy from a vending kiosk or recycle salvage |
| | see a run clock, a season, an expiry or any consequence of a restart being a *new* run |

What is real at the end of round 9: a reproducible two-profile composition, 7
production-input probes on a real engine, a quantified retraction of round 8's own
conclusion, and one stale hash with an exact replacement value — instead of a status
word.
