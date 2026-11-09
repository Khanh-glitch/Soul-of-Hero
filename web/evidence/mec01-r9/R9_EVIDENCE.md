# MEC-01 R9 — wild renewable source lifecycle (base b3a91c4)

## LI / Bible source → SOH before → gap
- Bible K3: sources are finite or renewable by explicit rule; "vật liệu run-local không tự tăng khi offline nếu thiếu nguồn"; reload must not refill; the rare/finite classes (Ragnarok chest, cash, POI) must never use the ordinary respawn.
- Bible K2: growth/recovery conditions are real (season, temperature, moisture, terrain); the 8-season/336h authority is fixed.
- Atlas (branch docs/gameplay-mechanics-first-policy-20261105, read-only): D04 approves ordinary container respawn by bounded class timer, never for unique loot or Ragnarok cash. LEGACY-U05 (respawn interval per class) is OPEN, so LI wild-plant regrow times are ORIGINAL_UNKNOWN. SYS15-C10: crops (sunroot / bitterleaf) have competing season value and land opportunity cost.
- SOH before: bush 420 s, grass 300 s, reed 360 s, herb 600 s, mushroom 600 s, fixed wall-clock timer, regardless of season or ground. `buildReason` allowed a floor over a dormant plant, and `sourceAt` refilled stock after the timer with no physical check.

## Confirmed defect (BEFORE, real engine)
- Probe + test `occupancy`: build `floor_wood` on a depleted bush tile (seed 98, real `buildReason` accepts it), wait past the cooldown → stock 3, `blockedAt` false, and `harvestHit` yields 3 berries from a tile with a floor.
- Log: `evidence/mec01-r9/BEFORE_occupancy_vitest.log` (expected 3 to be 0 at the stock check; same test passes after the fix).
- Probe log: `BEFORE_probe_vitest.log`.

## Change (AFTER)
- `catalog.ts`: `SourceDef.regrowClass` ('crop' for bush/grass/reed; 'herb' for herb/mushroom). Validation: a regrow timer needs a plant and a class; a finite source (iron, wreck, rock, rare, cash, ...) cannot carry regrow; regrowClass without regrow is rejected.
- `balance.v1.json → wildRegrowth` (SOH_PROVISIONAL): minRate 0.5, climateFloor 0.15, coldSlope 4, heatSlope 3, temperatureBand crop {0.22, 0.82}, herb {0.34, 0.78}.
- `engine.ts`:
  - `wildRegrowRate(r, tx, ty, def, at)` = max(minRate, climate band × `cropSeasonFactor(season, class)`), where climate comes from `climateAt` (Map temperature + seasonal offset). Weather is not an input, so waiting in rain cannot farm regrowth.
  - `advanceRegrowth`: integrates the rate piecewise over season boundaries from `regrowFrom` to now and records the exact completion instant `regrowDoneAt`. Reads are idempotent and additive.
  - `sourceAt`: refill only when `now >= regrowDoneAt` AND the tile is free (`entsAt` empty). A pre-R9 `regrowAt` is honoured as saved.
  - `harvestHit`: a depletion starts a cycle (`regrowFrom=now`); no more absolute `regrowAt`.
  - `regrowNote`: exhausted-source text: occupied tile → "can regrow once the tile is clear"; slow season → "slowed by the season"; quick → "quick this season".
- `sim.ts`: the exhausted-source toast uses `regrowNote`.
- `persist.ts`: validates `regrowFrom/regrowAcc/regrowDoneAt` only on regrow-capable sources.
- `core.ts`: type fields. No save version bump: the new fields are optional and legacy saves keep `regrowAt`.

## Measured effect (seed 98 and 401 identical: the Map is fixed; the seed only drives run RNG)
Source: `MEASURE_rates_vitest.log`. Median cooldown per season phase (phase0 spring … phase3 winter):
- bush (438 tiles): spring 420 s, summer 365 s, autumn 467 s, winter 764 s (old 420 s). Winter 100% slow.
- herb (110): 600 / 742 / 571 / 750 s (old 600 s).
- grass (895): 300 / 261 / 333 / 545 s. reed (90): 383 / 489 / 400 / 655 s. mushroom (18): 822 / 1200 / 649 / 750 s.
- Floor 0.5 → worst case doubles the cooldown; no plant becomes unreasonably scarce.

## Tests (mec01-r9-wild-regrowth.test.ts, 11 tests, real engine functions, fixtures labelled)
1. Catalog: only mat=plant has regrow + regrowClass; iron/wreck/rock/oak never regrow; `validateGameplayCatalog` empty.
2. Boundary: a depleted bush is empty 2 s before its season-scaled completion and full 2 s after.
3. Read pattern: polling every 5 s vs one late read → identical stock and HP; first refill within 5 s of the analytic instant.
4. Season crossing: a tile whose rate changes at the first phase boundary completes at the piecewise instant (±3 s).
5. Offline/reload: a save mid-cooldown restores `regrowFrom`; completion instant unchanged (no reset, no double refill).
6. Occupancy: floor on dormant bush → no refill, harvest empty, note says "clear"; reclaim the floor → plant emerges once; exactly 3 berries total.
7. One grant: 20 h of reads after refill → stock stays at 3, no pending timer.
8. Finite source: depleted iron vein stays empty for 200 h.
9. Legacy save: `regrowAt` honoured (not earlier, not under a building).
10. Save validation: regrow fields rejected on iron, accepted on bush.
11. Rate band: every sampled bush site at each phase is within [0.5, 2].

## Gates
- tsc --noEmit: exit 0.
- R9 focused: 11 passed, exit 0. BEFORE occupancy check: fails on the stock assertion (3 vs 0), exit 1 (code restored afterwards).
- Full Vitest --testTimeout=60000: 118 files passed / 1 skipped; 844 tests passed / 1 skipped; exit 0 (includes soh.test.ts legacy regrowAt case).
- Default `npx vite build`: exit 0; 1 file; 30,356,513 bytes.

## Gameplay consequence (player choice)
- Build over a berry bush or herb: that food source is off while the structure stands; reclaiming the structure restores it. Building is a real trade-off, not a free renewable food tile.
- Winter slows wild regrowth (bush median 420 s → 764 s; herb 600 → 750 s; mushroom up to 1200 s). Garden crops and wild foraging now compete over the season, as SYS15-C10 says.
- Exhausted tile shows the reason in-game (toast text), so the state is observable.

## Limits / remaining gaps
- Magnitude is small in absolute terms: base cooldowns are 5–10 real minutes against a 336 h run. The season changes tempo (up to 2×), not whether food exists. Whether base cooldowns should be hours-scale (scarcity) is a Creator/balance decision, not made here (no LI number exists: LEGACY-U05).
- Ground/biome and moisture are not in the rate yet (garden uses them). Only temperature and season, which the Bible names for growth.
- Pending regrowth under a structure emerges at the first read after the tile clears; there is no separate "dormant seed" entity.
- No in-world screenshot of the new toast; no browser play run (not required for risk tests).
- Garden/farm functions were not changed; they still compete through the same seasonal crop table.
