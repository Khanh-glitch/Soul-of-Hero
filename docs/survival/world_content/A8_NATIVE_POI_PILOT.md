# A8 native world-content pilot — S2 handoff

**Scope:** three source-anchored native Godot POI scenes plus one explicitly non-canonical authoring fixture. This is a reviewable A8 component package, **not** a production overworld mount, complete world, or full-game approval.

## What is implemented

- `game/survival/world_content/scenes/native_poi_template.tscn` is the reusable physical `PackedScene`. Quarry, Orchard, Mill and test-only Saltwind Lookout instance it. The common engine builds `StaticBody2D` boundaries, an `Area2D` action socket, capability gates, a safe retreat route, and interaction-side/distance/facing eligibility. Quarry and Orchard now use inherited scene art frames where suitable; the mill retains its state-driven waterwheel/water art. No new raw third-party art was committed.
- `data/survival/world_content/sites/*.json` carries each site's canonical A1 identity/cell, scene geometry, authored collision rectangles, actions, choices, fixture-only cost/reward intents, world-state deltas, capability needs and return timing. The fourth content type is authored as data against the same engine. `tools/survival/world_content/author_site.py` validates/stamps wrapper scenes without action-specific script changes.
- Interaction contract v1 (`NativePoiSite.intent_requested`) emits stable `source_id + object_id + action_id + claim_id`, catalog references, capability needs and state delta. It never applies inventory or persists authority. A host accepts/rejects/commits, then returns the matching intent result and owner projection.
- The separate S2 harness (`poi_pilot.tscn`) uses a transparent `CharacterBody2D` navigation probe, not a rendered player substitute; the locked canonical SOH characters are intentionally not substituted. Its authority is labeled fixture-only and never aliases `SaveService` or an actual item receipt.
- Godot test source covers instantiation/physical collision, stand/range/facing denial, route choice, cost and full-bag rejection, duplicate/tampered claims, interrupted retry identity, owner-projected generation/cooldown and reload, delayed Orchard return, Mill capability denial/unlock, and physical entry/retreat. **The test source has not yet passed a native Godot run.**

### The three distinctive places

1. **South Quarry** — canonical A1 `poi_crown_south_quarry`, `[30,280]`. A choice between `brace_east_shelf` and `chock_west_ramp` changes the safe route; `leave_seam_unworked` remains a no-item safe exit. `extract_outcrop` is reachable only after the owner-projected safe route. Current test costs/yield/timer are fixture values only.
2. **South Orchard Ruin** — `poi_crown_south_orchard`, `[140,360]`. A low-risk Reed Fibre fixture action accompanies the fallen sluice choice. Water changes only from owner projection; graft marks become available after the owner-time return interval. `honey` and `rare_herb` remain explicitly blocked.
3. **South Crown Mill** — `poi_crown_south_mill`, `[120,300]`. The race can be observed from the outer side before `cap_salvage`; physical gates protect the outer salvage area and maintenance walk. With capability, `repair_waterwheel` or `leave_wheel` commits a distinct state. The repair turns the wheel, opens the maintenance route and enables a separate fastener fixture. The exterior remains a safe retreat path.

All material amounts, yields and fixture cooldowns in these definitions are **S2 test inputs** only. They are not A3 prices, approved drop rates, live inventory grants, or production balance.

## Current source and art provenance

- Current A1 PR #20 head is `e16285ffbbf80829f07e056264751954cd16571a`; current A3 PR #19 head is `18e7afcbd576bbd9bfbcc509b2ee13216186a522`; current A0 PR #21 head is `7315f8e83fa6c9c1ec9e2a00d9c0e4fd05b8e450` (draft/conflicting); current A6 PR #24 head is `bed3fc81ced4505eac6cfc3ddec5c07aeef8019e`. Integration base is `feature/survival-rpg-foundation-20261029` at `86831332324428c7623ad431a577d101b7af5c9c`. These are live snapshots for this handoff; owners must refresh before integration.
- The three canonical identity/cell/access facts are read from current A1 `data/survival/world/world_plan.v1.json`; A1 currently marks the POIs `AUTHORED_PLAN_NOT_NATIVE_INTEGRATED`. Scene placement/transform remains A0/A1-owned.
- Current A3 `items.json` contains `oak_wood`, `stone_chunk`, `iron_scrap`, and `reed_fibre`, but they are `SOH_PROPOSAL`. Current `sources.json` contains `live_oak_wood`, `live_stone_chunk`, `live_iron_scrap`, and `live_reed_fibre`, also `SOH_PROPOSAL` with `poi_id:null`; none authorizes this pilot's route prices or POI-specific extraction. The canonical blocked request is `data/survival/world_content/quarry_integration_candidate.v1.json` and its full owner notes are `A8_QUARRY_INTEGRATION_HANDOFF.md`.
- Visual dressing references the project-authored `assets/environment/overworld/overworld_props.png` atlas frames listed in `data/overworld/overworld_props.json` (original project-generated art) and selected tree frames in `assets/environment/cainos_demo/cainos_plant.png`. The Cainos archive/source/terms record is `assets/environment/cainos_demo/THIRD_PARTY.md` on the integration base: commercial project use/modification was allowed at intake; raw pack redistribution/resale is not. The POI branch adds only references and draw calls, not copied atlas files. The basin/waterwheel and other scene-specific motion remain A8 native drawings, not claimed as source sprites.
- The D051/D052 policy snapshot is `9332cb9ba25da3026ede0cad578a90f0e4b5a2b6`: only bald/unarmored male Craftpix 555940 and female 419402 are locked base identities; armor must be equipped-item-driven and identity-preserving. Their source ZIPs/PNGs are not in this checkout. A8 introduces no Knight, Archer, generated or other substitute avatar.
- At The FOG commit `9c5cb03a9d9f895cd9194bcfa1b3c4821da7c4e7`, the actual `scripts/loot/loot_container.gd` and `scripts/loot/loot_table.gd` plus scoped MIT license were inspected. The small reusable idea is physical proximity/visual container interaction; its `already_looted`, internal `InventoryGrid`, item IDs and probabilities are not SOH authority. No The FOG code or restricted art was copied. See the Quarry handoff for the source-level decision.

## How to run and test

With Godot 4.7 installed:

```sh
godot --path . game/survival/world_content/scenes/poi_pilot.tscn
# Controls: WASD/arrows move; face socket + G makes selected choice; [ / ] choose;
# H/Y run first/second distinct action; F1-F4 select three POIs / test fixture;
# C toggles fixture-only salvage capability.
python3 tools/survival/world_content/author_site.py --check
godot --headless --path . --editor --quit
godot --headless --path . --script tests/survival/world_content/native_poi_contract_test.gd
```

`H`, `Y`, `C`, the site selector and seeded inventory exist only in `poi_pilot.tscn`. Do not move the fixture into a release autoload/player UI.

## A0 production integration contract

1. A0 mounts **one** pilot scene first at the exact A1 POI using the existing cell-to-world transform. Do not convert `[30,280]`, `[140,360]`, `[120,300]` into guessed pixels, edit the master overworld, or mount all three without A1/A0 route review.
2. A0 supplies the production host adapter, validates version, actor range/stand/facing/collision at commit, capability, A3 item/source/action authorization, bag capacity, costs, claim generation and site exclusivity inside the single A0 transaction. Production rejects fixture flags.
3. A0 persists claim, cost/reward, site state and resource timer atomically in `SaveService`; A8 stores no state. The current A0 head does not yet expose this A8 adapter or a migration-safe `world_pois` projection, so this is an owner handoff, not existing functionality. Owner replies with `schema_version`, `site_state`, `claim_generation`, `capabilities`, `ready_actions`, `resource_ready_at`, `clock_seconds` and an owner revision. Rejection/interruption returns unchanged projection; retries use the same owner-derived claim identity. Timers/generations come from owner state, not scene-local timers.
4. A0 tests both locked avatar identities with equipped-item armor, normal movement/camera/input, route, save/reload, item-full/material-shortage failures and retreat. Keep A1's 10 dungeon doors and Waystation/Relay unique-reward authority untouched.
5. No source is production-ready until A0 mount/transaction, A3 action price/source approval, A1 placement and native tests pass. Current A8 status remains **S2**.

## Evidence and status

Static verification passed on code-bearing head `2ad531f9e099cc3a29709da176e7a34b05a9a15b`: A8 authoring validator, gdformat parser/format, gdlint, JSON parsing and `git diff --check`. The sandbox still has no Godot executable. The earlier 4.7 download redirected to `release-assets.githubusercontent.com`, outside the available hosts. Current code-bearing A8 native run `41019182407` remained queued after a 180-second `gh run watch`; no job steps started. Other PR-native runtime/capture jobs are likewise pending. Therefore **no native Godot test, capture, or 720p/2K/4K visual inspection is claimed**. Inspect the actual workflow results and captured artifacts before raising this status. A green static validator is not native acceptance.

## Non-goals / unresolved blockers

- No production mount in `game/overworld/chapter1_overworld.gd`, no SaveService/SurvivalService changes, no duplicate economy, no Gold, no replacement avatar or A6 UI system.
- No approved A3 route price or Quarry/Orchard/Mill source binding; fixture amounts are non-authoritative.
- A0's world-POI persistence projection and production adapter remain unimplemented in A0-owned paths.
- Fourth Saltwind Lookout is authoring-only, not a canonical A1 POI. This work does not integrate the remaining A1 anchors or certify the world.
- Native tests and 720p/2K/4K captures remain unverified. No `FULL_GAME_READY`, runtime approval, or world-completion claim is made.
