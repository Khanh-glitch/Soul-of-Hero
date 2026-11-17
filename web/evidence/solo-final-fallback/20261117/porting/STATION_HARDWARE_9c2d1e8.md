# Selective paid-station hardware delta — not an NPC integration certificate

Solo source: `9c2d1e8`, parent `f10d1dd`. NPC inspected/fetched: `79ac5f0b2855ef44d5ca95ed32a19781fa66a045` on 2026-11-17. No NPC branch was edited, pushed or merged.

Delta patch: `station-hardware-9c2d1e8.patch`, SHA256 `22f4424afe4429f4e184e48c7e12fa9d8df69466ddc1039477262ecce354cf2e`. Reverse-apply check against Solo source PASS. This is an incremental delta, NOT a replacement for the earlier cumulative Solo port package, and NOT tested by applying it wholesale to current NPC.

## Reproduction and correction

Real paid L2/L3 Workbench upgrades/industrial module and Furnace lining were lost by reclaim→redeploy with the same chassis UID. Retained red report: `../station-hardware/before.json.gz` (2 failures). Existing pack durability conservation worked; permanent hardware had no packed representation.

Preserve only installed hardware; never serialize a job, worker, output, fuel, generator ID, enabled flag or remote claim in this field. An industrial module is disabled/unlinked at the new site. Existing bagStation resolves contents and job reservations separately. No ingredients, recipe, level gate, price, research or map geometry changed.

## Function-level port instructions (only with integration authorization)

1. `core.ts`: add the `StationHardware` interface and OPTIONAL `Stack.stationHardware`. **Do not replace Stack.** Current NPC has expanded `Stack.production` with physical job/worker/input/station provenance; retain every current NPC field. Keep the earlier Solo trap-state delta if already composed.
2. Add the pure `station-hardware.ts` module: `validStationHardware`, `packedStationHardware`, `restoreStationHardware`. It imports types only and has no world/engine dependency.
3. `engine.ts` `buildReason`: append valid hardware metadata to the existing intact-pack guard. Do not replace newer NPC access/owner predicates.
4. `engine.ts` `apply/build`: append the same metadata guard to pack selection; restore hardware after station creation. Keep the current NPC lifecycle/claim/production receipt and custody changes.
5. `engine.ts` `apply/reclaim`: after the current contents/job/worker resolution, capture current level/module/lining on the same deployed UID. In the historical no-deployed branch, create one explicit migration pack and put the actual hardware on that item. Retain the existing trap-state recovery, NPC job reservation settlement and newer bag custody policy. Never copy station queues or production output along with hardware.
6. `persist.ts` `stackInvariant`: append optional hardware validation; retain NPC `Stack.production` validation and all current historical migrations. No save version bump is needed for this additive optional field. Placed stations may legitimately have newer hardware than their last packed snapshot; capture actual live station hardware on recovery, do not enforce equality with stale deployed metadata.

## Required replay before integration

Run `paid-device-hardware-custody`, existing device repair/build/deploy, save, queued historical jobs and recipe migration; then current NPC production-owner races, reclaim/cancel/worker departure with an upgraded station, packed item transfers/trade/theft, active/offscreen/floor migration and separate-process save. Test paid L2/L3/module/lining -> reclaim -> transport -> redeploy with the same UID, condition, disabled/unlinked module; old plain packs get no free upgrade; corrupt/cross-device/runtime-field metadata fails both placement and save; historical raw-paid station mints one migration UID only.

Solo focused PASS is not a HumanWorld certificate. This patch does not preserve generator reinforcement, stored energy or every other runtime device setting; those are separate lifecycle questions, not silently declared fixed here.
