# SOH — Multi-Agent Engineering Program and Reuse Decision Matrix
Version 1.0, 2026-10-29. **Ready to assign, NOT yet staffed/running.** No background agents are claimed. Every agent's instructions are reproducible from this repo, so changes in conversation do not erase task context.

## 0. Strategy for speed without patchwork
The fastest route is **parallel work behind common interfaces**, not simultaneously merging seven complete game projects. Declare stable data contracts and acceptance fixtures first; maintain one canonical SaveService and one static/dynamic world identity model; tasks have distinct write paths; integrator reviews and merges only when the same seeded tests pass. Agents can autonomously approve low-level design choices using F0–F5, but cannot silently change user-locked commitments. Each agent must document what was imported, licensed, authored from scratch and tested.

Execution flow:
- WAVE A (contract lock, no major gameplay patch): owner confirms existing SaveService transaction API, world/TileMap authoritative boundaries, schema, representative item IDs, Gold native status and first game loop fixture. This is one architectural integration gate, not sequential user micro-approval.
- WAVE B (parallel on OWN branches): world masterplan; construction renderer/state; economy/recipe/loot; Skill Core/Gold adapter; UX/asset inventory; balance/content matrix. All consume the same CT-* contracts, issue small PRs with headless tests.
- WAVE C (integrated native loop): combine world→gather→inventory→build→craft→research→Core→POI→death/reload→dungeon; test realistic HUD/render and Web.
- WAVE D (scale): expand from vertical integration proof to full continent/balance/POI content/expeditions, iterate based on telemetry rather than deleting architecture.
A vertical slice is a proving tool, NOT the scope of final game.

## 1. Agent roster, owned paths, handoff artifacts

| Role | Proposed owned write scope | Read-only dependencies | Precise output / must pass |
| --- | --- | --- | --- |
| A0 Integration Architect & CI | `docs/survival/STATE.json`, `CONTRACTS.md`, branch integration, SaveService migration adapters, CI workflows | all systems; owns merge gate | CT-* interface revision, serialization/event pipeline, cross-agent type fixture, no dupes, native+Web smoke |
| A1 World Cartography & Ecology | `data/survival/world/**`, `tools/survival/worldgen/**`, region/POI manifest and semantic material grammar | existing author.py + Chapter 1 preserved | Full continent plan upfront, 10 existing dungeons in opening quarter, authored rivers/roads/biomes/resources, travel/POI graph test, actual native screenshots, not random speckle |
| A2 Construction & Roof/Collision | `game/survival/construction/**`, `data/survival/buildings/**`, construction-focused tests | CT-02/03, A1 region occupancy/TileMapLayer | foundation→wall→door→roof→chest→bed paid placement, room-aware fades, local nav update, reload+no dupes, collision perf |
| A3 Economy, Salvage, Research, Farming | `game/survival/economy/**`, `data/survival/items/**`, `data/survival/recipes/**`, resource/production tests | CT-03/05, existing LootCatalog/SaveService | Typed recipe graph, source trace, reverse research, tiered stations, finite resources, storage transfers, atomic queues, harvest-to-craft |
| A4 Skill Core + Gold VFX Port | `game/survival/skill_cores/**`, `data/survival/core_catalog/**`, separate native VFX port branch under Gold owner | existing hero/combat, Gold original archive, A3 ItemInstance | Cast/use idempotency, original full FX on target/terrain, source parity; never mark 93 entries native without actual port |
| A5 POI Encounters/Hazards/AI | `game/survival/encounters/**`, `data/survival/poi/**`, access graph tests | A1 POI anchors, A2 collision, A3 keys and protection | Green→blue→purple graded story access, power switches, danger, guard/boss/revisit loop, no softlocks, dynamic building AI |
| A6 UX / Pixel Art & HUD | `game/survival/ui/**`, `assets/survival/**` only with cleared license, HUD tests | CT schemas, top-down camera, gold requirements | Build ghost, loot/research inspect, known/unknown map, crafting sources, per-room clarity, 2K/4K sharp render; no generic redraw of Gold |
| A7 Systems Balance, Content and QA | `data/survival/balance/**`, `tests/survival/**`, telemetry & simulators | all source trace/journeys and agent work | Economy/conservation, non-grind 14-day replay scenarios, 31 dep tests/12 journeys, frame-time/softlock/memory reports |
| A8 Licensing & Source Diligence (part-time) | `docs/survival/licenses/**`, source pins/attributions | existing asset catalog + candidate repositories | SHA, file-level license scope, dependencies/export compatibility and an approved import/adapter ledger |

**Critical file policy:** Only A0 changes `game/autoload/save_service.gd`, `game/overworld/chapter1_overworld.gd`, `project.godot`, `AGENTS.md`, `STATE.json`, master acceptance and existing core APIs on the shared integration branch. All others work via explicit adapter interfaces and own task branches. A4 should coordinate with VFX branch owner; original Gold branches remain untouched until authorized integration.

## 2. Branch and merge mechanism
- Base for new implementation branches: current verified `feature/survival-rpg-foundation-20261029` HEAD, never hardcoded old SHA.
- Branches: `feature/surv-world-<id>`, `feature/surv-build-<id>`, `feature/surv-economy-<id>`, `feature/surv-core-<id>`, `feature/surv-poi-<id>`, `feature/surv-ui-<id>`, `feature/surv-balance-<id>`.
- Each PR declares CT-* it consumes/produces, list of modified paths, schema changes, source license/provenance, evidence case IDs, tests, native capture links, failure cases, next owner. Compare diff for conflicts BEFORE merge.
- Gate orders: data models+save first; world anchors and placement rendering can progress independently; economy recipes and UI catalog independently; POI/hazard and Gold adapters independently behind fixture APIs; integration gate merges on tested live gameplay.
- Never let two agents push directly to same working branch concurrently; never force push other agent work. Never add third-party art/license-unclear files into main asset tree by convenience.
- Update Git `WORKLOG.md` + `STATE.json` and Google Doc LIVE tab per real commit or `DOCS_SYNC_PENDING`. Docs do not auto-sync.

## 3. Repo due diligence — concrete copy / adapt / write decisions

| Candidate | Code/license evidence | Actual reusable seam | Verdict and why |
| --- | --- | --- | --- |
| [SOH native](https://github.com/Khanh-glitch/Soul-of-Hero) | Owned game, Godot 4.7 | SaveService v4 `transact_once`, existing inventory/loot, OverworldWorld TileMapLayer, Hero skills, Gold work | **REUSE DIRECT, never fork onto other game** |
| [The FOG](https://github.com/furmonenko/the-fog) | MIT code per its root LICENSE; imagery separately restricted; Godot 4.7; target project size ~78MB | `crafting_building.gd`, `laboratory.gd`, `loot_container.gd`, `inventory_grid.gd`, `build_spot.gd` | **PORT SELECTED ALGORITHMS ONLY**. BuildSpot is predefined-position, NOT freeform building. File-level dependency audit before reuse |
| [Survival Core Lite](https://github.com/openclawaimac/godot-survival-core-lite) | MIT code/CC0 demo claims, typed Godot 4.7, 48 advertised strict tests (not rerun); package ~1.7MB | gatherables, day-night, hunger/thirst, RecipeBook, atomic slot operations | **REUSE GATHER/RECIPE LOGIC via adapters**; avoid its separate inventory single source of truth. No freeform building/full base in Lite |
| [Coheronia](https://github.com/ppeck1/coheronia) | MIT engineering / assets reserved; Godot; ~204MB | block registry/build preview/placement validation | **ADAPT LOGIC/SCHEMA ONLY**, side-view renderer not drop-in for SOH top-down |
| [GLoot](https://github.com/peter-kish/gloot) | MIT, Godot 4.4+, established inventory plugin | inventory grid UI, container UI, serialization examples | **OPTIONAL UI ADAPTER**, NOT SaveService replacement; test Web and migration before dependency |
| [Seasons Gone](https://github.com/elliotfontaine/untitled-farming-sim) | MIT; older Godot 4 project | crop rotation, soil/farm loops and visual staging | **ADAPT SIMPLE FARM IDEAS**, not direct game merge |
| [Grid Base Builder](https://github.com/HataGames/godot-grid-base-builder) | MIT, 3D Node3D + raycast ground despite top-down marketing | ghost placement/support conditions concept | **DO NOT IMPORT AS 2D BUILDER**; porting 3D increases effort |
| [Life After Death](https://github.com/rumiazhari/life-after-death) | No clear reuse license confirmed | 2D rooms and roof fades as visual reference | **REFERENCE ONLY** |
| [The Gunsmith Survivor](https://github.com/Lucasc0-Git/The-Gunsmith-Survivor) | All Rights Reserved | game systems architecture | **REFERENCE ONLY** |

**No verified license** means not copyable, even if on public GitHub. Some GitHub REST API metadata gives `NOASSERTION`; read actual root LICENSE and per-folder restrictions before acting. Never copy Last Island commercial source/sprites/voice/text verbatim. Prefer robust small in-house code to pulling 78MB of interdependent code to implement one function. A transparent license/provenance ledger should list import SHA and original notices.

## 4. Build vs port vs bespoke criteria (measured rather than preference)
Choose **REUSE** only when (a) external implementation is same Godot major/version and 2D coordinate model, (b) API dependencies bounded (ideally 1-3 classes), (c) compatible MIT/permissive license with attribution and graphics separated, (d) tests can be brought across, (e) no new inventory/save singleton. Choose **ADAPT** when behavior and algorithms are suitable but representation differs (e.g. Coheronia side-view, 3D ghost placement); do not import its entire game. Choose **BESPOKE** for competitive advantage and core invariants: Gold native fidelity, room-based roof, cross-domain SaveService state, world geography grammar, multi-level POI access and SOH unique Core economy. Choice can be changed only by a recorded benchmark demonstrating lower total integration time/risk.

## 5. Shared sample fixture so agents independently integrate
Create a single synthetic but real runtime loop dataset with exactly these named IDs (names provisional until A0 contract lock):
- `region:opening_marches`, `poi:abandoned_research_01`, `resource:oak_tree_01`, `resource:iron_vein_01`, `container:roadside_crate_01`, `build:foundation_wood_01`, `build:wall_wood_01`, `build:door_wood_01`, `build:chest_wood_01`, `station:furnace_basic_01`, `station:research_01`, `blueprint:venom_core_01`, `core:venom_core_01`, `hazard:toxic_fog_01`.
- End-to-end: harvest wood/stone → bag → place paid foundation/wall/door → room fade → store resources → smelt + craft workstation → loot barrel with research scrap + damaged core → learn recipe → craft another Core → equip native Gold when verified → key+power vault → hazard with gear → death bag → sleep respawn → reload → existing Chapter 1 dungeon → return → new optional expedition.
- A6 UI can mock this exact dataset with no extra DataManager; A7 writes deterministic fixture and audit metrics; A0 owns integration.
**Status:** fixture proposal approved by design gate, IDs not yet shipped in game; don't label it implemented.

## 6. No missing agent: release gates
Ownership coverage check must account for ALL 44 subsystem IDs, 21 POI templates, 31 DEP IDs, 12 JOURNEY IDs, 40 UNVERIFIED original facts (which are not all production blockers). Test mapping is `SOURCE_COVERAGE_TRACE.json`. Assign each to role and disposition; if nothing addresses a record, it is a failure in planning, not a tacit omission.

A merge requires deterministic headless tests and relevant native screenshot/recording; interface changes require adapter compatibility; golden VFX requires comparison with exact original source bytes; world visuals require readability review not merely generated texture count; native FPS, Web memory, load/stream and 2K/4K scales need measurement. Audit script and CI detect missing records. User-approved gates can authorize design choices; **only actual tested code can authorize completion claims**.

## 7. Agent takeover prompt — reusable
"Continue Soul of Hero Survival RPG from issue #9 and current feature/survival-rpg-foundation-20261029 HEAD. Read AGENTS.md; the immutable 1355-line user Atlas in docs/survival/source_archive; SOURCE_COVERAGE_TRACE.json; SYSTEM_FUSION_BLUEPRINT.md; ATLAS_RECONCILIATION_AND_DECISIONS.md; MULTI_AGENT_EXECUTION.md; CONTRACTS.md, STATE.json, DECISIONS.md, ACCEPTANCE.md, WORKLOG.md and Google Docs tabs 03–LIVE. Adopt your explicit A# owner role, read the real code, implement CT-* on your OWN branch, test and integrate without editing other agents' files. Report verified vs unverified truth and update both Git+Docs. Do not await user approvals for small passed gate decisions."

## 8. CONTINUOUS RESEARCH — per-agent mandatory workflow
No agent is confined to The FOG, Survival Core Lite, Coheronia, GLoot, or the original 2019–2020 research. Those are pinned historical *starting candidates*. Every responsible agent runs live feature-oriented research before committing to a new subsystem implementation, and reopens the research if a later source could materially improve a design, solve a failure, or reduce integration cost.
- A0: source-of-truth/atomic transaction/version migration, Godot native and browser test harness patterns.
- A1: authored biome/terrain rules, streaming/LOD, river graph, map readability, region-access gameplay.
- A2: genuinely top-down 2D freeform construction, collision/navigation, room detection, dynamic roof, storage.
- A3: recipe DAG, loot rarity, material ecology, production, research, farming, transactions.
- A4: exact Gold animation integration, native JS/TypeScript parity harness, skill item resource economy.
- A5: graded POI puzzles, power circuits, PvE AI, hazards, pathing and softlock validation.
- A6: pixel-readable 2K/4K HUD, build tools, inventory and map UI, art licensing.
- A7: simulation, economy sinks, replay/14-day depth, automated exploratory tests.
- A8: continuous licensing/provenance and repository dependency/security audit.
At each task intake and major obstacle, append a compact **decision record** with search terms, candidates inspected, implementation/library versions, proof, decision, what it connects to in CT-01..CT-12, and reassessment trigger to `RESEARCH_LOG.md`. Search is not a ritual; stop when a solution is justified and verified, reopen when evidence changes. Agent A0 audits these records at PR/merge.
