# A6 V4 — player-first HUD, inventory and first-Core UX

**Status:** `IMPLEMENTATION_IN_PROGRESS` until the pinned native V4 workflow passes and its rendered frames are inspected. This work extends the existing A6 V3 UI on the existing A6 branch; it is not a new game/demo scene. **No production UI is mounted and no human test or approval is claimed.** PR #24 remains Draft/Open; do not merge.

**Dispatch source:** `docs/survival/tasks/A6_V4_PLAYER_FIRST_HUD_INVENTORY_CORE_UX_HANDOFF_20261030.md`, recovered from integration ref `feature/survival-rpg-foundation-20261029` at `303f39e7b824c807984ac87e7deb4947c25b2761`. The A6-owned files in this work remain limited to `game/survival/ui/**`, `tests/survival/ui/**`, `docs/survival/ux/**`, and the A6 workflow.

## Design target

Make the early survival loop legible and enjoyable without promoting combat as the only kind of progress. The first modest physical Skill Core should feel like a real new possibility because the player owns one particular object—not because of rarity fireworks, a damage promise, an automatic equip, or a forced cast. The UI distinguishes the exact Core instance, condition, finite charges, custody, loadout, recipe knowledge and A4 readiness. It never chooses or implies a new Core-use policy.

A0 already owns a compact overworld HUD for region, provisions, world counters, prompt, death and respawn. V4 adds only a passive right-side context/Core extension: it does not redraw region, provisions or counters, does not contain an interactive HUD button, and has no `_input`, `_unhandled_input`, `_process`, or gameplay polling. Context and feedback render only from explicit versioned owner projections; fixture data is visibly marked.

## Exact source pins and evidence

| Owner / evidence | Exact ref used | Relevant source |
|---|---|---|
| A0 current PR #21 | `b2c37d35f47ef870fcbafafbc7f49e3d2730cd17` | Existing overworld HUD, `ChestInventoryPanel`, `SurvivalService`, `SaveService`, gameplay input gate, Knight and native tests |
| A1 current PR #20 | `2951bf8559b2e289ce99fd4d394d44c46fdd91b1` | Authored POI / material / hazard / capability records; discovery remains an A0 runtime fact |
| A3 current PR #19 | `18e7afcbd576bbd9bfbcc509b2ee13216186a522` | Item instances, item catalog, recipes, research and station contracts |
| Original Atlas + coverage trace | `1ee7e43da22adb4b9ce1647efbcb1b07988ceaf7` | Immutable research evidence used by the V3 trace audit |
| Binding `ACCEPTANCE.md` | From A0 ref above | Full playable, save/reload, death, Core, replay and native-visual gates remain broader than this UI task |

The V4 workflow independently checks exact refs and selected content hashes. Original Atlas SHA256 remains `b958de0fc413cc200b35b0938760228c2ebd3a8ef4aa2f52c1051c52cca59157`; binding acceptance SHA256 is `b9afd6c22e47c1427346b2c8753e85b34ee5012d15e48934656189dd21ac7476`. The Atlas describes research and design implications, not a tested SOH build or commercial-game code/asset source. Its motivating guidance includes resource economics, route choices, preserving secrets, and separating physical Core ownership from learned recipe knowledge; it explicitly labels proposed SOH journeys as design tests.

## V3 / A0 comparison and reuse

| Surface | What is already useful | What V4 keeps / changes |
|---|---|---|
| A0 `game/survival/chest_inventory_panel.gd` | Actual in-world chest context; checks chest identity and reach on open, revalidates range/alive context before transfer; separate Bag and Chest rows; explicit amount; calls A0 `transfer_to_container` / `transfer_from_container`; protected unique IDs are disabled. The A0 service applies each transfer in the real SaveService transaction with stack/slot limits and a receipt. | Keep A0 as the sole live transfer authority and current production surface. Do not replace or edit it here. The return value is a bool and the panel's copy is intentionally broad (`Cannot transfer: check amount or available space.`); UI must not invent a more specific failure reason than the owner reports. Current 440×310 panel has one shared 1–50 SpinBox and ID-derived names; it does not explain A3 identity/condition/charges or per-row available maximum. |
| A6 V3 `survival_journal` / `expedition_planner` | Stronger item inspection, the 640×360 logical pixel-fantasy visual system, scrollable details, exact displayed quantities, search, discovered-place/hazard/capability cards, recovery, recipe requirements, specimen confirmation, and request/snapshot correlation. | Retain the V3 scenes, planner, read-only source adapter and acceptance journeys as the same A6 UI. Fix exact A0 item identity in transfer requests: a UI `stack_key` such as `oak_wood#1` remains display identity, while A0 receives canonical `item_id` `oak_wood`. Protected A3 `soh_i_…` rows receive no generic quantity control. |
| A6 V4 player HUD | New passive HUD extension: small status/provenance card, optional owner-supplied needs/danger/pack state, confirmed transaction feedback, and a distinct physical-Core ownership card. | No gameplay polling, click target, equip/cast control, predicted readiness, rarity animation or duplicated provisions HUD. Item gain/transfer feedback appears only for an owner-confirmed commit; a rejected transfer remains an owner-provided error. The only Core actions remain the A3/A4 owners' eventual commands, not this card. |

A6 `survival_view_adapter.gd` reads A0 totals/definitions and creates a presentation projection only. It associates an A3 instance token with an A3 instance/catalog record only when the host supplies that explicit record. An `soh_i_…` physical identity stays visible and protected; A3 `storage: instance` / `kind: skill_core` entries are never converted to a stack. Storage projection always has `transfer_enabled=false` and context validation marked `A0 host required`.

`a0_storage_command_adapter.gd` is intentionally a **shape validator/normalizer only**. It does not call A0 services or authorize a mutation. It carries a request ID, canonical item ID, direction, container ID and exact whole amount to an A0-owned host. The A0 owner must still verify the actual open chest, reach, alive state, current amounts/capacity and idempotency, then commit once through SaveService. The direct `SurvivalService` transfer methods do not themselves encode the panel's full reach/death context. Do not wire A6 intents straight to those methods or trust `transfer_enabled` as authority.

The current A0 panel generates its own session/serial transaction key. It does not currently accept the A6 request ID as a dedupe key. Before production wiring, A0 must either expose one context-gated transfer command that accepts and deduplicates the owner request ID or keep its existing panel as the only live panel and route presentation through an owner-approved design seam. Replaying an A6 intent as a new A0 button press is **not** an approved retry strategy. A6 must not add a second receipt/inventory manager.

## Source-of-truth mapping

| User-facing question / UI data | Owner and current contract | A6 behavior / truth boundary |
|---|---|---|
| What did I gather? How much? | A0 `SaveService.inventory_totals`, A0 harvest/loot commit and post-commit state; current A0 OverworldHud also owns region/provisions/prompt/counters. | Read exact committed totals/receipt. No uncommitted prediction or fake positive toast. A fixture capture says `PREVIEW · FIXTURE PROJECTION`. |
| Can I store a material, in what quantity? | A0 `ChestInventoryPanel` context; `SurvivalService.container_contents`, `inventory_totals`, `is_sweepable_item`, `transfer_to_container` / `transfer_from_container`; SaveService atomic receipt, slot and stack caps. | Exact selected amount and canonical item ID are requests. A0 rechecks every condition. A0 bool-only failure stays a generic owner rejection until A0 exposes reason codes. |
| Can I safely store a Core? | A3 `instance_id`/`item_id`/location/revision/condition/uses and A0's protected token custody guard. | Never generic chest-transfer a unique `soh_i_…` token. Display “unique / protected” and exact identity. No claim that A0 chest supports generic unique storage. |
| What did the Core cost me / how many uses remain / where is it? | A3 instance record; A0 loadout/custody projection; A4 owns runtime readiness. | Physical state, equipment, exact finite charges and condition are separate labels. Missing values stay unknown. Equipped + charges remaining is not “ready.” |
| How do I learn/replicate it? | A3 recipe/research service and `permanent_profile` knowledge. A3's catalog is an authored proposal until approved/implemented. | Display exact owner recipe inputs, station/tier and learned knowledge separately from specimen possession. Specimen sacrifice preview names the exact item; no local A6 mutation. |
| What is my current survival/risk/recovery state? | A0 owns provisions, actual health/stamina, hazard damage, death bag, bed/anchor, respawn, recovery and error. A1 hazard/capability plans are authored static data. | A0's existing provisions panel remains; optional A0 status rows only appear if supplied. Recovery/respawn stays unknown unless A0 says available/committed. A1 authored clues never become live danger damage or loot. |
| What can I pursue next? | A1 authored POI/material/capability routes; A0 discovery and live route state; A3 item/recipe requirements. | Only A0-disclosed POIs/materials are shown as discovered. Labels keep `AUTHORED_PLAN_NOT_NATIVE_INTEGRATED` distinct from runtime and hide undiscovered identities. No reward/capability is promised from static authoring alone. |

### A3 Core example at the pinned catalog

`core_ember` is `kind=skill_core`, `storage=instance`, `max_uses=8`, `max_condition=100`, `skill_readiness=BLOCKED_PENDING_A4`, `acquisition_status=PROPOSED_WORLD`, and `balance_status=SOH_PROPOSAL`. This is **not** a verified live drop or cast-ready skill.

The pinned `craft_core_ember` record lists `binding_cloth ×1`, `charged_blank ×1`, `reaper_essence ×1`, `soul_ember ×1`, Workbench tier 2, 30 active ticks, recipe knowledge and `tech_core_binding`; that technology is `permanent_profile` and remains a SOH proposal. `rebuild_core_ember` lists `consumes_specimen=core_ember` and `core_blank ×1`, `knowledge_spares ×2`, `soul_ember ×1`. A3's actual transaction/research implementation—not A6 copy—must confirm precise instance consumption and persisted learning. No new Core-use policy is selected here.

### A1 authored examples at the pinned source

`poi_crown_waystation` and `poi_crown_relay_shed` both state `native_playable=false` and `INTERACTION_SPEC_AUTHORED_NOT_NATIVE`. The Waystation models the `cap_salvage`/locker/ledger learning path and identifies one-time versus cooldown policy in its authored contract. The Relay models the hand-crank local-power bypass and keeps a later copper upgrade gap explicit. A6 may present those as **authored goals/clues** only after A0 supplies discovered visibility. The current source does not authorize A6 to grant them or promise live rewards.

## Implementation and test plan

- `player_first_hud.gd`: safe-schema acceptance, allowlisted provenance, bounded needs rows, unknown danger omission, explicit pack-full state, Core custody/condition/charge/readiness separation, committed-only feedback; no `Input` polls or interactive controls.
- `survival_view_adapter.gd`: exact storage rows, A3 instance-token identity/protected state, canonical item IDs, separate Core physical-state wording and no local transfer authorization.
- `a0_storage_command_adapter.gd`: request shape validation only; rejects unique tokens, stack keys, mismatched IDs, unsupported direction and non-positive/non-integer amounts.
- `expedition_planner.gd` / `survival_journal.gd`: preserve V3 surface; transfer requests distinguish canonical item ID from display stack key; unique Core has no generic amount control; Core status keeps custody/loadout/readiness distinct.
- `player_first_hud_test.gd`: bad schema/provenance, malformed unknown fields, full bag, fixture labels, pending-not-committed, no automatic Core action, unknown readiness and A3 token projection.
- `v4_storage_owner_integration_test.gd`: boots the pinned A0 overworld and creates a real A0 chest in an isolated save; A6 normalizes but never mutates; the test host drives the current A0 `ChestInventoryPanel` buttons. Positive exact deposit/withdraw and authoritative refresh; protected token, malformed request, overdraw, 12-slot chest overflow, full-bag withdraw refusal and out-of-range open are negative cases. These are automated native tests, not human gestures or normal-user journey proof.
- `v4_owner_source_audit.py`: exact ref/content hash and schema assertions for A0 panel/service/gate/HUD, A1 authored POIs, A3 Core/recipe/research, binding acceptance and Atlas archive.
- `v4_hud_native_capture.gd`: rendered on the current A0 overworld underlay at native 1280×720, 2560×1440 and 3840×2160. HUD content is fixture projection, explicitly labeled; world scene is the pinned A0 scene. Rectangle checks catch overlap with A0's plate and A6 Core/status cards. No production scene file is edited.

The screenshots establish native rendering and dimensions, not physical-monitor readability, human scan speed, localization, color accessibility, real combat-VFX clutter, weather, zoom behavior, Web, hardware-controller feel or human approval. They show the A0 overworld with fixture HUD data—not original Gold casts, both selected Adventurer avatars, tactical terrain, or the full world-exploration loop. Those broader native scenes need separate A4/A0 composition evidence. Do not mark any of these as passed without representative captures and human playtesting.

## A0 integration handoff (next owner action, not done here)

1. Keep A0's `OverworldHud` region/provisions/counters/prompt/death UI as the existing baseline. Consider mounting the passive A6 context/Core view in the cleared top-right only after the A0 host assigns actual owner projections; do not pass fixture DTOs.
2. Keep A0's `ChestInventoryPanel` as the only production transfer surface until A0 approves a context-gated, request-ID-aware transfer API. Connect A6 snapshots to A0's `inventory_totals`, `container_contents`, item definitions and A3 instance list; actual A0 still validates reach/alive/capacity and commits once.
3. Add explicit A0 result reasons (`out_of_range`, `dead`, `missing_item`, `insufficient_quantity`, `chest_full`, `bag_full`, `protected_unique`, `already_committed`) only if A0 chooses to expose them; until then show its bool-backed generic rejection, then refresh both authoritative sides.
4. Supply A3 `instances`, item/recipe schemas, station state, permanent learned recipe, exact research specimen and an idempotent transaction receipt. Supply A4 readiness separately; never copy `skill_readiness` into a cast-ready state.
5. Supply A0 player needs/provisions/death-bag/respawn/route/danger projections and A1-authored/A0-discovered POI fields separately. Strip undiscovered A1 records before they reach A6.
6. Compose the real scene and run the A0 combined modal/input suite with the exact production mount. The current A0 gate/composition is tested, but this V4 HUD is not production-mounted; run owner approval and human play before saying the combined shipping UI is safe or approved.

## Current independent gates and non-claims

The owner refs were refreshed on 2026-10-30 after A0/A1 advanced. Current A0 PR #21 is `b2c37d35f47ef870fcbafafbc7f49e3d2730cd17`; its chest-panel, SurvivalService, input-gate and acceptance hashes match the reviewed A0 source contracts, but **all checks on this newer head were still pending at the last query** (including `composed-native`, native runtime, and rendered captures). A prior A0 head `b6a3286c602a2be450959fbf052169deee6b7e8f` had `composed-native` and `SURVIVAL NATIVE RUNTIME` pass, but that result is not evidence for the current head. Do not carry it forward as a current green gate. Current A1 PR #20 is `2951bf8559b2e289ce99fd4d394d44c46fdd91b1`; its pinned Waystation/Relay data hashes remain unchanged, and the authoring/schema, isolated-reader and connector-fixture checks passed in run `40999842066`, while `validate-handoff` and the original-main baseline comparison failed in that A1 run. A1 connector fixture is not production gameplay. These owner states are separate from A6 V4, and V3 remains the historical baseline.

The current A6 work does **not** claim: production mount, A0-approved V4 interface, real-time loot feedback wiring, human-tested readability/usability, live Core acquisition, cast readiness, Core-use policy, A3-approved balance/material requirements, A1 POI discovery/reward execution, full game acceptance, 14-day replay quality or Web playability. V3 evidence remains at [V3_SUSTAINED_PRODUCT_ACCEPTANCE.md](V3_SUSTAINED_PRODUCT_ACCEPTANCE.md); V4 native results and any selected frames are appended here only after the pinned workflow is complete and inspected.
