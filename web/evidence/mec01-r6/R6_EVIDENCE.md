# MEC-01 R6 evidence (work order comment 6733657610 / IC_kwDOTbTDRM8AAAABkVt2Cg)

Base SHA 97c5c01. Web (SIM/FIXTURE measurement and natural browser trace), not native Godot, not human playtest. No S3/S4/S5 claim.

## P0 — motorbike road payoff (measured BEFORE / AFTER, same road, same load)
Harness: `tests/mec01-r6-freight-speed.test.ts`. Same straight 28-tile clear road (vehicleGeometry road), out 26 tiles east and back, real tick() at 50 ms, 40 iron ingots in the carried inventory / cart / bike cargo, bike refuelled by a real fuel canister, same run seed.

| row | before px/s | after px/s | time out+back (s) before→after | fuel | wear HP |
|---|---|---|---|---|---|
| walk, 41.4 kg carried | 92.2 | 92.2 | 9.05 → 9.05 | 0 | 0 |
| hand cart, 40 kg | 84.7 | 84.7 | 9.85 → 9.85 | 0 | 0 |
| motorbike, 40 kg cargo | 103.1 | 321.8 | 8.05 → 2.60 | 51.9 → 52.3 | 2.08 → 2.09 |
| motorbike, empty | 125 | 390 | 6.65 → 2.20 | 41.6 → 42.9 | 1.66 → 1.72 |

Ratio after: loaded bike / loaded walk = 3.49×; empty bike / walk = 4.23×.
Change: `src/game/balance.v1.json` motorbike.roadSpeed 125 → 390 (SOH_PROVISIONAL v2). Derivation: 92.2 × 3.5 / (1 − 0.5 × 0.35) ≈ 391. Fuel and wear per pixel unchanged, so speed buys time, not free fuel. Balance values are read live (not hashed into saves).

Net trip cost, same 52-tile round trip, loaded: fuel 52.3 units (≈ half a 100-unit canister) and 2.09 HP wear, plus the upfront kit (see Economy below). Walking costs no fuel but needs 9.05 s.

Not measured this round: rough/ground terrain speed, a tight turn/obstacle, a longer out-and-back beyond 52 tiles. The formula says ground 52 and rough 35 px/s are slower than walking on grass/forest, but I did not record it in a test.

## Test-harness changes forced by the faster bike (not assertion weakening)
- `b05-freight-compare`: legs 0.2 s (was 0.6 s) so the 390 px/s bike stays on the 8-tile segment; fuel 3 canisters, 3 refuels to a full 300-unit tank (a partial tank measured fuel exhaustion at 166.7 px/s). Assertion `pxPerSec ≈ roadSpeed` kept.
- `mec01-c2-delivery`: bike steps at 16 ms (60 fps) instead of 50 ms; at 390 px/s a 50 ms step moved ~20 px past a 16 px corridor cell and the scripted haul stalled. Walkers unchanged. Time = ticks × dt.
- `sim.ts`: fuel residue below 1e-9 is set to 0 (b05-freight-crude failed on 5.3e-15 > 0). Engine fix, one line.

## P2 — real Chromium on the R6 default build (served from web/dist at 8791)
Runner: `@sparticuz/chromium@131` + `puppeteer-core@23` with LD_LIBRARY_PATH to the extracted al2023 libs. Script: `browser-play-natural-trace.mjs`. Input: keyboard (WASD) and mouse (click to swing); menu clicks. No state injection.
- New run → Adventurer ♀ → Shipping Island → Begin: reached the in-world HUD (HP/ST/FD/H₂O/WRM, day/time, run clock 336 h, secured 0).
- Walked W then D, swung LMB 8 times at a point near a tree: no wood gained. Spawn differs per run (earlier Eastcove, Dead Foundry, Old Mill), so the swing aimed at no tree in these runs. Honest: harvest not confirmed in the browser.
- I opened the Inventory with the real I key: panel readable at 640×360, Load 1.4/60 kg, slots, Use/Split/Drop/Sort buttons, and hints. Screenshot `r6-inventory.png`.
- Console: no page errors; one 404 resource at the first load (not identified, not in the game flow).
- NOT done in the browser: a natural wood/iron harvest, craft, bench/research, mount/drive, refuel and freight. The full chain needs hours of in-game time and many Spares; not reached this round.

## Economy (P1) — NOT completed
Measured earlier (R5 census): whole-map expected Spares ≈ 79; the motorbike path needs ≈ 31. I did not change any production or price number this round. The R6 requirement for a full Last Island linked calibration (per-hit yields, furnace batches, container odds) is not met. The Atlas v5 leaves exact per-hit wood and ore yield, furnace output and container quantities as unresolved, so those values remain ORIGINAL_UNKNOWN. No 232× scaling was applied.

## Gate receipts
- tsc --noEmit: exit 0.
- Targeted: b05-freight-compare, mec01-c2-delivery, mec01-r2-c1-motorbike-chain, motorbike, b04-vehicle-unload, mec01-r6-freight-speed, mec01-f3-joined, b05-freight-crude: all passed after fixes (exit 0).
- Full Vitest (--testTimeout=60000): see the commit message for the final count.
- Default build `npx vite build`: exit 0, 1 file `dist/index.html`, 30,352,044 bytes (gzip 20.13 MB).

## F3 (P3)
`mec01-f3-joined.test.ts` now also sets a run-1 learned-recipe sentinel (`motorbike_kit`) before evacuation and asserts it is absent in run 2, and run 2 has a different id. Still in-process snapshot reload (not a separate OS process), with qaOffset 264 h phase control, labelled. Not native or human proof.
