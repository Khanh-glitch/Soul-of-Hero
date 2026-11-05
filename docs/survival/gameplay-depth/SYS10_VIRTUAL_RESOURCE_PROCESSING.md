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
- Build gate: an owned Workbench at level 2 or higher within 3 tiles, plus claim territory (`need: 'claim'`).
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

1. Refinery build requires a level-2 workbench within 3 tiles and claim territory.
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
