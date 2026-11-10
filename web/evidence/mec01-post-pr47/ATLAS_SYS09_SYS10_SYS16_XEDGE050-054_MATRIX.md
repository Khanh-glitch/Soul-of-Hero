# MEC-01 post-PR47 — Atlas SYS09 / SYS10 / SYS16 × XEDGE-050–054 bounded matrix

Scope: Web fixture/engine evidence only. Not S3/S4/S5, not visual, not human-enjoyment, not LI 100% parity, not final completion.
Atlas source: branch `docs/gameplay-mechanics-first-policy-20261105` @ `5f4e6c44` (restored to /tmp, not in repo).
Atlas status for every row: `CODE_READ_OR_IMPLEMENTATION_AUDIT_REQUIRED`. Atlas proposals do not override Creator-locked Bible rules.

Evidence levels: FIXTURE (injected state, labelled), SIM (tick()-driven movement / real custody inside a fixture start), NATURAL (none claimed).

## Evidence sources used (existing, not rewritten)
- C1 `tests/mec01-r2-c1-motorbike-chain.test.ts` — FIXTURE stock + real intents; chronology fixed in this round (craft `now = start + dt`).
- C2 `tests/mec01-c2-delivery.test.ts` — same cargo UIDs, walk / hand cart / motorbike, SIM haul via tick(), FIXTURE end placement [F1].
- `tests/b05-freight-compare.test.ts` — walk / cart / motorbike on the same eligible Shipping segment (measured speed, capacity, fuel, wear).
- `tests/b05-freight-crude.test.ts` — crude UID conservation pump → motorbike → refinery → fuel.
- `tests/s10-oil-refinery.test.ts` — refinery batch atomicity, starve/resume, cancel refund.
- `tests/b04-vehicle-unload.test.ts` — stranded motorbike cargo moves to ground bag, same UIDs.
- `tests/motorbike.test.ts` — physical motorbike, fuel on movement only, death keeps parked vehicle.
- C3 pair `tests/mec01-c3-offline-resume.test.ts` / `mec01-c3-offline-child.test.ts` — offline resume (child timeout 120 s).
- R5/R6.1 and browser evidence — referenced from the existing ledger; not re-run in this round.
- F3 (new this round): `tests/escrow-route-physical.test.ts` (PASS this round, exit 0) and `tests/mec01-f3-evac-reset.test.ts` (new, 2/2 PASS).

## Matrix

| Atlas row | XEDGE | Existing SOH evidence | Level | Verdict |
|---|---|---|---|---|
| SYS09-C01 hand carry cost | 050–054 (base) | C2 walking leg, B05 walk | SIM | Partially proven: walking delivers same UIDs; carry cost is not a separate measured curve |
| SYS09-C02 hand cart continuity | 054 | C2 hand cart; B05 cart | SIM | Proven for same route class; capacity measured in B05 |
| SYS09-C03 fuelled land vehicle | 050 | C1, C2 motorbike, B05, motorbike.test | FIXTURE+SIM | Proven for Web fixture: vehicle moves only with fuel; refuel path via refinery (B05 crude) |
| SYS09-C04 vehicle controls/collision | 051 | motorbike.test (obstacles, unsafe deployment blocked) | SIM | Partially proven; road-width route choice NOT tested |
| SYS09-C05 vehicle cargo | 052 | C2 cargo UIDs byte-for-byte; B04 unload to bag | SIM | Proven for cargo custody; metal-to-workstation haul not tested as a separate edge |
| SYS09-C06 fuel burn/refill | 050 | motorbike.test (fuel on movement only); B05 crude → fuel | SIM | Proven for Web fixture |
| SYS09-C07 wear/repair | 053 | C2/B05 measure wear; no repair-parts-vs-study choice test | SIM | Wear measured; repair-vs-study choice UNPROVEN |
| SYS09-C08 breakdown rescue | — | B04 stranded unload (not rescue of vehicle) | SIM | Partially: unload only, no rescue/tow |
| SYS09-C09 boat/water candidate | — | none | — | UNPROVEN / out of scope this round |
| SYS09-C10 vehicle storage/death | — | motorbike.test: parked vehicle kept on death, removed at run end | SIM | Proven for Web fixture |
| SYS09-C11 trip economics | 054 | B05 measured speed/fuel/wear; no net-freight investment threshold | SIM | Partially: measurements exist; investment threshold vs upkeep UNPROVEN |
| SYS10-C01 crude physical source | 050 | b05-freight-crude pump | SIM | Proven for pump source |
| SYS10-C02 oil extraction equipment | — | b05-freight-crude pump | SIM | Partially |
| SYS10-C03 basic fuel early access | 050 | motorbike fuel from refinery (B05) | SIM | Partially: scavenged cans path not compared |
| SYS10-C04 refinery process | 050 | s10-oil-refinery (atomic batch, starve/resume, refund) | SIM | Proven for Web fixture |
| SYS10-C05 fuel grades/consumers | 050 | refinery → Fuel Canister → motorbike | SIM | Partially: single grade |
| SYS10-C06 fuel storage/transport | 050 | B05 bag transport | SIM | Partially |
| SYS10-C07 generator vs vehicle tradeoff | — | none | — | UNPROVEN |
| SYS10-C08 petrochemical sink | — | Lubricant co-product only | SIM | Partially |
| SYS10-C09 risk/environment | — | none | — | UNPROVEN |
| SYS10-C10 offline refining | — | C3 offline resume (general), refinery starve/resume | SIM | Partially: C3 is not refinery-specific |
| SYS10-C11 refinery profitability | — | none | — | UNPROVEN |
| SYS16-C01 stable geography | 051 | geography-contract tests (not re-run) | — | Referenced only; Map-owned |
| SYS16-C02 viable starts | — | none this round | — | UNPROVEN |
| SYS16-C03 source taxonomy | — | none this round | — | UNPROVEN |
| SYS16-C04 biome rewards | — | none this round | — | UNPROVEN |
| SYS16-C05 roadside loot | — | none this round | — | UNPROVEN |
| SYS16-C06 POI landmarks | — | C2 factory toolbox POI (authorized source) | FIXTURE | Partially |
| SYS16-C07 wet terrain/crossings | 051 | none | — | UNPROVEN (XEDGE-051 road-width choice not tested) |
| SYS16-C08 climate hazards | — | none | — | UNPROVEN |
| SYS16-C09 Elder geography optional | — | none | — | UNPROVEN; must not become obligatory |
| SYS16-C10 distance economics | 054 | C2 same-route three-mode comparison | SIM | Partially: one route class |
| SYS16-C11 source save/overlay | — | persist fixtures / saved-map digests | — | Referenced; not re-run |
| SYS16-C12 full Veyra integration | — | none | — | UNPROVEN; Map-owned |

## XEDGE verdicts
- XEDGE-050 (vehicle fuel → refine or scavenge): fuel gating and refinery proven in fixture; scavenged-can alternative not compared. PARTIAL.
- XEDGE-051 (road width → short narrow vs long open route): UNPROVEN. Needs road-width route comparison; Map/geography owned for geometry.
- XEDGE-052 (heavy ingot haul → mine-and-return vs smelt-near-source): UNPROVEN as a choice; cargo custody proven. PARTIAL.
- XEDGE-053 (repair parts vs study): wear measured, repair path and choice UNPROVEN.
- XEDGE-054 (net freight investment vs fuel/upkeep): same-route three-mode measurement exists (C2, B05). Investment threshold UNPROVEN. PARTIAL.

## F3 (Ragnarok cash → escrow → deposit → evacuation → reset → run 2)
- Ragnarok cash purchase of escrow chest: `escrow-route-physical.test.ts` PASS (walks, buys with physical cash, builds, deposits). Exit 0.
- Evacuation: `mec01-f3-evac-reset.test.ts` PASS 2/2. securedCash preserved (7), run ended, run 2 starts with 0 run-local rcash and without run-1 learned recipe `motorbike_kit`. Negative: evacuate away from beacon refused, run and cash intact.
- Fixture labels: injected securedCash, injected rcash, fixture beacon. Not NATURAL_INPUT. No developer grants inside the player path beyond these labelled injections.
- No F3 engine defect confirmed. No engine change made. Gap that remains: no single test runs deposit → evacuate → run 2 in one chain with natural intents only.
- Handoffs for non-MEC-01 ownership: none issued in this round (no external gap confirmed). Map/A0/A3/A7 handoff NOT sent; to send only if the gap is confirmed in their domains.

## Not done in this round
- LI motorcycle/gear/frame BOM and economics reconciliation (task 3): NOT done.
- Build gates on commit 4883246 (this runner, 3.9 GiB RAM):
  - `npx tsc --noEmit`: exit 0.
  - Full Vitest `--testTimeout=60000`: 110 files passed / 1 skipped, 812 tests passed / 1 skipped, exit 0.
  - No-single-file build (temp config, outDir /tmp): exit 0.
  - Single-file build (`npx vite build`, outDir /tmp/soh-single-dist): exit 0, index.html ~30.35 kB (gzip 20.13 kB), one run.
  - Earlier exit 137 was with `--outDir dist-http-qa` inside the repo. It was not reproduced with outDir in /tmp. The default outDir (`dist`) was not tested. The earlier 137 is not claimed as resolved in general; this is one measured PASS.
- LI motorcycle/gear/frame BOM reconciliation: NOT done in this round.
- Control Tower / ledger: NOT updated in this round (no owner-reviewed handoff yet).
