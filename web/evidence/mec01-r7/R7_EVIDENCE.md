# MEC-01 R7 — evidence (base 7b76219)

## Cluster implemented: vehicle wear / maintenance (XEDGE-053, SYS09-C07)
LAST ISLAND MECHANIC (Atlas v11 XEDGE-053): engine wear demands repair parts; player chooses repair vs study.
BEFORE (SOH, 7b76219): wearPerPixel 0.002. Measured on the R6 road, 40 kg cargo, 300-unit tank, real tick():
- one full tank (300 units, 300 tiles) cost 12 HP of 200 (fuel ran out first). At this rate hull life ≈ 5000 tiles, so wear never created a maintenance decision in a run.
AFTER: wearPerPixel 0.008 (SOH_PROVISIONAL v3). Same route: one full tank costs 48 HP (200 → 152). Hull ≈ 4 tanks.
Repair unchanged: +50 HP for exactly 1 Mechanical Part + 1 Fastener (negative control: refused with no change when a part is missing).
Ratio: 4× wear per pixel; target derived from "one tank ≈ 1/4 hull life", a design target, not an LI number.
Source of numbers: LI v11 gives no per-pixel wear; ORIGINAL_UNKNOWN. Chosen value is a reversible SOH provisional.

## Code
- web/src/game/balance.v1.json: motorbike.wearPerPixel 0.002 → 0.008; _status v3.
- web/tests/mec01-r7-wear-maintenance.test.ts (new): tank costs 40–60 HP; repair refuses without fastener; repair consumes exactly MP + fastener and restores 50 HP.

## Checks (commands and exits)
- Targeted (11 files: motorbike, b04, b05 freight compare/crude, c2 delivery, c1 chain, r6 freight speed, f3 joined, s10 refinery, s12 airdrop, r7): 67 passed, exit 0.
- tsc --noEmit: exit 0.
- Full Vitest --testTimeout=60000: 114 files passed / 1 skipped; 817 tests passed / 1 skipped; exit 0.
- Default build npx vite build: exit 0; 1 file; 30,352,044 bytes.

## Not done in R7 (honest scope)
- Mining yields per swing/node, loot tiers, smelting batch, research/repair opportunity cost, full LI linked economy calibration: NOT changed this round.
- Bible K/C/J rows and natural-play proof of the wear decision: not done (no browser run of a freight day).
- Repair parts do not yet scale with damage; a fixed 1-part repair stays.
