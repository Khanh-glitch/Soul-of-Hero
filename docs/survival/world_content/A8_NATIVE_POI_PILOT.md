# A8 native world-content module — S2 engineering status

**Scope:** South Quarry, South Orchard Ruin, and South Crown Mill; shared native Godot interaction engine; one local-worksite transition contract; and a non-canonical fourth-site authoring fixture. This is an A8-owned native module, **not** an A0 production mount, A3-authorized economy, full-game approval, or release-ready integration.

## Implemented in A8-owned paths

- Each canonical POI now has two scene roles: a 128×128 compact overworld shell at its unchanged A1 cell and a separate 960×600 local worksite using the shared `NativePoiSite` engine. The local worksite is never directly mounted at the A1 world transform. Shell roots use the exact 1:1, rotation-0 transform `root = canonical_cell * 16 + (8,8) - action_socket`, with the centered `[64,64]` socket and no fractional scaling.
- Exterior shells retain five solid boundary segments around a real south doorway. The larger local scenes retain their authored collision and now have a central south ingress/egress gap. `transition_contract.v1.json` defines typed enter/exit requests: entering is possible only at the physically reached shell door; retreat returns to that shell door and canonical anchor. A8 emits requests only. It does not mount production scenes, move the authoritative Hero, save position, or treat an interior spawn as an overworld coordinate. The small in-pilot transition host is explicitly S2-only.
- Wrapper generation uses the actual source filename (e.g. `sites/south_quarry.json`), not the `site_id`. `author_site.py --check` independently parses each serialized `definition_path`, resolves the referenced file, and verifies `site_id` plus `source.poi_id`; it does not trust its own generated text for existence or identity. Adversarial Python tests prove that a missing path, wrong identity, and root escape are rejected.
- `NativePoiSite` consumes `get_facing_direction()` first when the composed Hero exposes A0's real interface (`game/characters/knight/knight.gd` at current A0 head); fixture-facing fallbacks remain test-only. Choices, capabilities, cooldowns, collision and scene dressing react to accepted owner projections. No scene-local inventory, receipt, or durable POI state is introduced.

## Distinct worksite loops

1. **South Quarry** — `poi_crown_south_quarry`, cell `[30,280]`. East-shelf bracing and west-ramp chocking are separate route preparations with distinct collision-blocker consequences; leaving the unstable seam is a safe no-item refusal. Extraction is denied unless an owner projection reports a safe route. The work face has a projection-driven recovery state and the same physical route supports retreat and later return.
2. **South Orchard Ruin** — `poi_crown_south_orchard`, cell `[140,360]`. The sluice choice drives visible irrigation state; accepted water flow reveals the delayed graft-mark return interaction. Gathering remains low-risk in the fixture and is **not** a live A3 source grant. Honey and rare herb remain blocked.
3. **South Crown Mill** — `poi_crown_south_mill`, cell `[120,300]`. The stopped race is inspectable from the outer side. The outer gate requires `cap_salvage`; the inner maintenance gate requires both that capability and an owner-projected `mill_wheel=turning`. Repair/leave are exclusive choices at a reachable near-side workstation. Repair visibly turns the wheel, opens the inner physical gate and enables a separate state-gated fastener workstation. The entrance and outer inspection path remain safely retreatable.

All fixture costs, yields, source quantities, and cooldowns remain proposals. The current A3 item statuses are `SOH_PROPOSAL`; A3's inspected v3 binding file contains Waystation and Relay Shed rows, **no Quarry, Orchard, or Mill binding**. Generic `live_*` IDs with `poi_id: null` do not authorize these sites. Production must not grant those items or treat fixture pricing as approved.

## Current owner source snapshots

- A1 PR #20 head: `7fd000e1c017830a088749b965e651fafb501b98`; the read-only `A8_SITE_TRANSFORM_CONTRACT.md` supplies Quarry `[30,280]`, Orchard `[140,360]`, Mill `[120,300]`, four-tile radius, and exact 1:1 transform. A1 geography is unchanged by this patch.
- A3 PR #19 head: `c23292be095903c67e3d6e6e4fbd310b6649da12`; `data/survival/items/world_source_bindings.v3.json` is schema `soh.economy.world_source_bindings.v3`, status `A3_IMPLEMENTED_NATIVE_FIXTURE_PENDING_A0_MOUNT`. Its present rows bind only Waystation cache/deadfall and Waystation/Relay world actions; it does not authorize A8 sources, prices, rewards or timers. Its embedded A1 pin is older (`2951bf8559b2e289ce99fd4d394d44c46fdd91b1`), so this A8 audit uses the current A1 head separately.
- A0 PR #21 head: `122294f2237c1836d6f04561e090fe6aa6c6c0cf`, still draft/conflicting at last check. The Hero facing getter exists at this head; A0 remains sole owner of production mounting, actor/source/claim checks, transition persistence, SaveService commits and world identity.
- A6 PR #24 head: `bed3fc81ced4505eac6cfc3ddec5c07aeef8019e`. Integration target `feature/survival-rpg-foundation-20261029` was last observed at `86831332324428c7623ad431a577d101b7af5c9c`.
- Avatar policy remains D051/D054: male bald/unarmored Craftpix 555940 and female 419402 are the only fixed starting human identities; no avatar art or player implementation is added here. No new raw third-party art was committed. The inherited overworld prop atlas references resolve in the integration target tree; Cainos provenance remains documented in `assets/environment/cainos_demo/THIRD_PARTY.md` there.

## Scoped validation and evidence

**Completed independent/static checks on this source revision:**

- `python3 tools/survival/world_content/author_site.py --check` — all four site definitions and actual wrapper references resolve and match identity.
- `python3 -m unittest tests/survival/world_content/test_author_site.py` — 5 adversarial path/identity tests pass.
- Scoped `gdformat --check`, `gdlint`, JSON parsing, and `git diff --check` are required after final edits.

**Native status: `NOT_TESTED`.** No Godot executable is installed in the workspace. The latest queried Actions runs `41019182407` and `41019689728` were still `queued`; each `godot-native` job had `steps: []`. No scene execution, native physics result, interaction pass, visual capture, or inspected 1280×720 / 2560×1440 / 3840×2160 image exists. A clean formatter or validator is not native acceptance. Recheck live run status after code is pushed; if runners remain queued, keep `NOT_TESTED`.

The PR-only workflow now runs authoring and adversarial checks, imports native resources with Godot 4.7, runs the physical/interaction/transition suite, and captures the harness at all three requested resolutions. Captures must be visually inspected; file generation alone is not evidence.

## A0 production handoff boundary

A0 may mount only the three compact shell scenes at the exact A1 cells, then consume the typed local-worksite doorway requests. Before production, A0 must validate the actual Hero/source/current transition at commit time, persist the real global position through SaveService, derive the durable return anchor from A1, and supply the approved production owner adapter. A8's in-pilot transition host and `PoiAuthorityFixture` are not substitutes. A3 must separately authorize each item/source/action and balance; until then no fixture cost, extraction, gathering, or salvage reward becomes live. No A0/A1/A3/A4/A6/S6/A7 production paths are edited here.
