# A0 PR21: recovery, guarded A1 visuals, physical source and save diagnostics — 2026-10-30

**B0/SURV-020 HOLD.** This is not a complete home-first/explore-first playthrough, release, human test, Gold sign-off, final avatar or E2 invitation. Supersedes earlier same-day notes that Git and owner notification were unavailable.

## Player actions / limits
On a headless source-built Godot 4.7 production controller with the explicit guarded Waystation candidate, the actual Hero received synthetic normal movement and pointer inputs from Refuge to the original locker, cache, ledger, deadfall and Relay, then walked back to Refuge. The locker granted `cap_salvage` and zero items; ledger granted `cap_seal_1` and zero items; deadfall granted two oak. The cache did **not** grant its authorized 3 iron scrap + 2 spares or commit the canonical receipt, so the Relay could not pay its authorized 2 scrap + 1 oak and could not power. Six failures / 33 checks. This is an isolated controller journey, not title/Home, paid-home stash, a human walk, two choices, combat or product acceptance.

A separate OS process reopened that profile; strict world_slice, survival and transaction dictionaries matched; strict inventory failed with 13 number-type differences and zero value differences. The cache was not previously claimed, so the second click's no-grant is **not** proof of a successful cooldown replay. The Hero again walked to the cache and back. First/restart logs use the same XDG profile. `A0_SAVE_DIFF` records every inventory mismatch for this case.

## A1 visual integration (guarded, not accepted)
Copied byte-identical `ad39bde6780c92169032246898c145c568f36e6e` first-hour renderer, shader, atlas, route, bundle, treatment and terrain/props images; atlas declares original SOH art and its nine inherited frames original project art. `game/survival/a0_world_art_candidate.gd` checks every byte SHA, requires the existing bounded Waystation candidate, a live world at identity transform, and rejects duplicate mounts. `survival/a0_world_art_candidate` defaults false. On the actual controller, 18/18 headless checks: no physics bodies/areas or TileSet physics, same Hero parent, Hero light mask 1 vs A1 lamps mask 2, ten gates, original Waystation host, and no save mutation. Run `tests/survival_a1_world_art_candidate_test.gd`. The initial 14-check run compared against the snapshot *before* baseline scene teardown and failed; teardown can persist position. It was corrected to compare against the post-teardown generation; actual mutation is still strictly asserted and has zero VALUE/TYPE diffs. This corrects the test boundary, not a production save fix.

**Do not enable by default.** A1 bundle requests reparenting Hero into `props_root`; actual Hero uses `get_parent()` for combat/VFX. A0 preserves the existing lifecycle, but cross-parent foot sorting and fade are therefore unverified. The treatment still uses A1's initial daylight; there is no approved clock→day phase mapping/cycle length in the bundle, so A0 did not invent one. Need A1/A0 native-rendered composition, clock contract, 720p/2K/4K visual review and A4 Gold parity; export/Web resource behavior and perf are untested. [A1 owner handoff](https://github.com/Khanh-glitch/Soul-of-Hero/pull/20#issuecomment-6520955693). No A1 authoritative source was edited.

## Identity and owner blockers
Physical cache request contains A1 instance `si:r_ashen_crown:waystation_cache:01`; pinned A3 V3 bindings identify the actual cache as `node_waystation_cache`. An additional read-only native planning probe feeds the exact host request to the pinned owner `_world_plan` and obtains `unknown_source_instance`; the owner-bound node ID resolves the canonical claim key. This demonstrates the source-level preflight mismatch, not a claim or invented alias. No unsupported alias, free loot, moved POI, changed rates or A3 patch. [A3 physical reproduction](https://github.com/Khanh-glitch/Soul-of-Hero/pull/19#issuecomment-6521031714). Exact A3 V5 `70ebbcff655e24380f0b00c8995f2aa30e97ba59` still fails native adapter test parse at 857/887 and restart compilation at line 51; integral parsed JSON stand rejects, and raw V3 empty state lacks V5 `roadside_notes_01_claim_count`. Full migration/replay remains untested. [A3 earlier source handoff](https://github.com/Khanh-glitch/Soul-of-Hero/pull/19#issuecomment-6520831307). A0 keeps V3; V5 is not production-ready. Its proposed 02/03 no-Core crates are not mounted. A6 selected bodies remain private/unmounted; optional A5 threat remains disabled because the previous failed-write score-farming issue is not closed.

## Exact persistence findings
`survival_waystation_authority_test.gd` on the real V3 facade, fixture host and test clock: **FAIL 2 / 48**, original two strict assertions retained. `report_all` emits every differing path, type and value. Commit memory→raw disk: 0 VALUE / 69 TYPE; memory→reload 0/16; raw disk→reload 0/53; fault-pre-memory→disk 0/146; pre/post-fault raw disk 0/0; fault memory→reload 0/68; fault disk→reload 0/78. In a first commit revision `2` remained `2`; world clock zeros, `cap_salvage`, cache claim `1`, next-ready `1800`, canonical `a1slice:poi_crown_waystation:cache_restock:1` and receipt `rr_waystation_cache_claim`, three scrap and two spares survived. Memory int fields parse as floats on raw disk; SaveService restores revision and stack quantities as ints but world clock/claim fields can remain floats. Full logs enumerate exact paths and types, including skill ranks, receipt timestamps and V3 economy. No value loss or duplication was observed in this fixture; that does not prove no unobserved loss.

The same test boots the real production overworld from the reloaded fault fixture. Revision `38`, clock 3600, cache claim `3`, next-ready `5400`, capabilities, receipt IDs and transaction keys were retained; inventory, world_slice and applied_transactions show 0 VALUE / 0 TYPE rebuild differences. This is reconstruction of fixture state, not a player run.

`a0_waystation_schema_oracle.gd` is deliberately **partial test-only diagnostic**, not a safe full-document equivalence oracle or replacement for the failing strict assertions. It checks A3 V3 world validation, revision/stack prepared integer typing, raw JSON integer properties, finite/exact-range numbers, receipt shapes and full-document value diffs. Negative tests reject changed quantity, changed canonical claim ID, float prepared quantity, >2^53 integer, missing field, capability-array reorder and nonfinite number. It does not establish schema validity or type tolerance for all other consumers (including future adapters/host receipts). `SaveDiff.collect` retains array order and missing-key detection. No decoder was changed, and both original failures remain unresolved.

Earlier Godot SIGKILL after temporary-write and after primary-rename each recovered in a new process (10/10 each), but SIGKILL is **not** a power outage or fsync/durable storage proof. The artificial debug false-return post-rename stale overwrite remains unresolved and not established production-reachable.

## Native commands and evidence
Godot: `/home/user/.cache/godot-4.7-src/bin/godot.linuxbsd.editor.x86_64`, `4.7.stable.custom_build` headless without graphical drivers. After `--headless --path . --import`, with separate `XDG_DATA_HOME` directories:

```sh
G=/home/user/.cache/godot-4.7-src/bin/godot.linuxbsd.editor.x86_64
XDG_DATA_HOME=/home/user/a0-turn-v2/xdg_art_final "$G" --headless --path . --script res://tests/survival_a1_world_art_candidate_test.gd
XDG_DATA_HOME=/home/user/a0-turn-v2/xdg_authority_full "$G" --headless --path . --script res://tests/survival_waystation_authority_test.gd -- --survival-save-fault-test
XDG_DATA_HOME=/home/user/a0-turn-v2/xdg_physical "$G" --headless --path . --script res://tests/survival_production_waystation_candidate_test.gd
XDG_DATA_HOME=/home/user/a0-turn-v2/xdg_physical "$G" --headless --path . --script res://tests/survival_production_waystation_candidate_test.gd -- --restart
```

These are synthetic input and fixture diagnostics, not rendered human acceptance. Isolated headless regression: SaveDiff 6, foundation 144, A3 authority 124, station 32 and Hero exit 32 passed. Native logs, including full differences and the initial failed art-test boundary, are archived externally in the session evidence bundle. GitHub checks were queued at last query, not passes.

## Recovery and next action
Four binary-safe patches from `7f3ca17e..51225718` were internally SHA-256 verified and archived; normal push succeeded and PR21 reached `51225718f3d9b15e508da633060270a4221e6a09` before this checkpoint. Recovery archive `/home/user/A0_PR21_recovery_51225718.tar.gz`, SHA-256 `f42956f3436497ff24d6e80e503b413f88365b379befa3bdc41a9ccd221f1ebc`; no private art or credentials. PR remains draft/HOLD, not merged.

**NEXT_ATOMIC_ACTION:** Obtain A3 exact-source native fix and explicit physical source identity/migration; re-run real Home→cache→stash→independent OS reload with original assertions. In parallel resolve the A1 no-reparent visual/clock contract and rendered 720p/2K/4K/Gold checks; retain default-off flags and A0 independent safety tests. Then address before-effect threat receipt/replay and fair death→same bag→bed→physical return; two voluntary paths, A6 bodies and full product review remain mandatory.

### Same-generation full rebuild follow-up
The earlier rebuild reported individual critical sections. A further read-only audit now captures **the same revision-38 generation** in memory and raw disk, calls `reload_save`, then builds the real production overworld and compares the **entire snapshot**. Result: memory→disk 0 VALUE / 78 TYPE; memory→reloaded 0/0; disk→reloaded 0/78; reloaded→after-build whole snapshot 0/0 (and inventory/world/receipts each 0/0). The original strict failing assertions remain unchanged: current authority fixture **FAIL 2/49**; all added checks pass. Full per-field output is in `authority-complete2.log`; the parse error from the preceding test edit is retained separately, not reported as a successful run. This is still fixture-funded, not evidence of a continuous player route.

## 2026-10-30 — A3 V5 adopted: the physical Waystation and roadside route now runs, end to end, in two processes

**What a new player can actually do (guarded candidate, synthetic input, headless).** In the composed production controller with `survival/a0_waystation_candidate` enabled, ordinary movement and pointer input walk the real Hero from the Refuge to the locker (capability, zero items), to the physical cache (3 iron scrap + 2 knowledge spares, canonical receipt `a1slice:poi_crown_waystation:cache_restock:1`), to the ledger (seal capability, zero items), to the deadfall (2 oak), to the Relay (consumes 2 scrap + 1 oak, grants `cap_power_1`, `bus_powered`), and back. After the process exits, a **second, independent Godot process** reads the same profile: all four sections compare **0 VALUE / 0 TYPE**. The same holds for the three A1 roadside crates at their authored stands: notes 01 → 1 research note (1800 active s), supply 02 → 3 scrap + 2 spares (one-time), timber 03 → 2 oak + 1 note (one-time), each with its canonical receipt and no second grant.

**What this is not.** The candidate is still default-OFF, the input is injected rather than human, no frame was rendered (this sandbox has no display/GL), and the normal **Home → Campaign → Overworld** menu chain stops at a GUI-dependent starter-kit assertion that also fails at the base commit in headless. Death/same-bag recovery, A6 avatars, Gold and difficulty balance remain untouched. B0 stays HOLD.

### Owner composition (Phase 1)
- Ten A3 files are byte-identical to `4bfba38d`: service `acbe03b0…`, world adapter `8bab2441…`, items `cc3c1165…`, sources `bc88143e…`, bindings `7b9670f4…`, recipes `4dbf48da…`, research `6cca178a…`, stations `aa054872…`, both schemas. The A0 shim (`a0_economy_adapter.gd` `2261047e…`) is re-pinned in SaveService and in all three workflows.
- `a0_v5_source_pins.gd` verifies those hashes at composition time; `EconomySession.configure` refuses to start on any mismatch.
- The A0 host now attests the authored identity for the mounted physical node only (`si:r_ashen_crown:waystation_cache:01` + `node_waystation_cache` + `sc_waystation_timed_cache_v1` + region), so A3's `host_identity_error` fails closed on a forged or foreign identity. No alias was invented: V5 declares both ids for one source.
- The three roadside crates are mounted at A1's unchanged cells/stands (`395,219`/`395,220`, `400,216`/`400,217`, `402,220`/`402,221`) with the exact A1 atlas frames and treatment pins, no added collision, and only while the guarded host is mounted.

### Save migration (A0-owned, fail-closed)
`a0_world_slice_v5_migration.gd` adds the six new V5 claim/cooldown fields as `0` only after validating the entire legacy world slice, its counters/cooldowns, capabilities, receipts, `last_transaction_key`, and every `soh.a3.world_action.*` receipt against the legacy binding **and its signed payload** (both the real V3 shape and the V5 preflight shape are accepted). Foreign claims, duplicated or missing receipts, wrong right ids, stale counters, partial V5 namespaces, non-integer/out-of-range numbers, and a failed backup or commit all quarantine the profile without writing.

### Decoder fix (Phase 4, the old 2/49 failures)
Godot JSON reparses every number as a float. SaveService now restores the declared integer slots of `world_slice`, `survival_economy` (including escrow copies of instance records, which otherwise broke the ownership audit), the ledger's `applied_at_unix`/`quantity`, and the inventory/progression sections, and **fails closed** on fractional or >2^53 values. With that, the two long-standing strict assertions pass unchanged and were tightened to compare the **entire committed document** after reload.

### Exact native results at `291511195dc6c7c5b501b28687f9f164a3457607`
Commands use the local source-built `4.7.stable.custom_build`; each profile is an isolated `XDG_DATA_HOME` under `/home/user/a0-v5-native/`.

| Test | Result |
| --- | --- |
| `survival_waystation_authority_test.gd -- --survival-save-fault-test` | **PASSED 50** (was FAIL 2/49) |
| `survival_a3_v5_migration_test.gd -- --survival-save-fault-test` | **PASSED 54** |
| `survival_a3_v5_roadside_authority_test.gd` | **PASSED 11** |
| `survival_waystation_identity_probe.gd` | **PASSED 9** |
| `survival_production_waystation_candidate_test.gd` / `-- --restart` | **PASSED 33** / **PASSED 19**, 0 VALUE / 0 TYPE |
| `survival_roadside_v5_input_test.gd` / `-- --restart` | **PASSED 30** / **PASSED 29**, 0 VALUE / 0 TYPE |
| real V3 producer (`fa0c119c` tree) then `survival_a3_v5_real_legacy_restart_test.gd` | **PASSED** / **PASSED 17** |
| `survival_a1_world_art_candidate_test.gd` | **PASSED 18** |
| `survival_foundation_test`, `survival_station_placement_test`, `survival_full_capacity_test`, `survival_hero_exit_test` | PASSED 144 / 32 / 34 / 32 |
| `survival_save_interruption_test`, `survival_save_precision_test`, `survival_save_diff_test` | PASSED 154 / 14 / 6 |
| `survival_a3_authority_test.gd` | **PASSED 124** (after the escrow-type fix) |
| `survival_economy_session_test` (38/115), `survival_save_ambiguous_write_test` (9) | **FAIL — identical counts at base `fa0c119c`**, GUI/frame dependent; not a regression |
| `survival_normal_entry_roadside_v5_test` | FAIL 1: GUI starter-kit reservation; the same check fails headless at base, so the Home→menu chain is unproven locally |

### Still missing (owner or environment)
1. **A3 tool plan.** `A0_TOOL_HOST_CONTRACT_V5.json` specifies a read-only `soh.economy.tool_use.v1` plan, but no implementation exists in `4bfba38d`; asked in PR19 comment `6522130262`. A0 will not invent a multiplier or price.
2. **Normal-entry chain** needs a rendered run (hosted Xvfb) — local sandbox has no display/GL.
3. **A6 avatars / Gold / human pacing**, death→same-bag recovery, and the voluntary home-first route remain B0 HOLD.
