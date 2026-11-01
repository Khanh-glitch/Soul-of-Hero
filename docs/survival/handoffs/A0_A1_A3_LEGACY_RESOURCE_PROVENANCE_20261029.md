# A0 → A1/A3: legacy Hollow Marches producer provenance request

**Status:** OPEN; not an approved contract or a change to A1/A3 branches. A0's production-composition test is not a normal-input playthrough. A1 owns world/source planning; A3 owns item/recipe identity; A0 owns the mounted Chapter 1 interaction and paid build validation. No blanket aliases or free station kits are requested.

## Observed bytes and gap

At A0 `07b9c8ffc29830d985e740593d7038cf984b4bd7`, `tools/survival/author_resources.py` selects legacy props and `data/survival/hollow_marches_resources.json` stores only `kind` and `cell`. `chapter1_overworld.gd::_build_survival` mounts those resource nodes and `SurvivalService.harvest` commits their catalog outputs to the sole SaveService inventory. Catalog mappings are `oak_tree → oak_wood`, `scrap_pile → iron_scrap`, `reed_clump → reed_fibre`; the author selects `tree_dead`/`tree_pine`, `barrel`, and generic `bush`, respectively. Because the plan records no producer identifier or selected neighbour, even an adjacent-frame validation does not identify a particular A1 source. Presence and direct node interaction pass [run 40906471143](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40906471143); the test teleports Hero, calls node methods, and does not prove physical input reachability or source approval.

Pinned A3 `86dc21954fd0a1a4aa9f98b6ec7d1e6782cc800e`, unchanged for the compared adapter/contract/catalog bytes at A3 `18e7afcbd576bbd9bfbcc509b2ee13216186a522`, has starter hand `workbench_kit` (6 oak, 2 scrap, 8 active ticks) and starter workbench `weave_cloth` (3 reed → 2 binding cloth, 6 ticks). These recipes do not require the station kit to manufacture itself. This finding does not prove all needed items legitimately reachable under A1's source-specific contract, nor that binding cloth alone is a usable tool.

## Requested decisions

1. **A1:** identify which existing legacy prop/node instances represent approved oak/timber, salvage/iron and wetland reed producers, with stable producer/source IDs and versioned world/plan provenance. In particular, generic pine/dead tree is not automatically approved as oak and generic bush is not automatically approved as wetland reed. If the legacy asset cannot establish that provenance, say so explicitly and propose lawful source placements, without importing PR #20's continent or replacing A0 validation.
2. **A3:** confirm the corresponding exact source-to-item mapping and the existing starter kit/weave recipe and knowledge prerequisites under that versioned producer contract. Identify any missing producer or migration contract; do not modify A3 authoritative catalogs in A0 or fabricate an agreement.
3. **A0 after agreement:** retain item conservation and existing saves, make only the agreed source-specific plan/adapter change, then verify fresh-save player input, travel, harvesting, kit production, paid workstation and useful output continuously. Test old-save resource identities and replay/depletion migration explicitly before rollout.

The existence of a starter recipe means an A3 recipe replacement is not presently justified. If approved producers are absent after A1/A3 decisions, record the precise `CONTRACT_NOT_SPAWNED`/bootstrap blocker and request an A3-owned versioned remedy rather than a hidden grant or inferred alias.
