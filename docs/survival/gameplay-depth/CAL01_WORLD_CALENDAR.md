# CAL-01 — `world_calendar_v1`: two-year / eight-season world clock (DRAFT review)

**Status: DRAFT / UNMERGED. NOT a production-ready claim.** Evidence level is mechanics
fixture on the real code and the real Map raster; nothing here is natural-play enjoyment
evidence, a 336 h campaign, or a native/A0 time contract.

**Branch:** `agent/cal01-world-calendar-seasons-20261108` · **Base:** PR #44 head
`ec909a5eab1099a2cfab44c89ab4e321e529b3dc` (main `5214789`).

## 1. What this is (and what it is not)

CAL-01 integrates a single, derived, versioned season clock into mechanics that **already
exist**. It does not reimplement weather, day/night, biome climate, thermal survival,
gardens, footprints or chronological offline settlement; it feeds them one chronological
input and one bounded per-cell multiplier.

| Fixed by Creator (not tunable here) | Provisional / measured |
|---|---|
| One run = 336 real hours incl. offline | 42 h per season (nominal only) |
| Final 72 h = Ragnarok | Per-season climate amplitude (`seasonClimateV1`) |
| Order Spring→Summer→Autumn→Winter ×2 | Day/night length (untouched, separate tuning) |
| Existing day/night, weather, thermal, garden tuning | Region climate amplitude `[CẦN ĐO]` |

## 2. The contract (`web/src/game/calendar.ts`)

One authority: `runClockMs(r, at) = max(0, at - startedAt + qaOffset)`. There is no second
clock: `calendarAt` derives year, phase index, season, phase elapsed/remaining and the
Ragnarok flag from it, and every consumer (weather, gardens, thermal, settlement, save
validation) calls the same function.

Verified boundary vector (`evidence/cal01-seasons/season-report.json → boundaryVector`):

| run hours | 0 | 42 | 84 | 126 | 168 | 210 | 252 | 294 | 336 |
|---|---|---|---|---|---|---|---|---|---|
| year | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 2 | 2 |
| season | spring | summer | autumn | winter | spring | summer | autumn | winter | winter |
| phaseIndex | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 7 |
| Ragnarok | – | – | – | – | – | – | – | **yes** | yes |

`phaseHours × phaseCount = 336` exactly. The ninth phase does not exist: at 400 h the index
is still 7 (`clampedAt400h: 7`), so no phantom season can grant a reward or extend a run.
Exactly-one-millisecond-either-side is asserted for all seven boundaries, and the run still
ends at the fixed 336 h wall time, not at a season edge.

**Typed integration contract (A0/A3/Map):** `CalendarStateV1`, `CalendarLedgerV1`,
`CalendarEventV1`, `LocalClimate` (`seasonal-climate-v1`) and `CALENDAR_CLOCK_CONTRACT`
declare exactly which fields other owners may consume (`provides: season, phaseIndex, year,
phaseRemainingMs, cropSeasonFactor, evaporationMultiplier, catchMultiplier, thirstMultiplier,
coldPoints`). `calendarViewForRun()` / `seasonInfo()` are read-only and grant nothing.

## 3. Seasons are a deviation on Map ground truth (B)

`climateAt(r, tx, ty, at, weather)` reads `economyMap.temperature/moisture/biome` and applies
the bounded offsets in `balance.v1.json → seasonClimateV1`. **The Map arrays are never
written** (asserted: `arraysUnchangedAfterClimateSweep: {temperature:true, moisture:true,
biome:true}`).

Spring deviation is `0` by construction, so every measured baseline (thirst, comfort target,
garden rate, rain-only footprints) keeps its calibration. Seasonal terms are additive
*deviations*, never replacements:

| Region (Map cell) | Spring | Summer | Winter |
|---|---|---|---|
| Frostcrown snow (`T=0.10`) | cold 0, thirst ×1.00 | cold 0, thirst ×1.05, evap ×1.19 | **cold +7.0** (`season_cold_winter_snow`), thermal target 19→0 |
| Warm sand coast (`T=0.70`, `M=0.25`) | cold 0, thirst ×1.00 | **thirst ×1.25, evap ×1.94** | cold **0** |
| Marsh (`T=0.77`, `M=0.85`) | cold 0, thirst ×1.00 | thirst ×1.13, evap ×1.50 | cold 0 |

The same winter therefore costs a snow cell seven bounded cold points through the existing
`thermalEvaluate` parts list and costs the warm coast nothing: there is no universal
modifier. Snow is **not a new weather family** — a freezing cell's rain/storm slot lands as
snow (200/200 winter slots on the snow cell, 0/200 in spring), `wet=false`,
`catchMultiplier=0`, so a snowing sky neither waters a plot nor refills a barrel.

`02.1` of the Bible's "no invented hazards" is respected: nothing new is spawned. Fire,
lightning, floods and creature behaviour keep their existing code paths.

## 4. Seasonal gardening with real costs (C)

`gardenEnvironment()` now takes its season/crop factor, evaporation and catch from the same
`climateAt`, and `stepGardensBarrels` / `tenderBoundary` / offline settlement are all
`at`-parameterised, so a boundary can never be interpolated across.

Measured at **Year 1 winter, h128**, same seed, same Map cell, 2 h real offline settle:

| Plot | Compost/rate | Offline result |
|---|---|---|
| cold exposed (no prep) | 0.053 | growth 0.13, soil water 0 |
| cold **framed** | 0.466 | growth **1.00** (ripe), soil water 0.32 |
| warm sand exposed | 0.385 | growth 1.00, soil water 3.00 |

Named, catalog-sourced costs debited through `dispatch()`: garden build `wood 4 + fiber 4`;
cold frame `wood 4 + fiber 4 + glass 1 + herb 1` (`GARDEN_FRAME_COST`); planting `seed 1`.
Nothing is injected into the plot after planting, and no harvest is granted by time alone —
the ripe crop still needs a real `garden.harvest` intent.

Water is the second axis: on a warm sand cell a plot loses **1.96** water in 20 min of
spring and **2.89** in the same 20 min of summer (`evaporationMultiplier` 1.00 → 1.86).
Crops compete by season: Sunroot 1.15 / Bitterleaf 0.90 in summer; 0.55 / 0.80 in winter.
Manual gardening stays viable everywhere — every seasonal factor is positive.

## 5. Chronological offline settlement (D)

`settle()` and `advanceWorld()` clip every slice at `seasonBoundaryAt(r, t)`, and
`commitSeasonBoundaries()` emits exactly one `season.begin` receipt per crossed boundary,
skipping `phaseIndex <= observedPhase`. A repeated Continue, a reload, or a partition at the
same instant therefore cannot re-announce a season.

Equivalence over an absence crossing spring→summer→autumn→winter (h10 → h140), three ways
(`offlineEquivalence`): continuous, 4 partitions, and 4 partitions **with a
serialize→validate reload between each** produce byte-identical results:

```
seasonEvents ["1:summer:1","1:autumn:2","1:winter:3"]
ledger {observedPhase:3, observedAt: h140}   receipts 135
gardenGrowth 1   gardenWater 3   hunger 95.815   thirst 93.7225
```

The absent player still dies of the **existing** hunger/thirst law at 130 h (identical in
all three variants), which is expected and not a CAL-01 damage term. A survived window
(h36 → h46, crossing the h42 boundary) returns alive (`hp 100`, `thirst 31.75`) with the
crop ripe and uncollected, so the next action is a real decision rather than a grant.
A season change never gives a creature sight of the player or the home.

## 6. Persistence (A, migration)

One policy, documented in `persist.ts` and enforced by `normalizeCalendarLedger`:

| stored record | behaviour |
|---|---|
| absent (pre-season save) | **nothing added**; the ledger is derived on the next settlement; run id/startedAt/custody untouched |
| well formed, not ahead of the clock | kept verbatim (an idempotent load cannot re-announce) |
| malformed / wrong version / future-dated / ahead-of-clock | re-anchored from the run clock; never grants, never resets, never skips |

Verified: a future-dated `observedPhase: 7` at h100 becomes `observedPhase 4` at h100.02,
with the same run id, deposited cash and entity count. `b1-storage` deep-equality fixtures
and `m-core-03r` byte-identical snapshots still pass, because a save that never contained a
calendar record is left byte-identical.

## 7. Two connected player choices from distinct families (E)

1. **Preparation vs exposure** (survival/ecology → gardening): spend 4 wood + 4 fiber +
   1 glass + 1 herb on a cold frame **before** winter, or accept the cold-cell winter rate.
   Measured 0.053 → 0.466 rate on the same plot and seed (§4).
2. **Where to farm / when to water** (Map biome → water economy): the warm sand coast grows
   through winter without a frame but evaporates ~1.9× faster in summer, forcing barrel
   refills; the marsh is milder but wetter; the snow cell needs both a frame and stored water.

Both use real source/cost/receipt paths (`STRUCTS`, `GARDEN_FRAME_COST`, `GARDEN_CROPS`,
`stepGardensBarrels`, `stepTenders`) — no fixture-only shortcut, no free output.

## 8. Verification

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` | clean |
| `npx tsc --noEmit -p tsconfig.test.json` | clean |
| `npx vitest run tests/cal01-world-calendar.test.ts` | **29 passed** |
| `npx vitest run --testTimeout=120000` (full) | **107 files / 804 tests passed, 1 skipped, exit 0** (~315 s) |
| `npx vite build` | built, `dist/index.html` single file |
| `node scripts/cal01-season-report.mjs` | `web/evidence/cal01-seasons/season-report.json` |

## 9. Changed files

| File | Change |
|---|---|
| `web/src/game/calendar.ts` | **new** — `world_calendar_v1` state/ledger/event/read-model, `climateAt`, `cropSeasonFactor`, `seasonWeatherWeights`, `normalizeCalendarLedger` |
| `web/src/game/balance.v1.json` | `calendar`, `seasonClimateV1` (offsets/cold/heat/traces), `weather.seasonWeights` |
| `web/src/game/core.ts` | optional `RunState.calendar` ledger field |
| `web/src/game/engine.ts` | season-aware `weatherAt`/`weatherSlot`, `gardenEnvironment`/`stepGardensBarrels`/`tenderBoundary` at `at`, `calendarViewForRun`, `seasonInfo` |
| `web/src/game/thermal.ts` | `seasonCold` part from `climateAt` (0 in the neutral season) |
| `web/src/game/sim.ts` | slice clipping at season boundaries, `commitSeasonBoundaries`, seasonal thirst + trace decay, seasonal tender/garden stepping |
| `web/src/game/persist.ts` | one calendar policy in `validate()`; byte-identical for records that never had one |
| `web/tests/cal01-world-calendar.test.ts` | **new** — 29 boundary/persistence/consequence/no-exploit tests |
| `web/scripts/cal01-season-report.mjs` | **new** — reproducible evidence generator |
| `web/evidence/cal01-seasons/season-report.json` | **new** — the output above |
| `docs/survival/gameplay-depth/CAPABILITY_LEDGER_W00.md` | SYS15-C06 row: `MISSING_NEW_SEASONAL_CLOCK` → `CALENDAR_PRESENT` (mechanics) with its open items kept |

## 10. Closure statement (Atlas/Bible → evidence level)

| Approved capability | Evidence level now |
|---|---|
| Bible §0.1c D-FINAL-02 two-year, eight-season run inside 336 h / last-72 h Ragnarok | **MECHANICS FIXTURE** — boundary vector + run-clock contract + test |
| SYS15-C06 season/multi-day cycles applied to farming/weather | **MECHANICS FIXTURE** — weather weights, garden rate, thermal cold, trace decay |
| SYS15-C03 cold/hot exposure by region | **MECHANICS FIXTURE** — bounded additive part, region-differentiated, 0 in spring |
| SYS15-C09 plant growth and water | **MECHANICS FIXTURE** — seasonal rate + evaporation on real receipts |
| SYS15-C01 hunger/thirst | **MECHANICS FIXTURE** — seasonal thirst multiplier only, baseline unchanged in spring |
| SYS07/R5.1/R6.1 offline defense, projectiles, fuel, receipts, save | **UNCHANGED, full suite green** |
| Native/A0 time contract, day/night length, region amplitude `[CẦN ĐO]`, human long-run value, real second run | **OPEN — not claimed** |

## 11. Non-claims

* Not production-ready; DRAFT PR only, no merge, no force-push.
* No natural-play or enjoyment claim: all time acceleration is the existing `qaAdvance`
  fixture, labelled LOCAL/UNVERIFIED.
* No native Godot/A0 time implementation (A0 owns it); this is the Web mechanics contract.
* No Map, HUD, AVFX or geography change; no new POI, hazard or weather family.
* Seasonal amplitude is a provisional `SOH_PROVISIONAL` parameter awaiting measurement.
