# A7 acceptance scoreboard — round 8 (system acceptance on a real engine)

_2026-10-30. Supersedes round 6/7 for status questions; round 8 ran a real Godot
`4.7.stable.custom_build` against composition `03887d9bebf4` (A0 `8750fd8a` +
A1 `178a5ba2` + A3 `a5d11141` + A6 `63d3fae5` + A8 `54c66b89`). Full report:
[`ROUND8_SYSTEM_ACCEPTANCE.md`](ROUND8_SYSTEM_ACCEPTANCE.md). Ledger:
`data/survival/balance/results/native_runs.v1.json`._

| verdict | count |
|---|---|
| PASS | 2 |
| FAIL | 3 |
| BLOCKED | 0 |
| RED_NOT_IMPLEMENTED | 10 |

* **B0 `first_hour` remains `NOT_CLAIMED`**, for a sharper reason than round 7:
  three journeys pass 33 of 34 checks and fail the same one — the placement ray
  hits a HUD `ClickBlocker` and is rejected as `solid_terrain`.
* A save **does** survive a genuine second OS process (int `987` returns as
  `987.0`, accepted as lossless; a replayed transaction key is refused).
* The 14-day arithmetic exists and is enforced in A3 (`1209600`, refuses 13- and
  15-day projections by name), but **cannot reach the runtime**: A0 vendors an
  older economy service missing `plan_offline_operations`, `forecast_offline_food`
  and `apply_offline_operation_plan`. That is recorded as FAIL, twice.
* Ragnarok, elders, stones, evacuation and the two economies do not exist at this
  pin; each RED row names the missing symbol.

---

# A7 acceptance scoreboard — round 6 (gatekeeper of integrated player value)

_Pinned 2026-10-30 against A0 `9269739e`, A1 `939720d5`, A3 `c5e80922`, A6 `08ccb834`,
A8 `c8b4bc88`. Every row is reproducible from the bytes named here; **nothing below was
observed in a running Godot session**. Regenerate with
`python3 tools/survival/balance/run_analysis.py`, prove the suite with
`python3 tools/survival/balance/run_tests.py`._

Round 6 asks a harder question than round 5. Round 5 asked *which link is missing*. Round 6
asks **would the gate notice if a link only looked present?** Two answers came back:

1. A real hole: scene reachability counted a name inside a `;` comment as an instanced
   scene. Fixed; the probe that found it is now permanent.
2. A real hole in A7's own reporting: `PROD-04` could be `FAIL` while the same payload filed
   it as closed, and the words it counted included the wire key `"schema"`. Both fixed,
   recorded as `CORR-13`.

## 1. What a player can actually do on this build

| The player can | The player cannot |
| --- | --- |
| boot, choose a profile, reach the Home map | find survival, a world map, a POI or a container on that map |
| enter the survival overworld through the campaign tab (source: `S3`) | walk to the Waystation: the mount is behind a project setting the shipped `project.godot` never declares |
| gather authored scrap and oak, build a bed, chest and door by ordinary input | claim the Waystation cache: A0 sends `si:r_ashen_crown:waystation_cache:01`, its own vendored table still says `node_waystation_cache`, and its lookup is exact equality |
| see a Knight | see the bald body D051 locks (`555940` / `419402`): A6's manifest still declares `BASE_ART_NOT_IMPORTED` |

## 2. The four claims, kept apart

| Claim | Question | State at this pin | Level |
|---|---|---|---|
| **A** | does a route from the normal menu into the survival overworld exist **in source**? | `SOURCE_PRESENT` | `S3_PRODUCTION_SEAM` |
| **B** | does it **run in native Godot**? | `STALE_HEAD` — 8 required runs, 0 `VERIFIED` | `NOT_CLAIMED` |
| **C** | is the Waystation **mounted and reachable by normal input**? | `SOURCE_PRESENT_BEHIND_DISABLED_FLAG`, `reachable_by_normal_input = false` | `S1_AUTHORED_ONLY` |
| **D** | is a **useful A3-authorised, persisted** reward claimable? | `PARTIAL` — authorisation `S3`, commit `S3` in source, never native | `S2_SCENE_FIXTURE` |

`C` is read from production paths only, and now has three states instead of two:
`ABSENT` / `SOURCE_PRESENT_BEHIND_DISABLED_FLAG` / `MOUNTED_BY_DEFAULT`. Round 5's `ABSENT` was
wrong at this head — the content *is* in production code — and the guard is what keeps it out of
a player's hands. Assertions `A17` and `A28` hold that distinction.

## 3. Exact code under test

| Owner | Head | What it is |
|---|---|---|
| A0 | `9269739e` | app root, save service, overworld, Waystation host, A3 catalog mirror (PR #21) |
| A1 | `939720d5` | world data + the vertical-slice handoff contract |
| A3 | `c5e80922` | items, sources, recipes, stations, loot tables + canonical `si:` bindings |
| A6 | `08ccb834` | player-first HUD, avatar adapter + art manifest |
| A8 | `c8b4bc88` | native POI sites, shell visuals, site transforms |
| A8 task | `9332cb9b` | `feature/surv-a8-reuse-audit-010a` — reuse audit, **unmerged** |

**75 files** are sha256-pinned in `data/survival/balance/snapshot/product_manifest.json`, plus
`tree_index.txt` so a `res://` claim can be checked against real paths. `load_snapshot` raises on
any byte drift; `test_snapshot_hashes_are_verified_on_load` proves the check runs and that the
manifest describes exactly the files on disk.

## 4. CI evidence, read honestly

`data/survival/balance/evidence/ci_runs.v1.json` records **57** workflow runs fetched with
`--limit 10` (the window is stored in the file, because "57 runs" without the window is a
number nobody could reproduce): **45 queued, 12 completed — all 12 completed runs failed.**
Every native state the gate needs is `STALE_HEAD` or `QUEUED`; `any_native_verified` is
`false`. The queue has grown, not drained: A0 keeps pushing and the runner has not caught up,
so "wait for CI" is not a plan for this pin.

A run counts only for the commit it ran on. Queued is `QUEUED`, never "probably fine". The two
most useful failure labels remain `post-boot inventory` (run `41018366655`) and
`disk unchanged after interrupted write` (run `41022547962`): both describe save-custody
failures that A0 has since fixed in source — and neither has been re-proven.

## 5. The chain that matters

Two chains, `L1`→`L8`; a chain is only as good as its weakest link. **13 of 16 links are
blocked.**

| Link | `waystation_cache` | `a8_quarry` |
|---|---|---|
| `L1_ENTRY` | `S3`, blocked (`B` unproven) | `S3`, blocked (`B` unproven) |
| `L2_ROUTE` | `S1`, blocked — behind a disabled project setting | `S2`, blocked — fixture scene only |
| `L3_INTERACTION` | `S1`, blocked | `S2`, blocked |
| `L4_AUTHORIZATION` | `S3`, **open** (3/3 A3 bindings adopted) | `S0`, blocked — 2 actions unpriced |
| `L5_COMMIT` | `S3`, blocked — 8 mounted survival callers, 0 keyed on the A1 contract | `S2`, blocked — in-memory fixture |
| `L6_RELOAD` | `S3`, blocked | `S0`, blocked |
| `L7_NO_DUPLICATE` | `S3`, blocked | `S2`, blocked |
| `L8_OUTCOME` | `S3`, **open** | `S3`, **open** |

## 6. Independent oracles (answers from outside the file being judged)

| Oracle | Verdict | What it proves |
|---|---|---|
| `engine_api` | `ENGINE_API_CONSISTENT` — 0 unknown calls | A8 `c8b4bc88` removed all 15 `Vector2.from_array` sites; `native_poi_vectors.gd` replaces them. True of the old pin `5ccf7b3f`, so this is **`SOURCE_FIXED_PENDING_NATIVE`** — the fix exists and nothing has run it. |
| `save_fidelity` | `ROUND_TRIP_EXACT` — 1 authoritative writer, 0 lossy | The writer is `JSON.stringify(snapshot, "\t", true, true)` — the fix A0 contributed at `51f2cce8`. A `save_fidelity` verdict is a *computed* condition (`A24`), so it cannot be asserted by prose. |
| `knowledge_gate` | `SEEDED_ONLY_BY_LOOT` | Every spare recipe needs a research station; the `research_kit` that builds one costs 3 spares. The only non-circular seed is `road_supplies` (2/claim, 1800 s) — looted from the cache that is mounted nowhere. The ladder is circular until BLK-1 closes. |
| `authorization` | `NO_UNBACKED_AUTHORIZATION` — 1 claim, 0 rejected | The single `AUTHORIZED_BY_A3` marker matches A3's pinned bytes. Authorization is never taken on an owner's word. |
| `instance_identity` | `HOST_ACTION_UNRESOLVED` — 1 of 2 instance requests | The shipped host's `cache_restock` request dies in A0's own catalog. A3 authorises it; A0's vendored copy is stale. See BLK-2. |

## 7. The five player-facing blockers

Each has one owner, one smallest safe correction, and a test that flips `FAIL`→`PASS`.
A blocker closes only when **its own source condition holds and the native evidence it needs is
`VERIFIED` on the pinned sha**.

| # | Blocker | Owner | Class | Fix state |
|---|---|---|---|---|
| BLK-1 | the Waystation exists in production code behind a project setting the game does not enable | A0 | `MISSING_PRODUCTION_MOUNT` | `SOURCE_PRESENT_BEHIND_GUARD` |
| BLK-2 | the cache cannot resolve its own reward: host sends the `si:` id, A0's vendored table holds the alias | A0 (re-vendor) with A3 | `CROSS_OWNER_IDENTITY_MISMATCH` | `SOURCE_PRESENT_UNRESOLVED` |
| BLK-3 | A8's invented engine static is fixed in source and unproven natively | A8 | `SOURCE_FIXED_NATIVE_PENDING` | `SOURCE_FIXED_PENDING_NATIVE` |
| BLK-4 | no native proof anywhere on this sha; the only paid receipt is a fixture that bypasses the host | A0 | `FIXTURE_ONLY_SUCCESS` | `RUNTIME_UNKNOWN` |
| BLK-5 | the player body is a Knight, the D051 art is not imported, and A6's viewer still labels itself a fixture | A6 with A0 (mount) | `PLAYER_FACING_VISUAL_DEFECT` | `SOURCE_ABSENT` |

## 8. Challenging the gate (round 6)

`sohbalance/adversary.py` runs **15 named spoof probes against the real analysing functions** and
requires every one to be rejected. Verdict: **`NO_KNOWN_SPOOF_SURVIVES`, 15/15.**

| Probe | What it tries to pass off as play |
|---|---|
| `comment_mention` | an id inside a `;` comment in a scene file — **was a real hole, fixed this round** |
| `test_only_reference` | a fixture class that names the node |
| `disabled_guard` | production code behind an off project setting |
| `alias_identity` | `node_waystation_cache` standing in for the world instance |
| `stale_catalog` | an owner's out-of-date copy of another owner's catalog |
| `phantom_sheet` | a `res://` path that exists only in a manifest |
| `injected_clock` | a fixture advancing its own cooldown |
| `claim_without_receipt` | a "verified" label with no committed transaction |
| `wrong_sha_run` / `empty_artifact` / `failed_step` | CI evidence that is green for the wrong reason |
| `mocked_reach` | a UI calling the interaction with a fabricated point |
| `respelled_catalog_key` | a snapshot key respelled so a catalog loads empty — **the bug A7 shipped and caught this round** |

The two player-facing checks added after this table was first written are `Q-08` (every A8 site
anchor sits outside the mounted world; A1's corridor, by contrast, keeps all 103 authored cells
inside it) and `Q-09` (the avatar seam A0/A6 are being asked to accept does not exist: no
production reference to A6's adapter, no male/female chooser, `knight.tscn` still mounted).

## 9. The living matrix

`data/survival/balance/results/matrix.json` and
`docs/survival/balance/B0_ACCEPTANCE_MATRIX.md` are generated from the gate, the oracles, the
adversary run and the blockers — never hand-written. Board state: **`B0_NOT_MET`**, strongest row
`SOURCE_FIXED_PENDING_NATIVE`. **Seven** rows, one per gap, each with the exact SHA, the owner, the
minimum fix, a `verify_command` a reviewer can paste, and the proof level it would reach.

## 10. Native probes (Phase 3)

Three Godot 4.7 probes ship in `tests/survival/balance_native/` and subclass A0's own entry chain:

* `first_hour_route_probe.gd` — menu → Home → paid shelter → walk (ordinary movement input) to
  whichever neighbour cell the **host itself** accepts as the locker stand → one `interact` press →
  one A3 receipt → a second press that must refuse → walk to the cache → press → second receipt.
  It derives the stand cell from `matches_interaction`, so no coordinate is invented; it stops with
  exit 2 while the Waystation mount stays behind an off project setting.
* `bed_death_bag_probe.gd` — looks for a mounted threat, and reports **blocked** when the world
  cannot kill the player (it cannot today: nothing mounted calls `begin_overworld_death`).
* `avatar_body_probe.gd` — the interface A0 and A6 are being asked to accept: choose male/female at
  normal entry, see the D051 body with four facings and grade 0, keep it after a respawn, never fall
  back to the Knight. It fails at the first check because no production screen offers the choice.

**Round 7 built Godot 4.7 from source in the A7 sandbox and executed all nine probes; see §13.
The static audit below is still what the *repository* can verify without an engine.** `sohbalance/probes.py` audits them
instead: each must extend the shipped chain, contain none of the constructs that would fabricate
its own result (teleport, injected node, forced death, granted item, direct inventory write), and
name only symbols that exist in the pinned bytes. Artifact verdict:
`PROBES_STATICALLY_SOUND_NOT_EXECUTED`, evidence class `NATIVE_UNEXECUTED`, guarded by `A33`.
Commands and the exact owner action per rung: `docs/survival/balance/NATIVE_ROUTE_PLAN.md`.

## 11. Assurances

* 34 assertions (`A01`–`A34`), all holding, in `data/survival/balance/results/summary.json`.
* 270 unit tests green (`python3 tools/survival/balance/run_tests.py`).
* 15/15 adversarial probes rejected; 3/3 native probes statically sound and unexecuted.
* Two genuine holes found by the adversary **in this round's own tooling** and closed with tests:
  `P08` (a fixture-only evidence file was being credited toward S4's C4) and `P09` (the Q-07
  overclaim pattern did not recognise a `REWARD_VERIFIED` token, so a fixture could announce a
  reward nobody had committed). Both are pinned by `test_adversary.py`.
* Nothing in this repository claims a native or human result. `A30` asserts that a source fix is
  not a native pass; `A27` asserts S4 stays a five-clause conjunction that fails at this pin.

## 12. Round 7 — D055–D061, and the pin nobody checked

Round 7 asks a different question from rounds 5 and 6. Rounds 5–6 asked *which link is missing* and
*would the gate notice a link that only looked present*. Round 7 asks **does this composition
implement the new player rules at all, and is the artifact this gate reads still describing a branch
anybody is working on.**

### 12.1 The D series is not acceptable, and no row is close

`tools/survival/balance/decisions_matrix.py` judges D055–D061 against a scoped requirement table and
writes `results/decisions.v1.json` plus `results/DECISIONS_MATRIX.md`. Verdict:
**`D_SERIES_NOT_ACCEPTABLE`** — 0 implemented, 1 partial, 6 absent.

| Decision | State | What is actually there | What is not |
|---|---|---|---|
| `D055` 14-day season | `ABSENT` 0/3 | a combat `run_id` and a level `reset_run()` | a persisted run key, `1209600 s`, any season end or start |
| `D056` reset scope | `ABSENT` 0/3 | — | `profile.achievements`, `run_history`, a season reset entry |
| `D057` guide chain | `ABSENT` 0/2 | the word "quest" in two comments | quest state, a run-scoped quest receipt |
| `D058` random starts | `ABSENT` 0/2 | real A1 terrain with `is_free` / `reachable_from` | a start selector, an eligible-cell set |
| `D059` shelter floor | `ABSENT` 0/4 | nothing | satiety, HP, an HP floor, `last_seen_at`, offline settlement |
| `D060` world clock | `PARTIAL` 3/4 | a persisted world clock, a bounded job queue, committed fuel | an absolute anchor, so no offline interval can settle |
| `D061` footprint discovery | `ABSENT` 0/2 | building-placement footprints and a tutorial flag | trail state, decay, detection memory |

Three repairs made this table defensible rather than merely long:

1. **Scope, not vocabulary.** `run_id` exists all over the combat layer and `reset_run()` resets a
   level, so a requirement counts only inside the durable namespace that owns it. Before this the
   matrix read `IMPLEMENTED` on two rows that implement nothing.
2. **A guard can only subtract.** "No monster stores a home coordinate" is a forbidden construct, so
   it is reported clean/violated and never as progress. Counting it as satisfied made `D061` look a
   third implemented for doing nothing.
3. **Eight near-misses, each opened and rejected.** `footprint` in `survival_build_system.gd` is a
   build-placement tile footprint; `clock_seconds` appears only inside the error string
   `invalid_world_clock_seconds`; `pursuit_execution` is a tutorial flag; `MAX_TICK_QUANTUM = 600`
   bounds one tick and cannot settle an 18 h absence. Every row is re-verified against the tree on
   every run, so the ledger cannot rot into fiction.

### 12.2 The pinned bytes are a composition capture, not the live branches

`tools/survival/balance/refresh_live_heads.py` compares all 75 captured files with the same path on
each owner's live ref. Verdict: **`PIN_BRANCH_DIVERGED`** — 10 same, 8 changed, 57 absent at the live
head; all five owners are `DIVERGED`, meaning the pinned head is not an ancestor of the live head.

The pinned heads (`A0 9269739e`, `A1 939720d5`, `A6 08ccb834`, `A8 c8b4bc88`) are reachable only from
the arena composition branches; the owners' own refs have been rewritten since. `A1`'s live branch
carries 3 files under `data/survival/` and none of the seven world-authoring files this gate reads.
So the honest answer to "refresh your stale matrix" is: **the matrix cannot be refreshed onto the
live heads, because the two lines do not share history and the paths no longer exist there.**
Re-pinning requires a new composition. Until then every static number here describes `05e0328d`'s
copy of the owners' work, and `results/live_heads.v1.json` says so on every run.

### 12.3 The probes are now two families, both audited

| Family | Directory | Extends | Contract |
|---|---|---|---|
| `A_JOURNEY` | `tests/survival/balance_native/` | A0's shipped normal-entry journey | 3 probes, the original five bans |
| `D_CONTRACT` | `tests/survival/balance_native_decisions/` | `d_harness.gd` | 6 probes, the same five bans plus three staging bans |

The D probes may not instantiate a scene, define a local class, or load anything outside
`res://game/`; the harness is the single door (`_mount_world()`, exactly one `add_child`, of
`res://game/overworld/chapter1_overworld.tscn`) and is audited itself. `d059` no longer calls
`begin_overworld_death()` to manufacture the death it should observe: its bag clause is marked
`NOT_MEASURED_HERE` and delegated to the real-journey probe. Each D probe also declares the symbols
it *expects to be absent*; 24 are confirmed absent against the pinned bytes, and a symbol that
appears turns the row into a stale expectation rather than a quiet pass.

### 12.4 What is still not proven

Round 7 originally said this was all `CONTRACT_ONLY`. It is not any more: §13 records nine probes
executed on a real Godot 4.7 build at composition `f3556747`. The D rows stay `RED_NOT_IMPLEMENTED`
after execution, which is stronger than a contract reading — the rules do not exist, and the probes
ran to prove it rather than to assume it.

## 13. Round 7 — native execution, on a real engine build

The round-7 instruction was explicit: do not stop at queued GitHub Actions. So the engine was built
here, from `codeload` source, because every prebuilt download is network-blocked in this sandbox.

| | |
|---|---|
| engine | `4.7.stable.custom_build`, built from `godot-4.7-stable` tarball (`sha256 5960084f…`) |
| toolchain | `scons 4.11.1` in a venv, Python 3.11.2, gcc, 2 cores / 3 GB |
| flags | `platform=linuxbsd target=editor production=no debug_symbols=no lto=none use_llvm=no x11=no wayland=no fontconfig=no dbus=no alsa=no pulseaudio=no` |
| composition | `refs/arena/05e0328d-soul-of-hero` @ `f3556747` (detached worktree, imported by the engine) |
| isolation | one OS process per probe, isolated `user://` save per probe, no owner file edited |

Every probe ran through the normal entry of that composition. **0 PASS**, 3 `FAIL`, 6
`RED_NOT_IMPLEMENTED`, 0 `BLOCKED` — recorded in `results/native_runs.v1.json`, and held to its exit
codes by `tests/survival/balance/test_native_ledger.py`.

| Probe | Verdict | Checks | What it measured |
|---|---|---|---|
| `first_hour_route_probe` | **FAIL** | 27 (1 failed) | the route works: profile → Home → overworld → walk → gather wood and reed → `C` opens the starter kit. The 27th check fails. |
| `bed_death_bag_probe` | **FAIL** | 27 (1 failed) | same journey, same single failure |
| `avatar_body_probe` | **FAIL** | 27 (1 failed) | same journey, same single failure |
| `d055_d057_season_probe` | `RED` | 4 | no run key, no `1209600 s`, no achievements/run history, no season entry, no quest namespace |
| `d058_random_spawn_probe` | `RED` | 2 | on the *real* map: 10 237 eligible cells across 10 authored regions, but 0 mounted hazards and 0 mounted survival sources, and no selector to choose among them |
| `d059_offline_hunger_probe` | `RED` | 2 | no satiety/HP document field, no `last_seen_at`, no offline settlement |
| `d060_world_time_probe` | `RED` | 7 | the world clock and bounded queue are real (`MAX_TICK_QUANTUM = 600`), but no elapsed-interval settlement exists |
| `d061_trail_probe` | `RED` | 1 | no trail state in any of 14 enemy scripts and no mounted hostile at all |
| `oracle_corruption_probe` | `RED` | 16 | every corruption it can express is caught (below); the two run-scope corruptions cannot even be expressed |

### 13.1 The one native failure, stated precisely

All three journey probes inherit one shared step from the composition's own
`tests/survival_normal_input_gather_test.gd:288`:

> `GUI reserves the resources gathered by ordinary input` — after clicking the `workbench_kit`
> recipe in the economy panel, a job named `workbench_kit` must exist **and** the wood/iron counts
> must be unchanged (reserved, not spent).

It fails while the two steps before it pass (`ordinary C action exposes the starter kit`). Two causes
fit the evidence and A7 will not guess between them, because doing so would mean editing an owner
test:

1. the injected click never becomes a real button press in a headless display, so no job is created; or
2. the reservation is not atomic with the click — currency moves before the job exists, or the job is
   created with the resources already spent.

**A0 owns the disambiguation** (reproduce with a display, or log `jobs()` immediately after the
click). Until then this is a genuine `FAIL` at `f3556747`, not a `BLOCKED`.

### 13.2 What the corruption oracle proved, natively

Every row has a **passing baseline first**, so a rejection cannot be an accept-nothing validator:

| Case | Baseline (must be accepted) | Corruption | Detected as |
|---|---|---|---|
| `C1` duplicate payment | a real transaction commits, effect `= 1` | replay the same receipt key | effect stays `1`, replay refused |
| `C1'` lost receipt | — | remove the receipt, keep the effect | `UNREACHABLE_BY_API` — classified as a design question, **not** an owner defect |
| `C2` instance identity | a well-formed economy state is accepted | `instance_id` disagrees with its key / id outside `soh_i_` | `instance_id_mismatch` / `invalid_instance_token_id` |
| `C3` clock | a plausible host clock is accepted | past the uint bound / rewound sequence / station ticks past bound / empty session | `invalid_time_number:latest_session_index` / `:sequence` / `invalid_time_station_ticks` / `invalid_time_session` |
| `C4` stored output | a well-formed stack survives | negative / non-numeric / wrong-shaped container | dropped (`0` / `{}`) |
| `C5`/`C6` run scope, monster knowledge | — | — | no representation exists at all |

Two of those repairs were A7's own defects, found only because the engine ran: the C2/C3 fixtures
invented a `clock_by_poi`/`last_tick` shape the validator rejects, so every C2/C3 rejection was
vacuous until the baseline passed; and `MAX_CLOCK_SECONDS` does not exist in `a3_economy_service.gd`,
so the bound was being compared against `0`. Both are fixed and both baselines now pass.

One honest observation, not a verdict: the sanitizer keeps an absurd stored quantity
(`999999999`) unchanged. Whether that is reachable through the chest UI is an A0 question, and A7
will not invent a stack cap to make the number look like a defect.

### 13.3 What is still not proven

* No rendered frame: every run is `DisplayServerHeadless`. Nothing here speaks to visual quality,
  animation or the D051 body — that remains `S5` and needs a human and a display.
* The D-series rows are `RED`, so there is nothing to accept; a probe that starts passing after an
  owner implements a rule must be re-run on a new composition SHA before any claim moves.
* The native ledger is engine-specific: it says nothing about A0's own CI, only about this build at
  this composition.
