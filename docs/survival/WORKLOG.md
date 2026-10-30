# Append-only Survival RPG worklog

## 2026-10-29 — Bootstrapping cross-agent continuity

- **Task:** SURV-000 — persistent handoff, source audit locks, acceptance contract.
- **Source baseline:** `c1925d8d17a78da22c64b2c0fc249711eed536ac`, `arena/54306b59-soul-of-hero`.
- **Branch:** `feature/survival-rpg-foundation-20261029`.
- **Owned changes:** new `AGENTS.md`, `docs/survival/`, `tools/survival/validate_handoff.py`, dedicated CI workflow; no gameplay/world/VFX or third-party assets modified.
- **Evidence:** original source inspection through GitHub and previously verified overworld/Gold SHA snapshots; pinned external repo SHAs in SOURCES.md.
- **Tests:** handoff contract validation provided in repo, CI configured to run on pushes; results PENDING until workflow completes on the committed SHA. No native/Web game test has been run for new mechanics because new mechanics have not been implemented yet.
- **Current blockers:** none for starting resource harvesting and construction foundation; verified original Gold ZIP bytes required before native-accurate Core VFX port; specific modular building art/license must be resolved for production, not needed to begin logic.
- **Immediate next task:** SURV-010 — build baseline harvesting-to-inventory-to-placement-to-save/reload slice under one source of truth. Read CONTRACTS.md before code.
- **Commit SHA:** inspect current branch HEAD from GitHub after this atomic commit (cannot self-embed own commit hash without altering hash).

Never erase prior entries. Append the actual SHA and test outcome of subsequent work in a new entry.

## 2026-10-29 — Verified continuity bootstrap and branch head

- **Task:** SURV-000 verified.
- **Commit:** `9816c8c8bfef8a78153a519fcbe8a40066b909c5`; branch HEAD independently checked, diff = 11 new handoff/validation files, 486 insertions and no other paths.
- **Automated test:** [Survival Handoff Contract run 40827332506](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40827332506) — `completed/success` for that exact SHA. This verifies handoff structure ONLY, not new gameplay.
- **Next:** SURV-010 implement harvest → authoritative inventory → 2D paid placement → reload with no duplication; no native/Web survival playtest has been run yet.

## 2026-10-29 — SURV-005: source-grounded 2019–2020 A–Z mechanics and decisive autonomy

- **Key user instruction:** research the whole historical Last Day Rules/Last Island of Survival (2019–2020 preferred), preserve all engaging subsystems, permit agent approval only through explicit gates, **14-day horizon must leave exciting unopened POIs/recipes/skill Core paths and replay drive**.
- **Critical discovery:** original Chinese release 王牌战争：文明重启 official 2019 sources plus Aug 27, 2020 *never-reset Action Base* and 15-day restart session coupling. Original published sources reveal tiered keycards and power circuits, three-tier workbenches, drawing/research station, repairable vs irreparable weapons, drop-and-recover, 2019 actual formula examples and item loot roles.
- **Research artifact:** `docs/survival/LAST_DAY_RULES_2019_2020_RESEARCH_ATLAS.md` covers world, seasons, lore, loot, categories, specific dated recipes, uncertain totals, stations, supply economy, construction, deaths, hazards, sources S01–S27, adaptation matrix and F0–F5 gates.
- **Google Docs tab:** `05 · Last Day Rules 2019–2020 · A–Z` (tabId `t.dg7e10u8in6k`), 29,902 characters published; tab 04 handoff update will follow after code commit/verification.
- **Research-only status:** verified existence and dated sources; **no new gameplay implementation or native/Web playtest**. Original total recipe count not available and NOT asserted. Research task SURV-005 is a research completion claim, not full user-requested game implementation.
- **Decisions:** D021–D031 in DECISIONS.md, reflecting user's delegated gate authority. Next task remains SURV-010; full game scope cannot be collapsed into a tiny prototype.
- **Commit:** inspect branch HEAD after this atomic update; record exact SHA and Docs readback.

## 2026-10-29 — SURV-005 VERIFIED ARCHIVAL SYNCHRONIZATION

- Source atlas initial commit: `68faae048ba0ac8b8a3c40a0d2cc85e42ce1e6a8`.
- Gate/decision & acceptance matrix commit: `ceb625b33f76e87a095fbc5480e25d804fb5166a`.
- Historical addendum with 2019 support mechanics and 2020 planting/economy: `bb86778666012081cdf411b6d791b8798c374281`.
- CI for exact historical atlas HEAD: https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40830754794 — successful handoff validator only.
- Google Doc source https://docs.google.com/document/d/1q8Vevy4qx_6AFyfJodmsWAhdSBBumtx31hxXnWPelqo/edit — tab 03 (~14.5k extracted chars including user's full final instruction), tab 04 (~5.6k chars), tab 05 (~34k extracted chars including dated 2019/2020 source atlas) all **written and read back**.
- **Verified:** research/document preservation, not gameplay. **Blocked original historical exact total recipe count:** no version-pinned exhaustive original dataset. **No gameplay, native VFX or Web survival CI run.**
- **Next implementation task unchanged:** SURV-010, with new mandatory 14-day depth/replay acceptance linked to world/content development.

## 2026-10-29 — SURV-006 full source archival and systemic integration plan
- User source: `Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md` was read end-to-end (1355 lines, 148205 bytes), archived verbatim in `docs/survival/source_archive/`, SHA-256 `b958de0fc413cc200b35b0938760228c2ebd3a8ef4aa2f52c1051c52cca59157`; remote GitHub readback hash MATCHES local uploaded bytes.
- `SOURCE_COVERAGE_TRACE.json`: source anchors for 44 subsystem sections, 21 POI archetypes, 31 named dependencies, 12 player journeys, 40 historical unresolved facts, 28 linked sources; 108 entries assigned A0..A8 owner and gate disposition, NOT_STARTED implementation.
- `SYSTEM_FUSION_BLUEPRINT.md`, `ATLAS_RECONCILIATION_AND_DECISIONS.md`, `MULTI_AGENT_EXECUTION.md`, `ECONOMY_AND_14DAY_REPLAY_BALANCE.md`: fully authored architecture, 25 gap/ruling records, 12 contracts, nine proposed specialist owners and quantitative test gates.
- Validator `tools/survival/validate_atlas_contract.py` + CI workflow updated; GitHub Actions https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40838554299 PASS for commit `d64c299866e3220ff97f43226eed63932d67b596`. NOTE: verifies ONLY docs/source integrity and owner coverage, no engine gameplay.
- Google Doc same existing document: tab 06 (original uploaded research mirror) and tab 07 (four full design/agent docs) created and their contents read back; Git is exact-byte source, Docs extraction may normalize paragraph newlines. Original tabs 1–5 preserved.
- Existing source context re-audited: `SaveService` 4702 lines, `OverworldWorld` 529, `Chapter1Overworld` 782; `transact_once` and TileMapLayer confirmed, 10-landmark guard and existing OverworldState preserved. This is source inspection, not runtime testing.
- **Changed gameplay files:** NONE. **Native/Web survival test:** NOT RUN. **New agents launched:** NONE (agent contracts prepared only). **Next:** A0 should lock CT schema on own integration branch and parallelize A1/A2/A3/A4/A6/A7 branches; first SURV-010 actual harvest→inventory→paid 2D build→save/reload proof, then full integrated scope.

## 2026-10-29 — Continuous discovery rule / A0 prompt clarification
- User confirms that the A0 prompt's "inspect external repositories" must apply to **every relevant phase and specialist agent**, not only initial due diligence. Research is a renewable engineering capability and source catalog is not frozen.
- Locked D044, updated AGENTS.md / MULTI_AGENT_EXECUTION.md / SOURCES.md; created RESEARCH_LOG.md with repeatable search→evaluate→reuse/adapt/build→test→re-search protocol.
- This is a documentation/agent-policy update ONLY. No survival gameplay code changed, no new external source has been validated by this policy change. CI result to be verified after commit; Google Doc tab 04 to be synced.

## 2026-10-29 — SURV-010 A0 foundation slice written (not yet CI-verified)

- **Task:** SURV-010, first real survival loop: harvest → authoritative inventory → paid 2D placement → stash → save/reload.
- **Branch:** committed on `arena/54306b59-soul-of-hero`, branched from integration `52b247a545b8840ed78de38cd21b64cdabfc8989`; offered to the integration branch as a pull request. No second long-lived branch was created.
- **New code:** `game/survival/survival_state.gd` (document shape + sanitizer), `survival_service.gd` (autoload; one `transact_once` per mutation), `survival_build_system.gd` (preview, six-rule cell validator, rebuild + reconcile), `survival_resource_node.gd`, `survival_structure.gd` (chest `can_interact`/`interact`, stash/take verbs). `SaveService` gained `add_items_to_candidate` / `remove_items_from_candidate` so a composite action can pay and create in one commit; `grant_inventory_item` / `consume_inventory_item` are now thin wrappers, so nothing else changed behaviour.
- **New data:** `data/survival/survival_catalog.json` (4 items, 5 resource kinds, 4 build pieces, rules) and `data/survival/hollow_marches_resources.json` — 91 authored nodes generated by `tools/survival/author_resources.py` from the real prop atlas, all of them 4-neighbour to one of their kind's source props, all reachable from the authored spawn.
- **Spawn economy, measured (Chebyshev tiles from spawn):** stone 7, iron 9, wood 15, reed 26. The rule the CI gate now enforces is per *material a piece costs*, not per node kind — iron is legitimately found both in rock veins and in abandoned camp supplies, which is what puts a first handful of scrap inside the opening minute.
- **Bug this work fixed in itself:** GDScript closures capture locals by value, so `result = {...}` inside a `transact_once` mutator wrote to the lambda's own copy and every harvest/build returned `{"ok": false}` to its caller while committing correctly. All result reporting now mutates the captured Dictionary's contents.
- **Two design corrections found by writing the test:** (1) a full `rebuild_from_save` on every `survival_state_changed` tore down colliders on every harvest — replaced by `reconcile_from_save`, with the full rebuild kept for world build and reload; (2) case 09 originally walked a `CharacterBody2D` into the wall, which tests the Knight's movement rather than the structure, so it now ray-casts against the physics space with an open-ground control ray.
- **Art:** `tools/survival/build_art.py` → `assets/survival/build/placeholder_build.png` (4 frames) + `data/survival/placeholder_build.json`. Still placeholders; `BUILD-ART` blocker unchanged.
- **Tests:** `tests/survival_foundation_test.gd` — twelve named cases (harvest, exhaustion and replay, paid build, unaffordable build, illegal cell, duplicate transaction key, container conservation, save/reload, wall collision, no regression to the ten gates/four camps, legacy save without survival, three reload cycles). It boots the production `chapter1_overworld.tscn`, not a fixture. **Status: written and parse-checked locally with gdtoolkit; never executed.** No Godot binary exists in this environment.
- **CI:** new `.github/workflows/survival-runtime-validation.yml` — data contracts (catalog closed under its own references, every node standing beside a matching prop, every costed material within 24 tiles of spawn), engine parse gate over every survival script, autoload/input wiring, then the twelve cases under Xvfb with a `gate_log.sh` fail-closed log gate and an anti-vacuity step that requires all twelve case ids and ≥40 assertions.
- **Explicitly NOT claimed:** no native run, no Web run, no playtest, no balance verdict, no roofed room, no bed/respawn, no crafting. `STATE.json` keeps `code_claims.survival_system_integrated = false` until a green run is recorded with its URL.
- **Docs:** `CONTRACTS.md` gained an implementation-status table (CT-01…CT-08) that names code paths and the exact test cases; the contract text itself was not rewritten.
- **Next:** run the workflow on the published SHA; fix what it reports; only then start SURV-020.

## 2026-10-29 — SURV-010 VERIFIED (native engine, 125 checks)

- **Run:** [Survival A0 (Foundation) Runtime Validation 40845406213](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40845406213) at `d3885226` — `success`, Godot 4.7 under Xvfb, booting the production `chapter1_overworld.tscn`. Result line: `SURVIVAL FOUNDATION PASSED - 125 checks`, engine exit 0, all twelve cases reported.
- **Same SHA, other gates:** Overworld (Hollow Marches) `success`, Hollow Marches browser playtest `success`, survival static contracts (data + parse + wiring) `success`.
- **Pre-existing red, unchanged and not caused by this work:** *Godot 4.7 Runtime Validation → Original main baseline comparison* fails 3/89 smoke checks (sword combo second light input, hot-tuned light damage) identically at `c1925d8d` and now. It is recorded in `STATE.json` under `evidence.pre_existing_red`; this work neither claims nor fixes it.
- **Three real defects the first native run found** — all of them invisible to static checks, which is the point of running the engine:
  1. `Object.call()` rejects an untyped `Array` where `get_value()` expects `Array[String]`, so every inventory read raised a runtime error *inside* the reader and returned null. Harvests committed; the bag read as empty; every build was refused as unaffordable. Fixed by giving SaveService a named accessor (`get_inventory_stacks`, `inventory_totals`, `inventory_total`) instead of threading path arrays through `call()`.
  2. `_with_inventory_stack_metadata()` omits `item_id` when the stack key *is* the item id — the ordinary first-stack shape. Survival's own counter read `record.item_id` and therefore reported zero for exactly the stacks a new player has. Inventory questions are now answered by the inventory authority and survival delegates.
  3. `OverworldWorld` had no `detail_code_at`; build validation's "not on the road" rule called a method that did not exist. The world now keeps a decoded detail layer and exposes the accessor.
- **Two test bugs of my own**, worth recording because both would have produced a confident false result: case 01 read `last_result()` before calling `interact()` (could only fail), and case 11 wrote a legacy fixture with a dotted stack key (`oak_wood.0`), which is not a valid identifier — the file was rejected as corrupt and replaced with defaults, so the case would have "verified" an empty save.
- **What is now true:** harvest writes to the one authoritative inventory; a spent node refuses and its receipt key cannot be replayed; building pays and creates in one commit or not at all; an illegal cell or a repeated transaction key charges nothing; a chest round-trips its contents exactly; walls carry real collision on the terrain layer; a save reloaded three times neither duplicates nor loses anything; a pre-survival save loads as an empty survival document; the ten gates, four camps and traversability are untouched.
- **What is still not true:** no human playthrough, no balance verdict, no browser playtest of *survival* specifically, no roofed room, bed, respawn, crafting, station, Core or hazard. `code_claims.survival_system_integrated` stays **false** in `STATE.json` — SURV-020 onward is where that claim is earned.
- **Next:** SURV-020 (enclosed room, roof fade, bed and respawn) on these contracts.

## 2026-10-29 — SURV-020 assignment checkpoint recorded after user caught missing intake documentation

- **User correction acknowledged:** assigning an agent **MUST** immediately produce durable task intake, scope, owner, gates, dependency boundaries and work-status record, not only chat prompt and end-of-task summary. The full in-progress work order is now in `docs/survival/tasks/SURV-020_WORK_ORDER.md`.
- **Actual Git state:** PR [#10](https://github.com/Khanh-glitch/Soul-of-Hero/pull/10) is MERGED, not OPEN; merge commit `2709b9f6bd0d1cc7a5b242e617184ddab0431470`; SURV-010 125 check native run [40845406213](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40845406213) is still source evidence.
- **User-reported agent state:** SURV-020 agent is already working. Mark task `in_progress` **by user report only**; no SURV-020 branch, commit, engine test, or visual evidence independently verified yet. All integration `code_claims` remain false for the full Survival RPG.
- **No interference:** do not modify the agent's in-flight gameplay code or Arena branch. This is a docs/state intake correction. Subsequent native results must be checked against exact SHA.
- **Cross-chat contract change:** At task dispatch record work order in Git and append Google Docs tab 04, with `assigned / user_reported_in_progress / code_verified` distinguished. At checkpoints record real commits/tests; at completion record acceptance and unresolved cases.
- **Next:** continue SURV-020 room/roof/bed/respawn with A0+A2; sync Google Docs and verify readback in this turn.


- **2026-10-30 ~11:00 ICT · CONTROL TOWER / POST-LAST-ISLAND SOURCE + ASSET DECISION CLOSEOUT · DOCS_ONLY.** Original 2019–20 Atlas/Docs/Decisions read; 44 historical SYS deterministically partitioned 32 adaptive /9 later-gated/3 literal rejected. The 26 current management packages partition 10 P0 executable in owned pipelines /6 P1 gated /6 P2 value-first /4 rejected. Independently scanned all 43 Project-supplied Craftpix ZIPs with SHA and license names; 5,790 filtered candidate image entries, 40 bundled licenses/3 absent, staged 22/18/3. Metadata-only Git reports: `reviews/POST_PIVOT_44_SYS_26_PACKAGE_DECISION_CLOSURE_20261030.md` @9f8b367d and `reviews/SOH_CRAFTPIX43_ASSET_GATE_20261030.md` @1ba3f161. No production files or A0/A1/A3/A4/A6 branches modified; no agent newly dispatched; raw source assets kept out of public Git. Live at check A0 draft PR21 6721f19 (CI active, not accepted); A1 PR20 2951bf85 (source/isolated stand corrected but current generic native/handoff RED). Next: read exact newest A0 run, gate B0 and A1 locker; user may wake A6 same original session with existing V4 for HUD after source access, never duplicate A0. Link to official Craftpix license https://craftpix.net/file-licenses/ and Google Docs tabs04/12. No game acceptance claimed.

## 2026-10-30 — A1 SURV-050A canonical geography connector blocker (source gate, not production native)

- **Wake scope:** one verified canonical geography blocker only on existing A1 branch/PR20; no continent expansion, economy rewrite, production POI migration, A0 controller/SaveService edit, or self-merge.
- **Read:** A0 PR21 handoffs/probe/controller/state/SaveService/build validator; integration CT/CONTRACTS/DECISIONS; legacy overworld bake/traversability/Knight; A1 chunks05_03/06_03 and vertical-slice contracts. A0 native run 40931599594 confirms the blocker: real Hero stops before legacy x369; canonical x384 is out of bounds.
- **Decision:** selected bounded static one-chunk annex (Option A′) over dynamic streaming for the pilot. Exact legacy carve mouth `x368..383,y199..201` = 46 solid cells / 48 dressed cells; native return trace proved `(368,201)` corner catches the 12×16 body, so the full three-row mouth is cleared; 14 flat cliff decals suppressed. Unchanged chunk6:3 composed at canonical `(384,192)` into `448×256`; unsupported new columns fail closed. Identity coordinate transform; camera right limit derives to 7168; no teleport, duplicate POI, reward change or 192-chunk import.
- **A1 artifacts:** `data/survival/world/connector/{canonical_connector.v1.json,legacy_cell_delta.v1.json}`, `compile_connector.py`, `validate_connector.py`, 8 connector pytest cases, isolated root-project Godot fixture `connector_native_test.gd`, CI job `godot-connector-native`, handoff `CANONICAL_GEOGRAPHY_CONNECTOR_HANDOFF.md`.
- **Local evidence:** connector validation 0 errors; pytest 82 passed; world/slice validators pass; determinism 232 artifacts tree `39b9f2535519f0080cf5809d073eb159f33ccdc3126603906fee6456192225c2`. CI native fixture at `90c1d8bf` PASS: push 40993737087 / PR 40993742640 (isolated composed world, real Knight, ordinary input round trip). Production `native_playable=false`.
- **A0/CT next:** A0 owns world-source injection seam, annex build guard, slice obstacle mount and production fresh-save/reload acceptance CN-07..10. CT must accept/reject the exact local ridge tradeoff. A1 returns `PAUSED_AWAITING_NATIVE_INTEGRATION`; PR20 remains open/unmerged.

- **Connector native closure:** final mouth `x368..383,y199..201` clears 46 solid cells / dresses 48 / suppresses 14 decals after native return trace proved the `(368,201)` corner catches the 12×16 body. Docs tab04 marker `A1_SURV050A_CANONICAL_CONNECTOR_90c1d8bf` read back at 118638–118678. A1 returns `PAUSED_AWAITING_NATIVE_INTEGRATION`; A0 PR21 owns production seam/build/save acceptance.

- **2026-10-30 A1 locker-stand owner correction:** A0 run 40996028162 proved exact stand `(408,199)` intersects original full-tile locker bank by 12×1 px. A1 authored `a1_locker_stand_toe_clearance_v1`: locker-bank collision 16×14 offset (0,-1), visual 16×16, stand/anchor/node/cells/rewards/46/48/14 ridge unchanged. `validate_slice` now live-shape arithmetic gates all stands; native fixture adds adverse original query + repaired exact stand + interaction range + round trip. Local pytest 84 passed; determinism 232 artifacts tree `39b9f2535519f0080cf5809d073eb159f33ccdc3126603906fee6456192225c2`. CI PASS at `bc71b536`: push 40999023888 / PR 40999029445. Docs marker `A1_LOCKER_STAND_CORRECTION_bc71b536` read back 133869–133904. A1 returns `PAUSED_AWAITING_A0_NATIVE`; no merge.

- **2026-10-30 A1 first-hour corridor / source-instance / A8 transform checkpoint:** Reviewed non-force merge `e16285ff` integrated base `86831332` and resolved the sole PR20 conflict in `WORKLOG.md` additively; GitHub PR20 became MERGEABLE. Authored `corridor:crown_roadside_first_hour_v1`: 2 source classes, 4 physical instances (3 non-POI roadside crates + canonical Waystation cache), 0 new POIs, 77 required nav cells, 36 detail cells, 8 inherited original SOH props. A3 `poi:roadside_cache` category referenced; A1 authored no rates/yields/timers for roadside instances. A8 Quarry/Orchard/Mill exact 1:1 socket-to-anchor transforms computed; all three rejected for direct overworld mount due 960x600 footprint mismatch. Streaming rewrite deferred after GDQuest MIT sector-pattern reference. Local: corridor validator 0 errors, pytest 101 passed, world/slice/connector validators pass, determinism 236 artifacts tree `54cc776b9ca22ec6b98987231b5e400610ccb325fe1caa8a0251d4262566715b`, handoff validator pass after A1 task-status enum correction. Native corridor CI pending at this entry; production `native_playable=false`, A0/A3 binding pending. No self-merge.

## 2026-10-30 — A1 world-level visual production (PR #20)

- Accepted corridor geometry/identities left intact; added visual-only art system instead of rebuilding.
- Baked original SOH survival atlas (238 terrain / 38 prop frames) + 9 inherited unscaled original frames; shared grammar, biome profiles, lighting profiles.
- Compiled Crown first-hour treatment pinned to corridor `9d3909b0…`, Amberwood apothecary/herb and Frost Crown shrine/skarn studies; no new POIs, no collision/stand/reward/save change.
- Added `game/world_art/world_art_presentation.gd` (TileMapLayer + unscaled sprites + warm lights + OverworldOcclusion reuse, zero collision bodies) and native 720p/1440p/2160p capture fixture + CI anti-vacuity job.
- Added executable A8 visual contract with PR #26 divergences (non-integer scales, 48 px grid, per-site palettes, 600 px height, Cainos license/scale).
- Local gates: 109 pytest passed; world/slice/connector/corridor/art validators 0 errors; handoff PASS (13 tasks); Atlas contract PASS; determinism 245 artifacts tree `d50f4f90…`; gdparse clean. Pillow/atlas previews inspected.
- Native: specified World Reader runs 41020340273 / 41020347365 still queued; world-art native captures NOT_TESTED pending CI. Production native_playable=false; A0 alone mounts. Drive 43-pack unavailable; no fabricated import.

## 2026-10-30 — A1 world-art follow-up: causal terrain, runtime hardening, A8 shells, Drive byte verification

- Replaced noise-decided biome patches with authored causal landforms (caldera ash fan, moor drainage, ruin shoulder, moraine terrace, apothecary garden, moonleaf margin, cirque snowfield, wind-scoured arête, skarn exposure). Roads are transparent overlays on opaque ground; ground marks calmed to low-contrast material clusters.
- Hardened `WorldArtPresentation`: atomic load validation, idempotent rebuild/clear, focus rebinding, per-frame occlusion stepping, `frame_name` meta, real collision/area/TileSet physics counts, private world-light cull mask so inherited Gold/Hero VFX keep default lighting/tint.
- Native fixture v2 proves zero collision before/after foot-sort reparent, invalid-load rejection, rebuild idempotence, occlusion fade, inherited VFX mask/tint isolation, true 720p/1440p/2160p captures, and matching integer-downscaled logical pixel hashes. Corridor fixture gains `--world-art` to drive real corridor collision with the overlay and capture driven-position art frames.
- Added A8 compact-shell visual skins (`a8_shell_visuals.v1.json`) for Quarry/Orchard/Mill at 128×128, 16 px grid, shared atlas, clear doorway; A8 keeps collision/entry, A0 alone mounts. Contract refreshed to PR26 `5ccf7b3f`, divergence A8-VIS-07.
- Google Drive enabled; 43-pack folder metadata verified. Candidate 574220 downloaded privately and byte/license verified (SHA-256 `302e8fa1…`, CraftPix Freebie terms); actual PNGs inspected and **rejected for style mismatch**. No CraftPix bytes committed; raw ZIP excluded.
- Local gates: 113 pytest passed; world/slice/connector/corridor/art validators 0 errors; handoff/Atlas PASS; determinism 246 artifacts tree `a833e5f9…`; gdparse clean. Current-head World Reader runs 41026150160/41026143600 at `2f6edd3f` had Python SUCCESS, native queued; native remains NOT_TESTED. Production native_playable=false; no self-merge.

## 2026-10-30 — A1 sustained world visual + real-navigation bundle (native hard-blocked, owner work exhausted)

- Demonstrated native hard dependency: no linux-x64 Godot on any allowed host (npm @ringozz/godot ships only wasm32/macos/windows; GitHub release assets redirect to blocked host); sandbox has no GL/EGL/X11/mesa/Xvfb and apt is permission-denied + blocked; CI World Reader 41032153753/41032145662 queued on external Actions backlog. Did NOT stop at QUEUED: completed all owner-independent PHASE 2–4 work.
- Player-readable art: research-notes crate `cache_notes` (pale paper + leather strap + wax seal, no iron latch / no glow) on `si:r_ashen_crown:roadside_supply:01`, distinct from iron-latched scrap caches; Waystation silhouette uplift (chimney+smoke, ridge pennant, warm service window, side crate stack) so it reads as a hearth/hub not a box; cardinal shore feather blends soften macro landform boundaries.
- Renderer correctness: `bind_focus()` now lifts the focus out of `props_root` before `OverworldOcclusion.configure_sprites` deep-scan, so the Hero's own weapon/body sprites are never registered as occluders (no self-fade).
- PHASE 3: `avfx_lighting_contract.v1.json` (world light mask 2 / inherited VFX mask 1, ground luminance caps, reserved accents) + measured CPU contrast study over REAL effect textures vs REAL ground at day/night (worst 2.13:1 ≥ 1.6 floor). Explicitly NOT full Gold parity / NOT A6 body.
- PHASE 4: `compile_first_hour_route.py` objective BFS proof (contiguous, all-walkable, 2px body margin, no one-tile trap, ten thresholds preserved) + home-first/explore-first/return camera-landmark states; `compile_mount_bundle.py` + `validate_mount_bundle.py` consumable A0/A8 gate (exact paths/SHA/placement/light/zero-collision/baseline/commands); `compile_a8_shell_visuals.py` derives atlas pin so shells never go stale.
- Gates: 119 pytest; world/slice/connector/corridor/art/mount-bundle validators 0 errors; handoff/Atlas PASS; determinism 249 artifacts tree `26ace820…`; gdparse + YAML clean. Pillow previews inspected (notes vs cache, Waystation, contrast study). Native/Gold/A6/A0-mount remain PENDING; PR20 open/unmerged.

## 2026-10-30 — A1 full-world region visual system (pause reversal executed)

- Reopened per CT `CT_A1_AD39BDE6_FULL_DISCUSSION_REAUDIT_PAUSE_REVERSAL_20261030.md`; preserved ad39bde6 first-hour pixel payload (ground/overlays/props/lights/views byte-identical) while migrating atlas/grammar pins.
- Extended grammar to all 11 planned region profiles; baked 1415 terrain / 111 prop frames. Authored 8 loadable region windows with canonical POI/resource IDs, day/night views, causal landforms, legend-aware water/bridge semantics, orientation-aware boardwalk/causeway overlays, clustered vegetation and hazard clues.
- Visual revisions from inspected 1x/5x panels: fixed wide boardwalk carpets, clipped camera edges, corduroy volcanic ground, over-bright salt (Gold contrast floor), and empty windows; added groves and calm material variants.
- Added `compile_region_coverage.py` source-to-scene matrix + window BFS approach/retreat audit; `preview_region_review.py` 1x/5x proxy-footprint panels; expanded AVFX contrast study to 11 ground materials (worst 1.739:1, not Gold parity); mount bundle memory estimate.
- Drive 668008/692491 byte+license verified and style-rejected; original art used. Gates: 121 tests, validators 0 errors, determinism 258 tree 776cfe4d. Native still pending; GitHub git transport TLS-failing at checkpoint, push retried.
