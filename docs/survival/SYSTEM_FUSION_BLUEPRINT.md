# Soul of Hero — Systemic Fusion Architecture v1.0 (approved through F0–F5 design gates)

**2026-10-29. DESIGN APPROVED; GAMEPLAY NOT YET IMPLEMENTED.** Read the immutable user-source atlas (SHA-256 `b958de0fc413cc200b35b0938760228c2ebd3a8ef4aa2f52c1051c52cca59157`) and its 108-index `SOURCE_COVERAGE_TRACE.json` before changing any subsystem. The 2019–2020 client is the principal survival *behavior* reference; 2021–2026 mechanisms are explicitly separate optional design extensions. The goal is near-complete behavioral fusion, not illegal proprietary source/asset copying.

## 1. The product IS one coupled state machine

A world geography defines resources, routes, danger and monuments. Players gather/scavenge items into inventory with costs and risks. Workstations transform raw material into intermediate ingredients, knowledge, tools, defenses and **finite-use physical Skill Core instances**. Player construction modifies storage, respawn, manufacturing throughput, defense and route logistics; it must physically change collision and AI navigation. Known recipes increase the value of previously gathered materials. Protected access to POIs creates new targets. Death shifts carried inventory into a recoverable bag without deleting learned recipes; permanent base and limited expedition replay create long-term motivation.

**Every feature must have at least two real inbound/outbound links to the economy, world, combat or agency graph; isolated menu-only features fail GATE-SYSTEM.** Exceptions: pure accessibility/UI and art assets, which must still support a measurable gameplay use. E.g. farm must feed potion and Core/food recipes, reduce preparation travel and have crop growth/persistence, not just drop "plant points".

## 2. Twelve architectural contracts, with sole write owner

| Contract ID | Authoritative owner | Data/input -> output | Mandatory invariants | Existing integration seam |
| --- | --- | --- | --- | --- |
| CT-01 WorldPlan | World Architect | global continent design, region/biome graph -> deterministic authored terrain+POI anchors | plan **all** regions up front, initial ~1/4 contains exactly 10 existing chapter-one dungeon exteriors; terrain causal | `game/overworld/overworld_world.gd`, `chapter1_overworld.gd` |
| CT-02 WorldState | Integration Architect | region ID/chunk/seed + world mutations -> rehydratable region snapshots | static geographic truth separate from dynamic player objects; deterministic UUIDs and cross-region load | `game/overworld/overworld_state.gd` |
| CT-03 ItemLedger | Economy Architect | item definitions/instances/stacks -> one authority for bag/chest/ground/death | conservation, capacity, provenance, uniqueness; no duplicate instance in 2 containers | `game/autoload/save_service.gd` currently schema v4 |
| CT-04 KnowledgeGraph | Economy Architect | source specimen, blueprint, research -> learned permanent recipe | found item ≠ unlearned plan ≠ permanent knowledge; scoped access | new adapter over SaveService |
| CT-05 Production | Economy Architect | inputs+station+fuel+time+recipe -> output & queue | ingredient reservation, rollback/commit, no output lost on full destination | crafting station adapter |
| CT-06 ResourceEcology | World/Economy boundary | region+node tables+loot table -> harvestable and renewed loot entities | type-dependent respawn, safe low-risk scrap, danger-weighted unique catalyst | `game/loot/loot_catalog.gd` |
| CT-07 Construction | Building Architect | owned cell+build piece+validity -> paid persistent geometry/room | no blocked required routes, physics, room-specific fade, dynamic nav, no free placement | TileMapLayer/Node2D layer separate from baked terrain |
| CT-08 EnergyCircuit | Building/POI boundary | source → wire/channel → switch/trigger → door/light/trap | no phantom power; save and reload all circuit states | construction entities + access graph |
| CT-09 AccessHazard | POI/Encounter Architect | key+tier+power+resistance+threat -> vault progression | no key consumed for an impossible action without clear UX; no permanent softlock | POI state + world gates |
| CT-10 SkillCore | Gold Combat Architect | physical core instance+known native skill ID+cast request -> full skill, charges | exact Gold VFX and enemy/terrain cues; atomic use debit; no fake native-ready | `weapon_skill_profile.gd`, existing combat |
| CT-11 PlayerSurvival | Gameplay Architect | needs, exposure, stamina, death -> risk and recovery | no silent offline kill; fair respawn, bag conservation, bed valid | existing provisions and state |
| CT-12 ExpeditionMeta | Balance/Systems Architect | home/knowledge/codex + run seed/rules -> repeatable hazardous expedition | persistent home not wiped; replay never grants high-tier Core for free; meaningful goals after extended play | new opt-in mode, separate save namespace |

**Foundation evidence:** `SaveService` has `transact_once`, `grant_inventory_item`, `consume_inventory_item`, `home_transfer_to_storage`, schema v4; `OverworldWorld` uses ground/detail/solid TileMapLayers and paint props; `Chapter1Overworld` requires exactly 10 landmarks. This does not imply the new 12 contracts exist yet.

## 3. World model and spatial ontology

Do not use 'one giant random tile generator' or blindly copy old map. The authoring sequence is: (a) geological macro forms, elevation and drainage; (b) climate/moisture/thermal/hazard; (c) settlement/ruins/history and old roads; (d) river/snow/wetland geology and soil/rock surface bands; (e) economical resources from veins/watersheds/forests; (f) POIs placed relative to former supply/transport/defense networks; (g) navigable roads/shortcuts; (h) authored staging/negative space and local noise details subordinated to walkability and landmark readability. All material placement carries a semantic tag/cause; forbidden are lone contrasting dots/cross-biome random shrubs with no transition.

**Spatial types:** `WorldRegion` -> `BiomePatch` -> `Chunk` -> `CellSemantic` (walkable / road / shore / water / hazard / cliff / settlement / building-allowed / resource-class / sightline). `POIAnchor` has approach routes, clue links, loot and key tiers, enemy/patrol + refresh and safety. `PlayerBuildEntity` overlays data not destructive re-paint of static atlas.

Existing Chapter One dungeons are a **cluster in the opening quarter**; '1/4' is rough designed region share, not necessarily literal Cartesian square nor all resources locked behind ten dungeon completions. The rest of the continent must have planned POIs, hazards, material chains, biomes, settlements, landmarks and possible travel connections **from the initial masterplan**. Biomes: initial marches/mixed temperate, frost, tropical/wetlands, river/other ecologies are examples; their names and exact dimensions may be gate-decided after spatial feasibility, never assumed original 2019 layout.

## 4. Economy and individual item life cycle

**ItemDefinition** `id, kind, tags, tier, size_or_stack, asset_ref, source_licenses, salvage_profile`. `ItemInstance` `uuid, item_id, rarity, condition, charges, max_charges, affixes, bind_scope, owner, origin_event, state_revision`. A stack is a quantity but non-identical instances (Core with varying usage/rarity) must NOT stack. Locations are mutually exclusive: bag, chest, station input/output, world drop, death bag, expedition transport; to move, issue one atomic transfer preserving identity.

**RecipeDefinition** `recipe_id, output(s), ingredients, category, tier, knowledge_scope, available_methods, workstation_capabilities, fuel/time/queue, provenance, mode_allowlist, salvage/repair_rules`; each ingredient points to an obtainable source. Separate recipe authoring from permanent recipe ownership. Distinguish learned Core recipe vs base-construction blueprint (spatial footprint), decorative Workshop Pattern, expedition entitlement and NPC/party licence. Revoke delegated entitlement without removing permanent knowledge. Recipe graph must be cycle-checked for free-value-positive loops across salvage/refining/repair.

**LootTable** must have durable source ID, version, category, seed, probability weights, count, conditions, replenishment policy, anti-repeat and metadata provenance. No imported 2026 drop rate is applied to H1. Validate expected reward per hazard/travel risk and ensure low-risk roads can progress research gradually but cannot completely replace vault/biome rare items.

**Resource production**: tree/stone/ore/herb nodes with finite hits and regeneration state; furnaces consume wood/coal etc and produce intermediate ingredients; workstations and laboratories have queues, input reservation and fuel; later farms yield common herbs/food so rare catalysts still require venture. Storage, furnace and recipe UI must support 'used in recipes', 'where source', 'craftability' and pending outputs.

## 5. Skill Core — do NOT merely rename bullets to mana

Hero has base weapon/combat identity; skill profile is native execution; physical Core is a separate item with limited usage and perhaps repair class. A Gold cast's full timeline, on-enemy FX, world terrain cues, anti-bright-map contrast and cleanup must remain the source-verified Gold version. A core authorization event binds instance/actor/cast UUID/skill ID to transaction. Use debit-on-committed-cast policy by default; interrupted/pre-commit casts produce no debit, otherwise idempotent debit once. This exact policy is an **engineering decision** to be tested across channelled and multi-hit skills, not a claim about original shooters.

The Gun→Skill mapping must be **functional**, not one-to-one visual: ammo caliber and weapon condition become Core charges/stability/energy material consumption, weapon attachments become Core modifiers/hero synergies, repair via workshop or recraft from knowledge, and guns' differing range/fire patterns map to different tactical movement/AoE/control/terrain interaction, not a hundred identical projectiles. Core skill item grants a **fresh temporary power**; a rare initial Core must be impactful even if a player has learned only a few during a 14-day-style experience.

## 6. POI / access graph

A POI record has `poi_id, region, location, authored purpose, map_visibility, rooms, enemy_encounters, loot_sources, hazards, power_nodes, circuits, credentials, access_modes, refresh_policy, story_clues, alternate_route, rewards, persist_state`. Green→blue→purple is a model of inter-POI access progression, not a universal fixed location map. A POI can hide a room early, require a power generator or fuse, need personal protection, and offer a dangerous but skill-based workaround. Different rooms have different loot classes and cooldowns; boss can drop material or key, not exclusively every rare Core.

20+ POI archetypes in source are templates, NOT a mandate to clone all named modern structures. No invented source game exact seed/coord/drop percentages. Any source-specific 2025/2026 timed island, land capture or party recipe is marked newer-extension, not claimed 2019 classic mode.

## 7. Physical, electrical and hostile construction

Building piece categories: foundation/terrain surface (cell); wall/door/window (edge/cell connectors); roof (room ID & occlusion); furniture (footprint/interactables); device (power, fuel, active state); territorial heart/owner; defense; garden plots. Placement pipeline:
1. ghost preview and 2D camera, collision/clearance/cell support and territory authority;
2. verify inventory cost, container/ownership/quota and route invariants;
3. reserve materials, atomically create persistent entity + debit cost, update render and collision/nav incrementally, commit;
4. on crash/load, replay idempotently or roll back without destroying resources;
5. demolition/upgrade must check occupants, linked devices, room connectivity and downstream production queues.

Room graph flood fill when walls/doors change, per-room roof overlay fades on enter, but walls/collision remain. Material tiers change durability/repair/cost and combat break-path. Energy sources, channels and switches must truly power doors, lamps, traps, not just animate. Quotas are measured by **SOH 2D engine load**, not 2023 original 40m/28m limits. No `Node3D` base plugin drop-in.

Territory controller in SOLO serves build ownership, extent, reserve capacity, storage protection and opt-in defense. Never force unfair online-only decay or raids that continue while app closed. Player can build temporary shelters/outposts with smaller footprint and more modest production rights than permanent home.

## 8. Persistence and safety design

One authoritative `SaveService` (no imported competing singleton). Define new survival namespace schema migration and versioned world-chunk state. One immutable event ID per harvest, craft, research, loot, build, cast, transfer, death and bag reclamation. Store before/after invariant tests, including interruption at transaction boundaries. `transact_once` is an existing method, but its semantics must be read at implementation; do not assume it is a full ACID cross-file database. An interrupted action must not silently duplicate or delete inventories and known recipes. Save in-progress station queue and no illegal offline time skip.

Critical invariants: no duplicated Core UUID, each item located exactly once, world resource source cannot be harvested twice per approved epoch, one-time relic not reappearing after reload, chests preserve children, no construction blocks mission-critical portal, no unlabelled player-spawn on solid geometry, modified walls trigger nav refresh, source Gold fixed.

## 9. Top-down pixel-art distinction: the answer to 'why play this instead of the realistic game?'

**We do not compete on photorealistic gunplay.** SOH must excel on four directly testable axes:
- **Combat expression:** spectacular high-fidelity authored pixel VFX plus hero-specific tactical skills, AoE shapes, combos, status effects, telegraphs and terrain responses visible clearly at native 2K/4K upscaling. Gameplay cannot turn into tiny unreadable particles.
- **Readable strategic information:** top-down shows enemy telegraphs, hazard borders, routes, where a building/circuit is blocking, skill footprints, and material roles at a glance. Large/quiet background patches keep players and skills obvious even when a POI is busy. HUD inventory/research/map must help discover relationships rather than spoil entire world.
- **Deep emergent specialization:** collecting a dozen different Core families, building production pipelines and solving environmental obstacles with Core plus gear creates a different intellectual/tactical value than 3D shooter aim skill. New Core changes route/strategy, not just damage color.
- **Fast-but-serious solo agency:** shorter repeated traversal to meaningful interactions, no multiplayer server downtime, repeatable expeditions and persistent base, multiple viable progress loops. The 14-day 'unfinished, want more' test passes because of actual branch depth and varied discoveries, not forcing impossible material costs.

Specific design gate: for every major new system, state its **unique benefit available precisely because of top-down/pixel/Skill Core**, plus screenshots/playtest evidence for readable affordances. If it adds no difference from a diluted 3D survival copy, reject or redesign.

## 10. Completion scope

Coverage indexing **is not implementation**. The 44 source subsystems/21 POI archetypes/31 dependencies/12 journeys/40 unknown facts require traceable outcomes. For each approved feature, define runtime class + data fixture + save contract + UI feedback + test(s) + native visual proof. Game-wide complete means every selected source behavior either verified implemented or explicitly rejected with an evidence gate and reason; no silently abandoned systems. A handoff CI green does not mean this game code passes. Full-world planning and skill Gold fidelity are mandatory, and the world must be traversable with real production, crafting, construction and combat loops.
