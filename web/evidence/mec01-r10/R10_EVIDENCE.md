# MEC-01 R10 evidence: wild renewable regrowth × soil / moisture / biome / slope / season / altered ground

Branch `arena/d968af95-soul-of-hero` · PR #47 (draft) · Web only (native Godot not touched, not accepted here).
Scope: risk-only Vitest on real engine functions over the fixed Map. Fixtures are labelled FIXTURE. Not visual, not human play, not Godot native.

## Chain (Bible K2–K4 → SOH)

BIBLE / LI SOURCE → SOH EXISTING → PROVEN GAP → PRODUCT CODE → NEW CAUSAL CHOICE

- BIBLE / LI SOURCE: wild plant regrowth interval is ORIGINAL_UNKNOWN in the LI sources read (LEGACY-U05). Base seconds stay the SOH_PROVISIONAL catalog values (bush 420, grass 300, reed 360, herb 600, mushroom 600). No retune to hours.
- SOH EXISTING (R9): season + local temperature integrated regrowth; occupancy suppresses refill; weather not an input.
- PROVEN GAP (R9 → R10): regrowth ignored the ground itself. Frozen (ICE), walled (PWALL), molten (LAVA) and burnt (BURNT) tiles, and the substrate (biome/moisture/slope) did not affect a wild plant. The garden already had this model (`gardenEnvironment`); the wild plant did not.
- PRODUCT CODE:
  - `engine.ts`: `soilFertility()` is the single soil authority. The garden now calls it with identical numbers (verified by a regression test against the former formula).
  - `wildRegrowRate` = max(minRate, climate × season factor) × soil(biome, SEASONAL local moisture, slope). Suppression → 0.
  - `regrowSuppressed` (physical hard stop: ICE / PWALL / LAVA / BURNT) is distinct from the slow factors. Dry, cold or sloped ground slows growth but does not stop it.
  - `terrainAtAbs` and absolute `untilAt` on timed terrain. Legacy `until`-only entries still work.
  - `settleRegrowthAt` runs before any terrain write (frost ring, freezeTile, PWALL writer, garden restore) so earlier time never takes a new terrain state.
  - `advanceRegrowth` splits its integral at a timed terrain expiry; refill gate requires "not suppressed at now".
  - `persist.ts` rejects a non-finite `untilAt`.
- NEW CAUSAL CHOICE: the same bush yields a different rate on fertile vs poor ground and a different rate by season. Wild gathering reads the seasonal moisture; the garden reads the watered Map value. Whether to harvest wild in a dry season or to plant in a garden is now a real trade. Garden-vs-wild output was NOT measured side by side this round (see gaps).

## Tests

`web/tests/mec01-r10-soil-regrowth.test.ts`: 12 tests, all pass.
- Soil regression: `soilFertility` equals the former garden table for 8 cases; clamp [0.3, 1].
- Two substrate states on the same bush type: fertile completes before poor; both complete (no permanent loss).
- FIXTURE frozen ground: zero accrual while ICE; completion = expiry + remaining/rate (±5 s).
- FIXTURE BURNT override: no regrowth while burnt; after removal only banked progress (~1 s), not an instant refill.
- Read-independence across a freeze and a season boundary: frequent polling vs one late read give the same stock and hp; first positive read not before freeze end.
- Legacy `until`-only terrain honoured against the sim clock.
- Save/reload mid-freeze: absolute `untilAt` survives round-trip; non-finite `untilAt` rejected.
- Rate bounds: all renewable wild sites, all seasons, within [0.15, 2].
- Output/day comparison, and "nothing minted": one stock per cycle, a second read in the same window adds nothing.
- Consumer chain (symbols only): bush → berries (food hunger 8) + seed bonus; herb → herb (food hp 6) → medkit (bandage 2 + herb 2); garden herb and crop inputs use seed/herb. No new item or recipe added. No missing consumer proven.
- Starter not starved: median renewable rate on the fixed Map stays ≥ 0.4 in every season (spring 1.000, summer 1.016, autumn 0.900, winter 0.550).

R9 test `mec01-r9-wild-regrowth.test.ts`: 11/11 still pass. ONE assertion changed: the lower bound moved from 0.5 to 0.15 (= minRate 0.5 × soil floor 0.3), because soil now multiplies the rate. Upper bound 2 unchanged. Disclosed here, not hidden.

## Measurements (`FOCUSED_r10_r9.log`, console `[R10 MEASURE]` lines)

- Same bush, neutral season: fertile soil 1.000 → rate 1.0000 (cooldown 420 s); poor soil 0.977 → rate 0.9765 (cooldown 430 s).
- Per-season output/day, bush, top vs bottom soil quartile (n = 438 bushes, quartile = 109):
  - summer: 638.7 vs 633.5 (ratio 0.992)
  - autumn: 555.4 vs 550.7 (ratio 0.992)
  - winter: 339.4 vs 307.5 (ratio 0.906)
- Interpretation: on seed 310 soil is a small lever in summer and a clear one in winter (cold × substrate). The effect is real but modest; it is not a dominant summer factor on this Map. Recorded, not tuned.

## Risks and gaps (stated, not hidden)

- Per-bush output/day (617 at fertile ground) is a ceiling assuming the player harvests the moment it returns, from the SOH_PROVISIONAL 420 s base. The player's visit rate, not regrowth, is the real constraint. No retune was made (per R10 order: no hour-scale scarcity retune without evidence).
- Frost/PWALL writers are exercised by code order and by the ICE fixture, not by a full sim tick. The writer ordering is a code-inspection result.
- Garden-vs-wild output was not measured side by side in R10; the "genuine alternative" is established by the moisture difference (seasonal wild vs watered garden), not by a measured trade-off.
- Weather is not an input to regrowth (unchanged R9 decision).
- Evidence side effect: several existing test files rewrite `web/evidence/*` JSON on every run. In this round a full run changed `mec01-r6/freight-speed-current.json` (`wearHp`). Standalone runs of that test on R10 and on HEAD gave identical output, so the drift is test-order state, not R10. Those four files were restored to HEAD and are not part of this commit.

## Gates

- Focused (R10 + R9): `FOCUSED_r10_r9.log`, 2 files, 23 tests passed, exit 0.
- Full Vitest `--testTimeout=60000`: `FULL_VITEST.log`, 119 files passed / 1 skipped, 856 tests passed / 1 skipped, exit 0.
- `tsc --noEmit`: `TSC.log`, exit 0.
- Default `npx vite build`: `BUILD.log`, exit 0, dist 30,357,549 B.
