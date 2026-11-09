# MEC-01 R11 evidence

Branch `arena/d968af95-soul-of-hero` · PR #47 (draft, not merged) · Web only.

## P0 — offline terrain-expiry causality

Causal path (code-proven): `sim.ts::advanceWorld` deleted an expired timed terrain entry (ICE/PWALL) without settling
the depleted source on that tile first. Later `advanceRegrowth` then read the underlying soil from the freeze start
onward and counted the frozen hour as growth.

**Reproduced on base `095db99` through the real `settle()` path:** `P0_BEFORE_base.log`
- reference (read before thaw): correct (stock 0 before thaw, 3 after).
- offline jump across thaw with terrain auto-cleanup: stock 3 before the thaw instant → bug.
- online 30 s ticks across thaw: stock 3 before the thaw instant → bug.

**Fix (`sim.ts`, ~L1046):** before deleting an expired entry, `settleRegrowthAt(tile, m.untilAt ?? t)` while the entry
still exists. Only entries expiring in this slice are visited (no world scan). Legacy `until`-only entries use the
slice time.

**After:** `P0_AFTER_fix.log` 6/6 pass: offline vs online vs reference agree; exact first legal completion; dense
(5 s) vs sparse reads give identical stock/hp; save/reload after thaw cleanup keeps the same ledger.

**Remaining temporal limit (stated, not hidden):** a read at a time EARLIER than a sim commit that has already
advanced past it returns the committed state. Reads are exact for forward and same-instant queries (which the game
produces); a stale past-timestamp query after a later commit is not reconstructed (no per-source event history).
Making all reads pure would touch ~16 call sites incl. harvest writes; not done this round.

**Test hygiene:** `tests/_evidenceFs.ts` redirects any `evidence/` write to an OS temp folder unless
`SOH_WRITE_EVIDENCE=1`. Eleven test files import it. Full run no longer mutates tracked evidence
(`mec01-r6/freight-speed-current.json` drift removed from the working tree). Earlier drift was order-dependent state,
not a behaviour change (standalone R10 == HEAD output).

## P1 — exit weather outlook honesty (K2 "dự báo chứ không toàn tri")

Found in code: `engine.ts::wetOutlook` (shown on the exit screen in `panels.tsx`) summed `weatherAt()` over the full
24 h, i.e. the REALIZED future schedule. `balance.v1.json` declares `weather.forecastSlots = 1` but nothing read it.

**Before (base):** seed 310 → 6.0 wet h; seed 311 → 8.1 wet h over the same 24 h from the same clock/season
(`P1_BEFORE_outlook.log`). The outlook leaked seed-specific future weather.

**Change:** first `forecastSlots` slots exact; later instants use the season's wet share
`(rain+storm)/total` of `seasonWeatherWeights(season at that instant)`. Output adds `exactHours`, `exactWetHours`,
`seasonalWetHours`, `reliability`. The UI text now says "exact for the next weather slot, seasonal estimate after".

**After:** seed 310 and 311 give identical `seasonalWetHours` (6.814 h); spring share 4/14 and summer 4/16 verified
(`P1_AFTER_outlook.log`, 70/70 with b2 and cal01).

**Not done (explicit):** exit forecast of thermal/cold exposure (`offlineSurvivalEstimate` scope note excludes it).
It requires a Creator decision on forecast uncertainty and heater-fuel modelling; not invented here.

## Gates
- Focused P0+P1 + related: green (see logs).
- Full Vitest `--testTimeout=60000`: `FULL_VITEST.log` — 121 passed / 1 skipped files, 866 passed / 1 skipped tests, exit 0.
- `tsc --noEmit`: `TSC.log`, exit 0.
- `npx vite build`: `BUILD.log`, exit 0, dist 30,357,96x B.
