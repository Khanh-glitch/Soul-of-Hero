# Round 11 — the current composition, played: what a player can do, what the product refuses, and what is not there

**Composition:** `refs/comp/r11_full` = `c5eb573bfadba4cd9a788ca60b015f7ff6163b11`
**Engine:** Godot `4.7.stable.custom_build.5b4e0cb0f`, built from source in this sandbox
(`platform=linuxbsd target=editor -j2`, 41 m 25 s; the release asset is unreachable from here)
**Recorded runs:** `data/survival/balance/results/native_runs.v1.json` (rows keyed `c5eb573bfadb`);
round 10's payload is preserved verbatim as `native_runs.r10_full.v1.json`, the same convention
round 9 used
**Verdict of the round:** **`ACCEPT_DIAGNOSTIC_EVIDENCE / ROUND10_STALE_CONFIRMED / HOLD_PRODUCTION / NO_MERGE`**
A7 does not merge, does not rewrite an owner file, and does not move an owner pin. Every number
below is from a native run at the SHA above; a fixture pass is labelled as a fixture pass and is
never counted as a journey pass.

---

## 1. What was rebuilt, and why round 10's words could not be reused

Round 10 was published on `1d39e92e75d8`. Since then A0, A1, A3, A6 and A8 all moved. Round 10's
findings were therefore **re-measured, not carried forward**: three of its headline failures are
gone at these bytes (§3), one of its passes is unchanged, and two new defects were found that round
10 could not have seen.

A composition here is not a branch. `tools/survival/balance/compose.py` starts from A0's head and
replaces, by exact prefix, the paths each other owner owns at *its* head; every path in the result
names the commit its bytes came from (`.artifacts/compose11/composition.r11_full.json` carries the
per-path provenance and a `provenance_digest`). No owner file is edited, added or removed to build
it. `refs/comp/r11_full` is the one commit that tree hashes to.

| profile | commit | files | base | overlays |
| --- | --- | --- | --- | --- |
| `r11_a0` | `f0f520e10d95` | 5 279 | A0 `738e621b688e` | — |
| `r11_core` | `7af17172ee65` | 5 555 | A0 `738e621b688e` | A1, A3 |
| `r11_full` | `c5eb573bfadb` | 5 635 | A0 `738e621b688e` | A1, A3, A6, A8 |
| `r10_full` (stale) | `1d39e92e75d8` | 5 511 | — | — |

### 1.1 Source matrix at the round-11 heads

| owner | ref used | SHA |
| --- | --- | --- |
| A0 (base) | `refs/live/arena-dea2428e` | `738e621b688e9d9890f636ef2ece48f6d29f5b01` |
| A1 | `refs/live/arena-e385312a` | `9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf` |
| A3 | `refs/live/arena-7a12b27e` | `b44e22df3af40939069189be14afc23ee1ce21c4` |
| A6 | `refs/live/arena-05e0328d` | `e88f2cee18ddafc971023e09a99f716fd518c191` |
| A8 | `refs/live/arena-2d7e6d7a` | `6337533f7cc0d39487921e279d3967ac29a59297` |
| AVFX | `refs/live/arena-c7b0c4e8` | `8eb6b31c3c1ae51227f8b5079bf4fbbe966291a3` — **reference only** |
| CT | `refs/live/docs-ct-loot-discovery-gate-20261030` | `971e0b95e1ea1c5f579f57f53fb35f3a6c3845e8` |
| CT gate doc | `refs/live/feature-survival-rpg-foundation` | `accb8a8cc16e` |

**AVFX is pinned for provenance and deliberately not overlaid.** Its unique paths are
`.github/workflows` and `docs/vfx`; every VFX asset it shares with A0 is identical or older, so
overlaying it would *downgrade* the base. There is still no Gold cast in this composition, and none
was fabricated: `a6/ui` ships a manifest and a pipeline, not cast bytes (§5).

### 1.2 The fence, re-verified byte by byte

A0's `a0_v5_source_pins.gd` fences 10 data files and 5 scripts. Recomputed with `sha256sum` against
the composed tree:

```
exact 15 drift 0 missing 0 total 15
```

**15/15.** In round 10 this fence was 12/15 with `35214ed8` unresolvable — the A0 vendor copy of
A3's world-source script had drifted from A3's own bytes, and one pin named a commit that is not a
tree. At `c5eb573bfadb` the composition overlays A3 at `b44e22df`, whose data files are exactly the
bytes A0 pins. **Old bug, genuinely fixed by the composition, not by editing A0.**

The fence is not merely self-consistent, and A7 did not take A0's word for it: the seam probe reads
`a0_v5_source_pins.gd`'s own constant map and **re-hashes every pinned path from the composed bytes**
rather than calling A0's `verify()`. (A0's `verify_with()` referee for a stale override exists and
returns `a3_data_pin_mismatch:<path>` by name; that is A0's test, not this round's evidence.)

---

## 2. Result at a glance

| probe | checks | failed | missing | verdict |
| --- | --- | --- | --- | --- |
| `r11_seam_probe` | 34 | 0 | 0 | **PASS** |
| `r11_j01_probe` | 33 | 0 | 2 | `RED_NOT_IMPLEMENTED` |
| `r11_j02_j05_probe` | 28 | 0 | 4 | `RED_NOT_IMPLEMENTED` |
| `r11_j03_probe` | 21 | 0 | 1 | `RED_NOT_IMPLEMENTED` |
| `r11_j04_probe` | 11 | 1 | 2 | `RED_NOT_IMPLEMENTED` |
| `r11_j06_j07_probe` | 41 | 0 | 2 | `RED_NOT_IMPLEMENTED` |
| `r11_adversarial_probe` | 21 | 0 | 0 | **PASS** |
| `r11_visual_probe` | 5 | 0 | 1 | `RED_NOT_IMPLEMENTED` |
| **total** | **194** | **1** | **12** | PASS 2 / RED 6 / FAIL 0 / BLOCKED 0 |

Runner totals for the eight probes in one invocation:
`{"PASS": 2, "FAIL": 0, "BLOCKED": 0, "RED_NOT_IMPLEMENTED": 6}`.

**How to read "RED".** A red probe means the *mechanics it could reach are green* and the journey
still cannot be played, because a named piece of the product does not exist. It is not a harness
failure: every one of the 12 missing items names the file, method and refusal string that is absent.
One check failed outright (J04's site differentiation, §4.4); that is an authoring defect, not a
missing owner.

---

## 3. Registry: what round 10 reported, and what is true now

| # | round-10 statement | at `c5eb573bfadb` | evidence |
| --- | --- | --- | --- |
| 1 | A0 fence 12/15, `35214ed8` unresolvable | **FIXED** — 15/15 exact | §1.2 |
| 2 | One run identity; `end_run` reachable only from the composition | **UNCHANGED** — 1 caller, `a0_economy_composition.gd:97`, and it is a `Callable`, not a literal `end_run(` | `r11_seam_probe` |
| 3 | `configure_meta_profile_port` has one production caller | **UNCHANGED** — 1 real caller, `a0_economy_composition.gd:81`; the only other two hits in `game/` are the method definitions in `economy_service.gd` and its vendor copy | `r11_seam_probe` |
| 4 | Endpoints: 9 authored stands, 0 operational | **PARTLY FIXED** — 1 endpoint (`preservation_kiosk_01`, stand `(408,199)`) now has an authored stand; the other 8 have no site or are owner-unauthorized | `r11_seam_probe` |
| 5 | Run expiry implemented but unreachable | **PARTLY FIXED** — the lifecycle now reports `state=expired phase=expired` live at 336 h and `settle_expiry()` closes the run with `end_reason=expired` in immutable history; but the **only** production caller of `settle_expiry` is the composition's launch path (`a0_economy_composition.gd:62`), so an expiry that happens while the player is standing in the world is written at the next launch | `r11_j06_j07_probe` |
| 6 | No Skill Core reachable, no charge authority | **UNCHANGED** — 3 cores, all `PROPOSED_WORLD`; `_skill_attestor` is an invalid `Callable`; 0 call sites of `configure_skill_attestor` or `commit_cast` outside the economy service | `r11_j02_j05_probe` |
| 7 | No damage producer | **UNCHANGED** — 0 call sites of `take_damage`/`take_resolved_damage` under `game/overworld` or `game/survival`; 0 enemies mounted | `r11_j02_j05_probe` |
| 8 | A6 has no sprite bytes and A0's `knight.tscn` never references A6's presenter | **UNCHANGED, and now precisely located** — A6's manifest declares its own status `PRIVATE_RUNTIME_STAGING_REQUIRED` and "No source sprites are included in Git" (18 sprite references, **0** present), and the presenter file is not in the composition at all | §4.1, §5 |
| 9 | A8 site scenes exist but mount nothing in the overworld | **UNCHANGED** — 0 A8 site nodes under the mounted overworld | `r11_j04_probe` |
| 10 | A0's death bag is real, one bag, durable, all-or-nothing | **UNCHANGED, and now proven across a second process** | `r11_j02_j05_probe` |
| 11 | *(new)* A successful `collect` reports a failure string | **NEW DEFECT** — `economy_session.collect` returns `{ok: true, reason: "rejected"}`; a UI keyed on `reason` will tell the player a paid claim failed | §4.3 |
| 12 | *(new)* Catalogue kinds vs the inventory writer | **NEW DEFECT** — 13 of 57 item ids have a catalogue `kind` (`station_kit` 5, `equipment` 5, `skill_core` 3) that `SaveService.INVENTORY_ITEM_KIND_IDS` refuses; only A3's own `station_kit → material` mapping makes a furnace kit holdable, and nothing maps equipment or cores at all | §4.2, §7.4 |

---

## 4. WP2 — the journeys, clause by clause

Each journey is classified on eight axes. `SOURCE_DEFINED` = the owner authored it;
`CODE_PRESENT` = the code path exists in the composition; `PRODUCTION_REACHABLE` = a player can get
to it without a fixture; `PLAYER_INPUT_EXECUTED` = the probe drove real input/physics;
`SAVE_VERIFIED` = the result survives a restart; `VISUAL_INSPECTED` = a frame was looked at;
`PRODUCT_VALUE` = it produces something an economy can price; `HUMAN_PLAYTESTED` = a person played it.
**A7 marks `HUMAN_PLAYTESTED` false everywhere. A model's utility weights are not a playtest.**

### 4.1 J01 — first hour: spawn, scavenge, tool, storage, return

| axis | result |
| --- | --- |
| SOURCE_DEFINED | yes — 5 resource node kinds, 9 build pieces, 57 items |
| CODE_PRESENT | yes — harvest, tool use, placement, containers, save |
| PRODUCTION_REACHABLE | **mostly yes** (bare hand, tool, chest); **no** for the selected avatar and the knife |
| PLAYER_INPUT_EXECUTED | **yes** — real `CharacterBody2D` walking, `Input.action_press`, `node.interact(hero)` |
| SAVE_VERIFIED | **yes** — a second OS process opens the same run and the same placed chest |
| VISUAL_INSPECTED | **no** — no rendered frame (§5) |
| PRODUCT_VALUE | yes — 2 oak per hit, 3 hits, 300 s respawn |
| HUMAN_PLAYTESTED | no |

What actually happened, in engine time, in one process:

* **Spawn is safe.** The spawn cell is `(56,218)` at world `(904,3496)`. An earlier round-11 run
  reported the spawn as "inside blocking collision" because the probe asked
  `traversability.is_walkable` for the 49 cells around the Hero and got `false` for all of them.
  That was a **probe/query mismatch, not a product defect**: the product's spawn door is
  `traversability.spawn_cell()` + `reachable_from()`, and the reachable set from the spawn is
  **98 304 cells**. The corrected probe walks out of the spawn in all four directions without
  teleporting, so "safe spawn" is a green clause and the earlier red was retracted rather than
  argued away. *(Recorded here because retracting a false red matters as much as reporting a red.)*
* **Bare-hand scavenging works.** Walk 260 px to `oak_tree@59,202`, `interact` → oak `0 → 2`,
  hits `3 → 2`. Second node `stone_outcrop@71,214` → 2 swings, 4 stone chunks.
* **The crafted tool is real, crafted, and its wear is atomic.** `stone_pick` queued at the hand
  station (2 oak + 3 stone escrowed), ready after six seconds of real time, collected once; A3
  minted `soh_i_…_d3346167` with `origin: economy` — **no fixture**. (An earlier pass of this probe
  looked for the instance in the raw economy document instead of A3's `owned_instances` API, missed
  it, and fell back to a granted tool; that fallback is gone and the claim now rests on the crafted
  instance.) The next swing on a stone outcrop shows
  **condition 100 → 99, revision 0 → 1, receipts 12 → 13, yield 1 → 3** — one receipt for wear and
  yield together. There is no window in which the tool is worn and the item is not granted, and the
  adversarial probe proves the converse (a full bag refuses the swing *before* the wear).
* **Paid storage is a real door.** `chest_wood` costs 4 oak + 1 iron; the placement door refuses
  `world_blocker` cells and `hero_in_footprint`, then builds. A second OS process sees the chest.
* **A6's avatar is absent.** A6 ships the *selection* half (`avatar_appearance_adapter.gd`,
  `avatar_sprite_pipeline.gd`, `a6_item_icons.gd`) and a manifest, but
  `player_avatar_presenter.gd` is not in the composition at all, and the manifest says so itself:
  status `PRIVATE_RUNTIME_STAGING_REQUIRED`, "No source sprites are included in Git" — **18** sprite
  references, **0** present. Code: **`A6_SOURCE_UNAVAILABLE`**.
* **There is no knife.** 57 catalogue ids, none is a knife or a blade. "Knife-first" is a bare hand.

### 4.2 J02 — the rare Skill Core: acquire, USE, STORE, RESEARCH

| axis | result |
| --- | --- |
| SOURCE_DEFINED | **partly** — 3 cores and 6 sources exist in A3's data, all `PROPOSED_WORLD` |
| CODE_PRESENT | yes — `commit_cast`, `owned_instances`, container sweep, research catalogue |
| PRODUCTION_REACHABLE | **no** for all four verbs |
| PLAYER_INPUT_EXECUTED | n/a — nothing to acquire |
| SAVE_VERIFIED | n/a |
| VISUAL_INSPECTED | no |
| PRODUCT_VALUE | **no** — a Core is worth nothing until it can be spent |
| HUMAN_PLAYTESTED | no |

The four verbs, each measured at its own door:

* **ACQUIRE** — `specimen_venom` is `PROPOSED_A1` at `poi:specimen_vault_venom` with requirements
  `[access_tier 2, power]`; all six core sources are `integration_status != LIVE`; no mounted world
  node binds any of them. **Missing, A1/A8.**
* **USE** — `economy_service._skill_attestor` is an **invalid `Callable`**, and no code in `game/`
  calls `configure_skill_attestor`. A real attempt on a held core returns
  `skill_gate_unavailable`. Use is fail-closed, which is the right shape and still means there is no
  charge authority. **Missing, A0/A3 decision + A4 attestor.**
* **STORE** — a chest accepts ordinary materials (`{oak_wood: 4, iron_scrap: 1}`) and **refuses an
  instance item on purpose**: `_transfer_all` skips anything `is_sweepable_item` says is a coupled
  unique ("leave coupled unique instances where the A3 ownership audit supports them"). So
  STORE-the-Core is not a player choice either. This is a *documented custody rule*, not a bug —
  but CT should know that the J02 matrix has no green verb.
* **RESEARCH** — 5 technologies in `research.json`, **1** with "core" in its id, and it is not a
  Core duplication path. **Missing, A3.**

### 4.3 J03 — funded station work, real elapsed time, one settlement, one claim

This is CT's primary target for the round, and it is **the one journey that is mechanically whole**:

| axis | result |
| --- | --- |
| SOURCE_DEFINED | yes — `burn_charcoal` = 2 oak → 2 charcoal, furnace, 8 ticks, `mode_allowlist [persistent_home]` |
| CODE_PRESENT | yes — placement → queue → arm → host projection → settle → claim |
| PRODUCTION_REACHABLE | **yes, except the kit's kind** (§7.4) and except A6's return card |
| PLAYER_INPUT_EXECUTED | **yes** — placed through `try_place`, escrow paid from the real bag, 12 s of real blocked wall clock, second OS process |
| SAVE_VERIFIED | **yes** — the returning process settles and claims from the durable file |
| VISUAL_INSPECTED | no |
| PRODUCT_VALUE | **yes, and it is mispriced** (§6.2) |
| HUMAN_PLAYTESTED | no |

The literal sequence, from `r11_j03_probe`:

1. furnace built through the player's door at a legal cell; `resolve_station` → `kind=furnace`,
   `operational=true`;
2. `queue_recipe("burn_charcoal")` escrows **exactly** 2 oak (`oak 4 → 2`) and returns `job_000001`;
3. `arm_offline_operation` succeeds; a caller **cannot** forecast a future interval
   (`project(now, now+3600)` returns `{}`);
4. 12 s of `OS.delay_msec` — the main thread does no work, exactly like a closed game;
5. a **second OS process** opens the same file and the composition settles on launch:
   `settle_ok=true`, `operations=1`, `charcoal 2`;
6. the player claims once (`claimed=true`), and the **second claim is refused**
   (`nothing_to_collect`), bag unchanged `2 → 2`.

Two defects ride along, both real:

* **A6 cannot read the settlement.** All six A6 accessors return empty contracts
  (`season_clock_missing`, `run_facts_missing`, `return_digest_missing`, `run_history_missing`;
  `digest_acknowledgements` and `site_cue` are absent). A6 resolves nine owner methods by name and
  none exists on the composed autoloads. The card is empty **by design**, and the probe asserts
  that it does not invent a reward for a settlement it cannot read.
* **A successful claim reports `reason: "rejected"`.** `economy_session.collect` returns
  `{ok: true, reason: "rejected"}` because `_transact` leaves the trial-mutator's reason string in
  place on success. Any UI keyed on `reason` will tell the player their claim failed when it paid.
  Cosmetic, but it is the exact class of bug that makes a playtest report unreadable.

### 4.4 J04 — Quarry / Orchard / Mill: a route with no destination

| axis | result |
| --- | --- |
| SOURCE_DEFINED | **yes** — three sites with 3/2/2 authored choices |
| CODE_PRESENT | **no** — no A8 site node is mounted |
| PRODUCTION_REACHABLE | no |
| PLAYER_INPUT_EXECUTED | no |
| SAVE_VERIFIED | n/a |
| VISUAL_INSPECTED | no |
| PRODUCT_VALUE | no |
| HUMAN_PLAYTESTED | no |

* **Mounted:** 0 A8 site nodes under the overworld. `chapter1_overworld.gd` instantiates landmarks,
  camps and resource nodes only; the three sites exist as standalone scenes.
* **Authorized:** `world_action({poi_id, action_id})` returns **`unknown_world_poi`** for all three
  — A3 has no world document containing them, so the refusal happens *before* authorization is even
  considered. (An earlier round-11 draft of this probe passed `contract`/`run_id`/`event_id` inside
  the request and got `invalid_world_request_field:contract`; A3 accepts exactly `poi_id`,
  `action_id`, `instance_id`, so the corrected probe reports A3's real answer.)
* **Differentiated:** **FAIL.** Two of the three sites are structurally identical in the authored
  data (`south_orchard_ruin` and `south_crown_mill`: 2 choices each, 0 with a cost, no risk tier);
  only `south_quarry` has three. A POI that differs only in its prose is not a different decision.
* A8's `world_source_adapter` **forbids a core as a POI reward** by construction
  (`binding_core_reward_forbidden`, `world_action_core_reward_forbidden`), so J02's "a Core at a
  POI" could not be built by widening a site reward even if the site were mounted. Good — this is
  the fail-closed rule doing its job, and it is why the Core must come from its own A1 source.

### 4.5 J05 — threat, one death bag, recovery

| axis | result |
| --- | --- |
| SOURCE_DEFINED | **partly** — death bag, custody rules, respawn |
| CODE_PRESENT | yes |
| PRODUCTION_REACHABLE | **no** — nothing in the world can hurt the Hero |
| PLAYER_INPUT_EXECUTED | **yes at the API door** (no hazard exists to walk into) |
| SAVE_VERIFIED | **yes** — a second OS process sees the same pending death and no second bag |
| VISUAL_INSPECTED | no |
| PRODUCT_VALUE | n/a |
| HUMAN_PLAYTESTED | no |

Measured through the product's own methods: `begin_overworld_death(pos)` → `death_1` with 2 stacks;
a second call returns `already_pending=true` with the **same** id; `finish_overworld_death` clears
the pending flag once; `recover_death_bag` restores the exact materials and a replay is refused.
`recover_death_bag` refuses while the death is *pending*, so the player's order is respawn-then-
recover — the probe follows that order (round 10's draft did it backwards and read a false red).

Two custody facts worth CT's attention:

* **The late-run currency is losable** — `ragnarok_unbanked` drops into the bag and leaves the
  inventory. Green.
* **A unique A3 instance is not.** `begin_overworld_death` keeps every `soh_i_` stack in the bag and
  puts only ordinary stacks in the bag record ("until death-bag ownership is supported by its
  audit"). That is a deliberate retention rule, and it means a *unique* item can never be lost. If
  the creator-locked design wants any unique item to be at risk, this rule and that design have to
  be reconciled — A0's, not A7's, to decide.

### 4.6 J06 / J07 — last 72 hours, deposit, reset, three carried benefits

| axis | result |
| --- | --- |
| SOURCE_DEFINED | **yes** — 7 currency sources, 9 endpoints, a 336 h run, a reset that carries 5 units, 3 profile benefits |
| CODE_PRESENT | yes |
| PRODUCTION_REACHABLE | **no** — no physical chest, no player-facing abandon, no operational kiosk |
| PLAYER_INPUT_EXECUTED | **yes at the API door** |
| SAVE_VERIFIED | **yes** — history, balance and benefits survive a reset |
| VISUAL_INSPECTED | no |
| PRODUCT_VALUE | **no** — the currency cannot be earned in this build |
| HUMAN_PLAYTESTED | no |

* **Custody window:** with a forged run clock (`MUTATION_RUN_CLOCK`, 360 000 s → phase `entry`,
  993 600 s → phase `last72`), a claim inside the last 72 h is refused **`source_identity_forgery`**
  — the world binds no instance of `elder_ashen_vault`. All 7 currency sources are
  `OWNER_CONTRACT_CANDIDATE_A8`, i.e. not physical. **Missing, A8 source + A1 geometry.**
* **Deposit:** `preservation_kiosk_01` now has an authored stand at `(408,199)` — round 10 had none
  — but its authority is `A1_A8_ENDPOINT_UNAUTHORIZED:OWNER_CONTRACT_CANDIDATE_A1_A8`
  (`operational=false`, `visited=false`). The refusal names the owner, not the player's location.
* **Expiry:** at 1 209 660 s the lifecycle reports `state=expired phase=expired` **before anything
  closes it**, and its own `settle_expiry()` then closes the run and records `end_reason=expired` in
  history. The mechanic is right; its only production caller is the composition's launch path, so a
  run that ages out mid-session is written when the composition is next built. That is the remaining
  "implemented but unreachable" edge, and it is much smaller than round 10's version of it.
* **Abandon / evacuation:** `abandon_run` has **0** callers in `game/`. The finale cannot be chosen.
* **Reset and benefits:** the reset path runs, the closed run's history is immutable, the new run
  gets a new id, and the carried currency is still spendable afterwards (`balance == 5`).

---

## 5. WP5 — visual: attempted, and honestly not obtained

`r11_visual_probe` asks the engine for a frame at three resolutions and reports exactly what it got:

```
display_driver=headless visible_rect=(640.0, 360.0) texture_null=false image_ok=false
no rendered frame is obtainable in this environment
```

The sandbox has no display server, no libGL/libEGL/Vulkan/DRI, and the Godot release assets are
unreachable (TLS failure), so the engine itself had to be compiled here — a compiler is not a GPU.
**`VISUAL_NOT_REVIEWED`.** Nothing in this report claims a frame was looked at, and no screenshot
is fabricated. What *can* be measured without a frame is measured: the HUD node exists with 11
controls and 5 text labels, the survival HUD script contains **no** currency/"Gold" string at all
(so the A6 legibility requirement cannot be met by the current HUD), and one swing produces a
readable result (`{ok, reason, item_id, quantity, hits_left}`) that a prompt can render.

**CT's A6 art approval is not integration approval.** A6's manifest ships with its own status
`PRIVATE_RUNTIME_STAGING_REQUIRED` and no sprite bytes in Git (18 references, 0 present); the
presenter is not in the composition; the Hero is A0's scene. Integrating the avatar is an
A0-file change (or an overlay-policy change), which is exactly the kind of cross-owner edit A7 must
not make.

---

## 6. WP4 — gameplay quality, measured where it can be

Atlas anchors: USER-JOURNEY 01 (first hour), 02 (rare Core), 05 (POI), 07 (last 72 h), 12 (return);
DEP-01 (spawn), 15 (storage), 18 (offline), 19 (reset).

### 6.1 Net expedition value from real receipts

All numbers below come from the composed data and from the runs above; nothing is estimated from a
model.

| flow | quantity | cost | time |
| --- | --- | --- | --- |
| `oak_tree` | 2 oak / hit, 3 hits = **6 oak** | 0 (bare hand) | 300 s respawn |
| `stone_outcrop` | 2 stone / hit, 3 hits = **6 stone** | 0 | 480 s |
| `iron_vein` | 1 scrap / hit, 2 hits = **2 scrap** | 0 | 720 s |
| `stone_pick` | 100 condition, 1/swing → **200 stone or 100 iron** per lifetime | 2 oak + 3 stone | — |
| `chest_wood` | 30-slot bag → 12-slot container | 4 oak + 1 iron | — |
| `bed_wood` | respawn point | 4 oak + 1 iron | — |
| `burn_charcoal` | 2 charcoal | 2 oak | 8 ticks (**8 s offline**, 0.13 s online) |
| `smelt_iron` | 1 ingot | 3 scrap + 1 charcoal | 12 ticks |

What this says about the *economy*, in three sentences a designer can argue with:

1. **The tool is not a money sink.** 2 oak + 3 stone buys 100 swings; those swings return 200 stone
   or 100 iron, which is 30–100× its own cost. Tool choice is therefore a *permission* decision
   (the catalogue's `TOOL_USE_RESOURCE_KINDS` maps `stone_pick` to `stone_outcrop`/`iron_vein`,
   `iron_pick` to `iron_vein`/`scrap_pile` and `salvage_hammer` to `scrap_pile`; **wood is always
   bare-handed**), never a cost decision. The second pick does not raise yield — it adds one node
   kind — so `iron_pick` is a *key*, not an upgrade. There are **no repair recipes** at all (36
   recipes, none repairs), so condition is a pure timer that never interacts with the economy.
2. **The only real wall is travel and respawn.** The nearest oak is 260 px (16 tiles) from spawn,
   stone 247 px. The full first-hour loop — spawn → oak → stone → craft → swing → chest → deposit —
   ran in **19.8 s of wall clock for the whole probe**. `respawn_seconds` (300–720 s) is the binding constraint, and it
   is a *waiting* constraint, not a *risk* one, because nothing in the world can hurt the Hero.
3. **Online and offline agree, and that is the good news.** Measured directly: a 6-tick hand recipe
   stepped `elapsed 0,1,3,4,5,6` over six real seconds while the game ran, and the offline planner
   applied **3 ticks for a 3 s absence** — both are ≈ **1 tick per real second**. (An earlier draft
   of this round claimed a 60× gap from `economy_session.TICKS_PER_SECOND := 60`; that constant only
   feeds a *fractional-step display remainder*, and the measurement retracts the claim. Recording the
   error here rather than deleting it, because a wrong balance number is worse than no number.)
   The consequence for the design is the opposite of a bug: an 8-tick charcoal burn costs the same
   eight seconds whether the player is at the bench or absent, so the only advantage of the paid
   offline job is that it happens while the game is closed — which is the intended shape.

### 6.2 What cannot be scored here

* **Fun.** No model output can make this a pass. `HUMAN_PLAYTESTED=false` for every journey.
* **Risk.** Nothing damages the Hero, so no route has a cost of failure; any "risk" number for the
  three POIs would be authored prose, not play.
* **Readability at 720p/1440p/2160p.** No frame exists (§5).

### 6.3 Per-POI verdict (WP4 requirement)

| POI | verdict | required evidence |
| --- | --- | --- |
| `south_quarry` | **`REJECT_WITH_REQUIRED_EVIDENCE`** | mount the site, bind one physical stand, authorize one bounded action with a real cost and cooldown, and re-run J04 |
| `south_orchard_ruin` | **`REJECT_WITH_REQUIRED_EVIDENCE`** | as above **plus** a second axis of difference from the mill (cost, requirement or outcome), because today the two are the same shape |
| `south_crown_mill` | **`REJECT_WITH_REQUIRED_EVIDENCE`** | as above, **and keep the Quarry's `REJECTED_PENDING_EVIDENCE_FAIL_CLOSED` closed** — A3's fail-closed answer is correct until an owner supplies evidence |

---

## 7. WP3 — adversarial and mutation results

All 21 checks green at these bytes. Each case enters through a product door; each refusal string was
asserted, because a refusal for the wrong reason is not evidence.

**Mutations, named.** Anything a probe could not obtain by playing is marked in the log with the
mutation that produced it, so no reader has to guess which claim rests on a fixture:

| marker | what it changes | where it appears |
| --- | --- | --- |
| `MUTATION_RUN_CLOCK` | `profile.run.run_started_at_unix` / `run_expires_at_unix` — eleven days of wall time cannot be played inside a probe | J06/J07 (entry, last-72 h, expired) |
| `FIXTURE_GRANT` / `FIXTURE_REFUSED` | items placed in the bag through `SaveService.grant_inventory_item` so a cost can be paid | J01 (chest cost), J03 (furnace kit + 4 oak) |
| `FIXTURE_GRANT … instance=` | one `storage: instance` item minted through `economy_service.grant_instance` (a real instance record + `soh_i_` token) | J02 (a Core), J01 (a tool) |
| `OS.delay_msec` interval | 12 s in which the process runs no frames — the product's own offline interval, nothing forged | J03 |

A fixture grant is never used to satisfy a *journey* clause. It is used to pay a price the probe
cannot yet earn (a Core whose source is `PROPOSED_A1`, a kit whose recipe needs a furnace), and every
check that depends on one says so in its own note.

| case | result |
| --- | --- |
| stale tool revision | `TOOL_REVISION_STALE` on the replay; the first swing committed against the planned revision |
| spent node | 3 swings empty the outcrop; the 4th is refused and **costs no condition**; the 3 that worked wore the *planned* tool 100 → 96, revision 4 |
| full bag | 29 stack records fills the bag; a further unique item is refused (`inventory_full`) |
| protected cell | 3 refusals (`protected_place`) at the spawn, and `try_place` cannot be forced past them |
| stale run output | the run ends, a new one opens, and committing the old proposal returns **`stale_offline_proposal`**; 0 charcoal lands in the new run |
| duplicate claim | second claim `nothing_to_collect` (J01/J03); chest claim refused upstream `premature_ragnarok_claim` |
| interrupted save | with `--survival-save-fault-test`, a commit interrupted at `after_primary_renamed` reports failure, does not half-apply in memory, recovers to a bag that **carries its receipt**, and a retry **cannot pay twice** |
| unauthorized vending | `endpoint_not_visited_or_offline` |

Documented, not scored: wrong-stand deposit and the duplicate chest claim cannot reach their own
rule because A1/A8 endpoint authorization refuses first (`A1_A8_ENDPOINT_SITE_ABSENT:crown_approach`).
The probe records the gate that stopped it instead of passing it by proxy.

---

## 8. WP6 — the gates

### 8.1 Nine binary gates

| gate | verdict | basis |
| --- | --- | --- |
| RESEARCH_PROVENANCE | **PASS** | 15/15 pins exact; provenance digest recorded per path |
| ARCHITECTURE | **PASS** | one SaveService, one run identity, one composition; no owner file edited |
| CODE_RUNTIME | **PASS (scoped)** | 194 checks at these bytes, 1 failure (§4.4), every probe mounted the shipped world |
| TEST_ORACLE | **PASS (scoped)** | refusals asserted by reason string; fixtures labelled; no fixture counted as a journey |
| VISUAL_UX | **NOT_TESTED** | no display (§5) |
| SYSTEM_VALUE | **FAIL** | no Core, no threat, no reachable POI, no earnable currency, no avatar |
| SAVE_MIGRATION | **PASS (scoped)** | second-process reload, crash-boundary recovery, reset and history |
| INTEGRATION | **FAIL** | A6 not mounted to the Hero; A8 not mounted in the world; A3 has no world document |
| BALANCE_REPLAY | **FAIL** | tool economics are permission-only (a pick costs 2 oak + 3 stone and returns 30–100× its cost); sites undifferentiated |

### 8.2 R0–R5

| level | verdict | note |
| --- | --- | --- |
| R0 spawn | **PASS** | safe spawn, 98 304 reachable cells, 4-direction walk out |
| R1 first hour | **PARTIAL** | bare hand, tool, chest, second process all work; no knife, no avatar |
| R2 paid station work | **PASS (mechanics)** | real escrow, real absence, one settlement, one claim |
| R3 main loop | **FAIL** | no threat, no POI destination, no Core |
| R4 finale | **FAIL** | no physical chest, no operational kiosk, no player abandon |
| R5 replayability | **PARTIAL** | reset, history, carried benefits are real; nothing to replay *for* |

### 8.3 What a player can and cannot do on `c5eb573bfadb`

**Can:** spawn safely; walk the world; scavenge wood/stone/iron by hand; craft a pick and use it
with atomic wear; place foundations, walls, a chest, a bed, a furnace, a workbench, a research
station and a garden; deposit and withdraw ordinary materials; start a paid furnace job, leave, come
back in a new process, collect once; die into one bag and recover it; expire a run; reset and carry
benefits forward; play the whole thing in 19.8 s of engine time without a single frame being
rendered here.

**Cannot:** see a character (no avatar in the composition); start with a knife (no such item); find
a Skill Core; use a Skill Core; store a Skill Core; research a Core; meet anything that can hurt
them; walk to a POI that does anything; earn the last-run currency; bank it (every kiosk is
unauthorized or has no site); choose to abandon a run; read a return digest (A6 publishes nothing);
build where the terrain says no; heal, repair, or lose a unique item.

### 8.4 Five separated verdict layers

| layer | verdict | why |
| --- | --- | --- |
| **Technical validity** | **PASS** | 194 checks, 1 failure, deterministic at one SHA; every claim traceable to a run row |
| **Normal-input playability** | **PARTIAL** | J01 bare-hand loop and J03 offline job play with real input; J02/J04/J05/J06 cannot be played |
| **Systemic depth** | **FAIL** | no risk, no Core, no POI outcome, tool economics are permission-only |
| **Creator-locked faithfulness** | **PARTIAL** | knife-first, last-72 h custody and losability are specified but unbuildable here; the Core's fail-closed source rule is faithful |
| **Human-playtested enjoyment** | **NOT TESTED** | nobody played it; no model score stands in |

### 8.5 Owner corrections, ranked

| # | owner | fix (method / test / commit) | size |
| --- | --- | --- | --- |
| 1 | **A0** | **Reconcile the kind vocabulary.** `SaveService.INVENTORY_ITEM_KIND_IDS` must accept, or explicitly map, `station_kit`/`equipment`/`skill_core` (13 of 57 ids). Today only A3's private `station_kit → material` mapping saves the furnace kit, and no mapping covers equipment or cores. Test: grant one of each kind and assert the bag records it with the catalogue kind. | S |
| 2 | **A6** | **Publish the nine owner projections A6 resolves by name**, or have A6 declare `A6_SOURCE_UNAVAILABLE` in its own contract instead of resolving by name into nothing. Test: the six accessors in `r11_j03_probe` return a typed, non-empty contract after a real settlement. | M |
| 3 | **A1 + A8** | **Mount the three sites** in the overworld with one physical stand each, and add the POI document A3 needs (`unknown_world_poi` is not an authorization answer). Test: `r11_j04_probe` reaching `world_action` preflight and returning a *policy* refusal, not a lookup failure. | L |
| 4 | **A1 + A8** | **A physical awakened-elder chest** bound to a real instance, so `plan_meta_source_claim` stops returning `source_identity_forgery`. Test: claim inside `last72` succeeds once and is refused on replay. | L |
| 5 | **A0** | **Close an expired run without a relaunch** (`settle_expiry` on a timer or at the interaction boundary), and give the player an abandon/evacuation door. Test: forge the clock to expiry inside a running session and assert the lifecycle closes it. | S |
| 6 | **A6 + A0** | **Integrate the avatar**: stage the sprite bytes in Git and reference the presenter from A0's `knight.tscn`, or add `game/survival/player/` to the overlay policy so A6's own scene is the one that mounts. Test: `r11_j01_probe` asserting a presenter in the composition and a rendered frame at 720p. | M |
| 7 | **A3** | **`collect` must not report `reason: "rejected"` on success.** Test: `reason` is empty (or `"ok"`) when `ok` is true. | XS |
| 8 | **A8** | **Differentiate the Orchard and the Mill**, or say in the data that they are the same decision. Test: `r11_j04_probe`'s distinct-shape count reaching 3. | S |
| 9 | **A0** | **Decide whether a unique item can be lost.** `begin_overworld_death` retains every `soh_i_` stack, so "losable" is true only for ordinary key items. Test: whichever way the decision goes, one probe asserts it. | S |

### 8.6 Reproduce

```
python3 tools/survival/balance/compose.py --profile r11_full --pin --write .artifacts/compose11
python3 tools/survival/balance/run_native.py \
  --godot /tmp/godot/bin/godot.linuxbsd.editor.x86_64 \
  --composition refs/comp/r11_full \
  --probe balance_native_r11/r11_seam_probe.gd \
  --probe balance_native_r11/r11_j01_probe.gd \
  --probe balance_native_r11/r11_j02_j05_probe.gd \
  --probe balance_native_r11/r11_j03_probe.gd \
  --probe balance_native_r11/r11_j04_probe.gd \
  --probe balance_native_r11/r11_j06_j07_probe.gd \
  --probe balance_native_r11/r11_adversarial_probe.gd \
  --probe balance_native_r11/r11_visual_probe.gd \
  --probe-args=--survival-save-fault-test --write
```

The engine is a from-source build: `platform=linuxbsd target=editor arch=x86_64 use_lto=no
debug_symbols=no tests=no -j2` on `4.7-stable` (`5b4e0cb0f`). It is not in the repository and is not
in any artifact; only the SHA of the run is.

---

## 9. What would change this verdict

The single highest-value *new content* is **#3/#4 (A8 physical sites and a chest)**: three of the six
red journeys are red only because the world has no destination. **#1** (the kind vocabulary) and
**#7** (`reason: "rejected"`) are small, and they are what makes the rest testable. The one
mechanical journey that already works — the paid furnace job — needs nothing but a legible return
card (**#2**) to be demonstrable to a player.

Round 12 should be able to say, on one hash: a chest was opened in the last 72 hours, its currency
was banked at a physical kiosk, and a paid furnace job settled in a returning process with a return
card that names the charcoal. If those three are green, `SYSTEM_VALUE` can move off FAIL for the
first time — and not before.
