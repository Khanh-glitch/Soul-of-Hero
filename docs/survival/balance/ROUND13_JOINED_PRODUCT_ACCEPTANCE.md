# Round 13 — A7 independent acceptance of the joined product (CT-GATE-v2026-10-31)

_2026-10-31. **Supersedes round 12 for status questions.** Round 12's composition
`663a83ede523` is retained as immutable historical evidence and is not inherited: every
number below comes from the round-13 composition pinned in §0.1, measured with the engine
built from source in this sandbox, and — where pixels are claimed — from PNGs committed by
an A7-owned job and **opened one at a time at 1×** in this session._

**Verdict: `HOLD_PRODUCTION` / `ACCEPT_DIAGNOSTIC_EVIDENCE` / `NO_MERGE`.**
The round-12 root dependency is unchanged and is still A0's: **the identity projection does
not exist at A0's own head**. Everything else that moved this round is measurable progress
in the *economy and input* layer (A0 published `depart_world` / `prepare_work_away` and a
1,000-line normal-input journey test; A8 published a native POI input test), and **none of
it is yet a journey a player can complete**, because the world they would walk in is still
the 384×256 Marches and the owners' own journey test fails on this tree.

---

## 1. What a player gets, in player language

Read this before any table. Every sentence carries the rung it was measured at:

`SOURCE_ONLY` < `FIXTURE` < `NATIVE_COMPOSED` / `NATIVE_COMPONENT_PATH` < `TRUE_INPUT` <
`VISUAL_INSPECTED` < `HUMAN_NOT_TESTED`. Claims never borrow each other's rung.

**What a player can do today, with their own hands and keys.**

They launch, walk with WASD into the Hollow Marches (`TRUE_INPUT`: 17.9 px per four 12-frame
bursts, 98,304 reachable cells from spawn), walk up to a real oak and a real outcrop and
press `E` (`TRUE_INPUT` to approach; the harvest itself is the product's own interact
door, `NATIVE_COMPONENT_PATH`), and get **2 oak per swing, hits 3 → 2**, **4 stone chunks
in 2 swings**. They can queue the shipped hand recipe and collect a real A3 tool instance
(`soh_i_000000000002_d3346167`) that then **wears out on stone** (condition 100 → 99,
revision 0 → 1, receipts 12 → 13).

They can build, and this round the pixels finally show it: **8/8 walls, a real room id, a
roof drawn at alpha 1.00, a bed placed and activated as the spawn anchor, a chest that
moves 34 oak + 28 iron + 1 kit out and back, and a workbench whose recipe is refused
`station_not_reachable` at 195 px and accepted at the bench** (`FIXTURE` materials +
`NATIVE_COMPONENT_PATH` doors — see §1.1). In the round-13 capture this house finally
**seals and roofs** — and it is a **doorless box**: the product's own guard only refuses to
seal the *Hero* into a doorless room, not to build one (§4.3).

**What a player cannot do.**

- **They cannot be anybody.** At A0's own head `game/autoload/save_service.gd` contains the
  string `avatar` **zero times**: no `get_player_appearance_projection`, no
  `player_avatar_changed`, no `set_player_avatar`. A6's `avatar_choice_screen.gd`, which
  the owners' own join now places at `game/ui/screens/avatar_choice/`, calls
  `SaveService.set_player_avatar(gender, "avatar_choice")` and therefore **cannot succeed**;
  A6's presenter guards on a method that does not exist and falls to its `NO_SAVE` path.
  `knight.tscn` mounts nothing. **The seam is one A0 file, and it moved by zero bytes this
  round.**
- **They cannot leave the Marches.** The default runtime world is still
  `hollow_marches.json` at **384×256**. A1 now authors a **1024×768** continent and ships a
  reader and a stream for it, but A0 does not mount them. The product *does* contain a
  second, gated source — `survival/a0_waystation_candidate`, **off by default** — which
  loads **448×256** and mounts a `WaystationRuntime`. Measured (§2, R13EXT): turning that
  gate on buys **5 of 118 POIs** and makes **2** of them standable, and the three A8 sites
  are still refused by A0's own mount authority. So the gate is a real 64-cell annex, not
  the continent, and the continent is not what ships.
- **They cannot enter a POI.** 0 A8 site nodes are mounted under the overworld; all three
  `world_action` calls return `unknown_world_poi`; A1's route graph declares only **1 of 3**
  A8 ids.
- **They cannot meet a threat.** `survival/a0_optional_threat` is absent/false, and there
  are **0** call sites of `take_damage`/`take_resolved_damage` under `game/overworld` or
  `game/survival`.
- **They cannot use a Skill Core.** 6 Core sources, **0 LIVE**; `commit_cast` →
  `skill_gate_unavailable` because A3's attestor is an invalid `Callable`.
- **They cannot choose the finale.** `abandon_run` has **0** callers in `game/`, and the
  72-hour claim is refused `source_identity_forgery`.
- **They cannot finish A0's own new journey.** A0 published
  `tests/survival_normal_connected_journey_test.gd` — the first owner artifact that tries
  the whole normal-input route, two processes, offline settlement. Run on A7's composition,
  **both processes exit 1**, on a concrete product seam: the test asks the offline host for
  `available_stations()` and **`economy_session.gd` does not define it** (§5, §7.2).

### 1.1 What the oracle actually did (CT's correction, applied)

CT was right about round 12 and this report is written so it cannot repeat the error. The
home journey is **`FIXTURE` + `NATIVE_COMPONENT_PATH`**, not "the player builds it":

| claim | rung | what the code did |
|---|---|---|
| walking, approaching a node, pressing a modal key | **TRUE_INPUT** | `Input.action_press` on the shipped action map |
| bare-hand gather, tool wear | **NATIVE_COMPONENT_PATH** | `node.interact(hero)`, `economy.queue_recipe/collect` called directly |
| home, chest, bed, station reach | **FIXTURE + NATIVE_COMPONENT_PATH** | materials from `FIXTURE_GRANT`; `select_piece`/`validate_cell`/`try_place`, `activate_bed`, `deposit_all`/`withdraw_all` called directly |
| one death bag | **NATIVE_COMPONENT_PATH** | `begin_overworld_death` called directly |
| a house you can see | **VISUAL_INSPECTED** | four 1× PNGs, opened (§4) |
| A0's normal-input journey | **not accepted** | it ran and failed; that is the finding (§5) |

No sentence in this report says a player performed an action that a probe invoked.

---

## 0. Receipt

### 0.1 Composition (built by `tools/survival/balance/compose.py`, pinned)

| profile | commit | files | question it answers |
|---|---|---|---|
| `r13_a0` | **`240d7034c292`** | 5309 | A0's head alone |
| `r13_core` | **`ea99fe18eae9`** | 5594 | A0 + A1 + A3 |
| `r13_full` | **`382f80ab7710`** | 5676 | A0 + A1 + A3 + A6 + A8 under A7's old narrow map |
| **`r13_heads`** | **`3d8630f5b1adfa6c5b50c56fa506524e0ce71f6b`** | **6119** | **the product the owners themselves join** — A0's published `tools/a0/ownership.json` scopes; this is what A0's own CI composes, and what §2–§8 measure |
| `r13_wired` | `893c7a03a603` | 5686 | COUNTERFACTUAL: A6's out-of-policy scene files accepted |

Owner heads for round 13 (`refs/live13/*`, all full SHAs, all reachable on `origin`):

| owner | round 12 | **round 13** | what moved |
|---|---|---|---|
| A0 `arena/dea2428e` | `a6b57c36` | **`53dcda29c9`** | `depart_world`/`prepare_work_away` (KEY_P), `_notification(WM_CLOSE_REQUEST)` departure, a 644-line normal-input two-process journey test, its own composition CI |
| A1 `arena/e385312a` | `9ca1453c` | **`c2ba1f0f01`** | a 37 k-line round-12 deep-world package: a 1024×768 stream, reader, runtime compiler and native test — **none of it mounted by A0** |
| A3 `arena/7a12b27e` | `b44e22df` | `b44e22df` (unchanged) | — |
| A6 `arena/05e0328d` | `6d71410a` | `6d71410a` (unchanged) | — |
| A8 `arena/2d7e6d7a` | `e1fe550b` | **`0f885df862`** | a rewritten `native_poi_input_journey_test.gd` and a worklog update |
| AVFX `arena/c7b0c4e8` | `8dd4f3e9` | `7e74cadd67` | unrelated to the survival surface |
| CT `docs/ct-loot-discovery-gate` | `971e0b95` | `971e0b95` (unchanged) | — |

Two composition policies exist and both are reported, because they disagree:
A7's narrow map (`r13_full`, 5676 files) puts A3's `game/survival/economy/` in `merge`
mode so A0's vendored copies survive; A0's own manifest (`r13_heads`, 6119 files) lets each
owner own its declared scope additively, which is what puts A6's
`game/ui/screens/avatar_choice/` and A1's `tests/survival/world/` reader into the tree.
**Neither policy can give the avatar a body**: `save_service.gd` has no avatar code at
either head, and that file is A0's under every policy.

### 0.2 Engine, ledger, probes

- Engine **`4.7.stable.custom_build.5b4e0cb0f`**, built from `4.7-stable` in this sandbox;
  headless for probes, X11 + llvmpipe for the captures (CI).
- Ledger `data/survival/balance/results/native_runs.v1.json` — composition
  **`3d8630f5b1ad`**, **11 probes / 203 checks / PASS 2 · FAIL 1 · BLOCKED 1 · RED 7**.
- Round 12's payload is preserved verbatim as `native_runs.r12_full.v1.json` (10 probes /
  200 checks / 2·0·1·7 on `663a83ede523`). The **50-probe cross-family sweep** is a
  separate artifact, `native_runs.r12_sweep.v1.json` (PASS 7 · FAIL 8 · BLOCKED 9 · RED 26);
  **three** of those eight `FAIL`s are the headless pointer limitation, **five are
  unexplained and stay `FAIL`**. Nothing here generalises them away.
- Probes `tests/survival/balance_native_r13/`: 10 carried forward from round 12 with the id
  renamed (so a round-12 → round-13 difference is a fact about the product), plus
  **`r13_extent_probe.gd`**, which is new and asks what the product loads and what its own
  gated annex is worth.

---

## 2. Claim → evidence, falsifiable, with the rung

| # | claim | rung | exact evidence | verdict |
|---|---|---|---|---|
| 1 | a player walks under real keys | TRUE_INPUT | 4 × 12 physics frames, 17.9 px max displacement; R13ID; screenshot at 1× shows the body | **PASS** |
| 2 | a body sprite is bound | NATIVE_COMPOSED | 34 animations, first `attack` 4 frames, texture built at runtime; `r13_identity` note | **PASS** |
| 3 | an avatar can be selected | — | `save_service.gd` has **0** occurrences of `avatar` at A0 `53dcda29`; presenter reads a method that does not exist | **`A0_SOURCE_UNAVAILABLE`** |
| 4 | the shipped world holds A1's continent | NATIVE_COMPOSED | R13EXT: default 384×256, **10/118** POIs in bounds, **0** standable; the gated annex 448×256 gives **15 inside / 2 standable** | **FAIL** |
| 5 | A8 POIs are physically reachable | NATIVE_COMPOSED | 0 mounted site nodes; 3/3 `world_action` → `unknown_world_poi`; A0 mount authority refuses all three | **`A1_RUNTIME_WORLD_EXTENT_ABSENT`** |
| 6 | a house is paid, sealed, roofed, furnished | FIXTURE + NATIVE_COMPONENT_PATH | R13HOME PASS 18: 8/8 walls, room id, roof alpha 1.00, bed `b10` activated, chest round trip, bench 195 px refusal | **PASS (transactional)** |
| 7 | a house looks like a home at 1× | VISUAL_INSPECTED | §4: 8/8 ring incl. `door_wood`, roof alpha 1.00 — the roof slab hides door and interior, and draws over the world-space label | **FAIL (readability)** |
| 8 | threat, damage, death, bag | NATIVE_COMPONENT_PATH | bag `death_1`, `already_pending`, recovery refused; **0** damage call sites; threat flag false | **bag PASS, threat absent** |
| 9 | funded offline settlement, 2nd PID | NATIVE_COMPONENT_PATH | R13J03: armed job, 12 s real closure, second process settles **2 charcoal exactly once**, second claim `nothing_to_collect` | **PASS** |
| 10 | A6 return projection exists | SOURCE_ONLY | 6/6 accessors empty (`season_clock_missing`, …) | **`A6_SOURCE_UNAVAILABLE`** |
| 11 | Skill Core find → charge → use | — | 6 sources, 0 LIVE; `skill_gate_unavailable`; source `specimen_venom` requires `access_tier 2` at a POI that is not mounted | **`SOURCE_ONLY` / unreachable** |
| 12 | the finale can be chosen | — | `abandon_run` callers in `game/`: 0; `plan_meta_source_claim(elder_ashen_vault)` → `source_identity_forgery` | **absent** |
| 13 | A0's normal-input journey completes | TRUE_INPUT (owner's) | **prefix PASS**: `prefix_complete=true checks=29 failures=0` with real input; continuation **FAIL** at `available_stations()` + `the physical furnace offers its own charcoal recipe`; 2/46, both processes exit 1 (§5) | **`TRUE_INPUT_PREFIX_ACCEPTED / END_TO_END NOT_ACCEPTED`** |
| 14 | 336 h run and last-72 h Ragnarok | MUTATION_RUN_CLOCK | forged clock reaches `last72` and `expired`; claim refused; no physical elder chest | **architecture only** |

---

## 3. Seam map — who owns the missing piece, at which SHA

| # | missing capability | owner · SHA | exact evidence |
|---|---|---|---|
| **S1** | the identity projection (`get_player_appearance_projection`, `player_avatar_changed`, `set_player_avatar`) | **A0 `53dcda29`** | `game/autoload/save_service.gd` contains no `avatar` token at all; A6's choice screen calls `set_player_avatar` and cannot succeed; A6's presenter falls to `NO_SAVE` |
| **S2** | a world source that contains A1's authored geography | **A0 `53dcda29`** | default `hollow_marches.json` 384×256; A1 authors 1024×768; the gated annex is 448×256 and off by default |
| **S3** | A8 POI mounting and A1 site ids | **A1 `c2ba1f0f` + A8 `0f885df862`** | A1's graph declares 1 of 3 A8 ids; A0's mount authority refuses all three at `A1_RUNTIME_WORLD_EXTENT_ABSENT` |
| **S4** | `economy_session.available_stations()` (A0's own new journey test calls it) | **A0 `53dcda29`** | 0 definitions in the composed `economy_session.gd`; the call is at `survival_normal_connected_journey_test.gd:521`. **This is a self-inconsistency inside one owner's two files.** |
| **S5** | a knife to start with | **A3 `b44e22df`** | 57 catalogue ids, none knife-like; A6 ships a `knife.png` icon for an item that does not exist |
| **S6** | item-kind vocabulary | **A0 `53dcda29`** | `INVENTORY_ITEM_KIND_IDS` refuses 13 of 57 ids (`station_kit` 5, `equipment` 5, `skill_core` 3). **A0 owns this; A3 owns the catalogue** (round 12's rank 5 said otherwise and is corrected) |
| **S7** | a damage producer and a threat default | **A0/A1** | 0 `take_damage` call sites; `survival/a0_optional_threat` false |
| **S8** | a physical Core source and a charge authority | **A1 + A8 + A3** | 0 LIVE sources; attestor invalid |
| **S9** | a physical elder chest / 72 h claim | **A8 + A3** | `source_identity_forgery` |
| **S10** | a voluntary abandon / evacuation door | **A0 `53dcda29`** | `abandon_run` 0 callers |
| **S11** | A6 return projection published by an owner | **A0/A3** | 6/6 accessors empty |
| **S12** | unique-instance loss on death | **A0 `53dcda29`** | `soh_i_` tokens survive death by design |
| **S13** | a readable home: roof that does not hide the door/interior, and world labels drawn above the roof | **A0 `53dcda29`** | §4.1(6)(7): the door is placed and invisible; the roof occludes the interaction prompt |

---

## 4. Visual evidence — `VISUAL_INSPECTED` at 1× 720p / 1440p / 2160p

`.github/workflows/a7-r13-joined-evidence.yml` (A7-owned, test-only) rebuilds the **pinned**
composition, refuses to continue unless the rebuilt SHA equals
`3d8630f5b1ad`, renders in a real X11 window at 1× (Xvfb + llvmpipe, `--resolution
1280x720`, the harness sets the window itself per size), verifies signature, dimensions and
that each frame is not flat, and commits the images. Run **`41188036958`**;
engine `4.7.stable.official.5b4e0cb0f`, adapter `llvmpipe (LLVM 20.1.2)`,
`content_scale_size 640×360`, `Camera2D.zoom (1,1)`.

| file (`docs/survival/balance/visual/r13/`) | framing | bytes | colours |
|---|---|---|---|
| `r13_overworld_1280x720.png` | 720p 1× | 297,599 | 355 |
| `r13_overworld_2560x1440.png` | 1440p 1× | 436,221 | 350 |
| `r13_overworld_3840x2160.png` | 2160p 1× | 546,824 | 356 |
| `r13_home_1280x720.png` | 720p 1×, at the built house | 300,161 | 361 |

All four were **opened at original resolution in this session** and inspected.

### 4.1 What the pixels show

1. **It reads as an SOH pixel survival RPG, at 720p.** Mortuary brick, birch and pine
   stands, a bone-yellow field, the Ashen Refuge tents, and a HUD that says
   `THE HOLLOW MARCHES · WESTERN FUNERY QUARTER` over a `PROVISIONS` bar and
   `CAMPS 0/4 · FINDS 0/8 · WAYS 0/4`. The palette is coherent, the 16 px tile art is
   consistent between terrain, props and structures, and the Hero is legible against both
   the brick and the grass because of the dark outline.
2. **Interaction is discoverable by contrast, not by a prompt:** `[CLICK] Oak Tree 3/3` sits
   in a dark plate with a white label directly over the node under the cursor. At 1× it is
   unambiguous.
3. **The 4K frame is the 720p frame magnified.** The HUD panel measures 610 / 1220 / 1830 px
   at the three framings — **49.0 % of frame width at all three** — and the 2160p frame
   matches the 720p frame at exact 3× offsets for **92.5 %** of probe pixels, against
   **1.2 %** at 2× and **1.6 %** at 4×. The project renders one **640×360 canvas**
   (`viewport 640×360`, `stretch mode canvas_items`): the visible world is **40 × 22.5
   tiles at every window size**, and a 4K monitor gets a **6× blow-up** of 640×360 art, not
   more world or more detail. This is a design decision A0 has never stated, and it is the
   single cheapest visual-quality lift available.
4. **No wayfinding exists.** `WAYS 0/4` is a counter with no map, no compass, no
   off-screen marker and no legend entry. A player who wants to raise that number has
   nothing on screen to walk toward.
5. **One body, everywhere, unchanged.** The same white-cloth, orange-chest figure at the
   same size in every frame; no picker, no name, no gender marker, and nothing that reads
   as "you chose this".
6. **The home seals, roofs — and the roof hides everything.** Final run: the capture walked
   out of the refuge, found ground beside the Hero, placed **8/8** ring pieces including
   **`door_wood` at `[54,236]`** (confirmed by reading the product's structure table:
   `door_placed=true`), got room `room_7a5fecea…`, and the roof drew over the footprint.
   Inspected at 1× and in a 3× crop: a **purple-slate roof slab covers the whole footprint**
   and there is **no visible door, no interior, no floor** from outside — the door exists in
   the data and is invisible in the frame.
7. **The roof is drawn over world-space UI.** In the same frame the interaction label behind
   the house renders as `[CLIC…` + `…or`, i.e. **the roof sprite occludes the prompt text**.
   Whatever the label is, a player cannot read it while standing at the south face of a
   house. That is a z-order/occlusion defect in the shipped scene tree, not a capture
   artifact.
8. **Provisions move while nothing happens:** 79 → 78 in frames taken seconds apart with no
   gathering between. Observed, not yet characterised; the drain rate is not measured.
9. **Contrast at 1× holds for the HUD; it does not hold for the Hero against the brick
   quarter** — the bone-white body over pale mortuary brick is the weakest pairing in the
   frame, and it is the pairing the spawn uses.
10. **So P2's "a physical paid home you can enter" fails on readability, not on
   transactions**: the build door, the room topology, the roof derivation, the bed anchor
   and the chest round trip are all real (R13HOME PASS 18); what a player sees is a sealed
   roofed slab.
7. **Provisions move while nothing happens:** 79 → 78 in the frames taken seconds apart with
   no gathering between. Observed, not yet characterised; the drain rate is not measured.
8. **Contrast at 1× holds for the HUD; it does not hold for the Hero against the brick
   quarter** — the bone-white body over pale mortuary brick is the weakest pairing in the
   frame, and it is the pairing the spawn uses.

### 4.2 What the pixels still cannot settle

No frame exists of a chosen avatar, a filled `CAMPS/FINDS/WAYS` counter, a POI interior, a
hostile, a death bag being picked up, the Core in use, the 72-hour window, or a return
screen — those features are absent from the build, so they cannot be photographed. The
house is a **labelled fixture setup** (materials granted; pieces placed through the
product's own build door) and is **not** evidence that a player builds a home with the
pointer. `HUMAN_NOT_TESTED` for enjoyment (EV8).

---

## 5. A0's own normal-input journey, run on this composition

A0 published `tests/survival_normal_connected_journey_test.gd` after round 12 was pinned:
gather → craft `furnace_kit` through the GUI → place it with the build pointer → burn
charcoal → queue `smelt_iron` → **KEY_P** to prepare the work → `depart_world()` → a second
OS process on the same save that collects the ingot through the GUI. That is exactly the
TRUE_INPUT evidence A7 has been asking for. A7 ran it **unmodified**, on `3d8630f5b1ad`, in a
real X11 window, two processes, nothing edited — and the result is the most informative
number in the product this round:

| stage | evidence |
|---|---|
| composition guard | rebuilt `3d8630f5b1ad` from 7 pinned SHAs, asserted before running |
| **prefix (ordinary input): gather → craft → place bench → weave cloth** | **`A0_CONNECTED prefix_complete=true checks=29 failures=0`** — 29 assertions pass with real keys and real clicks, and the save at that point is 16,206 bytes with a live `run_id` |
| continuation: furnace → charcoal → smelt → KEY_P → depart | **`FAIL  the physical furnace offers its own charcoal recipe`** and `SCRIPT ERROR Invalid call. Nonexistent function 'available_stations (via call)' in base 'Node (economy_session.gd)'` |
| verdict line | `A0 CONNECTED SURVIVAL JOURNEY FAILED - 2/46 (play)`, both processes **exit 1**, 0 `PASS` lines in the second |
| artifacts | `docs/survival/balance/visual/r13/journey/process1.txt`, `process2.txt`, `process1.exit`=1, `process2.exit`=1, `engine.txt`, `composition.txt` |

**Reading — and it is a genuine advance, not a defeat.**

1. **The first-29-checks half of the journey is TRUE_INPUT and it passes.** Until now, every
   "player gathers, crafts, builds, works" claim A7 could make was
   `NATIVE_COMPONENT_PATH` at best, because the probes call the doors directly. A0's own
   test does not: it walks, clicks, presses keys, and the 29 checks prove the prefix. That
   upgrades J01's *prefix*, and only its prefix: `gather → craft → place bench → weave
   cloth` is now `TRUE_INPUT / NORMAL_INPUT_PREFIX_ACCEPTED`.
2. **The remaining 17 checks never run**, because the continuation dies on a missing
   method. `available_stations()` is called by A0's own test file at line 521 and is
   **defined nowhere** in the composed `game/survival/economy/economy_session.gd`.
3. **Who must fix it: A0.** Under A7's narrow map `game/survival/economy/` is `merge` mode,
   so A0's copies survive; under A0's own manifest the same is true. `economy_session.gd`
   is A0's file at **both** heads and in both policies. The most likely shape is a
   companion change A0's test expects and A0 has not yet landed at this SHA — but A7 does
   not guess and does not fix it: it is one owner's file and that owner's own test.
4. **The round's verdict on the journey** is therefore
   **`TRUE_INPUT_PREFIX_ACCEPTED / NORMAL_INPUT_END_TO_END_NOT_ACCEPTED`** — a big step
   from round 12's `PLAYABLE_NATIVE_COMPONENT_PATH`, and still not the journey the contract
   promises.

This is why NEXT ACTION (§9.1) is not the avatar: it is this method. One definition, one
already-written test, and the product's strongest claim becomes measurable end to end.

## 6. R0–R5, nine gates, six axes

### 6.1 R0–R5

* **R0 — read the source.** Contract, D062–D074, the Atlas journeys, CT-GATE §0–§8,
  CT's review `#6541013653`, and the four moved owner heads read at the SHA, not at prose.
* **R1 — reproduce.** Composition rebuilt from 7 exact refs twice (identical SHA
  `3d8630f5b1ad`); import exit 0; 11 probes / 203 checks.
* **R2 — attack the oracle.** Round 12's own false positives were re-opened and corrected
  (§1.1). New falsifications this round: the "annex is a continent" hypothesis (it is 5
  POIs); "the capture cannot build a house" (it was my harness standing in the wall cell);
  "`economy_session` is A3's" (it is A0's under both policies, which changes who must fix
  it); "a sealed room is a home" (it has no door).
* **R3 — execute and look.** Real engine, real composition, real input, second OS process,
  four 1× PNGs opened. Distinguish: import (pass) · headless native (pass) · full
  composition (pass) · rendered 1× (pass) · owner normal-input journey (fail) · human
  session (none).
* **R4 — play value.** §7. Home-first is real and cheap in transactions and unreadable in
  pixels; explore-first still has no destination; threat absent; Core unreachable; finale
  doorless.
* **R5 — gates and decision.** §6.2, §6.3, §9. No self-merge.

### 6.2 Nine independent gates (each with its own veto)

| gate | verdict | proof |
|---|---|---|
| RESEARCH_PROVENANCE | **PASS** | 7 full SHAs, rebuild-deterministic, per-file provenance, two composition policies both reported |
| ARCHITECTURE | **FAIL** | identity slice absent from A0's own save service; world source 384×256 vs 1024×768 authored; A0's new test calls a method A0 never defines |
| CODE_RUNTIME | **PASS (scoped)** | import exit 0; 203 checks; 0 parse errors in the family |
| TEST_ORACLE | **FAIL** | success still surfaces `reason: "rejected"` on `collect`; A0's own journey test cannot run against A0's own session |
| VISUAL_UX | **FAIL** | four 1× PNGs: no wayfinding, one body, doorless roofed box, 4K = 6× blow-up of 640×360 |
| SYSTEM_VALUE | **FAIL** | no Core use, no damage producer, no reachable POI, no finale |
| SAVE_MIGRATION | **PASS (scoped)** | 2nd-PID settlement exactly once, one bag, `already_pending`, idempotent receipts; instance-token loss rule absent |
| INTEGRATION | **FAIL** | 0 A8 sites mounted; A6's choice screen cannot succeed; A1's stream unmounted |
| BALANCE_REPLAY | **NOT_TESTED** | 336 h / 72 h reachable only by `MUTATION_RUN_CLOCK` |

### 6.3 Six axes (never averaged)

| axis | verdict |
|---|---|
| ENGINEERING | **PASS (scoped)** — pieces do what they claim; placeholders labelled |
| NORMAL_PLAYER_REACHABILITY | **FAIL** — avatar, POIs, threat, Core, finale, and A0's own journey |
| ACTUAL_VISUAL_CRAFT | **FAIL (scoped)** — coherent at 720p; never native above 640×360; no wayfinding |
| GAMEPLAY_DEPTH / ECONOMIC VALUE | **FAIL** — one-sided economy; no decision changes a route |
| CREATOR_FIDELITY | **FAIL** — P1, P5, P6, P7, P8 blocked on named owners |
| HUMAN_ENJOYMENT | **NOT_TESTED** — no human session |

---

## 7. P1–P8, G1–G8, twelve journeys, 336 h

### 7.1 P1–P8

| promise | status | why |
|---|---|---|
| P1 two avatars, chosen, persisted | **FAIL (`A0_SOURCE_UNAVAILABLE`)** | no avatar code in A0's save service; A6's screen and presenter cannot succeed |
| P2 a physical paid home you can enter | **FAIL on readability** | transactions PASS (8/8 walls, room, roof alpha 1.00, bed anchor, chest round trip); the door *is* placed but the roof slab hides door and interior, and the roof occludes world-space labels |
| P3 knife-first exploration | **FAIL** | no knife item at all (0 of 57) |
| P4 fair threats and death-bag recovery | **bag PASS / threat absent** | 0 damage call sites; bag rules correct |
| P5 layered, reachable POIs | **FAIL** | 10/118 in bounds, 0 standable, 0 mounted, 3/3 refused |
| P6 knowledge through play, not a registry | **FAIL** | 5 technologies exist; the Core that would gate them is not reachable |
| P7 the Creator's Hero, not a Knight placeholder | **FAIL** | identity absent; the shipped body is a code-built Knight |
| P8 last-72 h Ragnarok, custody, evacuation | **FAIL** | claim forged-or-refused; no elder chest; `abandon_run` unreachable |

### 7.2 G1–G8 gates named in the work order

G1 identity · G2 world extent · G3 POI physicality · G4 threat/damage · G5 Core economy ·
G6 336 h/Ragnarok · G7 offline custody · G8 clean reset. G5–G8 are all blocked on the same
two A0/A1 root dependencies; G7's *settlement* half is PASS and its *currency custody* half
is `NOT_TESTED` because 7 of 7 currency sources are owner candidates, none physical.

### 7.3 Twelve journeys

| # | journey | verdict |
|---|---|---|
| J01 | first hour: spawn → gather → craft → storage → second process | **`TRUE_INPUT_PREFIX_ACCEPTED / NORMAL_INPUT_END_TO_END_NOT_ACCEPTED`** — A0's own journey test passes its 29-check prefix with real keys and clicks, then dies at `available_stations()`; no avatar, no knife; `collect` reports `rejected` |
| J02 | rare Core → charge → USE → store → research | unplayable (`SOURCE_ONLY`, 0 LIVE) |
| J03 | funded station work offline, one settlement | **PASS** settlement (2 charcoal once, 2nd claim `nothing_to_collect`); return projection absent |
| J04 | Quarry / Orchard / Mill + retreat | unreachable (0 mounted, 3/3 `unknown_world_poi`, 1/3 ids declared, 2 shapes of 3 — **FAIL**) |
| J05 | threat → death → bag → recovery | bag PASS; threat absent |
| J06 | last 72 h custody and deposit | refused (`source_identity_forgery`) |
| J07 | evacuation / voluntary end | `abandon_run` 0 callers |
| J08 | avatar choice survives a second process | impossible (no API) |
| J09 | walk to a standing A8 site and retreat | impossible (0 mounted) |
| J10 | camera/HUD legibility at 720p/1440p/2160p | `VISUAL_INSPECTED`: legible HUD at 720p; 1440p/2160p are magnifications; no wayfinding |
| J11 | 336 h run, full reset except achievements/history/`profile.secured_ragnarok_currency` | architecture only (`MUTATION_RUN_CLOCK`) |
| J12 | A0's normal-input connected journey (owner's own test) | **runs and fails** on `economy_session.available_stations()` |

---

## 8. Falsification log — including my own errors

| finding | how it was attacked | outcome |
|---|---|---|
| round 12: "the player builds a home with their own hands" | re-read the probe beside CT's review; every door is a direct call, every material a grant | **overclaim, corrected in round 12 §1 and not repeated here** |
| round 12: "A3 owns the kind-mapping" | read `INVENTORY_ITEM_KIND_IDS` — it is in A0's `save_service.gd` | **owner cross-write, corrected** |
| round 12: "all eight sweep FAILs are pointer limitations" | only three carry that evidence | **generalisation withdrawn; five stay FAIL** |
| "the product's waystation annex is the missing continent" | mounted it with the gate on and counted | **falsified**: 448×256, +5 POIs inside, +2 standable, still 0 A8 sites |
| "the capture cannot build a house because the world refuses" | recorded the product's own refusal strings and moved the Hero out of the ring | **my harness**, twice: a 6-cell search, then the Hero standing in the cell being walled |
| "a sealed room with a roof is a home" | placed `door_wood` and inspected the frame; read `_hero_exit_rejection` | **product defect recorded**: a doorless box is legal and reads as a slab |
| "A3 owns `economy_session.gd`" | the composition's `merge` mode means A0's copy survives; A0's own test calls a method the file does not define | **re-attributed to A0**, which changes who can fix the journey |
| "`VISUAL_NOT_TESTED` in round 12" | an A7-owned render job existed all along | **retracted in round 12 §4**, superseded here |

No result depends on a model's opinion of fun, on capture metadata, or on a fixture
presented as a player achievement. Every `FIXTURE_GRANT`, `MUTATION_A7_KEY`,
`MUTATION_RUN_CLOCK` and `COUNTERFACTUAL_SETTING` is printed by name in the probe output.

---

## 9. Decision, owner actions, and the next acceptance gate

**Decision: `HOLD_PRODUCTION` / `ACCEPT_DIAGNOSTIC_EVIDENCE` / `NO_MERGE`.** A7 does not
merge, does not edit owner code, and does not upgrade a missing feature to a pass.

### 9.1 NEXT ACTION (one primary outcome)

> **A0 (`arena/dea2428e`, `53dcda29`): make A0's own normal-input journey pass.**
> Define `available_stations()` on `game/survival/economy/economy_session.gd` (A0's file
> under both composition policies) and make
> `tests/survival_normal_connected_journey_test.gd` green in two processes on the
> composition A0's own CI builds. That single outcome converts the product's *strongest*
> claim — "a player gathers, builds, works and returns through ordinary controls" — from
> `NOT_ACCEPTED` to `TRUE_INPUT`, and it is the cheapest unblock on the board: one method,
> one test, already written.
>
> Dependency 1: **A0** publishes the identity projection (`get_player_appearance_projection`,
> `player_avatar_changed`, `set_player_avatar`). A6's screen and presenter already call
> these names; nothing else about the avatar pipeline is missing.
> Dependency 2: **A1 `c2ba1f0f` + A0** decide the world extent (384×256 default vs 1024×768
> authored) and state whether `survival/a0_waystation_candidate` is a product feature or a
> prototype. Today it buys 5 POIs and ships off.

### 9.2 Prioritized owner corrections (impact order)

| rank | owner · SHA | action | verification |
|---|---|---|---|
| 1 | **A0 `53dcda29`** | define `economy_session.available_stations()` | A0's journey test exits 0 in both processes |
| 2 | **A0 `53dcda29`** | identity projection on `SaveService` | A6's `avatar_choice_screen` returns true; presenter reaches a non-`NO_SAVE` status |
| 3 | **A0 `53dcda29`** | mount A6's presenter in `knight.tscn` | a live `AvatarPresenter` node in the world |
| 4 | **A0 `53dcda29`** | make the roof layer reveal the door and interior (fade/cutaway as the camera approaches, or draw world labels above the roof) | a 1× frame in which a door is visible and `[CLICK]` text is not cut in half |
| 5 | **A1 `c2ba1f0f` + A0** | reconcile 384×256 / 448×256 / 1024×768 and mount the reader | R13EXT `pois_inside ≥ 100`, `pois_standable > 0` |
| 6 | **A0 `53dcda29`** | state the 640×360 canvas decision (render at native resolution, or declare it) | a 2160p capture that is not a 3× copy of the 720p one |
| 7 | **A0 `53dcda29`** | wayfinding for `CAMPS`/`FINDS`/`WAYS` | a 1× frame in which the nearest unmet POI is findable |
| 8 | **A0 `53dcda29`** | widen `INVENTORY_ITEM_KIND_IDS` (13/57 refused) | 57/57 storable |
| 9 | **A3 `b44e22df`** | a knife in the survival catalogue (no kind work — that is A0's) | a knife id obtainable at spawn |
| 10 | **A0/A1** | a damage producer and a threat default | R13TD loses its `MISSING` |
| 11 | **A8 `0f885df862` + A3** | differentiate Orchard/Mill (2 shapes of 3 — still the round's only outright FAIL) and authorise rewards | 3 distinct shapes |
| 12 | **A0 `53dcda29`** | a player-facing abandon door | `abandon_run` callers ≥ 1 |

### 9.3 The next verifiable acceptance gate

`R13-G1 — the journey is a journey`: on a fresh composition of the then-current heads, **in
one CI run, two OS processes**, with no A7 overlay and no fixture materials:

1. A0's `survival_normal_connected_journey_test.gd` exits **0** in both processes and prints
   its own `PASSED` banner;
2. the same run's frames are **opened at 1× 720p and 2160p**, and the 2160p frame is **not**
   a 3× copy of the 720p one (probe: pixel identity at exact 3× offsets **< 40 %**);
3. the built house's door **and** interior are visible in a 1× frame, the roof does not
   occlude world-space labels, and the Hero can walk through the doorway;
4. `R13ID`'s identity `MISSING` lines are gone and a selected body survives the second
   process;
5. `R13EXT` reports `pois_inside ≥ 100` on the **default** (no flag) configuration.

Until that gate is green, P1, P2, P3, P5, P7 and P8 stay `FAIL` regardless of CI.

---

## 10. Reentry (mode A) and reproduction

```bash
# 1. rebuild the pinned composition (needs refs/live13/* fetched at the SHAs in §0.1)
python3 tools/survival/balance/compose.py --profile r13_heads --pin --ref-root refs/live13
git rev-parse refs/comp/r13_heads        # must be 3d8630f5b1adfa6c5b50c56fa506524e0ce71f6b

# 2. the round-13 family (11 probes, 203 checks) — import first, never --skip-import
python3 tools/survival/balance/run_native.py \
  --godot /tmp/godot/bin/godot.linuxbsd.editor.x86_64 \
  --composition refs/comp/r13_heads \
  --probe balance_native_r13/r13_extent_probe.gd --write

# 3. the pixels and the owner journey (CI, because the sandbox has no rasteriser)
gh workflow run a7-r13-joined-evidence.yml
```

**Mode-A reentry for the next auditor:** read `r13_identity_probe` first — if
`save_declares_method` is still false, nothing in the avatar/POI/P7 column has moved
whatever a PR title says. Then run **A0's own journey test** on the fresh composition: its
exit code is now the single most informative number in the product. Then `R13EXT` for the
world, then `R13HOME` for the regression. Do not treat `663a83ede523` or this round's
`3d8630f5b1ad` as current after an owner head moves; re-pin and re-run.

### 10.1 Action receipt (Git evidence, not a dispatch)

| action | evidence |
|---|---|
| owner heads refreshed to full SHAs | `refs/live13/*`; A0 `53dcda29`, A1 `c2ba1f0f`, A8 `0f885df862` |
| composition rebuilt deterministically | `r13_heads` = `3d8630f5b1ad` twice from the same refs |
| 11-probe family run | `native_runs.v1.json` on `3d8630f5b1ad`; round 12 preserved |
| pixels rendered and opened | run `41188036958`, four PNGs under `docs/survival/balance/visual/r13/` |
| A0's journey executed, unmodified | `docs/survival/balance/visual/r13/journey/` (both transcripts, both exit codes) |
| nothing merged, nothing dispatched | PR #25 open; A7 has no Arena dispatch to show, and a Git document is not a dispatch |
