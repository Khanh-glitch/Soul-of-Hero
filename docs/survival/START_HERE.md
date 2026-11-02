# SOH Survival RPG — canonical context

**CURRENT AUTHORITY:** `CURRENT_PRODUCT_CONTRACT.md` + D062–D074 of `DECISIONS.md`; the 2026-10-29 descriptions below were historical snapshots and are not executable where superseded.


**Project:** Khanh-glitch/Soul-of-Hero  
**Mission tracker:** https://github.com/Khanh-glitch/Soul-of-Hero/issues/9  
**Owned integration branch:** `feature/survival-rpg-foundation-20261029`  
**Exact fork base:** `arena/54306b59-soul-of-hero` at `c1925d8d17a78da22c64b2c0fc249711eed536ac` (2026-10-29).  
**Other concurrent branch:** `feature/gold-93-skill-readiness-20261028` at audit SHA `6c58ecf6f7c2350ee49f3a82e3cef42bf80afaf7`. READ-ONLY.
**Revision rule:** these are *audit snapshots*, not promises about live HEAD. Resolve GitHub branch HEAD on every session.

## What user wants (preserve semantic meaning, not literal quotes)

1. Transform SOH from Chapter-1 dungeon-centered game into a **long-lived offline open-world survival action RPG** inspired strongly by the exploration/crafting/base-building loop experienced in *Last Day Rules / Last Island of Survival*. Adapt firearms to limited-use **Skill Core** and weapons/blueprints to fantasy materials and permanent core-crafting knowledge, without turning it into a generic shallow crafting menu.
2. The world is **fully designed from the outset**, not one authored corner plus three blank future placeholders. Large, continuous, causally authored biomes (snow/frost, forest/tropical, rivers/wetlands, opening marches) with terrain semantics, water flow, settlements, enemies, secrets, resources and threats. Access grows through real soft/hard barriers (strong mobs, poison/frost, broken bridges/route repairs, equipment, faction control, physical world changes), not arbitrary level popups. Choose/iterate world layout after confirming gameplay needs.
3. Existing **10 Chapter-1 dungeon sources** remain preserved and reusable; survival-world inclusion/location is selectively authored by actual geography/gameplay. No mandatory count or quarter arrangement. New runs spawn randomly across safe areas.
4. Building is **actual grid-aligned freeform top-down 2D** with walls/foundations/doors/roofs, usable rooms, a roof that fades/reveals interior per room, working collision, real storage, workstations, furnace, bed/respawn, farm and eventually defense/production/outposts. Not merely preselected BuildSpot upgrades.
5. The loot-to-research-to-craft loop: scavenging barrels and ruins, item rarities, finite durability/uses, special zones requiring protection/key/access mechanism, smelting, crafting, blueprints and repeatable production. **Found Core can be used but eventually depletes**; learning a recipe/secret permanently allows rebuilding it from specific materials. Learning a recipe and owning a temporary core are separate state.
6. Preserve the significant SOH VFX corpus. User insists original Gold VFX **acts exactly as Gold**, including enemy-body FX, terrain/ground effects and full open/close timelines. Never approximate by drawing a similar sprite, skipping environmental effect, or labeling a source catalog as native-ready.
7. Full solo world runs end after **UP TO 14 real days including offline**, or earlier at player request/physical evacuation. Every run resets home/items/Core/research/map/quests; secured Ragnarok currency and global achievements/history persist. No PvP, arbitrary grief or artificial grind. Farming/forge/research outputs can mature offline with real input limits.
8. The user explicitly prioritizes **efficient end-to-end execution**, using existing assets and permissively licensed Godot code, with agents handling internal substeps and delivering one integrated playable loop rather than asking for approval after every change. Never interpret this as permission to hide failures or to make major design choices contrary to user commitments.

## Current facts verified from GitHub

- `game/overworld/chapter1_overworld.gd` binds 10 landmark positions and currently builds/paints the nearly 100k-cell Chapter-1 map on entry. Refactor a generic World/Region engine before scaling; don't break L01–L10. 
- `game/overworld/overworld_world.gd`: `ground/detail/solid` TileMapLayers, props and collision. Large map terrain from baked JSON plus code-based authoring.
- `game/autoload/save_service.gd`: authoritative versioned SaveService with `transact_once`, inventory and home storage; preserve via migration. Current audited schema version 4, 30 bag slots, 50 home storage slots.
- Loot catalog, weapon skill profiles, Hero combat rules exist. No verified freeform construction or real survival research economy in SOH.
- Assets already under `assets/environment/`, `assets/ui/`, `assets/vfx/`, `assets/characters/`. Asset catalog has 102 source entries; **not all original archives are in Git**. Do NOT buy or blindly import generic packs.
- VFX Gold branch: `docs/vfx/skill_readiness/readiness_manifest.json` declares 93 entries but **0 native_port_ready** at audit SHA; archive hashes recorded, original ZIP bytes absent from that Git branch. Do not fake port readiness.
- Source Gold ZIP required eventually for exact parity:
  - `venomwright-combat-vfx-design (4).zip`: SHA256 `ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716`
  - `ARCANA_III_V2_72_SKILLS_FULLFX_2X.zip`: SHA256 `8402633cbc9666b6f628f1b6101acc6123d67af0a1797a229ea02aa5d440677d`
- **Important visual lesson:** older and current overworld both lack material-placement world grammar; the new revision increased noisy small-scale detail. Do not treat current map as a visual gold standard or just smooth random tiles. Plan causal geography and look at actual native captures.

## Work that has NOT yet been done in this integration branch

No construction/loot/crafting/survival gameplay code has been added by this kickoff. No third-party packages imported. No native/Web end-to-end playtest of new systems passed. No protected parallel branch changed. The Git commit containing this document only inaugurates durable agent coordination and implementation contracts.

## Fastest safe next step

Review `CONTRACTS.md` and `STATE.json`, then implement a **single end-to-end mechanically playable slice** using read-only licensed references and an adapter to existing SOH inventory/save: harvest nodes → player inventory → place a collision-enabled wall/door/foundation → persist and reload. Grow that slice to roofed room, chest, workstation/crafting, blueprint/Core then world hazards before calling the mission complete.

This is an integration path, NOT a request to show user a tiny unfinished demo and stop. Deliver internally validated increments and record every partial truth in the repository.

## Major update 2026-10-29: full research source, architecture and differentiation
Full user-provided Atlas (1355 lines, SHA256 in AGENTS.md) now permanently archived in this Git branch. **It is more complete than either the preceding 2019–2020 research synthesis or this brief START_HERE**; readers MUST consult full original and `SOURCE_COVERAGE_TRACE.json` (108 named mechanisms + 40 source unknowns + 28 references).
Design approved: systemic fusion of world/biome/resources; physical item+recipe research/production; actual multi-room top-down construction, material durability, storage, electrical circuits, territory; layered POI access and hazard; finite Core/Gold parity; PvE risk/recovery; run-local home and season-end Ragnarok/evacuation; new game-wide 14-day depth test; clearly distinct top-down tactical and pixel-art virtues.
Read master documents `SYSTEM_FUSION_BLUEPRINT.md`, `ATLAS_RECONCILIATION_AND_DECISIONS.md`, `MULTI_AGENT_EXECUTION.md`, `ECONOMY_AND_14DAY_REPLAY_BALANCE.md`. The last document preserves original quantitative epoch distinctions and SOH-specific proposed test targets.
**No gameplay code was modified during the source-archiving/design pass.** Do not claim the game systems have been verified. Real Godot native/Web work begins SURV-010.
