# SYS10 — Virtual Resource Processing: Oil Refinery (provisional)

Status: **provisional implementation evidence**. Not a full SYS10 closure.

## Scope

A physical Oil Refinery converts finite Salvaged Oil into:

- Fuel Canisters (`fuel_can`), consumed by the existing motorbike fuel path and the existing furnace-style fuelled station logic.
- Machine Lubricant (`lubricant`), a new item that halves motorbike wear for a bounded distance.

Oil is not created by this feature. Salvaged Oil remains sourced only from the existing finite authorities (wreck salvage bonus and `VENDOR_SPARES`, see `web/src/game/wreck-economy.ts`). No recipe outputs `salvaged_oil`, which the test suite asserts.

## Mechanics

| Recipe | Input | Output | Time | Notes |
| --- | --- | --- | --- | --- |
| `refinery_fuel` | 3 Salvaged Oil + 1 Glass | 1 Fuel Canister | 14 s | single-run |
| `refinery_fuel_batch` | 5 Salvaged Oil + 1 Glass | 2 Fuel Canisters | 22 s | ~17% more oil-efficient (2.5 vs 3 oil per can) |
| `refinery_lubricant` | 2 Salvaged Oil | 1 Machine Lubricant | 12 s | tier 1 base recipe |

- Build cost: iron ingot ×4, mechanical parts ×3, spares ×5, brick ×6, glass ×2. Hit points 280.
- Build gate (Bible K6, 2026-11-05): an owned level-2 Workbench within 3 tiles, valid terrain, collision and materials. **No Territory Cabinet is required**; `need` is `'any'`.
- Fuel: burns fuel like the furnace (`needsFuel` includes `refinery`).
- Lubricant on the motorbike: consumes one Lubricant to set `vehicle.lube` to `lubricantDistancePx` (12000 px), capped at 1.5× that. While `lube > 0`, wear is multiplied by `1 - lubricantWearReduction` (0.5). Lube decrements with distance travelled.

Balance values live in `web/src/game/balance.v1.json` (`oilRefineryV1`, `motorbike.lubricantWearReduction`, `motorbike.lubricantDistancePx`).

## Code touchpoints

- `web/src/game/catalog.ts`: `lubricant` item, three recipes, `refinery` structure, BUILD_ORDER.
- `web/src/game/engine.ts`: build gate, `needsFuel`, `vehicleLubricate` dispatch.
- `web/src/game/sim.ts`: wear reduction and lube decrement in the motorbike step.
- `web/src/game/core.ts`: `vehicle.lube?: number`.
- `web/src/game/persist.ts`: lube validated finite and within `0..1.5*lubricantDistancePx`.
- `web/src/ui/panels.tsx`: refinery station banner, lubricate control, Refinery craft and build groups.

## Verification

Focused tests: `web/tests/s10-oil-refinery.test.ts`, 7 tests, all passing:

1. Refinery build requires a level-2 workbench within 3 tiles and does not require a claim cabinet.
2. Single, batch and lubricant jobs convert oil with exact inputs and outputs.
3. Refinery fuel refuels the motorbike; lubricant reduces measured wear versus a control bike on the same road (driven left to avoid fixtures).
4. No recipe creates Salvaged Oil; oil count only falls.
5. Jobs settle at the exact boundary and survive a save/reload round trip.
6. Forged lube values outside the bound and forged stack sizes fail validation.
7. Offline settlement grants exactly one station output with no extra items; run clock stays at 336 h.

Results:

- `npx tsc --noEmit`: PASS.
- `npx vitest run`: 52 files, 371 tests, all PASS (was 364 before SYS10; +7 new).
- `npm run build`: **not verified in this session**. Vite reaches "Inlining" then the process is killed (out of memory). Several stale Vite dev servers from earlier sessions are holding ~1.5 GB of the 3.9 GB sandbox. The build succeeded earlier in this branch (30.2 MB, gzip 20.1 MB), so this is an environment issue, not a verified regression.

## Known gaps (provisional)

- `validate()` does not reject a refinery entity re-typed to another station type, nor malformed station queue jobs. This is a generic persistence gap, not added by SYS10.
- The vehicle lubricate action is a direct dispatch; no physical animation or UI timing beyond the existing station patterns.
- No balance tuning against playtests yet.
- Generator/base-power consumption of Fuel Canisters is not part of this change.

## SYS10-R1 corrective update

- **Industrial co-product batch** `refinery_industrial`: 6 oil + 1 glass, 26 s, outputs 2 Fuel Canisters + 1 Lubricant as one committed job. Preflight at queue time and at completion; if the bundle does not fit, nothing is committed and inputs stay reserved. Compare: batch fuel + separate lubricant = 7 oil for the same outputs.
- **Single balance authority**: `balance.v1.json` `oilRefineryV1` (cost, HP, need, recipes, lubricant values). `catalog.ts` derives recipes from it. Old motorbike duplicate keys removed.
- **Wear boundary**: each movement step is charged at protected or full rate according to remaining lubricant distance.
- **Validation**: refinery jobs must match canonical recipe time and reserved inputs; refinery entities must be structures with valid HP; retyping a refinery now fails validation. Legacy jobs without reservations still load.
- **Tests**: 13 SYS10 tests in `web/tests/s10-oil-refinery.test.ts`; full suite 52 files / 377 tests pass; `tsc` passes; production build passes at `NODE_OPTIONS=--max-old-space-size=768`.

### Not done in R1 (honest status)
- No measured three-strategy economy comparison (furnace vs refinery vs buying/scavenging).
- Browser capture `evidence/sys10-r1/refinery-640x360.png` shows the title screen only; refinery interaction, output collection and fuel use in the browser are **not** captured.
- Territory cabinet/upkeep coverage is a separate Bible decision and is not modeled here.
- Generic `validate()` gaps outside refinery queues remain.

## SYS10-R2 current state (supersedes R1 declarations where they differ)

- Industrial batch 6 Salvaged Oil + 1 Glass → 2 Fuel Canister + 1 Machine Lubricant, 26 s, one paid job, atomic bundle commit. Shown in Station and Craft UI with full bundle, fuel status, pause reason and output-space state.
- Refinery queue jobs always require a paid reservation (no migration: the refinery is branch-local and no shipped save contains refinery jobs). Refinery identity (`identity: 'refinery-v1'`) binds station type for both empty and active refineries.
- Unused balance knob `fuelBurnSecondsPerFuel` removed; `lubricantOverCapFactor` now read by the engine; `need` read from balance.
- Economy model: `evidence/sys10-r2/economy_model.py` (outputs in `economy_model.out.txt`). Conclusion: refinery batch saves 0.5 oil per can vs furnace; industrial saves 2 oil vs batch+separate lube; one lubricant saves ~12 HP per 12000 px on flat road (0.24 repair) for 2 oil. Provisional tuning kept; the lubricant repair value is a design tradeoff for Creator decision, not a fix.
- Furnace `STRUCTS.furnace.need = 'claim'` is label-only like the refinery's was. Not changed in R2 (Furnace behavior is preserved); K6 reconciliation dependency.
- Browser: portable HTTP build `web/dist-http` (vite.http.config.ts). Real clicks: Title → Continue → world; F → Oil Refinery panel. Controlled fixture disclosed.
- NOT achieved: UI queue of the batch by real input, completion wait, output collection, fuel/lubricant use on a motorbike in browser, browser save/reopen. S3 is NOT claimed.
