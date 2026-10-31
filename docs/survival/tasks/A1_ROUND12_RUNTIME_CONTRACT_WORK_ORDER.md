# A1 Round 12 runtime/source-contract blocker — work order

**Owner:** A1 only, existing `arena/e385312a-soul-of-hero` / PR20. **Intake base:** `8551a323e444f755d7a29b1ad518aa29aeb039cb`. **Status at intake:** active implementation; no production mount or merge authorized.

## User work order

Close the reproduced A1 production-source-contract blocker, not by replacing the old Knight hash with today's hash. Separate immutable authored-world integrity from mutable A0/A6 runtime compatibility. Keep the 1024×768 plan, all 192 chunk manifests/files, world/legacy art, A8/source identities, canonical POI coordinates, routes, collision/hazard data and derived spawn binding strict. Validate the real player scene/body/motion/camera and required legacy world/traversability/controller APIs semantically; incompatible interfaces must fail closed with precise named errors.

Prove with independent positive and negative evidence that compatible refreshed A0/A6 actor bytes do not invalidate unchanged geography, while corrupted plan/chunk/A8/legacy-art data, stale/invalid spawn data and broken player/world interfaces still fail. Run the complete reader/stream native matrix in explicitly composed source trees using the new exact A1 SHA. Freeze the original reproduction at A0 `62f6a32d08d319bfdcd28235786558f54f49b420` / A6 `6d71410a370df805f8b29a018b61380d6c233b65`, then independently test forward compatibility at refreshed A0 `86ac20ba6ad6e80e964ef15af8f1fe48f11ee020` / A6 `6518c09835a273ac1e7b91dc5e6712d6a4c3863e`. Do not silently reuse A0's older A1 workflow pin or chase unrecorded moving heads.

Return exact A1 and composed source identities, native CI logs, integrity-negative evidence, visual evidence if rendered, the remaining production integration boundary, and an executable R0–R5 owner handoff. PR20 stays open and unmerged.

## Owner fences and scope

- **A0:** sole owner of production movement/collision, construction, SaveService, production mount and actual-world activation. This task does not edit or enable those systems.
- **A1:** runtime contract, semantic interface checker, reader/stream consumer checks, derived index, isolated native fixture, compiler/oracle and scoped evidence.
- **A6:** actor presentation/avatar/HUD remains owner-managed; the composed scene is tested, not edited here.
- **A3/A8/A7/AVFX:** no economy/rate/reward, POI mechanic/interior, independent movement acceptance or Gold change.
- No new region/POI/route, terrain fabrication, relaxed collision, generic replacement fixture, changed canonical coordinate, production-playability claim or visual-acceptance claim.

## Implementation acceptance

1. Mutable script/scene/project paths are absent from `source_pins`; their current hashes are diagnostic observations only. Re-pinning them is rejected by compiler and reader.
2. Immutable plan/chunk/source/art hashes remain exact; the historical baseline lock's data checks remain active while declared runtime files are excluded from byte identity.
3. The semantic checker loads the actual composed consumer scene and scripts and checks body type/enabled shape/size/offset, floating motion, collision layer/mask, numeric motion/health properties, camera offset/smoothing, bound input actions and required legacy APIs. The default scene is only a technical body; an optional consumer scene override imposes no Knight visual/script identity, so D051 Adventurer presentations remain valid consumers. Actual D051 visual acceptance is separate.
4. Named native negatives cover plan identity, chunk integrity, A8 source identity, legacy tile-art integrity, spawn cell-hash semantics, spawn binding, incompatible Hero shape and missing legacy-world API. The original world bytes and primary reader remain unchanged after the probes. Spawn verification also covers world/frame/policy binding, per-chunk hashes, region accounting and 3×3 source safety, not just candidate totals.
5. Isolated plus both exact-SHA composed profiles run the measured-budget complete Godot 4.7 matrix, real frame-driven routes/returns, dynamic structure reload, 36 spawn cases and 69 captures. The independent report oracle checks runtime evidence, derived bindings and every required refusal; missing/skipped native bodies fail CI.
6. Dispositions remain independent: source/native evidence never implies `PRODUCTION_MOUNTED`, `PLAYER_PLAYABLE` or `VISUALLY_ACCEPTED`.

## Verification entrypoints

```bash
python tools/survival/worldgen/compile_round12_runtime.py --check \
  --out artifacts/a1-round12/round12_native_inputs.json
python -m pytest tests/survival/world/test_round12_deep_world.py -q
# Exact-head GitHub Actions: SURV-050A World Reader
# jobs: godot-round12-deep-world-native and godot-round12-composed-runtime-native
```

Each composed matrix runner uses A0's `tools/a0/compose_owners.py`, records owner SHAs and a pre-import Git tree ID, verifies every composed `data/survival/world` and `game/survival/world` file against the new A1 event SHA, rejects out-of-scope copied files, and verifies A0 script/A6 scene/A0 reviewed-controller provenance separately from semantic runtime acceptance. A1's compiler runs from the exact A1 checkout against byte-identical composed world data; no unowned tooling overlay is added to the production source tree.

## Verification result

- Native target `2a4f6e7964ec38e41ce3af8344f2bc3c37f48cc6`; Godot `4.7.stable.official.5b4e0cb0f`; [World Reader run 41199262481](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41199262481).
- Isolated, frozen reproduction and forward composition each passed **263 native + 132 oracle checks**, 37 journeys, 36 spawn cases, 69 captures and all eight named refusals. Frozen tree `efb776c3e430eeb21aaad9e33add45703552a524`; forward tree `e844bf142e858a5de070204b87fbad8c2bcf3665`.
- Source gates: **160/160 world pytest**, deterministic compiler regeneration, handoff validation and diff-check. The initial new-SHA oracle path-spelling failure was diagnosed and fixed; it was not hidden or bypassed.
- Full evidence, R0–R5, nine independent gates and the single A0 owner order are in `docs/survival/world/REVIEW_A1_ROUND12_RUNTIME_CONTRACT_2A4F6E79.md`.

## Remaining handoff boundary

The green result closes only the A1 cross-owner source-contract defect at the cited native target. A0 must still decide and implement actual production mounting and prove production traversal/build/collision/POI/save behavior. A7 and human visual review remain separate; inspected source-window visual HOLD/DEFECT is not cleared by this contract fix.
