# A8 native world-content pilot — S2 handoff

**Scope:** three source-anchored native Godot POI scenes plus one explicitly non-canonical authoring fixture. This is a reviewable A8 component package, **not** a production overworld mount, complete world, or full-game approval.

## What is implemented

- `game/survival/world_content/scenes/native_poi_template.tscn` is the single reusable physical `PackedScene`. Quarry, Orchard, Mill and the test-only Saltwind Lookout instance it. The common engine builds real `StaticBody2D` boundaries, an `Area2D` action socket, the capability gate, a safe retreat route, interaction-side/distance/facing eligibility, and distinct in-world line/polygon scenery.
- `data/survival/world_content/sites/*.json` carries all per-site identity, A1 anchor, scene geometry, authored collision rectangles, actions, choices, costs/reward *intents*, world-state deltas, access capability and return timing. The fourth content type is authored as data against the same engine. `tools/survival/world_content/author_site.py` validates and stamps the wrapper scene without action-specific script changes.
- Interaction contract v1 (`NativePoiSite.intent_requested`) emits stable `source_id + object_id + action_id + claim_id`, catalog references, capability needs and state delta. It never applies an inventory balance or persists state. The host must accept/reject/commit, then call `receive_authoritative_result()` with the matching intent ID and `set_projection()` with the host-owned versioned projection.
- The S2 pilot harness is a separate scene (`poi_pilot.tscn`). It has a *transparent CharacterBody2D navigation probe and floor ring*, not a rendered player/character substitute; canonical SOH characters are intentionally absent. The harness authority is labeled fixture-only and never aliases `SaveService` or an actual item receipt.
- Dedicated Godot test source covers instantiation/physical collision, range and facing denial, route choice, atomic cost failure, bag-full failure, duplicate/tampered claim, interruption/retry identity, owner-projected resource generation/cooldown and reload, delayed orchard return, mill `cap_salvage` denial/unlock and entry/retreat through the actual physics body. The scoped GitHub workflow runs these contracts and requests native captures at 720p, 2K and 4K.

### The three distinctive places

1. **South Quarry** — at canonical A1 `poi_crown_south_quarry`, `[30, 280]`. Face the split-face tool mark; brace the east shelf with candidate Oak Wood or chock the west ramp with candidate Stone Chunk. The chosen route physically removes its blocker and commits one exclusive world-state branch. A separate finite outcrop intent returns after its configured recovery window. The player can leave without making the choice.
2. **South Orchard Ruin** — at `poi_crown_south_orchard`, `[140, 360]`. The existing reeds provide one low-risk finite candidate. Clear the fallen sluice for a candidate Stone Chunk cost or leave it undisturbed. Water visibly runs only after the owner projection changes; graft marks/knowledge become available only after the owner-time return interval. `honey` and `rare_herb` are explicitly blocked and never awarded.
3. **South Crown Mill** — at `poi_crown_south_mill`, `[120, 300]`. The wheel/race can be inspected from a marked sightline outside the POI before `cap_salvage`; the outer gate and maintenance-walk gate are real collision barriers. This preserves A1’s fact that the mill outer zone requires `cap_salvage` without preventing observation from outside. With the capability, the player can cross both gates and choose to repair the wheel at candidate Oak Wood + Iron Scrap cost or leave it seized. Repair animates the wheel, opens the route, and enables a finite fastener recovery candidate. The south route remains a safe way out.

The values in this paragraph are *intent inputs to an S2 fixture only*. Do not read them as A3 prices, approved drop rates, or real game balance.

## Source and art provenance

- Canonical POI IDs and cells, plus A1 outer-access facts, are transcribed from the dispatched A8 work order at `b19b5ef305229b7b3ee8477f15ca2ac9f679e2b2`; quarry/orchard outer access has no required cap; mill outer access is observational and the maintenance walk requires `cap_salvage`. The production geography transform and mounted placement remain A1/A0 work.
- The candidate item IDs in the isolated fixture were observed in `data/survival/survival_catalog.json` at source snapshot `feature/surv-a8-reuse-audit-010a`, commit `9332cb9ba25da3026ede0cad578a90f0e4b5a2b6`, SHA-256 `42c64cf7f37b2e6fdfa1d6d19c71f2bcd9455a42e8e8033241e663d2ece66974`. That source explicitly says item semantics belong to A0/A3 and costs/yields are provisional. It is **not the production A3 catalog**, is absent from the active base checkout, and grants no transaction permission. `catalog_candidates.fixture.json` is only a test whitelist. A3 must map/approve every used item ID and price before release; A0 must supply the authoritative atomic transaction and save boundary.
- D051/D052 correction (commit `9332cb9ba25da3026ede0cad578a90f0e4b5a2b6`) locks bald/unarmored male Craftpix 555940 and female Craftpix 419402 from the user's SOH Asset Drive; armor grades 1/2 must be equipped-item driven and preserve identity. Those source ZIPs/PNGs are **not in this checkout** and are not copied here. This pilot introduces no substitute Knight, Archer, or generated avatar. A0/A6 must mount the two source-confirmed player assets and existing armor contract.
- Scene shapes/colors are drawn natively in `native_poi_site.gd`; no third-party sprites, AI-generated assets, or external runtime art are used. A1-authored terrain/prop tiles and the two player sheets remain art/integration blockers for a release-quality whole-world screenshot, not something this pilot silently replaces.

## How to run and test

With Godot 4.7 installed:

```sh
godot --path . game/survival/world_content/scenes/poi_pilot.tscn
# Controls: WASD/arrows move; face socket + G makes selected choice; [ / ] choose;
# H/Y run the site's first/second distinct action; F1-F4 select the three POIs / test fixture;
# C toggles the fixture-only salvage capability.
python3 tools/survival/world_content/author_site.py --check
godot --headless --path . --editor --quit
godot --headless --path . --script tests/survival/world_content/native_poi_contract_test.gd
```

`H`, `Y`, `C`, the 4-site selector and seeded inventory exist only in `poi_pilot.tscn`. Do not move the test fixture into a release autoload or player UI.

## A0 production integration contract

1. A0 chooses **one** pilot PackedScene for the first mount and supplies its transform through A1's cell-to-world mapping. Do not turn `[30,280]`, `[140,360]`, `[120,300]` into guessed pixels, edit the master overworld, or mount all three without the A1/A0 route/access review.
2. Inject the production host adapter on the scene owner. Subscribe to `intent_requested`; validate version 1, actor range/stand/facing/collision at commit time, capability, A3 catalog item IDs, inventory capacity, costs, claim ID and site exclusivity inside the normal A0 transaction. Candidate fixture flags must be ignored/rejected by production.
3. Persist, atomically with cost/reward and claim ledger, the one versioned owner state projection for each POI in the existing SaveService. A8 stores no state. On successful commit, reply with matching `intent_id` and projection fields `schema_version`, `site_state`, `claim_generation`, `capabilities`, `ready_actions`, `resource_ready_at`, and `clock_seconds`. On reject/interruption, return an explicit reason with the unchanged projection; retry the same claim ID. The owner computes the delayed orchard unlock and replenishable candidate generation/cooldown from its durable clock, never from a scene-local timer.
4. Have A0 test both canonical avatar identities with armor driven by equipped item, existing movement/camera/input, normal route, save/reload, item-full and material-shortage failure. Validate player can retreat from each scene without a side exit or stuck collision. Keep A1's 10 dungeon doors and Waystation/Relay unique-reward authority untouched.
5. Do not call this integrated/production until the A0 host, A3 item/cost mapping, A1 placement and native user-input/persistence test have passed. Current status remains **S2**.

## Evidence and status at handoff

The data validator succeeds locally (`A8 site data valid: 4 sites; one reusable PackedScene / interaction engine`). `gdformat --check` is a syntax/parser/format check only, not a Godot runtime test. The sandbox has no Godot executable; the official GitHub 4.7 binary download was attempted but its redirect to `release-assets.githubusercontent.com` is outside the available network hosts. Consequently, **no local Godot run, screenshot, or visual frame inspection is claimed**. The added isolated CI job is configured to perform the native test and render-size captures once run on GitHub. Capture artifacts and Godot result must be added to the review after that job succeeds; a green Python validator alone is not native acceptance.

## Non-goals / unresolved production blockers

- No mount in `game/overworld/chapter1_overworld.gd`, no SaveService change, no duplicate inventory/economy, no Gold, no UI subsystem or scene-wide dashboard.
- No approved A3 catalog/transaction API in this active checkout; all candidate material values are test-only.
- No approved male/female avatar source pixels or A1 regional terrain/prop atlas in this checkout; do not substitute.
- Fourth lookout is an authoring test fixture, not a canonical A1 POI. This work does not complete the 106 other A1 anchors or certify the whole map.
- The workflow's native Godot tests and 720p/2K/4K captures have not been executed in this sandbox. This work makes no `FULL_GAME_READY` or world-completion claim.
