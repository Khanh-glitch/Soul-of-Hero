# ROUND 6 — Architecture decision: which Level 3 is authoritative, and how death works

**Status:** decision and planning gate. Nothing in `data/`, `game/`, `tests/`, `assets/`,
`project.godot`, the prototype gameplay code or the existing evidence was modified to
produce this document.

**Pinned source revision for every claim below:** `d7f6da7` on
`arena/6e89e68d-soul-of-hero` (== `origin/arena/6e89e68d-soul-of-hero`). Comparators that
are *not* on this branch are named with their own commits:

| Ref | Commit | Relationship to Round 6 |
| --- | --- | --- |
| `main` | `5214788` | Round 6 branched here; does not contain Gate 2–5 or PR #3 |
| PR #3 `integration/chapter1-2-hero-web-playtest` | `1c21a49` | **already an ancestor of this branch** (verified `git merge-base --is-ancestor`) |
| PR #5 `design-pilot/levels3-4-candidate-a` | `1fd78f8` | 3 files (workflow + brief + audit); base branch below |
| PR #5 base `arena/b1c99a44-soul-of-hero` | `f27e8b7` | **already contains the L3/L4 data rewrite**; shares ancestor `1c21a49` with this branch; 28 commits not in ours, 342 not in theirs |

---

## 0. Executive answer

1. **The authoritative Level 3 is the one in `data/levels/chapter_1_level_3.json` on the
   shipping line — 116 × 84, 77 entities — until the owner rules otherwise.** It is not
   "better"; it is the only document that the registry, every production level test, the
   campaign save path and the Web playtest already exercise. Authoritativeness here is a
   *provenance* claim, not a quality claim.
2. **Gate 3 owns presentation technology, not the Level 3 map.** Its 116 × 96 document
   (`prototypes/gate3/level_data/chapter_1_level_3_gate3.json`) is a **test fixture**
   derived from Candidate A, and its authoring pass silently *edits walkable space*
   (`carve()` turns 27 wall cells into floor and adds 11). It is therefore neither a
   presentation-only artefact nor a candidate for promotion as-is.
3. **The proposed direction in the Round 6 brief is internally inconsistent and I am
   reporting the contradiction rather than smoothing it:** "retain the canonical
   77-entity contract" and "PR #5 owns Level 3 design" cannot both be true, because
   **PR #5's own branch has already replaced `data/levels/chapter_1_level_3.json` with a
   79-entity, 116 × 96 map** that is byte-identical to our
   `prototypes/gate0/level_data/chapter_1_level_3_a.json` (same blob
   `8687766b3a92367391804c48c20e5dc489b8b381`). One of the two must give.
4. **Death flow: recommend option B (player-chosen revival at the last checkpoint), not
   the prototype's automatic respawn director and not the shipped restart-only flow.**
   The mechanism already exists in production and is currently dead code
   (`knight.gd::respawn()` is called from nowhere in `game/`; `hud.gd:108` hides
   `RespawnButton`; `hud.gd::_on_player_respawned()` is already wired). What is missing is
   a *policy* and an owner decision, not an engine feature.
5. **No gameplay, balance, roster or persistence value should change in Round 7.** The
   smallest safe Round 7 is one CI-runner-only substitution probe plus a written owner
   decision package (see §6).

---

## 1. Method, and what is "obtained" versus "specified"

Round 6 re-read the live tree rather than Round 5's prose, then ran three read-only
probes. Everything in the "obtained" column below was executed on this revision; nothing
was written outside `/tmp` and `.artifacts` scratch space in a throwaway copy.

**Obtained (executed this round, read-only):**

| Probe | What it did | Result location |
| --- | --- | --- |
| P1 — provenance | hashed `prototypes/gate0/level_data/chapter_1_level_3_a.json` and PR #5 base's `data/levels/chapter_1_level_3.json` | identical blob `8687766b…` |
| P2 — PR #5's own auditor | ran `tools/design/levels3_4_pilot_audit.py` (from `1fd78f8`) in a `/tmp` copy with `.git` symlinked, against three candidate documents | §3.4 |
| P3 — production map-contract port | Python re-implementation of the assertions in `tests/chapter_1_campaign_map_design_test.gd` (bounds, floor≥2000, no floor/wall overlap, unique profile, one player, one exit, combat pressure, off-floor entities, tile-centre anchors, 4 reciprocal doors landing on floor, full connectivity through doors, spike dodge space, spike-avoidant objective reachability) | §3.5 |
| P4 — authoring portability | imported `tools/gate3/author_gate3.py`, ran `fit_placements()` + `build_material()` against both maps with `worldmodel.DOORS` re-derived from each map's `floor_door` entities | §4 |
| P5 — camera-band derivation | recomputed `_build_camera()` bands from each map's `metadata.rooms` | §4.4 |
| P6 — damage ledger re-read | parsed `GATE3 DAMAGE` / `GATE3 DAMAGE LEDGER` lines in the published logs | §5.2 |
| P7 — call-graph audit | `grep` for every caller of `knight.respawn()` inside `game/` | §5.1 |

**Specified, not obtained (must not be read as results):** anything requiring the Godot
editor — real collision, camera framing in pixels, WebGL2 frame times, and the behaviour
of Candidate A under the production test suite. Those are marked *unverified* wherever
they appear and are scheduled as Round 7 gates.

**Known limits of P3:** it is a re-implementation of GDScript assertions, not the test.
It cannot see TileSet compatibility, the collision *shape* query, NodePath wiring or
render output. A pass here means "nothing in the source document contradicts the contract
I could restate in Python", never "the production test passes".

---

## 2. Verified facts both decisions rest on

### 2.1 The two Level 3 documents

| | shipped `data/levels/chapter_1_level_3.json` | Candidate A |
| --- | --- | --- |
| where it lives | production path, registry slot 3, PR #5 base branch | `prototypes/gate0/level_data/chapter_1_level_3_a.json`, byte-identical to PR #5 base's production file |
| envelope | 116 × **84** | 116 × **96** |
| Backdrop / Geometry / Decor | 5 004 / 1 104 / 29 | 3 351 / 1 702 / 73 |
| entities | **77** | **79** (adds `l3_torch_13`, `l3_torch_14`) |
| entity types | 1 player, 15 skeleton, 5 skeleton_reaper, 4 floor_door, 5 sigil (4 required), 2 checkpoint, 1 exit_gate, 2 chest, 18 spikes, 12 torch, 12 coin | identical counts except **14 torches** |
| rooms / camps | 11 ids / 3 ids | **same 11 ids, same 3 ids**, different rects |
| player spawn | `(136, 216)` | `(280, 216)` |
| `camera_bounds` | `[0,0,1856,1344]` | `[0,0,1856,1536]` |
| `layout_profile` | `three_floor_crossfire_and_cover` | **identical** |
| `objective` text | "Dùng hố làm vật che…" | "Dùng kệ sách đá làm vật chắn…" |
| moved entities | — | **76 of 77** shared ids changed position |

So the divergence is *spatial identity and envelope*, not entity inventory, not objective
contract, not encounter budget. That materially lowers the cost of either direction and
materially raises the cost of doing neither.

### 2.2 Gate 3's map is Candidate A **plus a carve**, not Candidate A plus a skin

`tools/gate3/author_gate3.py::carve()` is applied before painting
(`build_level()` → `carve()` → `build_material()`). Measured difference between the two
prototype documents:

```
Backdrop  3351 -> 3413   (+62 cells, 0 removed)
Geometry  1702 -> 1686   (+11, -27)
Decor       73 ->   73
entities   79 ->   79 (identical ids, identical positions)
```

The 27 removed Geometry cells at `(25..33, 9..10)` and `(27..34, 16..21)` are the authored
alcove and shaft; the 11 added cells are `SHAFT_SEAL` at `y = 21`. **The overlay's map
changes what the Knight can walk into.** Any statement of the form "Gate 3 is a
presentation layer over Candidate A" is false; it is a presentation layer over a
*third* map that has never been reviewed as a layout by anyone.

### 2.3 Gate 3's runtime is already addressed to the production path

`prototypes/gate3/gate3_redesign.gd`:

* `const EXPECTED_LEVEL := "res://data/levels/chapter_1_level_3.json"` — the overlay
  refuses any other level path;
* `attach_to_level()` reads `res://prototypes/gate3/visual_placement.json`, and that
  document's `source_level` is the prototype JSON.

The two are only consistent because `.github/workflows/gate3-runtime.yml` **copies the
prototype JSON over the production path inside the runner** before every capture
(`cp prototypes/gate3/level_data/chapter_1_level_3_gate3.json data/levels/chapter_1_level_3.json`,
lines 58, 93, 122, 152…). That is the sanctioned trial substitution, and it also means the
Gate 3 evidence describes a map the repository never ships.

---

## 3. D1 — Canonical Level 3 ownership

### 3.1 The decision to be made

Not "is Gate 3 good" (Technical Gate 3 passed, see `ROUND_5_ACCEPTANCE.md`). It is:

> Which Level 3 document is the content of record, and who is allowed to change its
> layout?

Three concrete directions were on the table:

* **A — retain the shipped 77-entity map as content of record; Gate 3 becomes reusable
  technology; any redesign arrives later through the normal design-pilot promotion.**
* **B — adopt Candidate A now as the shipped Level 3**, i.e. promote the 79-entity,
  116 × 96 map, and let Gate 3's derived map stay a fixture.
* **C — port Gate 3's *design* onto the shipped 77-entity map** (re-author props, material
  and shade for 84 rows; re-take every frame).

### 3.2 Decision matrix

Scores are my judgement, stated so the owner can overturn them with a number; the
*evidence* column is what makes them checkable. 1 = worst, 5 = best, from the point of
view of "ship a correct, reviewable Level 3 with the least new risk".

| Criterion | A (retain canonical) | B (adopt Candidate A) | C (port design onto canonical) | Evidence |
| --- | --- | --- | --- | --- |
| Gameplay-contract compatibility | **5** | 4 | 4 | Counts are identical (20 enemies, 18 spikes, 5 sigils/4 required, 4 doors, 2 checkpoints). P3 found 0 violations for *both* maps. B's only contract deltas are +2 torches, spawn, bounds. |
| Entity / reward / checkpoint / objective continuity | **5** | 3 | 3 | 76 of 77 ids move in B; checkpoints move from `(264,680)/(264,1160)`; objective string changes. No reward payload changes (verified by PR #5's auditor: "non-spatial reward/objective payload changed" never fired). |
| PR #5 compatibility | 2 | 4 | **5** | PR #5's brief demands the 77-entity baseline and then its own branch ships 79. A makes PR #5 *re-scope* L3; B ratifies what PR #5 already did; C is exactly what PR #5's brief asked for and has not been done. |
| Regression risk to production tests | **5** | 3 | 4 | Every production level test loads the production path. B mutates what 5 test files validate at once; C re-takes screenshots but keeps `layout_profile`/room anchors by construction. |
| Visual quality (as measured so far) | 2 | **4** | 4 | Round 5: floor-2 arrival 45.3 % with a door-at-west-edge defect, floor-3 camp 59.2 % proxy miss. Both defects are properties of the 116 × 96 fixture, so they travel with B and C. |
| Engineering effort to reach a shippable state | **4** (presentation only) | 3 (presentation + promotion PR + re-pinned tests) | 2 (new authoring pass: 52 placements, shade, 22 frames per resolution, balance re-measure) | §4 measurements: props are 116 × 96-bound; 7 of 52 placements find no legal cell on canonical. |
| Runtime performance | 4 | 4 | 4 | Overlay cost measured in CI: +112 nodes, +1 266 objects, draw calls 227 → **96**, frame time 15.44 → 17.05 ms software GL (+10.4 %). Envelope height changes nothing measurable. |
| Long-term maintainability | **4** | 3 | 3 | A keeps one authored L3 and a map-agnostic presenter. B leaves the prototype JSON as a permanent fixture whose derivation (`carve()`) nobody else can reproduce. C collapses to A once done, but costs a full authoring pass. |

**Not scored**, because no honest number exists yet: design quality of the 79-entity
layout versus the 77-entity layout. PR #5's brief requires an 80/100 independent design
score per level and that review has not happened (its Stage 3 is still open). Any matrix
that pretends to rank the two designs on quality would be inventing data.

### 3.3 Recommendation (D1)

**Direction A, with a time-boxed escape hatch to B.**

1. **Content of record stays `data/levels/chapter_1_level_3.json` (116 × 84, 77 entities).**
   No substitution into the production path outside a CI runner, ever.
2. **Gate 3's ownership is re-declared as technology:** the presenter, the authoring
   tool, the coverage proof, the camera-band derivation and the checkpoint z-fix. Its map
   document stays at `prototypes/gate3/level_data/` as a fixture and is **never** promoted.
3. **PR #5 remains the design owner for L3/L4, but the ownership has to be restated.**
   Its brief's "77 entities, pinned baseline" language no longer describes its own branch.
   Two consistent restatements exist and only the owner can pick:
   * **A1** — L3 stays canonical; PR #5 narrows to *Level 4* plus its contract auditor, and
     any L3 redesign is a separate future pilot; or
   * **A2** — PR #5's L3 replacement is accepted *as a deliberate level-identity change*,
     which means the canonical contract becomes 79 entities / 116 × 96 / spawn `(280,216)`,
     the registry and test pins are updated in the same PR, and Round 5's mapping of
     Gate 3's evidence onto "Level 3" becomes legitimate.
4. **Adopt B only if the Round 7 probe (§6) is green** *and* the owner accepts the identity
   change in writing. B is not forbidden — it is simply unearned today: nothing has yet run
   the production suite against Candidate A.
5. **Reject C for now.** It costs a full authoring pass (7 placements have **no legal cell**
   on the canonical map; median relocation for the ones that fit is 3.5 cells, max 9) and
   would invalidate every Gate 3 frame. It becomes reasonable only if A1 is chosen *and*
   someone wants the archive look on the shipped map.

### 3.4 Why "PR #5 will catch it" is not a mitigation — I ran PR #5's own gate

`tools/design/levels3_4_pilot_audit.py` at `1fd78f8` pins baseline
`2903a305c610fc547581cc82268f3b7e37e8e75a` and checks entity-type survival, reward-payload
immutability, sigil/room/camp preservation, door reciprocity, floor/entity coherence and
footprint delta. Run in a `/tmp` copy with `.git` symlinked to this repository:

| Document audited | Verdict | Key numbers |
| --- | --- | --- |
| current canonical (unchanged) | **PASS** | 77 → 77 entities, moved 0, floor 5 004 → 5 004, Jaccard 1.000, warning "NOT IMPLEMENTED YET" |
| Candidate A | **PASS** | 77 → 79, moved 76, floor 5 004 → 3 351, delta 4 759, **Jaccard 0.278** |
| Gate 3 carved map | **PASS** | 77 → 79, moved 76, floor 5 004 → 3 413, delta 4 751, Jaccard 0.278 |

PR #5's auditor accepts a map that replaces **72 %** of the walkable floor, because its
thresholds are "no removed ids, no changed reward payloads, ≥ 140 % floor growth warning"
— and Candidate A *shrinks*. The auditor is a good regression net and it is reused in the
integration blueprint (see `ROUND_6_INTEGRATION_BLUEPRINT.md` §5), but it is **not** a
map-identity gate and must not be quoted as one.

> **Correction to `ROUND_5_ACCEPTANCE.md` §4.3:** that section states PR #5's audit "fails
> on entity count and footprint by construction" if Candidate A is adopted. It does not —
> measured above. The real conflict is narrower and sharper: PR #5's *brief text* pins 77
> entities while PR #5's *branch* ships 79, and the auditor is configured to accept both.

### 3.5 Would Candidate A break the production map tests? Not at the source level

P3 (Python re-implementation of `tests/chapter_1_campaign_map_design_test.gd`) on all
three documents:

```
canonical      floor=5004 wall=1104 entities=77 camps=3 rooms=11  violations: none
Candidate A    floor=3351 wall=1702 entities=79 camps=3 rooms=11  violations: none
Gate 3 map     floor=3413 wall=1686 entities=79 camps=3 rooms=11  violations: none
```

Additional pins that Candidate A *also* satisfies, checked directly:
`tests/chapter_1_map_design_test.gd` (L3: 15 skeleton, 5 reaper, 18 spikes,
`required_sigils` 4) and `tests/content/content_contracts_test.gd:413`
(`chapter_1_level_3: 20` enemies). `tests/chapter_1_campaign_level_visual_capture.gd`
captures `l3_f2_ring` and `l3_f3_exit`, both of which exist in both maps.

**Conclusion:** the map identity conflict is *not* a contract conflict. It is a
documented-baseline conflict plus a save-progress and review-evidence conflict. That is a
much cheaper problem than Round 5 believed, and it is exactly why the probe in §6 is worth
one CI run instead of another round of speculation.

### 3.6 What is portable from Gate 3 — headline

Full detail and per-subsystem verdicts are in **`ROUND_6_REUSE_MATRIX.md`**. Headline:
the presenter, the placement-fitting algorithm, the material painter, the coverage proof,
the shade field, the camera-band derivation and the checkpoint z-fix are **map-agnostic
code**; the *data* they consume (`PLACEMENTS`, `GARTH`, `ALCOVE`, `SHAFT_*`, `SOUTH_*`,
`LIGHTS`, and `carve()` itself) is Candidate-A-bound. Nothing may be carried over without
re-running the authoring pass against the chosen map and re-taking every frame.

---

## 4. D2 — Death flow and combat balance

### 4.1 What production actually does (verified line by line)

```
damage -> health <= 0
  knight.gd::kill()                     (:2718)
    -> _try_relay_to_living_reserve()   (:2728)   only if a *reserve* Hero is alive
         -> complete_soul_relay()                 swap bodies, run continues
    -> _die()                           (:2750)   "both Heroes down" path
         -> GameEvents.player_died.emit()
hud.gd::_on_player_died()               (:683)    shows DeathOverlay, pauses tree
  title "CẢ HAI HERO ĐÃ GỤC"  (HUD.tscn)
  RespawnButton: hidden in _ready()     (hud.gd:108)
  DeathRestartButton -> _restart_run()  (hud.gd:201, :813)
      -> GameSession.reset_run()        (score=0, sigils=0, checkpoint=(104,104))
      -> AppFlow.retry_active_run()     (level restarts from spawn)
```

`knight.gd::respawn()` (`:2765`) exists, fully implemented: clears death state, restores
every hero pool and barrier, refills mana/stamina, teleports to `GameSession.checkpoint`,
grants **1.0 s invulnerability**, emits `player_respawned`. `hud.gd::_on_player_respawned()`
(`:702`) hides the overlay, unpauses, restores controls and toasts "Đã hồi sinh tại điểm
lưu".

**`grep -rn "\.respawn()\|respawn(" game/` returns no caller.** The only caller in the
repository is `prototypes/gate3/gate3_redesign.gd::_on_player_died()` (the 1.2 s automatic
director). Production has the whole revival path built and switched off.

### 4.2 The four questions the brief asked

**(1) Does the harness model reserve switching? No.** `capture_gate3.gd::_player_dead()`
(`:1044`) tests the *active body* (`health <= 0 or dead`); the ledger
`_on_health_changed()` (`:1048`) attributes damage to that one bar; the respawn pass
restores one 1 100-HP bar. No reserve entity, no `complete_soul_relay()`, no
`force_relay_after_hero_defeat()` anywhere in the harness.

**(2) Is 1 592 gross a valid party-survivability measure?** As a measure of *one Knight's*
survivability at L3, yes — and that is the correct interpretation, because **at Level 3 the
party is one Hero**: `save_service.gd:34 SOUL_TEAM_RESERVE_CAPACITY := 1` and
`archer_hero` arrives as a `chapter_1_level_5` reward (`data/content/rewards/
chapter_1_level_5_archer_soul_pickup.tres`), with `HERO_UNLOCK_SHARD_COST := 50` shards as
the only alternate route. Caveat to state everywhere the number is quoted: a replaying
player who already owns the Archer (5 × L5 shard bundles, or 50 shards) *can* have a
850-HP reserve at L3; for that player the budget is 1 950 HP and the relay path is live.
So 1 592 gross = **144.7 % of one bar, 81.6 % of a two-body budget** — the conclusion
"the descent exceeds the health available" holds for the first playthrough and softens on
a replay.

**(3) Are the encounters unfair?** Signal from the published ledgers (P6), one full
descent each:

| run | hazard | enemy | blows | unexplained | total |
| --- | --- | --- | --- | --- | --- |
| 1 | 120 (6 ticks) | 1 830 | 12 | 154 | 2 104 |
| 2 | 120 (6) | 1 348 | 9 | 0 | 1 468 |
| 3 | 100 (5) | 1 830 | 12 | 0 | 1 930 |
| 4 | 234 (5) | 1 542 | 11 | 0 | 1 776 |

* Hazards are **not** the threat: 5–6 spike ticks of 20 HP, 100–234 HP, 6–13 % of the gross.
* The threat is **9–12 enemy blows totalling 1 348–1 830 HP at a 1 100 HP bar** — the
  Knight can absorb ≈ 7 blows and the level delivers 9–12. Death is therefore the
  *expected* outcome of a clean descent, not a mistake.
* Individual logged drops in `stability_run_*.txt` + `deep.txt` (19 events incl.
  duplicates) are 154 HP each and 11 of 13 unique events occur at ≤ 45 px from the nearest
  enemy — i.e. **sustained melee contact**, not the long-range crossfire the Round 5
  narrative emphasised. Caveat: the log prints one line per *tick* in which health drops,
  so simultaneous sources collapse into one event and the range bucket is a lower bound.
* Convergence, hazards and signalling are therefore **secondary**; the primary unfairness
  is *no recovery between three storeys of sustained melee*. That is a survivability
  design question, not a telegraphing bug.

**(4) Can checkpoints support player-controlled recovery without bypassing progression?**
Yes, and cheaply. `GameSession.checkpoint` is **in-memory only** (`:9`, reset by
`reset_run()` at `:54`, set by the level's checkpoints via `set_checkpoint()` `:118`), so a
revival at the checkpoint cannot leak across runs or sessions. L3's checkpoints are at
`(264, 680)` (floor 2) and `(264, 1160)` (floor 3); the run starts at `(104, 104)` set by
`main.gd:243`. Revival at those points keeps sigils and score but rewinds position — the
progression bypass risk is limited to whatever the player picked up after the checkpoint
(one floor of enemies and possibly a sigil), which is a *design* knob, not a persistence
hole.

**(5) Restart vs explicit revival vs other?** See §4.4.

### 4.3 Alternatives

**A — existing: relay → defeat/restart.** Preserved exactly as shipped.
*Tension 5, fairness 1, accessibility 1, exploit risk 5 (no exploit), progression 2
(everything lost), implementation 5 (zero), Hero-systems 5.*

**B — manual checkpoint revival (recommended).** On death, the overlay offers *Hồi sinh tại
điểm lưu* (revive at last checkpoint) alongside restart, and the choice is the player's.
Specification (owner-gated, **not** implemented in Round 6):
* **Eligibility:** at least one checkpoint touched this run (`GameSession.checkpoint !=
  spawn`), and a per-run revival budget (suggest 2) so death keeps a cost.
* **State restoration:** exactly `knight.gd::respawn()` today — full HP for every hero
  pool, barrier, mana, stamina, 1.0 s invulnerability, `global_position =
  GameSession.checkpoint`. Enemies **not** reset, hearts **not** refilled: the player
  re-enters a live encounter.
* **Progression persistence:** score, sigils, coins and loot already collected persist
  (they are `GameSession`/`SaveService` state, untouched by revival). What is lost is the
  un-collected progress of the last storey — the same loss a restart imposes on the whole
  run.
* **Exploit surface:** the only new one is "die on purpose to refill HP". Mitigations, in
  order of preference: finite budget per run (cheap, no save format change) → restore to a
  fraction of max → respawn at the checkpoint with enemies left alive (already the case).
  A *persistent* cost would need a save-schema change and is out of scope for this round.
* *Tension 3, fairness 4, accessibility 5, exploit risk 3, progression 4, implementation 4
  (the method exists; the UX and policy do not), Hero-systems 4* (relay still fires first
  when a reserve is alive, so B only governs the terminal case).
* User-visible change: one button and its policy. That is why it needs owner approval, not
  an engineering argument.

**C — automatic checkpoint revival.** The prototype's director, promoted.
*Tension 1, fairness 4, accessibility 5, exploit risk 2 (unlimited free healing, invisible
to the player), progression 4, implementation 5 (already written), Hero-systems 3.*
Also inherits a specific engineering defect: the director drives the overlay from a timer
that runs while the tree is paused (`create_timer(1.2, true)`), so it competes with the
HUD's own `_on_player_died()` lifecycle and hides a design problem behind an automatic
outcome. Round 5 already recorded this as "the mechanic works, but it is not shipped".

### 4.4 Recommendation (D2)

**Ship A now, adopt B when the owner is ready, reject C.**

* **A stands until B is approved.** No balance value changes: hazards at 20 HP/tick, 20
  enemies and 1 100 HP stay exactly as shipped. Round 5's D2(a) disposition is unchanged —
  the Mortality finding is *reported*, not silently tuned.
* **B is the recommended target** because it (i) costs one button + one policy instead of a
  new subsystem, (ii) preserves the relay-before-defeat hierarchy, (iii) makes the
  checkpoint the reward for surviving a storey instead of a decorative prop, and (iv) is
  testable without touching save format.
* **C is rejected** even though it is written: it removes the tension the level's design is
  built around and it makes the survivability numbers unmeasurable (every death becomes a
  soft success).
* **The balance question is separable and must not be decided by the death flow.** Even
  with B, "9–12 blows × 150 HP against a 1 100 bar" describes a descent where two revivals
  are the difference between finishing and not. If the owner wants L3 to be survivable on
  one bar, the lever is *encounter pressure* (Round 5's measured numbers), not revival.

### 4.5 What native tests would be needed for B, and their minimum safe setup

Specified only; nothing was run (no Godot in the sandbox).

* Isolated harness (`tests/ci/…` scratch runner, **no** production save):
  `SOUL_OF_HERO_SAVE_PATH=user://tests/…json`, `AppFlow.start_campaign_level(
  &"chapter_1_level_3")`, then (a) force `knight.kill()` with no reserve → assert overlay
  shows both buttons; (b) press revive → assert `player_respawned` fired,
  `global_position == GameSession.checkpoint`, `health == max_health`, tree unpaused,
  enemies still alive; (c) exhaust the budget → assert only restart remains; (d) kill with
  a reserve present → assert relay fires and the overlay never appears.
* Runner must not modify `data/**`; the substitution rule (CI-only copy) applies.
* Obtained today: **none** of the above. Specified: the four assertions, all of which map
  onto existing signals (`player_died`, `player_respawned`, `checkpoint_changed`).

---

## 5. Owner-approval boundaries

Anything that changes *what the player sees or receives* is owner-gated. This round
recommends and does not decide:

| Change | Gated? | Why |
| --- | --- | --- |
| L3 content-of-record (77 → 79 entities, 116 × 84 → 96) | **Owner** | Level identity; invalidates PR #5's pinned baseline text |
| Unhiding `RespawnButton` + revival budget | **Owner** | Gameplay rule; must not be self-approved |
| Any HP / damage / roster / persistence value | **Owner** | D2(a) standing instruction |
| Moving the overlay from `prototypes/` into `game/` | **Owner** | Protected tree; also a permanence decision |
| Re-authoring props for the canonical map | **Owner** (scope) | New authoring pass, new frames, new evidence |
| Reusing the auditor in CI | Gate 3 team | Read-only tool, no production change |
| Adding a CI-only substitution probe | Gate 3 team, CI-only | No file outside `.github/` and `tests/` scratch; must not run on `main` |

## 6. Smallest safe Round 7 scope

1. **One CI-runner-only probe (no repository substitution):** in a workflow step, copy
   `prototypes/gate0/level_data/chapter_1_level_3_a.json` over the production path *inside
   the runner*, then run the production gates that actually touch Level 3:
   `chapter_1_campaign_map_design_test`, `chapter_1_collision_route_test`,
   `content_contracts_test`, `chapter_1_balance_matrix_test`, and the slot-3
   `chapter_1_campaign_level_visual_capture` (spawn / mid / end). Publish the logs as
   evidence. This converts §3.5 from "source-level pass" to a real result, and it is the
   only thing that can settle direction B on evidence rather than opinion.
2. **A one-page owner decision package** containing only the two open questions from
   §3.3 (A1 vs A2) and §4.4 (B approved / B deferred), with the numbers above attached.
3. **A written revival-policy spec** (`docs/gate3/ROUND_7_REVIVAL_POLICY.md` draft) —
   text only, so the owner can approve or reject a *rule* before anyone writes code.
4. **Not in Round 7:** any file move into `game/`, `data/`, `assets/`, `tests/`; any
   balance edit; any overlay refactor; any attempt to port the archive onto the canonical map.

## 7. Uncertainties I cannot close from here

* **Design quality of either map** — no independent 80/100 score exists. Round 5 measured
  *framing*; nobody has measured *fun*.
* **Whether Candidate A passes the production suite in Godot** — source-level says yes,
  only a run can say yes for real.
* **WebGL2 cost of the overlay** — the only numbers are software-GL. Round 5 §4.5 stands
  unchanged: a browser frame-time capture is mandatory before any deploy.
* **Whether the 116 × 84 canonical map has enough vertical separation for per-storey camera
  bands at all** — measured in §4 of the reuse matrix: the derived bands overlap by 5 and 9
  rows and extend past the map edge, so the floor-2 arrival framing that Gate 3 tuned is
  *not reproducible* on the canonical map without new authoring. That is a real cost of
  direction A and it is stated in the matrix rather than hidden in a camera statistic.
