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

**A7 has no Godot binary, so none has been executed.** `sohbalance/probes.py` audits them
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
