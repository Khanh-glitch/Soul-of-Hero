# A6 V3 — sustained product acceptance

Date: 2026-10-29. Source checkpoint: A6 reviewed V2 `81a0b3da476495348c8ee06ba939b7c82611cd32`. This document is the current A6 UX acceptance ledger; older V1/V2 notes below remain historical evidence, not current acceptance.

## Decision and scope

**A6 remains isolated. Production mount: HOLD. Product/gameplay acceptance: NOT CLAIMED.** A6 supplies read-only UI projections, fixture scenarios, and A0/A1/A3 handoff regressions only. It does not create a SurvivalService, mutate the world, save state, grant items, operate a Core, complete a recipe, respawn the hero, or simulate Gold effects. A fixture transition or a green A6 CI result is not live integration or a human playtest.

Allowed A6 edits remain confined to `game/survival/ui/`, `tests/survival/ui/`, `docs/survival/ux/`, and this A6-scoped workflow. No A0 Knight/overworld/SaveService, A1 world, A3 economy, A4 Gold, S6, or global render settings were changed. CI composes the A6-owned overlay over an exact A0 checkout in a throwaway directory. A1/A3 files are copied as isolated read-only acceptance inputs, not as production assets or autoloads.

## Pinned owner sources

Pins used by the V3 source fixture and dedicated workflow; refresh the live PR heads before changing these constants:

| Owner | PR | pinned source | What the pin proves / does not prove |
|---|---:|---|---|
| A0 | #21, Draft | `aaee29339aca7e953af1b96d5bcc06b0fb7527bc` | Current source-complete project, `SurvivalService`, paid bed/death/respawn implementation, and partial visible-modal gate. It is not an all-gameplay-input gate. |
| A1 | #20 | `2cb1a3c5f093724eb9fecbdf45909ccb611f7b32` | Authored POI/route/material/hazard records. `AUTHORED_PLAN_NOT_NATIVE_INTEGRATED` and `CONTRACT_NOT_SPAWNED` stay visible. |
| A3 | #19 | `18e7afcbd576bbd9bfbcc509b2ee13216186a522` | Economy item/recipe/research/station contracts and a separate native adapter implementation. A6 CI copies catalogs plus `economy_service.gd` as an isolated text-audit input; it does not mount or instantiate A3 service code. |
| A4 | — | source attestation not independently verified in this work | Core skills remain `BLOCKED_PENDING_A4`; original Gold fidelity/readiness is unverified. |

Immutable research input remains the Atlas at source-evidence commit `1ee7e43da22adb4b9ce1647efbcb1b07988ceaf7`, content SHA `b958de0fc413cc200b35b0938760228c2ebd3a8ef4aa2f52c1051c52cca59157` (1,355 lines; trace schema `soh.source_coverage.v2`, 44 systems, 21 POI templates, 31 dependency chains, 12 journeys, 40 unknown original facts and 28 cited sources). The workflow checks out this immutable evidence and the read-only audit verifies content hash, ranges and verbatim citations. Historical/mode distinctions are preserved; the 2019–2020 Atlas is behavioral evidence, not a merged balance sheet or proof that every later system was present in the same build.

## Product acceptance lens

Keep D003–D007, D021, D030, D032–D034, CT03–CT12, ACCEPT-REPLAY and ATLAS-IMPL visible in future review. Preserve the coupled loop of authored geography, runtime discovery, physical resources/items, learned knowledge, shelter/production, hazards and route choice, finite-use Core identity, combat, death/recovery, save persistence and replay. A permanent home is not an expedition; a finite physical specimen is not a permanent learned formula; an authored map record is not a player discovery. Meaningful preparation, retreat, scarcity and recovery remain player choices, not decorative labels. No UI-only milestone can pass the integrated gameplay gate.

## Journey A — new survivor (fixture-labeled presentation)

1. Show the A0 `scrap_pile` → `iron_scrap` and `oak_tree` → `oak_wood` catalog mappings. The fixture does not claim the player found or harvested either node; A0 catalog yield/restock numbers are provisional balance.
2. Show A0 `bed_wood` cost (4 `oak_wood`, 1 `iron_scrap`) against an explicitly fictional satchel (3 / 0), including the exact shortfall. No auto-craft, free payment or placement occurs.
3. Explain the native A0 bed checks: placed bed identity, enclosed room, clear wake cell and safe exit; `activate_bed` rechecks and commits through SaveService. The screen’s “valid bed” is `FIXTURE_VALIDATED_ONLY`; A6 did not place/pay/activate it.
4. Display A0-owned `pending_death`, `spawn_anchor`, `death_bags` and host-response boundaries. A0 death code moves ordinary stack records to a durable bag once; current code retains `soh_i_*` unique instances pending A3 ownership. Respawn must resolve first; bag recovery is all-or-none, and capacity failure leaves the bag intact. A6 invokes no respawn/recovery.

Negative cases: missing materials remain missing; an undiscovered resource clue is not sent as truth; no safe bed/host response stays unknown; a pending death cannot be recovered as though respawn completed; a full inventory does not silently delete a bag.

## Journey B — rare physical Core (fixture-labeled presentation)

1. Show one schema-shaped A3 `core_ember` instance with stable `instance_id`, `item_id`, location, revision/origin, integer condition and finite uses. Sample values are fixture only (5/8 uses, 61/100 condition). A4 readiness comes from the A3 item catalog and remains `BLOCKED_PENDING_A4`; no cast/equip is offered.
2. Preview three consequences without changing the token: use finite charges (only after A4 owner attestation/commit), store the same identity, or select a specimen-research path.
3. Before the destructive research path, require a clear confirmation preview. A3's `research_recipe(..., "specimen", ..., instance_id)` reserves the exact instance and 5 `knowledge_spares` at a Tier-1 research station. A3 native fixture code marks the specimen `consumed_by_research` only when the research job completes and learns recipe knowledge; recipe knowledge and the physical token are distinct. A6 does not submit this transaction, claim a completion or update either state.
4. Show the separate post-research `craft_core_ember` requirements: `charged_blank`, `binding_cloth`, `soul_ember`, `reaper_essence`; a Tier-2 workbench, `tech_core_binding`, and the catalog’s 30 active ticks. The production path remains disabled because the composed project has no A3 economy service, certified station snapshot, or A0 active-tick host. `SOH_PROPOSAL` is shown as such. The A3 station catalog declares placement `A0`-owned; no queue is fabricated.

Negative cases: bad/stale IDs, missing instance/formula, wrong specimen family, empty queue/service, missing station/tier, full inventory, duplicate/stale requests and failed commits all remain owner failures, not optimistic UI state. The workflow separately runs pinned A3 `economy_adapter_test.gd`, which exercises exact/stale instance and attestation tokens, duplicate IDs, full inventory, missing/wrong station, queue rejection and failed commits against its real SaveService adapter with explicit native fixtures. These are owner-native tests, not a claim of A3 mounted in the composed A0+A6 product. A3’s current unique-token and active-time implementation remains partially blocked on A0 SaveService guard and host integration. The UI never treats `knowledge: recipe` as proof of a learned formula.

## Journey C — first expedition (fixture-labeled presentation)

1. Use A1 `rt_crown_safe_approach` from Refuge to Crown East: foot/trunk, `risk: low`, no capability requirement. Show the optional `rt_east_seam` alternative with A1 `risk: high`, `cap_filter` requirement; do not invent damage probability or hazard severity.
2. Reveal only fixture-discovered A1 Waystation and Relay clues: the lantern/painted green seal; the dead lamp/copper cable trench. Both authored `safe_court` stages describe a retreat and no hazard exposure. A1 POI readiness remains `INTERACTION_SPEC_AUTHORED_NOT_NATIVE`, status `AUTHORED_PLAN_NOT_NATIVE_INTEGRATED`. The separate hidden-relay fixture proves the clue, material, hazard and capability fields are withheld when discovery is false.
3. A1 shows Relay interaction gated by `cap_salvage`; this is an authored capability, not a live grant. No known hazard IDs in the scenario means no hazard is disclosed, not “the world is hazard-free.” A1 material nodes currently include `CONTRACT_NOT_SPAWNED`; no salvage or loot is granted.
4. Return, discovery progression, capability state and route completion await A0/A1 runtime owners. No travel, POI interaction, loot, progression or human expedition is simulated.

## Versioned DTO boundaries

These are A6 UI proposals and explicit test-fixture envelopes, not approved production APIs.

### Fixture envelope

`soh.ui.journey.fixture.v1` carries `fixture_label`, `source_refs`, and read-only `a0`, `a1`, `a3` projections. The test fixture loads A0’s real `data/survival/survival_catalog.json` plus A1’s real route/material/hazard JSON and A3’s real item/recipe/research/station JSON from the pinned workflow checkouts. Only the following scenario values are invented and labeled fixture: current inventory counts, bed activation, `pending_death`/death bag example, Core instance values, learned-formula bool, queue, and discovery booleans. Each DTO row preserves its owner’s source IDs and statuses. Unknown versions or unpinned sources fail closed.

### A0 read-only projection proposal

```json
{
  "contract": "soh.ui.a0_survival_projection.v1",
  "revision": "opaque-owner-revision",
  "resources": [{"node_id":"scrap_pile@x,y","resource_kind":"scrap_pile","revealed":true,"item_id":"iron_scrap","status":"owner-supplied"}],
  "bed": {"entity_id":"owner-id-or-empty","piece_id":"bed_wood","cost":{"oak_wood":4,"iron_scrap":1},"placement_reason":"owner-code","spawn_anchor":"owner-id-or-empty"},
  "recovery": {"pending_death":"owner-id-or-empty","death_bags":[],"respawn_status":"unknown|ready|rejected|committed","recovery_status":"unknown|available|capacity_rejected|committed"}
}
```

A0 derives discovery, placement, room/safe-wake validation, payment receipt, death-bag records, respawn and recovery status from its existing world/SaveService owners. It must not accept UI booleans as authorization. An A6 proposal is not evidence that A0 approved this field set.

### A1 read-only projection proposal

```json
{
  "contract": "soh.ui.a1_discovery_projection.v1",
  "revision": "owner-world-revision",
  "places": [{"poi_id":"poi_crown_waystation","discovered":true,"cell":[408,200],"content_readiness":"INTERACTION_SPEC_AUTHORED_NOT_NATIVE","status":"AUTHORED_PLAN_NOT_NATIVE_INTEGRATED"}],
  "routes": [{"route_id":"rt_crown_safe_approach","risk":"low","required_capabilities":[]}],
  "hazards": []
}
```

A1 supplies authored static records; A0 supplies live discovered/route state and disclosure. The producer must omit undiscovered identities/clues/hazards/materials entirely. `hazards: []` is only the known/disclosed set. A1 authors no native damage or mitigation result.

### A3 read-only projection proposal

```json
{
  "contract": "soh.ui.a3_economy_projection.v1",
  "revision": "owner-economy-revision",
  "instances": [{"instance_id":"soh_i_000000000011_a1c0ffee","item_id":"core_ember","location":"satchel","condition":61,"max_condition":100,"uses":5,"max_uses":8,"revision":3,"origin":"owner-source"}],
  "knowledge": {"recipe_id":"craft_core_ember","learned":false,"scope":"permanent_profile"},
  "jobs": [],
  "station": {"station_id":"owner-placed-id","kind":"workbench","tier":2,"operational":false,"queue_capacity":0,"station_revision":"owner-revision"},
  "actions": {"can_equip":false,"can_research":false,"can_craft":false,"blocked_reason":"owner-code"}
}
```

Core instance identity comes from A3 schema-2 `instances`; the optional `learned`/action fields are producer projections, not A3 item columns. Station/power/condition/removal and active-tick time are A0-owned. A3 transaction receipts, recipe knowledge, unique-instance ownership and queue status must come from A3’s real service. A6 does not infer or approve the projection.

## A0 modal-input handoff: blocking integration requirement

At the pinned A0 source, `chapter1_overworld.gd` checks visible `gameplay_modal` roots before its build-toggle/slot/place polling and prevents its Escape retreat path from running through a visible modal. This is partial. `game/characters/knight/knight.gd` directly polls movement, crouch, interaction, attack, skill, relay and other controls in `_physics_process` and action helpers without consulting the modal group. A visible A6 modal can therefore coexist with polled Knight input. Do not hide this finding, mount production UI, or claim build/combat safety.

A6-owned executable regression: `tests/survival/ui/a0_modal_gameplay_input_regression.gd`. Run it against the pinned A0 composition:

```sh
godot --headless --path . --script res://tests/survival/ui/a0_modal_gameplay_input_regression.gd
```

The script instantiates the real Chapter 1 overworld and Knight; checks nested modal discovery, hidden-parent clearing, visibility restoration and tree-exit cleanup against A0's modal registry; then holds movement, light attack, skill and build-toggle together across physics frames, sends a real pointer click at the modal, and checks held movement across close/release. The pinned A0 result is expected to report `A0_MODAL_INPUT_GATE_LEAK` (movement/combat leaks) and nonzero status; the A6 workflow recognizes and records this expected blocker rather than masking it as a passing safety test. A lifecycle/setup error is not an accepted expected failure. A probe setup/parse error is not an accepted expected failure.

**Exact A0 gate requirement:** all polled gameplay input paths—not just Chapter 1 construction and Escape—must consult one A0-owned, frame-coherent modal input gate before consuming movement, attack/skill/relay/interact, pointer, build, retreat/pause and controller actions. Capture press-and-release state at the gate; a press begun under a modal remains suppressed until its matching release even if the modal closes first. No click-through, stale just-pressed action, or held input may be promoted after close. The combined A0 native test must exercise visible, nested, hidden-parent and tree-exit modals; keyboard, mouse and controller; simultaneous build/movement/attack/skill/relay; Escape/pause; press-through, release-after-close and outside click; and verify no action, placement, cost debit, retreat or combat. Only after that test passes may A0 and A6 discuss a production mount. A6 must not edit Knight or substitute an adapter for the gate.

## Native and visual validation

A dedicated `.github/workflows/a6-v3-product-acceptance.yml` composes pinned A0 + A6 source, imports with Godot 4.7, audits the actual Atlas/coverage archive, runs the four required legacy A6 suites plus the new three-journey suite, runs A3's pinned owner-native economy adapter suite in its own checkout (not mounted into A0+A6), and records A0 bed/death and modal-input results. Captures are limited to eight PNGs: Satchel, four journey examples (cost shortfall, specimen confirmation, known clues, and safe-vs-shortcut risk) and Core detail at 1280×720; Core detail also at 2560×1440 and 3840×2160. The 2K/4K captures check integer multiples of the 640×360 logical layout; they do not prove real monitor legibility, non-integer scaling, color accessibility, weather/Gold contrast or human input comfort. Exact run ID, per-suite counts and visual critique are added below after CI completes and the actual images have been inspected.

### Current evidence ledger

| Gate | Result |
|---|---|
| Local Godot 4.7 | Not installed; official binary download was previously blocked by restricted asset-host connectivity. |
| Atlas/coverage audit | Passed locally in a temporary project tree using the pinned authentic evidence commit; hash, 1,355 lines, 108 entries, 40 unknowns, 28 citations and verbatim source ranges matched. CI repeats this from an immutable checkout. |
| GDScript/YAML tooling | Edited scripts parsed with gdtoolkit; workflow YAML parsed with PyYAML. These checks do not replace Godot 4.7 import/tests. |
| Native A6 composed CI | Pending V3 workflow run. |
| Pinned A3 owner-native adapter test | Pending V3 workflow run; runs in the exact A3 checkout and remains a separate owner test, not combined A0/A6 production integration. |
| Actual PNG capture/inspection | Pending V3 workflow run; no screenshot claim before review. |
| A0 modal/gameplay safety | **BLOCKED** pending the executable native probe and A0 all-input gate. |
| A1 world integration/discovery | Authored contract only; runtime spawn/discovery/hazard damage not proven. |
| A3 production/unique-item authority | Source code/catalog exist in PR #19; A0 guard/active-time integration remains pending; not mounted by A6. |
| A4 original Gold readiness | **UNVERIFIED / BLOCKED_PENDING_A4**. |
| Human gameplay or Web playtest | Not performed. |
| Production UI mounting | **HOLD**. |

After CI, replace pending entries only with the actual run URL/ID and inspected evidence. Keep generated captures under ignored `.artifacts/`, at or below 12 PNGs, and out of Git.
