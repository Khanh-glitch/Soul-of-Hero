# SOH — independent gameplay composition / extensibility handoff

**Agent:** a new Gameplay Composition & Extensibility Architect; not LW1, A0, A1, A3, A6, A7 or GP-B.
**Branch:** `arena/896e13fc-soul-of-hero` (Arena-fixed; no other working branch created).
**Checkpoint A:** architecture audit, source inspection and implementation decision. **NOT DONE / NOT PRODUCT ACCEPTED.**

## 1. Exact baseline and authority

- Session initially checked out `5214788933b1a827f3a177d11ff486433dfe5e8a` (`main`, lyric-video ignore cleanup).
- Read-only fetched PR #31 head `fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1`, PR #34 head `05ff5a3df04c59abd964bf54bc705ff5618646bd`, the canonical document commit and work-order commit.
- The initial shallow clone hid ancestry. After deepening, Git verified `main` is an ancestor of PR #34. The clean session branch was fast-forwarded by `git reset --hard 05ff5a3d…` **on the same Arena branch**. No owner branch was changed, no merge commit created, no PR merged.
- `05ff5a3d` differs from the supplied green C08 code `c7b1866b79018b17344701e3f54f614479d9ca9c` only by the C08 handoff document. PR #34's current head remains `05ff5a3d`.
- PR #31 is OPEN/DRAFT, base `arena/dea2428e-soul-of-hero`. Its native composition, authored integration and physical-job-custody checks passed; its original-main comparison check failed. These are historical owner results, not this branch's acceptance.
- PR #34 is OPEN/DRAFT, base `integration/gameplay-gpb-a3-20261101`. C08 unit + native A/B/C/K8/relaunch/new-run passed at `c7b1866b`: https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41434002200 . Latest-head runtime import/captures passed; original-main comparison still failed. No C08 implementation is being replaced.
- Full work order read at `7a1c53acfc5b7cda6cb34ea3f348b4e100744354:docs/survival/tasks/NEW_AGENT_GAMEPLAY_COMPOSITION_EXTENSIBILITY_20261102.md`, blob SHA-256 `3f77c006a5046aea3de8d3c5e5c09d933e0df4877b7e6b6003f022fa70680f16`.
- Full canonical Bible read at `a8c718b55130cff29b3adc5e7c531f9211ca22df:docs/survival/CURRENT_PRODUCT_CONTRACT.md`, Git blob `803eb3a4cf4ba0d2c2b2b60520ad5b1a294e1769`, SHA-256 `ab02f994af371e7386e9403dff5cdb3673412cd99b0e250f13b2201077d1e8ac`. It is 229,339 bytes, 829 newline characters; the GitHub/file viewer presents 830 lines including the final empty line. This exact blob, not a line-count approximation, is the authority. The PR's short contract and donor's embedded Bible are not substitutes.
- Freedom Law, K1–K8, all J01–J20, Map §V, S0–S5 and the single C01–C24 registry were read. J are observations, not quest prerequisites. No C25, rule change, production balance change, A6 restyle, A8 design or Gold substitution is authorized here.

## 2. Existing authority / actual call graph

| Root | Existing source and real caller | Durable state / action | Causal coverage and boundary |
|---|---|---|---|
| K1 item | `game/autoload/save_service.gd`: `add_items_to_candidate`, `remove_items_from_candidate`, unique-token ownership; `economy_service.gd`: instances; `survival_service.gd`: container transfers | Definition in A3 data; instance/token, condition, owner/container in the ONE save candidate; atomic debit/grant/transfer | C03,C05,C07,C10,C17,C18,C23. No facade may mint inventory. |
| K2 world | `a1_authored_source.gd` → A1 production reader; `a0_world_authority.gd` → streamer/collision/spawn/sites; `chapter1_overworld.gd::_build_authored_world` | A1 owns 1024×768 geography, 64-cell chunks, 16px tiles; A0 mounts actual bodies | C01,C05,C08,C13,C14,C24. No replacement generator/map clock. |
| K3 source | `survival_resource_node.gd::interact` → `survival_service.gd::harvest[_with_tool]`; separately `economy_session.gd::harvest_authenticated_source` → pinned `a3_economy_service.gd::harvest` | Natural node hits/depletion in `survival.resource_nodes`; authenticated binding claims in A0 applied transactions | C01,C02,C11,C14. The two paths are not joined in the authored production world. |
| K4 work | `economy_session.gd::queue_recipe/collect/prepare_work_away` → `a0_economy_adapter.gd` → canonical `economy_service.gd`; `a0_economy_composition.gd` → `a0_offline_host.gd` | ONE queue, funded inputs/fuel, output escrow, run-local knowledge; real UTC only for explicitly prepared work | C02,C04,C06,C09,C12. Reuse, do not implement another queue. |
| K5 actor | shipped player scene/controller; `c08_trace_source.gd`, `c08_trace_follower.gd`, `skeleton_enemy.gd`; mounted by overworld | Real body pose, local sensing, explicit trace successor, run clock; bounded K8 trace ledger | C03,C05,C08,C09,C10. Preserve PR #34 bytes and behavior. |
| K6 building | `survival_build_system.gd::validate_cell/place` → `survival_service.gd::place_structure/resolve_station` → `survival_structure.gd` | Paid run-local structure, footprint, HP, collision, door/bed/chest/station; A0 candidate + receipt | C06,C07,C09,C10. A1 supplies terrain; A8 supplies POI geometry. |
| K7 freight | Existing inventory/container custody and actual traversal; A3 route projections are read models | No new vehicle authority in this assignment | C07,C13,C18. A cart/weather depth connection is deferred. |
| K8 time/save | `save_service.gd::transact_once`; `a0_run_lifecycle.gd`; `economy_session.gd` active clock; `a0_offline_host.gd` prepared settlement | One save snapshot, run identity/deadline, receipts, offline chronology and run reset | C06,C09,C17,C20–C23. No second ledger, wall-clock active time or offline monster damage invention. |

### Already data-driven — keep

- A3 item/recipe/station/research/source catalogs are loaded by `EconomyService.load_catalog` from `data/survival`; recipe enqueue, fuel escrow, maturity, collection and knowledge are generic.
- `SurvivalService` reads resource hits/yield/recovery and structure costs/footprints from `survival_catalog.json`.
- Build occupancy, room topology, station reach and structure restoration already use definitions and durable IDs.
- A1 resource placements come from the authored reader, not a new scatter algorithm.
- C08 already has typed trace identity, local physics sensing and persistence.

### Three concrete expansion blockers

1. **Missing physical-source join.** `chapter1_overworld.gd::_build_authored_survival` mounts A1 nodes, but never calls `EconomySession.bind_authored_source_host`. `SurvivalResourceNode.interact` calls the old harvest path directly. The 13-field A3 source receipt path has no authored-world production caller. `WaystationHost` is a separate, guarded annex candidate and is not a general natural-source host.
2. **Closed tool/material vocabulary.** `EconomyService.TOOL_USE_RESOURCE_KINDS` and `known_kinds` hardcode three item IDs and three resource kinds. Adding a supported tool variant otherwise requires changing canonical service code and its SaveService source pin. The map also has no typed, versioned capability declaration. This is distinct from legitimate typed handler code, which should remain.
3. **Fixed content discovery/build list.** `AUTHORED_SOURCE_KINDS` is a controller constant; `SurvivalBuildSystem.BUILD_SLOTS` is a fixed nine-entry list despite `piece_ids()` and catalog costs. The latter is a real content-discovery seam, not justification to rewrite building physics. A6 visual changes remain out of scope.

Other limits are recorded rather than disguised as PASS: natural-node recovery currently uses wall time; A3 binding claims use active time; offline settlement covers explicitly prepared jobs, not a complete ecological simulation; full S4/S5 and all C edges are not implemented by this assignment.

## 3. Three options and decision

| Option | Assessment | Decision |
|---|---|---|
| 1. Reuse catalogs/adapters unchanged | Queue/recipes/building already support variants, but cannot bind the real A1 natural node to the 13-field contract or discover a new tool capability without ID edits | Insufficient for the two actual blockers; reuse everywhere else |
| 2. Thin typed composition contract above existing owners | Versioned read-only definition/capability validation; one trusted live A1/A0 physical host; existing A0 transaction, A3 cost/queue and node state; QA overlays explicitly isolated from shipping data | **Chosen**, smallest change that can be falsified by the requested scenarios |
| 3. New entity/event framework / universal dispatcher | Duplicates K1–K8 ownership, creates migration and replay hazards, unsupported by the audit | Reject |

Seams and implementation state (checkpoint A was the audit-only boundary):

- A small typed capability resolver references canonical definitions, with the closed handler set `natural_hit`. JSON cannot supply scripts, arbitrary Callables, costs to A0, or authoritative coordinates. **A first implementation now exists in the working tree** at `game/survival/composition/capability_contract.gd`; parse/native status is unverified because no local Godot 4.7 is available.
- The three existing canonical tool definitions now declare `soh.item.capabilities.v1`; `EconomyService.plan_tool_use_candidate` resolves target kinds through the typed contract. The only legacy fallback is bounded to the three former IDs (`stone_pick`, `iron_pick`, `salvage_hammer`) for older fixture catalogs. Catalog load fails closed on malformed declarations. The existing planner still owns wear and the existing A0 transaction still owns yield/depletion.
- `survival_catalog.json` supports optional `required_capability`; bare-hand harvest refuses when one is declared, and tool harvest checks the exact capability ID via the resolver. No production resource currently opts in: legacy bare-hand routes in existing journey tests are preserved until a reviewed content decision.
- A live A1/A0 natural-source host deriving all 13 receipt fields from the mounted node, A1 reader, actual hero, run and existing clock is **not implemented**. In the pinned A1 plan, resource nodes expose `node_id`, `region_id`, `site_id`, `cell`, `material_key` and `required_capabilities`, but the inspected examples carry `status: CONTRACT_NOT_SPAWNED` and no binding identity/receipt owner/action or A8 authorization digest. The required reader file is also absent from the PR34 base and appears only in owner composition. Do not manufacture receipt fields; this remains the primary blocker for joining the natural-source path. A0 must recheck identity/geometry at the commit boundary. Existing node depletion and tool wear stay atomic; no static fixture receipt shortcut.
- Canonical capability declarations are in place; a QA-only additional item/recipe and two source instances using existing handlers are still pending. Any pinned A3/SaveService change must be a minimal visible diff with updated pins and **owner approval required**, never a silent hash relaxation. Pins for the current capability seam have been updated together in the working tree; none has yet been natively verified.
- QA content loaded only by an explicit test composition, never by the shipping catalog. Unknown/mismatched definitions fail closed. Existing saves keep their IDs; missing content cannot silently refill or grant.
- Read-only affordance/result projection for A6 remains deferred; no HUD redesign.

## 4. Prototype source reuse ledger — SOURCE_INSPECTED, not executed/accepted

Original archive fetched from Git blob `5a667c979a597d5d26e80453f7f16756db98f150`, 727,262 bytes. SHA-256 verified exactly: `fa95538271fd46a70f5737b58b8671124e091e8f6196479950a25dca741a2403`. Extracted and directly read all of `engine.ts`, `sim.ts`, `catalog.ts`, `world.ts`, `tests/soh.test.ts`, plus the supplied reuse analysis.

| Donor source | Useful hypothesis | SOH translation / rejection |
|---|---|---|
| `engine.ts:222–241`; `sim.ts:193–250` | Material-specific harvest power; one swing can hit actors and sources | Keep multi-capability principle; use actual Godot range/LOS, A1 identity, A3 cost and A0 atomic grant |
| `engine.ts:527–613` | Funded queue, fuel exhaustion, physical output, specimen research | Reuse existing A3/A0 queue; test completion, pause, 2PID and claim-once, not a second station engine |
| `sim.ts:135–190,211–229` | Load/surface/cart affect actual travel | Defer K7 depth until joined loop passes; no copied speed/weight balance |
| `sim.ts:77–135,466–580` | Weather, gardens, traces and chronological offline work | Defer environment depth; no blanket creature freeze or invented offline damage |
| `catalog.ts` | Multiple capabilities on one definition; source/recipe/structure separation | Learn schema shape only; canonical Godot data remains authority |
| `world.ts` | Stable geography, optional POI gates, distinct routes | Reject generator and 200×200 world; A1 reader remains production geography |
| `tests/soh.test.ts` | Depletion, wrong material, dual-use tool, loaded reclaim, fuel-limited offline, research custody | Adapt as negative/positive hypotheses; TS teleport/injected inventory/traces are not native evidence |
| `engine.ts:319–326`; `sim.ts:260–320` | Counterexamples: 400-intent dedup eviction; newer-nearby trace jumps | Reject; preserve durable A0 receipts and PR #34 strict successor/local sensing |

No browser engine, IndexedDB, donor map, art, boss, balance, AI or save implementation is ported. Additional four archives are not needed to justify the current seams; their manifest is recorded for later specific test gaps.

## 5. Proof plan and honest gates

- **Scenario 1:** two QA-only physical A1 source instances, same harvest capability/handler, different placements; real controller/input, range/LOS, depletion, wear, restart and remote/counterfeit rejection.
- **Scenario 2:** QA-only item + recipe through a real paid station and the existing funded queue; fuel-stop, offline return, physical collection exactly once.
- **Scenario 3:** second authored fixture layout through the same A1 reader/host and gameplay pipeline; invalid terrain/site/identity refused. No production Map replacement.
- **Joined loop:** normal AppRoot/New Game/avatar selection where feasible, actual movement, source→materials→paid home/storage/station→departure/alternative→prepared offline work→second PID→physical return/claim. Any blocked leg remains HOLD with owner and exact minimal seam.
- **Regression:** C08 source-byte guard and native gate; existing canonical composition/R13/physical-job tests; run reset and missing-definition/schema cases.
- **Visual:** native 1280×720 PNG and 640×360 pixel review, actually opened. Nonblack checks are not visual acceptance.
- Gate vocabulary: S0 design, S1 source, S2 isolated native, S3 same-build input, S4 human observation, S5 long-horizon/replay. Checkpoint A is **S1 / SOURCE_INSPECTED** only.

## 6. Runtime / checkpoint / next action

Godot is not preinstalled. The official GitHub release asset redirects to a host outside this sandbox's allowlist; the direct download failed with SSL_ERROR_SYSCALL. The API asset route also redirects. This is a runtime provisioning blocker, **not a native PASS**. Existing Godot 4.7 GitHub Actions are the authorized fallback; local installation will be retried only through an allowed distribution route.

Current working-tree checkpoint (uncommitted; no native compile): typed capability resolver + canonical tool declarations + catalog fail-closed validation + survival optional-capability gate + first native assertions are written. `a0_v5_source_pins.gd` and `SaveService` canonical service hash are updated in tandem. JSON parsing and `git diff --check` pass. This is still **S1 / SOURCE_INSPECTED**; no Godot parse, native PASS, source receipt, image review or owner approval is claimed. The only confirmed A1 natural-source behavior remains the existing unjoined route.

Next implementation order: (1) resolve A1's authoritative generic source-receipt contract with the A1/A0 owners—do not synthesize missing receipt identity; (2) finish or revert the typed seam after Godot 4.7 native parse and existing C08/R13/tool/offline regressions; (3) add isolated QA overlays and exercise two source definitions plus paid station/fuel/work-queue route; (4) second authored fixture region, then joined AppRoot/2PID gate; only then one depth connection. Do not start all three depth systems. Cross-authority owner review remains required.

```bash
git status --short --branch
git rev-parse HEAD
gh pr list --head arena/896e13fc-soul-of-hero --state all
gh run list --branch arena/896e13fc-soul-of-hero --limit 10
# Continue with the smallest source/capability seam, then run the native gate.
```

Owner review required before acceptance: A0 (receipt/clock/reset), A1 (source identity/geometry), A3 (catalog/capability/cost and any pin diff), A7 (independent gates), A6 (readability only). No owner approval is implied by this document.
