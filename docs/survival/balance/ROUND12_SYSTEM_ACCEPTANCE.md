# Round 12 — A7 independent system acceptance (CT-GATE-v2026-10-31)

_2026-10-31. **Supersedes round 11 for status questions.** Round 11's composition
`c5eb573bfadb` is retained as historical evidence only; nothing in this report is
inherited from it. Every number below was measured on the composition pinned in §0.1
with the engine built from source in this sandbox._

**Verdict: `HOLD_PRODUCTION` / `ACCEPT_DIAGNOSTIC_EVIDENCE` / `NO_MERGE` /
one structural root dependency named, one content-reachability root dependency named.**
Visual status amended below from `VISUAL_NOT_TESTED` to `VISUAL_TESTED` (§4): the product
was rendered and its pixels inspected, and the pixels show defects, not a pass.

---

## 1. What a player gets, in player language

Read this before any table. It is the only section that describes the product rather
than the audit.

**What works, and that a player can do today with their own hands.**

A player enters the shipped overworld (`Hub → Campaign → Enter Overworld`), walks with
ordinary keys (largest displacement over four 12-frame bursts: **17.9 px**), chops a real oak with a bare
hand (**2 oak wood per swing, hits 3 → 2**), mines stone (**4 chunks in 2 swings**),
queues the shipped hand recipe, waits **6 s** of the game's own clock, collects a
**real A3 tool instance** (`soh_i_000000000002_d3346167`), and wears it out on a
mining node until the node depletes and the next swing is refused with
`harvest_grant_refused`.

They can then **build a house that is physically real**: 8 paid walls enclose a room
(`room_e1512500…`, 1 interior cell), the roof layer derives a **footprint over that
room and draws it at alpha 1.00 while the player stands outside**, the floor is a paid
piece, the **bed places inside the room and becomes the run's spawn anchor through its
own transaction**, a **chest is placed and moves real stacks** (deposit 34 oak + 28
iron + 1 kit, then a full withdrawal that empties it), and a **workbench must be
walked up to**: the same `weave_cloth` queue is refused at 195 px with
`station_not_reachable` and accepted at the bench. Placing the bench **consumes the
kit** (1 → 0). The death path is real too: `begin_overworld_death` drops the ordinary
stacks into **exactly one bag**, a second death reuses `death_1` rather than minting
`death_2`, recovery is refused while the death is pending, and the **physical bag node
in the world** returns the stack when interacted with at the death spot.

The same build door is also **brittle in a way a player will hit**: in the fresh-capture
run the Hero stood inside one perimeter cell, that wall was refused `hero_in_footprint`,
the room therefore never sealed, and the bed was then refused `bed_requires_room` — one
refused cell silently costs the whole room, and nothing on screen shows which cell is
missing (§4.1.5). The run's own HUD also dropped from `PROVISIONS 80` to `78` while the
capture sat still.

**What a player cannot do, and this is the headline of the round.**

* **They cannot be anybody.** There is no male/female Adventurer to select, no
  appearance, and no avatar on the body. The composition ships A6's presenter, sprite
  pipeline, appearance adapter and art manifest (all four files are present), and
  **nothing mounts them**; the presenter's only reachable branch is its own
  `NO_SAVE` safety path because `SaveService.get_player_appearance_projection()` and
  `player_avatar_changed` **do not exist in this composition**. Even in the
  counterfactual where A6's out-of-policy scene edits are accepted — the presenter
  then mounts as a real `AvatarPresenter` node plus an `AvatarUnavailable` diagnostic —
  **the avatar still does not appear**, because the API is still missing (§3.2). The
  gap is not the art and not the mount: it is one A0-owned method and one A0-owned
  scene reference.
* **They cannot reach the world that was authored.** A1's route graph declares **118
  POIs; 108 of them have cells outside the only runtime world A0 loads (384×256)**.
  A8 authored its sites against **1024×768**, so all three south sites are refused by
  A0's own mount authority with `A1_RUNTIME_WORLD_EXTENT_ABSENT`. A player can stand
  in the 10-POI opening window; the continent is authored, not present.
* **They cannot meet a threat.** `survival/a0_optional_threat` is absent/false, so the
  fully-built, fully-guarded skeleton encounter is never created. Under a
  counterfactual flag it mounts correctly at **27.7 tiles (443 px)** from the spawn
  after **123** validated attempts — gear that works, wired to nothing.
* **They cannot find, charge or use a Skill Core.** Six Core sources exist; **none is
  LIVE**. `commit_cast` refuses with `skill_gate_unavailable` because A3's skill
  attestor is an invalid `Callable` and no code configures it. There is **no call site
  of `take_damage`/`take_resolved_damage` under `game/overworld` or `game/survival`**:
  nothing in the survival world can hurt the Hero except a script.
* **They cannot choose the finale.** `a0_run_lifecycle.abandon_run` has **0 callers in
  `game/`**; the last-72 h claim is refused as `source_identity_forgery`; no physical
  elder chest is bound in the world.
* **They cannot be seen as themselves.** Three 1× PNGs at 720p/1440p/2160p now exist
  and were inspected (§4): the world reads clearly at 1×, but every frame shows the same
  one default body, there is no wayfinding on screen at all, and a house built through
  the product's door photographs as a windowless slab. Pixels that show a defect are
  evidence, not a pass.

**Two promises are not "almost there"; they are set by a number nobody has reconciled
(384×256 vs 1024×768) and a method nobody has written (the identity projection).**
Both are single-owner, dependency-ordered fixes. Everything else in this report is
secondary to them. A third one became visible only when the pixels arrived: a player who
is told `WAYS 0/4` has **nothing on screen to walk toward** — no map, no compass, no
off-screen marker — and the game never renders above a 640×360 canvas, so a 1440p or 4K
player is buying magnification, not clarity (§4.2). Neither is expensive; both are A0
surface.

---

## 0. Receipt

### 0.1 Composition (immutable, built by `tools/survival/balance/compose.py`)

| profile | commit | files | question it answers |
|---|---|---|---|
| `r12_a0` | **`21c37aecc9c7`** | 5307 | A0 alone (`a6b57c36`), the floor of this round |
| `r12_core` | **`2a3ab8724959`** | 5583 | A0 + A1 + A3 |
| `r12_full` | **`663a83ede523`** | 5665 | **the product under the current overlay policy** |
| `r12_wired` | **`fce825edb22d`** | 5675 | **counterfactual only**: `r12_full` + A6's 10 out-of-prefix scene/UI files |

* base **A0** `arena/dea2428e` @ **`a6b57c36cf2b`** (PR #21, draft, WIP SURV-020)
* overlay **A1** @ **`9ca1453ccdd3`** · **A3** @ **`b44e22df3af4`** ·
  **A6** @ **`6d71410a370d`** · **A8** @ **`e1fe550bfe7c`**
* control tower `docs_ct-loot-discovery-gate-20261030` @ **`971e0b95e1ea`**
* A6's **open PR #24 is `63d3fae54b1e`** on `arena/443f004f`; this composition pins the
  **other** A6 branch (`arena/05e0328d`, `6d71410a`), so A6's PR head is *not* what was
  measured. Stated because a reader would otherwise assume PR content = tested content.
* Composition rule: an overlay owns its prefix, is `replace` mode, and no owner file is
  edited to build it. A6's 26 `game/` paths outside the overlay prefix are **excluded**
  and counted in §3.2; they were measured only in `r12_wired`.

### 0.2 Engine, ledger, probes

* Engine: **Godot `4.7.stable.custom_build.5b4e0cb0f`**, built in this sandbox from
  `4.7-stable` (`scons platform=linuxbsd target=editor arch=x86_64 use_lto=no
  debug_symbols=no tests=no vulkan=no opengl3=no -j2`), 2802 compile steps, 40 m 25 s.
  Display: `DisplayServerHeadless`, adapter `""` — no rasterizer, no window.
* Ledger: `data/survival/balance/results/native_runs.v1.json`, **composition
  `663a83ede523`**, **10 probes / 200 checks / PASS 2 · FAIL 0 · BLOCKED 1 · RED 7**.
* A same-composition **50-probe sweep across every A7 family** (rounds 8–12) is
  preserved as `native_runs.r12_sweep.v1.json` (PASS 7 · FAIL 8 · BLOCKED 9 · RED 26);
  §9 explains why three of those FAILs are an oracle/environment artifact and not
  product defects. Round 11's payload is preserved as `native_runs.r11_full.v1.json`.
* The only red CI job on this branch is **"Original main baseline comparison"**, and it is
  red on `main`'s own commit `52147889`, not on this branch: the job copies this branch's
  test scripts into original main and runs them there, where
  `second light input is accepted` and `hot-tuned light damage reaches an overlapping enemy
  using the active Hero damage projection` fail (job `124487637801`). Those are campaign
  combat clauses outside A7's survival scope, recorded here so the red X is not read as a
  survival regression.
* Visual evidence: `.github/workflows/a7-r12-survival-visual.yml` (A7-owned, test-only),
  run **`41184551136`**, rendering the same pinned composition in a real X11 window; it
  produced the four 1× PNGs in `docs/survival/balance/visual/r12/` that §4 inspects. The
  sandbox itself remains rasteriser-free (`DisplayServerHeadless`, adapter `""`).
* Probes: `tests/survival/balance_native_r12/` (9 files + harness). Six are round-11
  bodies **carried forward unchanged except the probe id**, so a surviving defect is a
  fact about this tree; three are new and target the round-12 mission
  (`r12_identity_probe`, `r12_home_probe`, `r12_threat_death_probe`,
  `r12_visual_probe`).

---

## 2. Claim → evidence, with the rung named

Evidence rungs (protocol §3): EV1 static · EV2 import/parse · EV3 headless native ·
EV4 owner-native input · EV5 full composition · EV6 playable value · EV7 human review ·
EV8 enjoyment. Nothing below is raised above its rung.

| claim | measured | rung |
|---|---|---|
| The shipped product imports and builds a world | `import exit=0`; overworld reaches READY on every probe | EV5 |
| A body moves under real keys | 4 bursts × 12 frames, largest displacement **17.9 px** | EV5 |
| Bare-hand harvesting pays real items | oak 0 → 2, hits 3 → 2; stone 4 chunks in 2 swings | EV5 |
| The shipped hand recipe yields a real tool instance | job ready after **6 s**, collect ok, `soh_i_000000000002_d3346167` | EV5 |
| A tool wears and a node depletes | condition 96, revision 4, next swing `harvest_grant_refused` | EV5 |
| A house can be built and lived in | 8/8 walls, room id, roof footprint **1** @ alpha **1.00**, bed anchor, chest transfer, station gate | EV5 |
| Placing the workbench pays | kit 1 → 0 on commit; 1 → 1 when the cell is refused | EV5 |
| One death bag, recoverable through the world node | `death_1`, second death `already_pending`, pending recovery refused, bag node returns stack | EV5 |
| A threat exists and is fair *if enabled* | counterfactual mount at **443 px**, **123** attempts, contact damage 14, enemy HP 70 | **EV4/EV5, counterfactual** |
| A player avatar exists | **absent**: no API, no mount, no art bytes, no selection node | EV5 (negative) |
| A player can reach authored POIs | **10 of 118** inside the runtime extent | EV5 |
| A player can enter an A8 site | **0 mounted**; 3/3 refused `A1_RUNTIME_WORLD_EXTENT_ABSENT` | EV5 |
| A Core can be found/charged/used | **0 LIVE sources**, `skill_gate_unavailable`, no damage producer | EV5 |
| Offline work settles once | 2 charcoal after 12 s absence in a **second PID**, second claim `nothing_to_collect` | EV5 |
| The finale can be chosen | `abandon_run` callers in `game/`: **0**; last-72 h claim `source_identity_forgery` | EV5 |
| The product looks right at 1× | **VISUAL_TESTED — and it does not**: four 1× PNGs (720p/1440p/2160p + house) inspected; no wayfinding, one unseen avatar, house reads as a slab, 4K is a 6× blow-up of 640×360 (§4) | EV7 (visual) |
| The first hour is enjoyable | **not claimed**; needs a human (EV8) | none |

---

## 3. Seam map — who owns the missing piece, at which SHA

### 3.1 The identity seam (primary root dependency)

The vertical slice exists **only as a cross-owner diff on A6's branch**:

| layer | file | owner of the path | in `r12_full`? |
|---|---|---|---|
| save API `get_player_appearance_projection()` + `player_avatar_changed` | `game/autoload/save_service.gd` (+177/−124 on A6's branch) | **A0** | **NO — excluded** |
| mount node `AvatarPresenter` | `game/characters/knight/knight.tscn` | **A0** | **NO — excluded** |
| presenter | `game/survival/player/player_avatar_presenter.gd` | A6 | yes |
| sprite pipeline / adapter / manifest | `game/survival/ui/avatar_*.gd|json` | A6 | yes |

Measured in `r12_full`: `save_declares_method=false`, `save_declares_signal=false`,
`hero_scene_references_presenter=false`, project-wide mentions of the symbol **3**
(all inside A6's own reader), avatar-named asset files in the whole composed tree
**0**, live nodes that could select or present an avatar **0**.

Measured in `r12_wired` (A6's scene files accepted): `hero_scene_references_presenter
=true`, live nodes **2** — `AvatarPresenter` and `AvatarUnavailable` — and
`save_declares_method` **still false**. **Accepting A6's scenes does not produce an
avatar.** A6's manifest declares
`GAME_USE_SUPPORTED; PUBLIC_RAW_SOURCE_REDISTRIBUTION_NOT_APPROVED;
PRIVATE_RUNTIME_STAGING_REQUIRED`, and **no male/female sheet exists in Git**, so even
with the API the pipeline would resolve `SOURCE_BLOCKED`.

`r12_wired` deliberately **excludes** `game/autoload/save_service.gd`: accepting a
second SaveService from a non-owner is exactly the "one owner / one SaveService"
violation the standing constraints forbid. The counterfactual therefore measures the
*mount*, and the API remains provably an A0 authoring job.

### 3.2 The geography seam (secondary root dependency)

| fact | value | source |
|---|---|---|
| runtime world A0 loads | **384×256**, `data/overworld/hollow_marches.json` `world_bounds` | A0 |
| extent A1 authored against | **1024×768** | A8 package `a1_authored_world_extent_cells` |
| A1 POIs authored | **118** | `data/survival/world/poi_route_graph.json` |
| POIs inside the runtime extent | **10** (108 outside) | computed |
| A8 sites | Quarry `(30,280)`, Orchard `(140,360)`, Mill `(120,300)` | A8 package |
| A0 mount authority verdict | `A1_RUNTIME_WORLD_EXTENT_ABSENT` ×3 | `a0_poi_mount.probe()` |
| A8 sites declared in A1's graph under A8's ids | **1 of 3** (A1 says `south_*`, A3 answers `unknown_world_poi`) | `r12_j04` |

A0's authority is **correct to refuse**; it is the number that is wrong. Neither owner
may "fix" this by moving a site to a made-up cell.

### 3.3 The remaining seams, each with its owner

| # | missing capability | owner · SHA | exact evidence |
|---|---|---|---|
| S3 | a knife item to start with | **A3** `b44e22df` | 57 catalogue ids, none is a knife/blade; A6 ships a `knife.png` icon for an item that does not exist |
| S4 | `SaveService` item-kind vocabulary | **A0** `a6b57c36` | `INVENTORY_ITEM_KIND_IDS = [material, consumable, blueprint, key_item]` refuses **13 of 57** ids (`station_kit` 5, `equipment` 5, `skill_core` 3) |
| S5 | an authentic damage producer | **A0/A1** | `take_damage`/`take_resolved_damage` call sites under `game/overworld` + `game/survival`: **0** |
| S6 | a threat in the shipped default | **A0** `a6b57c36` | `survival/a0_optional_threat` false → `OptionalSkeletonEncounter` never created |
| S7 | physical Core source | **A1 + A8** | all 6 sources `PROPOSED_A1`, none LIVE; no mounted node binds `poi:specimen_vault_venom` |
| S8 | Core charge/use authority | **A3** `b44e22df` | `_skill_attestor` invalid Callable, no `configure_skill_attestor` caller, `commit_cast -> skill_gate_unavailable` |
| S9 | unique-instance loss on death | **A0** `a6b57c36` | `begin_overworld_death` retains every `soh_i_` stack; a unique token can never be lost |
| S10 | physical elder chest / last-72 h claim | **A8 + A3** | `plan_meta_source_claim(elder_ashen_vault) -> source_identity_forgery` |
| S11 | voluntary abandon / evacuation door | **A0** `a6b57c36` | `abandon_run` call sites in `game/`: **0** |
| S12 | A6 return projection published by an owner | **A0/A3** | all 6 accessors absent (`season_clock_missing`, `run_facts_missing`, `return_digest_missing`, …) |
| S13 | station endpoint authority | **A1 + A8** | `kiosk_02 -> A1_A8_ENDPOINT_SITE_ABSENT:crown_approach`; `preservation_kiosk_01 -> A1_A8_ENDPOINT_UNAUTHORIZED:OWNER_CONTRACT_CANDIDATE_A1_A8`; vending `endpoint_not_visited_or_offline` |
| S14 | A8 site differentiation | **A8** `e1fe550b` | `south_orchard_ruin` and `south_crown_mill` have identical shape (2 actions, 0 cost, no risk tier) — the only outright `FAIL` of the round |

---

## 4. Visual evidence — `VISUAL_TESTED` at 1× 720p/1440p/2160p, and what it falsified

**Amendment, 2026-10-31 08:35Z.** §4 as first published said `VISUAL_NOT_TESTED` because
this sandbox has no rasteriser (`DisplayServerHeadless`, no libGL/dri) and cannot
download an artifact from the blob host. That was true of the sandbox, not of the
product, so A7 built its own render path instead of inheriting the verdict:
`.github/workflows/a7-r12-survival-visual.yml` (A7-owned, shipped nowhere) rebuilds the
**pinned composition `663a83ede523`** with `compose.py --pin`, hard-asserts the resulting
`refs/comp/r12_full` equals that SHA *before* it claims a capture, then renders in a real
X11 window at 1280×720, 2560×1440 and 3840×2160 (`xvfb-run`, llvmpipe, 1× — no scaling in
the harness), verifies each PNG's signature, dimensions and that the frame is not flat,
and commits the images back to this branch. Run `41184551136` succeeded; the pixels below
were **opened one by one at 1× in this session and inspected**, not read from metadata.

| file (in `docs/survival/balance/visual/r12/`) | framing | image | bytes | distinct sampled colours |
|---|---|---|---|---|
| `r12_overworld_1280x720.png` | 720p 1× | 1280×720 | 306,989 | 366 |
| `r12_overworld_2560x1440.png` | 1440p 1× | 2560×1440 | 452,863 | 361 |
| `r12_overworld_3840x2160.png` | 2160p 1× | 3840×2160 | 568,487 | 362 |
| `r12_home_1280x720.png` | 720p 1×, at the house | 1280×720 | 295,320 | 344 |

Engine `4.7.stable.official.5b4e0cb0f`, display server `X11`, adapter `llvmpipe (LLVM
20.1.2)`, scene `res://game/overworld/chapter1_overworld.tscn`, `is_world_ready` true,
Hero spawn `(904, 3496)` world px = cell `(56, 218)`, camera zoom `(1.00, 1.00)`. The
transcript and every measurement are committed beside the images
(`r12_visual_measurements.json`, `render_output.txt`).

### 4.1 What the pixels actually show

1. **One avatar, and no selection seam.** A single humanoid in white cloth with an
   orange chest and a dark head covering stands centre-frame in all four captures. There
   is no picker, no name, no gender marker, and nothing on screen changes with an
   identity — consistent with the census (`0` avatar assets in Git, `save_declares_method:
   false`, presenter absent from `r12_full`).
2. **The HUD is real and legible at 1×:** `THE HOLLOW MARCHES · WESTERN FUNERARY
   QUARTER`, a `PROVISIONS 80` bar, then `CAMPS 0/4`, `FINDS 0/8`, `WAYS 0/4`, and the
   control legend `WASD move · CLICK interact · B build · C craft · ESC retreat`. The
   three counters are quarter-scoped, which is the same extent seam §3.2 measures — a
   player who clears this quarter sees `4/8/4` and nothing on screen says what lies past
   the quarter line.
3. **There is no wayfinding at all.** No minimap, no compass, no off-screen marker, no
   waypoint arrow, no "press M". `WAYS 0/4` is a promise with no in-world pointer to a
   way. This is a separate, cheaper defect than the extent seam: it survives even after
   A1 reconciles the world.
4. **Interaction is discoverable where an object is under the cursor:** the home frame
   shows `[CLICK] Oak Tree 3/3` over a harvestable tree, i.e. a remaining-harvest count is
   surfaced in the world and reads clearly at 1×.
5. **A house built through the product's own doors reads as a wall slab, not a room.**
   From a legal plot the capture placed **15 of 16** perimeter walls and 9 foundations
   with `select_piece`/`validate_cell`/`try_place`; the 16th was refused
   `hero_in_footprint` (the Hero stood in that cell), the bed was then refused
   `bed_requires_room`, and `room_at()` returned nothing — one missing wall is enough to
   void the room. The photograph shows what that produces: a solid wainscot mass with
   **no door opening, no roof, no readable interior, no bed**, over brick floor. Nothing
   on screen marks the one cell that is missing, and the only feedback is the refusal
   string. (The round-12 `R12HOME` probe reached `PASS 18` with a sealed `r=1` plot seven
   cells away and bed `b10` activated — the mechanic works, the *path* is brittle and the
   result is not visually a home.)
6. **Provisions moved in the frames:** `PROVISIONS 80` in the three world frames,
   `PROVISIONS 78` in the home frame taken seconds later with no gathering in between.
   The capture did not measure the drain rate, so this is recorded as observed, not
   claimed.

### 4.2 What the pixels falsify — including my own round-12 arithmetic

The table published earlier in §4 (80×45 / 160×90 / 240×135 visible tiles; Hero at
4.44 % / 2.22 % / 1.48 % of screen height; HUD text 8–11 *physical* px at 4K) was
**arithmetic on window pixels that ignored the project's content scale, and it is wrong.**
Measured, from the committed PNGs and the runtime facts recorded beside them:

- root `content_scale_size = 640×360`, `content_scale_mode = 1` (CANVAS_ITEMS),
  `content_scale_factor = 1.0`, `Camera2D.zoom = (1, 1)`; in `project.godot`
  (`663a83ede523`) that is `window/size/viewport_width=640`, `viewport_height=360`,
  `window/stretch/mode="canvas_items"`, `window/stretch/aspect="expand"`.
- The HUD's dark panel measures **610 / 1220 / 1830 px** long at 720p / 1440p / 2160p —
  **49.0 % of frame width at all three**, i.e. exactly 2× / 4× / 6× of one 305-logical-px
  layout.
- Sampling the 2160p frame at exact 3× offsets reproduces **92.5 %** of 5,238 probe
  pixels of the 720p frame; at 2× or 4× the match collapses to **1.2 % / 1.6 %**. The
  4K capture is a 3× magnification of the 720p view, not a wider view.
- Therefore, for the three **16:9** framings that were requested, the visible world is
  **40 × 22.5 tiles** (16 px cells) at *every* window size — 4.9 % of the 384×256 runtime
  extent, not 3.7 / 14.6 / 33.0 % — the Hero keeps a constant screen-relative size instead
  of shrinking to a third, and HUD text is drawn at 8/11 logical px and rasterised at
  16–22 px (720p) up to 48–66 px (2160p). `aspect="expand"` means only a non-16:9 window
  would reveal extra world on one axis; all three inspected captures are 16:9.

The consequence is worse for a pixel-art game, and it is *A0's*: **the game never renders
at native resolution.** A 1440p or 4K monitor receives a 4× / 6× blow-up of 640×360 tile
art, and buying a bigger screen never reveals more of the world or more detail. `VISUAL_UX`
fails on that, on the missing wayfinding, and on the house reading as a slab.

### 4.3 What the pixels still cannot settle

`VISUAL_TESTED` covers exactly what was photographed: the overworld at three framings and
one house attempt. **No frame exists** of a chosen avatar, a roof closing over a sealed
room, a knife gather that credits an item, a threat that damages the Hero, a death bag
recovered, a funded offline homecoming, the Core in use, or the Ragnarok window — so P1,
P4, P5, P7 and P8 keep their `FAIL`/`NOT_TESTED` status on the evidence of §2, and the
house in the frame was paid with `FIXTURE_GRANT` materials, so the pixels prove the build
door, **not** that a player can afford it.

---

## 5. Gameplay valuation (what the loop costs and returns)

**Home-first vs explore-first.** The only loop that pays *and* completes in this
composition is home-first: harvest → hand recipe → tool → build. Its cost, from the
shipped catalogue: **26 oak wood, 2 iron scrap, 1 workbench kit** for 8 walls + 1 floor
+ bed + chest + bench. At the measured bare-hand yield (2 oak per swing, 3 hits per
node) that is ≈13 oak swings and ≈2 stone/iron swings — a real, short first hour. The
probe paid this from a **`FIXTURE_GRANT`**, so the *net expedition* number is a
requirement, not a measurement: **the loop is affordable, but A7 did not earn it** and
does not claim to have.

**Explore-first has no destination.** Walking away from the spawn reaches 10 POIs out
of 118; the three A8 sites are refused by arithmetic. A route that ends in a refusal is
not an expedition, so there is no explore-first return to compare. The economy's
opportunity cost is therefore one-sided: building always beats travelling, because
travelling reaches nothing.

**Prepared vs unprepared.** Unprepared, the world cannot kill the Hero except by
script (0 damage call sites). Prepared, the counterfactual skeleton does 14 damage
against **1100 HP** — 79 contacts to kill — while carrying 70 HP, i.e. the "fair
threat" is currently a punching bag, not a risk. Neither branch changes a decision,
which is the definition of a missing gameplay layer rather than a tuning bug.

**Offline homecoming.** `burn_charcoal` escrows exactly 2 oak, arms, survives 12 s of
real absence, settles **once** in a second OS process (charcoal 2), and a second claim
is refused `nothing_to_collect`. Funded offline work is real and durable. But the
successful claim returns `reason: "rejected"` — the same stale-reason defect measured on
`collect` in round 11 and again on `queue_recipe` here. A success that reports a
rejection is a UX/custody lie even when the state change is correct.

**Full run / Ragnarok.** The run clock can be forged (A7 mutation, declared) to entry,
last-72 h and expired. At last-72 h a meta-source claim is refused
`source_identity_forgery`; the abandon door has no caller; the 336 h and 72 h boundaries
exist as arithmetic but not as a player-reachable finale. **The 336-hour run is
unplayable end-to-end**, and no amount of probe time can fix that without S10 and S11.

---

## 6. R0–R5, nine gates, six axes

### 6.1 R0–R5

* **R0 — recover the contract.** Read in full: protocol (152 lines), the round-12 work
  order, `CURRENT_PRODUCT_CONTRACT.md`, D062–D074, P1–P8 and the full Atlas/Source
  Coverage framing. Owner boundaries: A0 owns SaveService/lifecycle/world mount, A1
  geography, A3 economy, A6 UX/art, A8 world content, AVFX spectacle. The deliverable
  moves *depth* only where §2 says EV5; elsewhere it moves a fixture or a document.
* **R1 — inspect work and seams.** Pinned composition; read the **entire** changed
  methods behind each claim (`save_service.gd` kind gate, `a0_poi_mount.probe`,
  `threat_mount.mount`, `survival_death_bag.interact`, `economy_service.collect`,
  `room_topology.room_at`, `survival_roof_layer._process`). Cross-read A1/A3/A6/A8 heads:
  A6's PR head (`63d3fae5`) is not the measured branch (`6d71410a`); A8's package is
  authored against an extent that does not exist at runtime.
* **R2 — attack the oracle.** Three probe defects of my own were found and fixed rather
  than reported as product defects (§9). Conversely, three legacy probes report `FAIL`
  on a clause that requires a real pointer warp (`Input.warp_mouse`) and therefore
  cannot hold headless — classified `NOT_TESTED_ENVIRONMENT`, not a defect. Positive
  paths attacked with a **full bag (29 stack records)**, stale tool revision
  (`TOOL_REVISION_STALE`), depleted node, stale offline proposal, duplicate chest
  claim (`premature_ragnarok_claim`), and a second death before recovery.
* **R3 — execute and look.** Real engine, real composition, real input, second OS
  process, and **four 1× PNGs opened** (§4). Distinguish: import (pass) · headless
  native (pass) · full composition (pass) · rendered 1× at 720p/1440p/2160p (pass, CI
  Xvfb) · Xvfb pointer (NOT_TESTED) · human session (none).
* **R4 — play value.** §5. Home-first is real and cheap; explore-first has no
  destination; threat is off; Core is unreachable; finale has no door. Model-feel
  observations are hypotheses, not playtests.
* **R5 — gates and decision.** §6.2/§6.3, decision in §10. No self-merge.

### 6.2 Nine independent gates (each with its own veto)

| gate | verdict | exact proof |
|---|---|---|
| RESEARCH_PROVENANCE | **PASS** | composition built from 8 named refs; every path carries `source_sha`; A6 PR head ≠ measured head disclosed |
| ARCHITECTURE | **FAIL** | identity slice exists only as a cross-owner edit of A0's `save_service.gd`; geography authored at an extent A0 cannot load |
| CODE_RUNTIME | **PASS (scoped)** | import exit 0; 200 checks; 0 parse errors after the const-collision fix |
| TEST_ORACLE | **FAIL** | success surfaces `reason: "rejected"` on `collect` and `queue_recipe`; legacy headless pointer clause misclassified as a defect (now labelled) |
| VISUAL_UX | **FAIL** | §4: four 1× PNGs opened; no wayfinding, one avatar, house is a windowless slab, and 1440p/2160p are 4×/6× magnifications of a 640×360 canvas |
| SYSTEM_VALUE | **FAIL** | no Core use, no damage producer, no reachable POI, no finale |
| SAVE_MIGRATION | **PASS (scoped)** | second-PID settlement, one bag, pending-death refusal, idempotent receipts; instance-token loss rule absent (S9) |
| INTEGRATION | **FAIL** | 0 A8 sites mounted; A6 scenes excluded; endpoints unauthorised |
| BALANCE_REPLAY | **NOT_TESTED** | 336 h and 72 h reachable only by forged clock; no player can reach the finale |

### 6.3 Six product axes (never averaged)

| axis | verdict |
|---|---|
| ENGINEERING | **PASS (scoped)** — the pieces do what they claim; placeholders are labelled as placeholders |
| NORMAL_PLAYER_REACHABILITY | **FAIL** — avatar, POIs, threat, Core, finale unreachable |
| ACTUAL_VISUAL_CRAFT | **FAIL (scoped)** — pixels exist and were inspected; craft is coherent at 1× but the game never renders at native resolution (§4.2) |
| GAMEPLAY_DEPTH / ECONOMIC VALUE | **FAIL** — one-sided economy; no decision changes |
| CREATOR_FIDELITY | **FAIL** — P1/P5/P6/P7/P8 all blocked on named owners |
| HUMAN_ENJOYMENT | **NOT_TESTED** — no human session this round |

---

## 7. P1–P8 matrix

| promise | verdict | the one thing that decides it |
|---|---|---|
| **P1** living cause-and-effect world | **FAIL** | 108/118 POIs outside the loaded 384×256 world; the opening quarter is a window, not a network |
| **P2** home worth returning to | **PARTIAL / mechanics PASS, craft NOT_TESTED** | paid walls→room→roof→bed→chest→station gate all measured; roof is a labelled developer placeholder and no pixel was seen |
| **P3** scarcity, crafting, knowledge, revaluation | **FAIL** | 13/57 ids cannot be stored; 0 LIVE Core sources; no knowledge→worth chain observable |
| **P4** fair danger, death, recovery | **FAIL** | threat off by default; 0 damage call sites; the single-bag recovery itself is correct |
| **P5** layered POIs and returns | **FAIL** | 0 sites mounted, 3/3 refused, 2 of 3 sites authored identically |
| **P6** distinct Cores, source-authentic Gold | **FAIL** | `skill_gate_unavailable`; no physical Core; Gold/spectacle visual NOT_TESTED |
| **P7** two avatars, comprehensible interface | **FAIL** | no avatar API, no mount, 0 art bytes, 0 selection nodes; the Knight is the protagonist |
| **P8** long-term aspiration, deliberate wipe | **FAIL** | `abandon_run` has 0 callers; elder chest `source_identity_forgery`; run boundaries unreachable |

---

## 8. Twelve adapted journeys

Seven are the rounds-10/11 journey numbers, re-measured here; five are the round-12
asks that have no subject in this composition. "Adapted" = adapted to what exists.

| # | journey | status |
|---|---|---|
| J01 | first hour: spawn → scavenge → tool → storage → second process | **playable**, avatar clause missing, no knife item, `collect` reports `rejected` |
| J02 | rare Core: find → charge → USE → store → research | **unplayable**: 0 LIVE sources, `skill_gate_unavailable` |
| J03 | funded station work, offline, one settlement, one claim | **playable**, A6 return projection absent (6/6 accessors) |
| J04 | Quarry / Orchard / Mill route + retreat | **unreachable**: 0 mounted, `unknown_world_poi`, 1/3 ids declared |
| J05 | threat, one death bag, recovery | **bag PASS**; threat off by default (counterfactual only); unique-token loss impossible |
| J06 | last 72 h custody, deposit | **refused** `premature_ragnarok_claim`, endpoints unauthorised |
| J07 | run reset + the three carried benefits | **boundaries exist; no player door** (`abandon_run` 0 callers) |
| J08 | select a male/female Adventurer and see them | **absent** (S1/S2) |
| J09 | walk to an A8 site, act, retreat | **absent** (S2) |
| J10 | find, charge and use a physical Core | **absent** (S7/S8) |
| J11 | prepare, meet a threat, die, wake at the bed, recover the same bag | **half**: death/bed/bag real, threat default off |
| J12 | 336 h run → Ragnarok custody → voluntary evacuation | **absent** (S10/S11); clock reachable only by declared mutation |

---

## 9. Falsification log — including my own errors

| finding | how it was attacked | outcome |
|---|---|---|
| "the avatar is missing because A6 is not merged" (round 11) | measured the counterfactual with A6's scene files accepted | **retracted/narrowed**: the presenter mounts and still cannot see an identity → the blocker is A0's API, not A6's files |
| "`room_at()` returns the room's cells" (my first probe) | Godot error `Invalid cast: could not convert value to 'Array'` | **my bug**: it returns an **id**; fixed, then the room/roof measured correctly |
| "placing the workbench does not pay" (my first assertion, and A0's own test name) | measured payment only on commit | **my bug**: a refused cell must not consume the kit; on commit the kit 1 → 0 |
| "the camera keeps one zoom" (my visual probe) | compared size-prefixed strings | **my bug**; zoom is `1.00` at all three framings, which is itself the finding |
| three legacy B0 probes `FAIL` on `survival_normal_input_gather_test.gd:553` | read the clause: it depends on `Input.warp_mouse` under a real window | **environment, not product** — `NOT_TESTED_ENVIRONMENT`; CI's Xvfb job is where it belongs |
| "the roof is never drawn" | waited a frame for `_process` topology refresh | **retracted**: footprints 1, alpha 1.00 outdoors |
| "a full bag is accepted" | 29 ordinary kinds + extra token | refused, as designed; `grant_instance` → `inventory_full` |
| "a stale tool revision still harvests" | replay after condition change | `TOOL_REVISION_STALE` |
| 108/118 arithmetic | recomputed inside the probe from the shipped JSON | reproduced twice, both profiles |
| A8 refusals | asked A0's own `probe()` instead of paraphrasing | 3/3 `A1_RUNTIME_WORLD_EXTENT_ABSENT` |

No result in this report depends on a model's opinion of fun, on capture metadata, or on
a fixture presented as a player achievement. Every `FIXTURE_GRANT`, `MUTATION_RUN_CLOCK`
and `COUNTERFACTUAL` is printed in the probe output by name.

---

## 10. Decision, owner actions, and the next acceptance gate

**Decision: `HOLD_PRODUCTION` / `NO_MERGE` / `CONTINUE_CORRECT` on A0 and A8, `RESUME`
on A1's extent reconciliation.** A7 does not merge, does not edit owner code, and does
not upgrade a missing feature to a pass.

### 10.1 NEXT ACTION (one primary outcome)

> **A0 (`arena/dea2428e`, `a6b57c36`): ship a player avatar identity as A0's own code.**
> Add `SaveService.get_player_appearance_projection()` + the `player_avatar_changed`
> signal to `game/autoload/save_service.gd` **authored by A0** (adopt A6's method
> semantics, not A6's file), and mount A6's `player_avatar_presenter.gd` in
> `game/characters/knight/knight.tscn` as a child node. Then prove it with a
> two-process test: choose a body, write it, reload, and read the same projection.
>
> Dependency 1: **A6** (`6d71410a`) lands the licensed male/female sheets in the
> runtime staging path the manifest already declares — today **0 avatar bytes exist in
> Git**, so the pipeline can only resolve `SOURCE_BLOCKED`.
> Dependency 2: **A1** (`9ca1453c`) + **A0** reconcile the world extent (1024×768
> authored vs 384×256 loaded); this is the only thing that makes an A8 site or any of
> the 108 unstandable POIs reachable.

### 10.2 Prioritized owner corrections (impact order)

| rank | owner · SHA | action | verification |
|---|---|---|---|
| 1 | A0 `a6b57c36` | author the identity projection + mount the presenter | `R12ID` loses its first three `MISSING` lines |
| 2 | A1 `9ca1453c` + A0 | reconcile extent; move or re-author the 108 POIs | `R12ID` extent `MISSING` clears; `a0_poi_mount.probe` returns ok |
| 3 | A6 `6d71410a` | publish the licensed sheets where the manifest says | `_avatar_bytes().count > 0`; presenter reaches `STATUS_READY` |
| 4 | A0 `a6b57c36` | a damage producer in the survival world, and decide the threat default | `R12TD` loses its `MISSING`; a Hero can be hurt without a script |
| 5 | A3 `b44e22df` | a knife item and kind-mapping for `skill_core`/`equipment`/`station_kit` | 57/57 ids storable; knife present at spawn |
| 6 | A3 `b44e22df` | clear `reason` on success (`collect`, `queue_recipe`) | success returns `reason: ""` |
| 7 | A8 `e1fe550b` | differentiate Orchard vs Mill; bind a physical Core/elder chest; authorise kiosk endpoints | `R12J04` 3 distinct signatures; `plan_meta_source_claim` ok |
| 8 | A0 `a6b57c36` | a player-reachable abandon/evacuation door | `abandon_run` callers in `game/` ≥ 1 |
| 9 | A0 `a6b57c36` | allow a unique A3 instance to be lost on death (or state it never is) | a `soh_i_` token can appear in a bag record |
| 10 | A0 `a6b57c36` | decide the 640×360 canvas: either render the world at native resolution above 720p, or declare the fixed logical view a design choice in the contract | a 2160p capture that is **not** a 3× magnification of the 720p one (probe: < 40 % pixel identity at 3× offsets), or a contract line that says it is |
| 11 | A0 `a6b57c36` | wayfinding on screen: a minimap or off-screen markers for `CAMPS`/`FINDS`/`WAYS`, so a counter of 0/4 is actionable | a 1× 720p frame in which a player can point at the nearest unmet POI without reading a log |
| 12 | A0 `a6b57c36` | a house that reads as a home: a door opening in the wall ring, a roof that closes, and a visible marker for the one refused cell | a house frame like §4.1(5) in which the interior is visible and the bed is placed |

### 10.3 The next verifiable acceptance gate

`R12-G1 — identity is real`: on a composition containing A0's new API, A6's staged art
and no A7 overlay, all of the following must hold **in one run**:

1. a male and a female body are both selectable through a shipped screen, and the
   choice survives a **second OS process** (`R12ID`/`J08`);
2. the presenter reaches `STATUS_READY` and a rendered body differs between the two
   choices — inspected as **real 1× PNGs at 720p, 1440p and 2160p**, produced the way §4's
   were (`a7-r12-survival-visual.yml` pattern: pinned composition, Xvfb, 1×), or the gate
   is `VISUAL_NOT_TESTED` and cannot pass;
3. `R12ID`'s extent `MISSING` is replaced by a **standing** A8 site whose `probe()`
   returns ok, and a player can walk to it and retreat (`J09`);
4. no A6 file appears outside its overlay prefix, and no second SaveService exists.

Until that gate is green, P1, P5, P7 and P8 remain `FAIL` regardless of CI.

---

## 11. Reentry (mode A) and reproduction

```bash
# 1. rebuild the pinned product (creates refs/comp/r12_full)
python3 tools/survival/balance/compose.py --profile r12_full --pin
git rev-parse refs/comp/r12_full            # must be 663a83ede5239baaf372a907d7e138ab31f4f70d

# 2. build the engine (once per sandbox)
python3 -m pip install --break-system-packages scons
git clone --depth=1 --branch 4.7-stable https://github.com/godotengine/godot /tmp/godot
cd /tmp/godot && scons platform=linuxbsd target=editor arch=x86_64 use_lto=no \
  debug_symbols=no tests=no vulkan=no opengl3=no -j2

# 3. run the round-12 family (10 probes, 200 checks)
cd /home/user/Soul-of-Hero
python3 tools/survival/balance/run_native.py \
  --godot /tmp/godot/bin/godot.linuxbsd.editor.x86_64 \
  --composition refs/comp/r12_full \
  --probe balance_native_r12/r12_home_probe.gd --write

# 4. re-run the counterfactual (never the product; never with --write)
python3 tools/survival/balance/run_native.py \
  --godot /tmp/godot/bin/godot.linuxbsd.editor.x86_64 \
  --composition refs/comp/r12_wired \
  --probe balance_native_r12/r12_identity_probe.gd
```

### 11.1 Action receipt (Git evidence, not a dispatch)

| action | evidence |
|---|---|
| composition pinned and rebuilt on the exact refs | `refs/comp/r12_full` = `663a83ede523…`; the capture job asserts this SHA before it renders |
| ledger written on that composition | `data/survival/balance/results/native_runs.v1.json` (10 rows, 200 checks) |
| report + scoreboard published | commits `6698cfc`, `d28369c` on `arena/353cf120-soul-of-hero` |
| pixels rendered by an A7-owned job, not by an owner's | `.github/workflows/a7-r12-survival-visual.yml`, runs `41183323197` (failed at fetch: missing AVFX ref), `41183534595`, `41183848452`, `41184197051`, **`41184551136` (green)** |
| pixels opened and inspected | this report, §4; four PNGs under `docs/survival/balance/visual/r12/` |
| nothing merged, nothing dispatched | A7 has not merged PR #25 and has no Arena dispatch to show; a Git document is not a dispatch |

**Mode-A reentry for the next auditor:** the first thing to re-measure is
`R12ID`'s identity census. If `save_declares_method` is still `false`, nothing in the
avatar/POI/P7 column has moved, whatever any PR title says. Then re-run `R12HOME`
(it is the only PASS-adjacent journey and therefore the one most likely to regress
silently), then the extent census. Do not read round 11's `c5eb573b` verdicts as
current; do not treat the `r12_wired` counterfactual as a product state; and do not
claim a visual result without an opened PNG.
