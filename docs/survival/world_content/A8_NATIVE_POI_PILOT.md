# A8 native world-content pilot — source, native, visual, and production status

**Scope:** A8-owned scenes/scripts/data/tests for the existing South Quarry, South Orchard Ruin, and South Crown Mill. This closeout remains on PR #26. No new PR, merge, POI expansion, or production claim.

## Player-facing intent

The intended loop is physical approach → inspect/choose in the local worksite → see an owner-projected route/site-state change → retreat → return and observe persistence.

- **Quarry:** two real preparation branches, east brace or west chock, plus a safe leave-unworked choice. East path is 286 px; west is 390 px (104 px / 6.5 tiles). Only the selected owner-projected blocker changes and the opposite stays closed. A visible seam warning hides after a committed brace/chock. Route distance is physical geometry, not proof of a meaningful strategic difference, danger, damage, reward, or economic value.
- **Orchard:** clear irrigation or leave the channel blocked. Owner-projected flow removes the deadfall cue; delayed graft marks are a return hook. No honey/herb grant is authorized.
- **Mill:** inspect the stopped race, repair or leave the wheel seized, then retreat/return. The seized-race cue is visible at baseline; only owner-projected state changes it. No fastener grant is authorized.

Each site retains its separate 128×128 exterior shell and 960×608 local interior, original authored paths, collision blockers, doorway/exit geometry, and canonical A1 identity/cell. A0 owns production mounting, reachability, actor relocation, transitions, persistence, and SaveService. A8 local scene tests are not A0 gameplay evidence.

## Intent and authority boundary

The default nonfixture `NativePoiSite` now emits only neutral `soh.native_poi.intent.v2` identity/revision fields: contract ID/version, intent ID, source ID, object ID, action ID, claim ID, and observed projection revision. It does not send costs, rewards, cooldowns, claim policy, state deltas, unlocks, `catalog_source`, A3 approval references, client fixture flags, or receipts. The v1 authority-bearing contract is retired and points to v2.

All fake economics/readiness values are isolated under `tests/fixtures/survival/world_content/a8_native_poi_action_catalog.fixture.json`; the Godot test authority is guarded as fixture-only and cannot serve as A0, A3, SaveService, or a live receipt. A0 must resolve canonical A1 state plus an exact A3-approved binding and independently commit any authorized costs, rewards, generation, active cooldown, site state, and durable owner receipt. Missing approval is fail-closed.

The real GDScript contract test now exercises the default scene's exact neutral field set and adversarial rejection for forged `provisional_test_only`, forged `catalog_source`, extra cost fields, stale/foreign projection, no approval, interrupted receipt, and replay after serialized fixture reload. These are source-level GDScript tests; without Godot they have not been executed as runtime behavior.

## A1 atlas comparison and exact disposition

A8 retains its complete pinned A1 PR #20 texture set at `939720d50a0b822ff9042d4104dc69ba78ffe0f8`; comparison target is current A1 head `ad39bde6780c92169032246898c145c568f36e6e`. `data/survival/world_content/a1_atlas_compatibility.v1.json` plus `test_a1_atlas_compatibility.py` compare decoded RGBA bytes for every used site frame against current A1 coordinates. Exact crops match for all 23 used terrain frames and 25 used prop frames.

Decision: preserve the complete A8 pin, current coordinates, source-sized props and A8 original Gold. Do not wholesale-copy or repin the newer atlas. Current A1 adds 80 candidate land-transition masks and two notes-crate props; the A8 renderer has no neighbor-aware compositor, and the notes crates are unrelated. Those unused candidates are explicitly not adopted. Shell/interior sizes, A1 canonical cells and identities, actual route/blocker/doorway geometry, and the original ten dungeons remain unchanged. No source provenance change is proposed.

## Quarry evidence and direct A3 request

`data/survival/world_content/quarry_economics_evidence.v2.json` supersedes the dimensionally invalid v1 candidate. It cites exact A3 source hashes and the current A3 source graph (without treating generic records/recipe sinks as Quarry authorization). Inventory deltas remain item-separated; any optional scalar comparison requires A3-approved opportunity weights. Unknown binding, source allocation, prices, costs, yield, active cooldown, capability grant and route/risk valuation remain `null`.

A3 decision requested: approve one explicit Quarry binding/source/action with item-vector terms, source allocation, active-time cadence and capability consequences, or maintain rejection and identify the missing evidence. Route length alone is not a strategic case. No cross-unit oak/stone subtraction or invented hazard/loot is proposed. Current inspected A3 PR #19 head `4bfba38d87bb2b6529745bf4a3caf2ba0ca07947` still reports `REJECTED_PENDING_EVIDENCE_FAIL_CLOSED`.

## A0 production request

The owner insertion request is `A0_QUARRY_REACHABLE_WORLD_INSERTION_SPEC.v1.md`; concise machine-readable scope is `quarry_integration_candidate.v2.json`. Quarry shell transform is root `[424,4424]`, local socket `[64,64]`, canonical center `[488,4488]`; only the 128 px shell may be mounted in the overworld. The 960×608 worksite is entered separately. A1's route is not proof that current A0 world streaming/host makes cell `[30,280]` reachable.

A0 must own live world reachability and physical transitions, canonical instance identity, A1/A3 resolution, projection, atomic SaveService changes, durable receipt, and separate-process restart/idempotency. A0 PR #21 current inspected head is `51225718f3d9b15e508da633060270a4221e6a09` (OPEN); no A8 production mount or SaveService integration is present.

## Evidence status — separate categories

- **A8 source/static:** `python3 tools/survival/world_content/author_site.py --check` passed; all 17 Python world-content tests passed, including exact-pixel A1 compatibility and dimensioned evidence checks; `gdformat --check` and `gdlint` passed for changed GDScript. This establishes serialized/source structure and static GDScript parsing/lint only.
- **Godot native:** HOLD. No local Godot 4 executable is available. The last queried A8 exact head was `1426a0eb250a0a680081c2dfabfe4eb339f61f5d`; its action/import/capture workflows (`41040398338`, `41040398206`, `41040398163`) were queued at the review. They are not a pass, and new source requires exact-head CI. No native import, physics, route interaction, restart, or inspected 720p/1440p/2160p captures are claimed.
- **A0 production:** HOLD. A0 mount/reachability, live actor transitions, existing SaveService integration, durable receipts, and separate-process restart remain unproven.
- **A3 economics:** HOLD. No Quarry/Orchard/Mill binding, cost, yield, cooldown, capability grant, or source allocation is authorized.
- **Human play:** HOLD. No human playthrough establishes a recognizable strategic choice, safe retreat, or revisit acceptance.

The old-head failure `41024526858` / job `123959371999` belongs to `5ccf7b3…`; CT summarized import success followed by a native physics/interaction preload/parser failure in that old test. Direct log retrieval ended with EOF, so do not infer a precise cause or apply it to current code.

## Owner boundary

A8 supplies isolated scenes/data, neutral intent/projection proposal, test fixtures, A1 pixel-compatibility evidence, state-linked cues, and the dimensioned A3 decision candidate. A0 alone owns production mounting, transitions, SaveService persistence, reload and receipts. A3 alone authorizes costs, rewards, cooldowns, source bindings and capability grants. A1 alone owns canonical world geometry and identity. Human/native acceptance remains pending. No merge requested or performed.
