# Exact source registry, license gates and asset availability

Audit on 2026-10-29. All third-party source SHAs are **reference snapshots**, not automatically vendored dependencies. Reconfirm SHA/license at actual adoption. No downloaded full external code imported in initial kickoff.

| Repository | Audited SHA | License boundary | Role and status |
| --- | --- | --- | --- |
| [The FOG](https://github.com/furmonenko/the-fog) | `9c5cb03a9d9f895cd9194bcfa1b3c4821da7c4e7` | MIT **source** only; assets under assets/, Sprites References/, images/ are all-rights-reserved; addons separate licenses | Primary reference: loot_container, crafting_building, laboratory, inventory grid, fixed BuildSpot; NOT freeform construction |
| [Godot Survival Core Lite](https://github.com/openclawaimac/godot-survival-core-lite) | `df0c9c032c5c78e50019dbe9fdf7fee72e41875a` | MIT source; Lite modules available, Pro is separately licensed | Harvestable/needs/day-night/recipe reference; Lite has **no freeform building/stations/full save**, claimed 48 tests not locally rerun |
| [Coheronia](https://github.com/ppeck1/coheronia) | `3f4dbdd7a268f232a49407db5160111a090ea964` | MIT engineering only; images, audio and authored lore reserved | block_registry/build_preview/serialization ideas; side-view rendering incompatible |
| [GLoot](https://github.com/peter-kish/gloot) | `6b09b87ac07a8536779ef1ab0fafc7e99830f948` | MIT | Optional inventory UI/reference; evaluate conflicts before adding |
| [Seasons Gone](https://github.com/elliotfontaine/untitled-farming-sim) | `c509cab1614eab245e5bc7a4c27034cfa318f7e8` | MIT | Farming/crop rotation conceptual reference, older code |
| [Grid Base Builder](https://github.com/HataGames/godot-grid-base-builder) | Not pinned | MIT | Uses Node3D/ray to flat Y=0 despite 'top-down'; not drop-in for SOH 2D |
| [Life After Death](https://github.com/rumiazhari/life-after-death) | Not pinned | No clear code reuse license | Read-only reference for 2D enterable buildings/roof reveal |
| [The Gunsmith Survivor](https://github.com/Lucasc0-Git/The-Gunsmith-Survivor) | Not pinned | All Rights Reserved | Read-only gameplay reference |

## Soul of Hero asset inventory and provenance

- `assets/environment/cainos_demo/`, `ocean_cainos/` contain Cainos 2D atlas subsets with THIRD_PARTY notes, no standalone license inside supplied ZIP; provenance/permissions require checking before release.
- `assets/environment/chapter1/` has 10 environment families; `assets/environment/overworld/` has baked tile/prop atlas and overrides.
- `assets/ui/free_inventory/`, `assets/ui/fantasy_icons.png`, `assets/library/downloaded/treasure_chests_1_2a/`, `rpg_arsenal_1_1/`, `rpg_icons_400/`; production license of chest/rpg_icons_400 still needs proof.
- `data/asset_library/download_catalog.json` lists **102 source entries**: 87 packages, 1 directory, 14 loose files. **This is a catalog, not a guarantee of archive bytes available in Git.** At audit, GitHub showed only 8 folders in `assets/library/downloaded/`.
- `docs/ASSET_SOURCING_MATRIX_2026_07_15.md` and `docs/CHAPTER_1_L06_L10_ASSET_READINESS.md` contain source provenance/release blocks (older snapshots; revisit live source).
- Do not buy new generic icon/UI/VFX packs. Modular foundations/walls/doors/roofs/interiors/farming growth-stage art **has not yet been verified as a coherent production kit**.

## GOLD source fidelity gate

- Reference `feature/gold-93-skill-readiness-20261028` and `docs/vfx/skill_readiness/README.md` as read-only.
- `venomwright-combat-vfx-design (4).zip` SHA256 `ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716`.
- `ARCANA_III_V2_72_SKILLS_FULLFX_2X.zip` SHA256 `8402633cbc9666b6f628f1b6101acc6123d67af0a1797a229ea02aa5d440677d`.
- Original source ZIP bytes were **not included in the audited Gold branch**; retrieve/verify them when exact source port work begins. Do not substitute hashes with guessed reconstructed source.
- Gold registry entry count != playable ability count. Source vs actual VFX acceptance requires a full timeline on native Godot and environment/target parity.

## Source adoption policy

Pin commit and license snapshot; isolate an adapter; run headless Godot, native rendering and Web export; preserve original required attribution; never copy third-party art unless separately licensed.

## Living-source registry policy — supersedes any interpretation that this list is exhaustive
This page's initial candidate list is only a historical snapshot. As development continues, agent A0–A8 must actively discover newer/different candidate repositories and designs for each significant subsystem and store dated positive/negative results in `RESEARCH_LOG.md`. Pin exact source SHA at adoption and reevaluate when engines, dependencies, licensing or functionality change. Separate source code rights from art and content. A rejected repo remains useful evidence; document why. Future research is required at every material design/implementation decision and on new blockers, not performed once at project kick-off.
