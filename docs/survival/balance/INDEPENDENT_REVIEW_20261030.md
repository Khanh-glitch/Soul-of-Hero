# A7 independent review — early-game exploration, loot discovery and economy readiness
**Date:** 2026-10-30 · **Author:** A7 (independent QA & balance) · **Checkpoint:** first completed deliverable
**Verdict:** `ANALYSIS_COMPLETE / NATIVE_NOT_TESTED / HUMAN_NOT_TESTED / NO_GAMEPLAY_EDIT`
**Machine-readable companion:** `data/survival/balance/results/*.json` (regenerate with
`python3 tools/survival/balance/run_analysis.py`, verify with `--check`, test with
`python3 tools/survival/balance/run_tests.py`).

---

## 0. What this is, and what it is not

This review reports what the **authored data itself** implies about early-game exploration, loot discovery and
material sinks. Every number is either (a) computed from A1/A3 JSON that this checkpoint pins by SHA-256,
(b) an assumption published in `data/survival/balance/hypotheses.v1.json`, or (c) explicitly missing and marked
`UNMODELLED`/`NOT_TESTED`.

It is **not** a playtest, **not** native verification, and **not** a balance change. No file outside
`docs|tools|tests|data/survival/balance/**` was modified. In particular: no loot table was edited, no drop rate
was chosen, no Core was assigned a cast, and no A1/A3/A0/A4/A6 implementation was touched.

---

## 1. Inputs, and the verification that they are current

| Owner | Pinned commit | Evidence in this checkpoint |
|---|---|---|
| A1 (PR #20) | `2951bf8559b2e289ce99fd4d394d44c46fdd91b1` | 8 files re-hashed; 3 long connector polylines and 10 inset POIs matched against the route graph |
| A3 (PR #19) | `18e7afcbd576bbd9bfbcc509b2ee13216186a522` | 8 files re-hashed; referential audit over 56 items / 36 sources / 36 recipes / 5 technologies / 2 loot tables |

Three independent reproductions succeeded, which is the evidence that the model is reading the real data rather
than a paraphrase:

1. **A1's own first-hour route length.** A1 publishes 1541.72 tiles / 256.95 s of movement. Re-routing
   Refuge → Waystation → Relay → Apothecary → Refuge over A1's polylines with A1's capability grants gives
   **1541.72 tiles / 256.95 s** (`difference_tiles = -0.0`).
2. **The Control Tower's loot expectation.** CT reported 3.6 scrap / 1.35 spares / 0.45 notes / 0.45 seeds per
   `roadside_cache` claim. Exact rational enumeration of the 343-state claim distribution reproduces those four
   numbers to machine precision, plus `P(≥1 scrap) = 0.784` and `P(≥1 spare) = 0.657`.
3. **A3's pinned A1 hashes.** A3 pinned A1 at `91a35449…`; all six overlapping file hashes are identical to the
   bytes at A1 head `2951bf85…`. `PIN_DRIFT_VS_ADOPTION_CONTRACT = 0`.

---

## 2. The playable-world axis: 118 authored places, 0 that can hand out A3 loot

| Classification | Count | Meaning |
|---|---:|---|
| `CONTRACT_ONLY_NOT_PLAYABLE` | 106 | authored site contract; no native interaction |
| `AUTHORED_SPEC_NATIVE_NOT_INTEGRATED` | 2 | Waystation, Relay Shed; `native_playable: false` in A1's own spec |
| `SHIPPED_LEGACY_SCENE_NO_A3_LOOT` | 10 | preserved Chapter-1 dungeon exteriors, no route-graph node, no A3 loot |
| **`loot_bearing_natively`** | **0** | computed by `Model.is_loot_bearing_natively()` for every POI |

Capability-gated reachability from the Refuge (authored graph, Dijkstra with A1's required capabilities):

| Tier | Capabilities held | Reachable POIs | Enterable | Playable | Loot bearing |
|---|---|---:|---:|---:|---:|
| `EMPTY_HANDED` | — | 15 | 15 | 1 | 0 |
| `AFTER_WAYSTATION` | `cap_salvage, cap_seal_1` | 24 | 24 | 2 | 0 |
| `AFTER_RELAY` | + `cap_power_1` | 25 | 25 | 2 | 0 |
| `AFTER_APOTHECARY` | + `cap_filter` | 39 | 39 | 2 | 0 |
| `ALL_AUTHORED_CAPABILITIES` | all 12 | 108 | 108 | 2 | 0 |

Read: the authored continent is *geographically* complete (108/108 new POIs reachable, no orphan nodes), but
**exploration currently has no loot-bearing destination at all**. Of the 39 places a `cap_filter` novice can
reach, 37 are contract-only and 2 are authored specs that are not native-integrated; none is mounted. Note also
that `cap_filter` alone opens 14 additional places (25 → 39) — it is the single strongest early gate in the
graph, and one of only four capabilities obtainable in the first hour.

---

## 3. Finding F-01 (MAJOR, A3): A3's loot sources are not at A1's places

All **16/16** A3 `sources.json` entries with `acquisition: loot` reference a POI in a private vocabulary
(`poi:roadside_cache`, `poi:sealed_archive`, `poi:toxin_laboratory`, `poi:specimen_vault_ember`,
`poi:abandoned_institute`, …) and a region in a private vocabulary (`opening_marches`, `sealed_archive`,
`mire_wetlands`, `frost_ridge`, `chapter_1_2`). **0 of 16** resolve to an A1 `poi_id`; **0 of 16** resolve to an
A1 `region_id`. The 15 A3 text placeholders are not A1 places, and the names collide misleadingly —
`poi:roadside_station` is *not* `poi_crown_waystation`, and `poi:sealed_archive` is not
`poi_ember_convict_mine`.

This is not a cosmetic naming gap: it means **no authored reward can be placed without an A1 decision**, and any
claim of the form "the game gives X at place Y" is currently unsupported for all 16 sources.

The second A3 artefact, `progression_model.product_sources`, *does* bind by A1 id (19 rows, 13 with a resolvable
`poi_id`, all 13 resolving correctly), but 5 of those 19 are explicitly provisional
(`PROVISIONAL_A3_BINDING_TO_A1_POI`, `PROVISIONAL_A3_BINDING_NOT_A1_APPROVED`, `A3_DESIGN_PROPOSAL_A1_HINTS_ONLY`).
So: **A1-resolvable bindings exist, they are just not the authoritative ones**, and they are not approved.

---

## 4. Finding F-02 (MAJOR, A3): the first research station has no non-loot path

`research_kit` (crafted at the workbench) costs `oak_wood 4 + iron_ingot 2 + knowledge_spares 3`.
`knowledge_spares` is produced by `make_spares` (**research station**), `study_predator_jaw` (**research
station**) and `study_axe_insignia` (**research station**) — plus the proposed `roadside_cache` loot and the
A3-imputed Waystation locker. No `LIVE_SURV_010` and no `LIVE_EXISTING_REWARDS` source yields spares.

Craft ladders (fixed-point over recipes with station kits and technologies unlocked by what the ladder itself
can build):

| Ladder | Seeds | Items obtainable | Recipes | Stations reached | Technologies |
|---|---|---:|---:|---|---:|
| `NATIVE_PROVEN` | oak, stone, iron_scrap, reed_fibre (4 live sources) | 13 | 9 | hand, workbench, advanced workbench, furnace | **0** |
| `NATIVE_PLUS_LEGACY_REWARDS` | + 7 legacy Chapter-1 reward items | 20 | 9 | same | **0** |
| `AUTHORED_PLAN_INCLUDING_LOOT` | + all authored/none-playable loot sources | 56 | 36 | + research, garden, advanced furnace | 5 |

So the *native-proven* economy can build tools, cloth, charcoal, ingots and kits (9 recipes) but **cannot reach a
research station, therefore cannot research anything, therefore cannot bind or rebuild a Core**. Everything from
`tech_smelting` upward depends on either (a) the unbound `roadside_cache`, or (b) the A3-imputed Waystation
locker quantity that A1 does not author (`QUANTITY_OWNERSHIP_UNRESOLVED`, see F-04).

This is the single most consequential balance finding in the checkpoint: **the "offline survival loop"
(gather → build → loot → research → craft Cores) is severed between "build" and "loot", and the current data
bridges it only with a proposal.** It is a design decision for A1/A3, not something A7 may patch.

---

## 5. Finding F-03 (MAJOR, A1/A3): `risk` mixes severity with progression band, so cargo loss is unmeasurable

A1's 130 route edges label `risk` as `low(5), high(1), early(30), mid(50), late(44)`. `early/mid/late` are
*progression bands*, not severities, and A3's death model only has keys `low/medium/high/combat`. Result:
**6 of 130 edges (4.6%)** can be assigned a death probability at all. For the remaining 124 the tool reports
`UNMODELLED_NO_DEATH_MODEL_KEY` instead of inventing `0.0`, which is why most trip rows in §6 show a null death
chance. Expected-cargo-retention therefore cannot be computed on the safe corridors, and any future "death
costs you the trip" statement needs an A1/A3 vocabulary decision first.

Where the model *can* compute it (P5 below, `risk: medium` declared by A3), retention is
`0.97 / 0.985 / 1.00` for cargo-recovery hypotheses `0 / 0.5 / 1.0` — i.e. the *recovery* hypothesis moves the
answer far more than the 3% death chance does.

---

## 6. Expedition arithmetic (two accessible patterns + one underprepared + one hypothetical + one Core run)

Time is split; `gather` = 6 s/claim and `interaction` = 45 s/stop from A3's assumption block; travel is A1
polylines at 6 tiles/s. Combat, reading/planning, UI and death are **unmodelled** (never zero).

| Pattern | Travel | Gather | Interact | Total | % of 45-min | Loot (expected units) | Sink coverage |
|---|---:|---:|---:|---:|---:|---|---|
| **P1** safe bootstrap loop (Waystation→Relay→Apothecary) | 257.0 s / 1541.72 tiles | 24 s | 135 s | **416.0 s** | 15.4% | scrap 5, spares 3, moonleaf 2 | `research_kit`: short 2 ingots + 4 oak (**spares exactly 3/3**) |
| **P2** filtered material run (Quarry→Ferry Pile) | 278.2 s / 1669.18 tiles | 24 s | 90 s | **392.2 s** | 14.5% | stone 2, iron_ore 2, reed 4 | `weave_cloth` covered; `furnace_kit` short 6 stone + 3 scrap |
| **P3** underprepared east-seam intent | 148.7 s / 892.0 tiles | 6 s | 45 s | **199.7 s** | 7.4% | scrap 3, spares 1 (fallback route only) | nothing |
| **P4** 3 roadside containers (**hypothetical**: 0 exist) | 278.2 s / 1669.18 tiles | 60 s | 90 s | **428.2 s** | 15.9% | scrap 10.8, spares 4.05, notes 1.35, seeds 1.35 | `tech_smelting` inputs covered |
| **P5** first-Core attempt (ember barrow field, provisional) | 174.2 s / 1045.3 tiles | 6 s | 45 s | **225.2 s** | 8.3% | `core_ember` 1.0 (one-time, `discovery_chance 1.0`) | n/a (Core is terminal-use) |

Budget: at 416 s per trip a 45-minute session has room for **6 trips**; at 392 s, also **6**; at 1350 s
(half session) **3**. Those are *accounted* seconds; real sessions carry the unmodelled terms above, so treat
"6 trips" as an upper bound, not a schedule.

Three observations that follow directly from the table:

- **The first-hour loop is not self-sufficient by design or by accident.** After one full loop the player is
  exactly at 3/3 spares for a `research_kit` but short 2 ingots (6 scrap) and 4 oak — both of which the *native*
  live sources supply. That is a coherent shape: the *station* is native-buildable, the *knowledge* is not.
- **The material and knowledge ladders do not meet.** P4 (containers) alone covers `tech_smelting`; P2 covers
  only `weave_cloth` and is short 4 spares + 3 scrap for smelting; the first-hour loop P1 lands **exactly one
  spare short of `tech_smelting`** (3 of 4) while being exactly sufficient for `research_kit`'s 3 spares.
  Economically distinct ladders are what CT asked for; the missing link is that the knowledge ladder's only
  entries (`roadside_cache`, locker) are unbound.
- **P3 costs 7.4% of a session and returns 4 units**, while the "unprepared" failure it represents (a locked
  high-risk shortcut) is invisible in the loot numbers: the cost is the 93.48 extra tiles of the safe detour,
  not a reduced reward.

---

## 7. Finding F-05 (MAJOR, design): once `cap_filter` exists, the *shortest* route is the high-risk shortcut

`rt_east_seam` (336.52 tiles, risk `high`, requires `cap_filter`) is **93.48 tiles shorter** than
`rt_crown_safe_approach` (430.00 tiles, risk `low`). Before `cap_filter`, the safe route is the only option, so
A1's bootstrap teaching works. After the Apothecary lesson — i.e. exactly when the novice has been taught to
survive — the routing preference inverts: Refuge→Waystation becomes **352.52 tiles** instead of 446.00, and a
round trip saves **31.2 s** by using the high-risk corridor.

The tool reports this as a *routing* fact, not a verdict: a player who knows the difference can choose the safe
route; an optimizer will not. But nothing in the data makes the safe route preferable after `cap_filter`
(no cost, no hint, no reward difference), and A1's own `novice_bootstrap_contract` describes the seam as the
"hazardous shortcut". Since death probability on `high` edges is 8% (A3 assumption) *per traversal*, a 31 s
saving is being priced against real cargo risk — with the cargo loss itself unmeasurable per F-03.

This is the cleanest example of why A7 exists: A1's per-file contracts are all individually satisfied, and the
*combination* still produces a bad default.

---

## 8. Finding F-06 (MAJOR, A1/A3): hazard access and hazard mitigation point at different hazards

`vault_catalyst` requires `resistance venom:60`. Its A3-provisional POI binding is `poi_ember_convict_mine`,
whose A1 hazard is `hz_ember_gas`, kind **`acid_gas`**, access capability `cap_filter`. The only item in the
catalog that grants `venom ≥ 60` is `toxin_mask`. So the gate demands resistance to a *different* hazard than
the one the place applies, and **no item grants `acid_gas`, `heat`, `poison`, `cold`, `tide` or `pressure`
resistance at all** even though `a1_source_adoption.v2.json` lists all of them as
`PARTIAL_REQUIRES_A3_EXTENSION`.

Worse, `toxin_mask` itself is only reachable on the authored-plan ladder (`NATIVE_PROVEN: false`,
`NATIVE_PLUS_LEGACY_REWARDS: false`) because it needs `venom_extract`, which needs `tech_toxin`, which needs the
research station from F-02. So the mitigation item for the gated vault is behind the research cycle that the
vault's own loot (`ancient_catalyst`) is supposed to fund. Reported as `RESISTANCE_CHAIN_BLOCKED` (MINOR) plus
`SOURCE_REQUIREMENT_UNMAPPED` (MAJOR).

---

## 9. First Core discovery: today it is an *access* problem, not a luck problem

Derived, not assumed (`sensitivity.json → core_capable_sources`):

- **Authored tables that can emit a `core`-tagged item: 0** (both tables; the junk table explicitly excludes
  `rare`, `core`, `exploration_only`).
- **Eligible roadside containers today: 0** — there is no table output *and* no resolved container POI.
- **Physical Core specimen sources: 3**, all `one_time`, all `discovery_chance 1.0`, all provisional:
  `specimen_ember` → `poi_crown_barrow_field` (needs `cap_seal_1`, reachable at 429.17 tiles, POI contract-only);
  `specimen_frost` → `poi_frost_ice_cave` (needs `cap_thermal, cap_seal_2`, **route-locked** at novice caps);
  `specimen_venom` → `poi_verdant_canopy_temple` (needs `cap_climb, cap_filter, cap_seal_3`, **route-locked**).
- **Plan sources: 3** (`plan_*_core` at `poi:abandoned_institute`, unresolved POI).

So the current authored answer to "how does a player get their first Core?" is: **walk 429 tiles to a
contract-only barrow field and pick up a guaranteed one-time specimen** — or be blocked. There is no
probability distribution to measure, and therefore nothing to tune. Any "first Core drop rate" discussion is
premature until an eligible container class and its placement exist.

For completeness — and **only** as an illustration of scaling — the label-checked hypothetical grid
(`HYPOTHETICAL_NOT_A3_TUNING`, `p` assumed, crate counts assumed) gives:

| p per container | crates for 50% chance | crates for 90% chance |
|---:|---:|---:|
| 0.2% | 347 | 1151 |
| 0.5% | 139 | 460 |
| 1.0% | 69 | 230 |
| 2.0% | 35 | 114 |

and reproduces CT's "middle" illustration exactly (`p=1%`, 2 crates/trip → 18.21% after 10 trips, 33.10% after
20). Those numbers are arithmetic on an assumption; they are not a recommendation and must not be shipped as a
rate.

---

## 10. Unlucky players, repeated claims and reload

- **One claim of `roadside_cache` yields neither spares nor notes 16.64% of the time** (exact: `0.55³`).
  A 3-claim trip misses both **0.46%** of the time. Two claims already give a 90% chance of at least one
  knowledge item — i.e. the table is generous *if it exists*, and completely irrelevant until it does.
  The worst legitimate case (a trip with zero useful loot) is quantified rather than averaged away.
- **Seeded resampling** (14 sessions × 3 claims, 4000 runs, seed 20261030) puts a 10th-percentile player at
  **scrap 125 / spares 47 / notes 14** and a 90th-percentile player at **scrap 173 / spares 68 / notes 25**.
  That spread is small because 42 claims average out; the real variance is concentrated in *early* claims, which
  is where the 16.6% single-claim miss matters.
- **Duplication is blocked, not assumed away:** a one-time reward claimed twice returns `allowed=0`
  (`one_time_already_claimed`); a new session ("reload") does **not** re-grant it; a per-session cap of 1
  refuses 5 requests; a zero-restock non-one-time source refuses in-session farming; a unique-instance Core
  modelled at 2 units is clamped and flagged. All four are executed cases, not prose (`adversarial.json`).
- **Capacity:** bag = 30 slots (A3 assumption), one slot per distinct item, `stack_limit` adds slots above that
  (120 spares = 3 slots). None of the five patterns overflows; a 45-distinct-item trip overflows by 15 and is
  reported as `CAPACITY_TRUNCATED` rather than silently truncated.

---

## 11. Data hygiene findings (owner: A3 unless stated)

| Finding | Count | Evidence |
|---|---:|---|
| `SOURCE_POI_UNRESOLVED` | 16 | every A3 loot source; see F-01 |
| `SOURCE_REGION_UNRESOLVED` | 16 | `opening_marches`, `sealed_archive`, `mire_wetlands`, `frost_ridge`, `chapter_1_2` are not A1 regions |
| `QUANTITY_OWNERSHIP_UNRESOLVED` | 1 | A1 authors Waystation hints + policy `ONE_TIME`/`RENEWABLE_COOLDOWN` with **0 quantities**; A3 assigns `waystation_locker={iron_scrap:2, knowledge_spares:2}`, `a1_crown_salvage={iron_scrap:3, knowledge_spares:1}` |
| `SOURCE_ID_DIVERGENCE` | 9 | same physical source, different ids: `vault_catalyst` vs `catalyst_vault`; `a1_crown_tuff` vs `live_stone_chunk`; `a1_amber_herb` vs `node_moonleaf`; … |
| `ITEM_OVEROWNED` | 2 | `iron_scrap` yield 2 (live) vs 3 (road); `moonleaf_seed` 2 vs 1 |
| `RECIPE_CYCLE` | 2 (INFO) | `grow_grain` / `grow_moonleaf` return one seed — seed-preserving cultivation, **not** an exploit; labelled as such so nobody "fixes" it |
| `PROVISIONAL_BINDING` | 4 | 3 specimens + catalyst vault |
| `ROUTE_LOCKED_FOR_CAPABILITIES` | 3 | the 3 locked sources above, at `cap_salvage/seal_1/power_1/filter` |
| `DEATH_CARGO_LOSS_UNMODELLED` | 1 | F-03 |
| `SOURCE_REQUIREMENT_UNMAPPED` | 1 | F-06 |
| `RESISTANCE_CHAIN_BLOCKED` | 2 | F-06 |
| `BOOTSTRAP_DEPENDENCY_CYCLE` | 1 | F-02 |
| route-polyline endpoint gaps | 3 (A1) | `rt_ember_mere` 60.83, `rt_ember_coast` 156.20, `rt_sunken_fen` 44.72 tiles from the declared node cell — connector art or wrong endpoint, but it breaks distance realism on those three routes |

Totals: **57 findings — 0 BLOCKER, 20 MAJOR, 28 MINOR, 9 INFO.** No blocker means nothing here forbids
building; it means the *product* story is currently held together by proposals rather than by data.

---

## 12. Adversarial evidence (24/24 cases pass)

Twelve **data-fault** cases inject a defect into an in-memory deep copy and require the matching finding:
unknown loot item, Core injected into junk, zero weights, inverted quantity, zero rolls, unknown source item,
orphan source, unknown recipe item, unknown station, capability self-dependency, cut-off site, invented A1
quantity. Twelve **behaviour** cases execute real edge paths: no-route → `None` (never a fake path), zero
eligible containers, repeated one-time claim, reload re-grant, session cap, zero-restock farming, bag overflow
(exactly 15 slots), unique-instance duplication, unlucky trip, death with 0/50/100% cargo recovery, a
Core-less trip still having non-Core value, and the research bootstrap cycle.

Two of the twelve also exist in the clean baseline (`D11`, `D12`) and are marked `also_in_baseline` rather than
being presented as new detections — the suite is designed to make that distinction visible.

---

## 13. Answering the mission questions directly

| Question | Answer from this checkpoint |
|---|---|
| Are planned POIs playable? | **No.** 106 contract-only, 2 authored-spec-not-native, 10 legacy scenes without A3 loot. 0 loot-bearing. |
| Are resource nodes supply crates? | **No.** 178 nodes stay on the harvest axis; eligible containers = 0. |
| Is A3's 14-session model a playtest? | **No.** It is a conservation/scenario model and is cited as such. |
| Are Gold-blocked Cores usable skills? | **No.** `core_*` remain `BLOCKED_PENDING_A4`; nothing here assigns a cast. |
| Is there non-Core loot value? | **Yes, in the data**: `iron_scrap` feeds 4 recipes + 1 technology (13 units/cycle); spares feed 6 recipes + 2 technologies (20 units/cycle); the junk table's 3.6 scrap/claim funds `tech_smelting`'s scrap line in ~0.51 claims. **But none of it is placed.** |
| Is the early economy coherent? | **Partly.** Native ladder: 13 items, 9 recipes, 0 technologies. Loot ladder: everything, but with 0 reachable containers and a research-station cycle. |
| Is first-Core discovery luck or access? | **Access.** 3 deterministic one-time specimens, 2 of them route-locked early; 0 probabilistic containers. |
| Would an unlucky player be stuck? | **Yes, and it is now quantified**: 16.6% of claims yield no knowledge item; the guaranteed research path is the blocked one; the fallback (targeted POI) is the one with unresolved ids. |
| Can a player duplicate loot by reload? | **Not in this model**: one-time flags persist across sessions and zero-restock sources refuse renewal. Native SaveService behaviour is A0's to prove. |

---

## 14. Next atomic actions (requests to owners — A7 does not edit these)

1. **A1:** supply a POI-id contract for the 16 loot sources (or publish the mapping file), and give each A1
   reward either quantities or an explicit "A3 owns quantity" flag, so F-01/F-04 can close.
   Also decide `risk` vocabulary (severity vs band) so F-03 can produce a death model.
2. **A3:** pick authoritative ids (F-01 divergence), and state the replacement policy for `rolls` in
   `loot_tables.json`. Reconcile `vault_catalyst` resistance (`venom:60` vs `acid_gas` hazard) or bind it to a
   venom POI (F-06).
3. **A1/A3 jointly:** resolve the first-hour research-station bootstrap (F-02). Options are A1's to choose:
   a native spare source, an authored renewable cache with a *bound* POI, or an explicitly cheaper kit.
4. **A0:** confirm whether death-bag recovery is 0/partial/full; the tool currently reports all three
   hypotheses because the answer changes retained cargo by up to 8% on a 3%-death trip and much more on a
   high-risk one.
5. **A4:** Cores must stay out of any "first Core rate" discussion until an eligible container exists and a
   Gold-attested cast is available; this checkpoint deliberately produces no rate.
6. **Control Tower:** the L1-S special road-supply class is the only authored shape that would make §9 a
   probability question. If it is approved, the tool already accepts it: add the table and the bound POI, and
   `sensitivity.json` will compute the real numbers instead of the labelled grid.
7. **Re-run A7 after A1/A3 land any of the above**: `python3 tools/survival/balance/run_analysis.py` then
   `python3 tools/survival/balance/run_tests.py`; the assertions in §1 are the regression guard.

---

## 15. Explicit non-claims

- No native gameplay, no Godot run, no screenshot, no browser session was produced here.
- No human playtest, fun, pacing or 14-day engagement evidence exists in this checkpoint.
- No Core drop rate is derived, proposed or implied; the grid is labelled hypothetical everywhere it appears.
- No loot table, item, recipe, POI, route or reward was modified.
- "Reachable" means *reachable in A1's authored polyline graph under the stated capabilities* — it does not
  mean collision-checked, spawnable, or fun.
- The 6-trips-per-session figure is an accounting ceiling, not a measured cadence.
