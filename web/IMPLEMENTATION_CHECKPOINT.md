# Gameplay implementation checkpoint — prototype-first branch

This is a build/evidence handoff, **not a second gameplay specification**. The canonical product contract remains authoritative. Source baseline: `references/gameplay-prototypes-20261102:reference_prototypes/20261102/soul-of-hero-game-development.zip`, SHA-256 `fa95538271fd46a70f5737b58b8671124e091e8f6196479950a25dca741a2403`.

## This checkpoint

- The source ZIP is preserved unchanged at `reference_prototypes/20261102/soul-of-hero-game-development.zip`; verified with `sha256sum` and `unzip -t`.
- The same React/TypeScript/Canvas game is extracted in `web/`; original Vite, UI, renderer, catalog, world and test suite retained.
- Removed the 400-command replay-dedup eviction. Successful command IDs now remain in run-persisted `seenIntents`, separately from the intentionally bounded display receipt history. Added a regression that performs 410 later successful physical transfers, JSON save/reloads, then retries the original transfer and verifies duplicate rejection and conserved inventory.
- Fixed one real trace-AI integrity defect: when following a trace chain, next knowledge must be a newer footprint spatially contiguous (26px) with the footprint just sensed. It no longer picks an unrelated newer trace within a broad creature-radius search. This is a bounded prototype fix, not proof of full C08 or robust offline AI.
- Configured Vite to accept the Arena preview host.

### Reproduction and test results

From `web/`:

```sh
npm ci
npm test
npm run build
npx tsc --noEmit
npm run dev -- --host 0.0.0.0 --port 5173
```

Executed: original baseline `npm test` 13/13 pass, `npm run build` pass; after changes `npm test` 14/14 pass (includes negative replay-after-eviction/reload), `npm run build` pass, and `npx tsc --noEmit` pass. Browser installation was attempted but Playwright Chromium download failed with `ECONNRESET` from the external browser CDN; no screenshot is claimed in this checkpoint. The live Vite preview is the available visual check surface, but it has not been visually accepted. npm reports 6 dependency audit advisories (1 low, 1 moderate, 2 high, 2 critical); dependencies were not force-upgraded.

## Bible coverage snapshot — K1–K8 and C01–C24

Status describes evidence in the donor plus this branch's executable tests, not Godot/native or human acceptance. `PARTIAL` means a real mechanism exists but the canon's complete causal/negative/player gate is not established. `INCORRECT` records a known defect observed in the donor; fixes below do not promote the whole edge to accepted.

| Canon | Status | Evidence / remaining principal gap |
|---|---|---|
| K1 items/custody | PARTIAL | UID stacks, containers, transfer/death bags, escrow and replay regression; save authority remains client-side, broad mutation path isn't transactional. |
| K2 environment/time | PARTIAL | Terrain/weather/fire/trace decay; no full climate/terrain-source authored pipeline or offline event parity. |
| K3 sources | PARTIAL | Finite source stock and cash source tests; source geometry and mutation authority are not independently authenticated. |
| K4 knowledge/work | PARTIAL | Research specimen→blueprint and paid/fuel-bounded station jobs; recipe catalog migration and durable cross-process chronology need proof. |
| K5 actor/survival/AI | PARTIAL | Combat, survival/death and local sensing exist. Trace follower could select unrelated marks; adjacency guard fixed; native movement-derived adversarial C08 tests remain. |
| K6 building/POI | PARTIAL | Paid structures/claim/site checks and some POI gates; full structure footprints, actual placement variety, multi-layer authored POI and loaded reclaim are unproven. |
| K7 travel/freight | PARTIAL | Physical cart/container and terrain/load movement exist; route alternatives and complete cost comparison/player loop unproven. |
| K8 run/time/profile | PARTIAL | 336h/72h logic, offline catch-up, deposit/finalize/runs present; only local editable persistence, chronological event authority and global verification absent. |
| C01 | PARTIAL | Finite harvesting/tool match tests; reject remote harvesting via an authoritative geometry boundary. |
| C02 | PARTIAL | Salvage/Spares paths present; road-value/source provenance breadth unproven. |
| C03 | PARTIAL | Charged Core cancel/commit and cross-use combat; full capability/data extensibility and authentic Gold actions absent. |
| C04 | PARTIAL | Study→physical blueprint→learn-once tested; atomic rollback/restart and all study methods not proven. |
| C05 | PARTIAL | Combat/harvest shared in game; validated aim, transaction boundary, authored environmental consequence incomplete. |
| C06 | PARTIAL | Fuel-bounded jobs/offline work and gardens; timeline edge ordering and separate-process persistence need tests. |
| C07 | PARTIAL | Costed build, invalid-site rejection, transfer and persistence tests; full item identity and all footprint/reclaim cases incomplete. |
| C08 | INCORRECT → PARTIAL | Donor selected a newer trace without strict adjacency. Contiguous-successor guard + regression coverage for older scenarios; comprehensive unrelated-trace regression still next. |
| C09 | PARTIAL | Offline environment/survival is processed; creatures are frozen offline and no full causal threat timeline. |
| C10 | PARTIAL | Death moves custody into one physical bag and persists in serialization; native recovery route and all restart cases incomplete. |
| C11 | PARTIAL | Locks/keys/POIs exist in fixed world; externally authored multi-layer map/POI support is not established. |
| C12 | MISSING | No verified optional task/reward ordering contract. |
| C13 | PARTIAL | Cart load and terrain affect travel; loaded trip comparative proof and route costs absent. |
| C14 | PARTIAL | Weather/fire/trace state advances; repeatable source recovery and temporal consistency under adversarial offline schedules unproven. |
| C15 | PARTIAL | Final-72 physical cash source and mint-once exercised; broader unique-source ledger not proven. |
| C16 | PARTIAL | Zero-balance cash→seller chest route is exercised; canonical first-chest seller economics remain proposed, not canon. |
| C17 | PARTIAL | Deposit debit/credit and replay tested; durable transaction behavior across browser process crash not proven. |
| C18 | PARTIAL | Profile funds buy run-local stocked items; exhaustive stock/receipt crash checks absent. |
| C19 | PARTIAL | Six Elder data/combat exists; original Gold acceptance and complete per-Elder causal outcomes absent. |
| C20 | PARTIAL | Local achievement/score events exist; scoring anti-farm eligibility not established. |
| C21 | MISSING | No trusted service for verified global ranking; local status is explicitly unverified. |
| C22 | PARTIAL | Physical evacuation/finalization tested; route challenge and all end states need adversarial coverage. |
| C23 | PARTIAL | Run reset clears run-local state and preserves profile cash/history in tests; migration/crash guarantee and full wipe audit incomplete. |
| C24 | PARTIAL | Stable 200×200 generated world/four safe starts and tests; authored replaceable development maps/POIs and shipping-continent acceptance not achieved. |

## Extensibility evidence and current limits

Verified baseline evidence: world sources, items, recipes, stations, structures, creatures and placements already have catalog/data seams; the engine shares harvest/interaction/recipe paths across definitions and world generation. This checkpoint adds no per-ID gameplay special-case. However, adding authored content still reaches TypeScript catalog/world source, and the catalog uses inferred/loose typing in places. Therefore the required claim—validated/versioned data + placement-only addition across map/POI/item/source/recipe—is **not yet demonstrated**.

## Next specific increment

Add a strict versioned content-pack schema and boot-time cross-reference validation around the current source/item/recipe/world definitions, with a second development map layout and one new item/source/recipe that run through existing generic interactions. In parallel, add the negative trace-successor test and authoritative range/source precondition tests. Then obtain a real browser capture from an available Chromium runtime and visually inspect the same tested SHA before calling the visual gate complete.
