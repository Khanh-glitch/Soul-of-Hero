# Ironholm — from a warehouse stack to a lit ore yard

Ironholm Foundry already generated a workshop engineer, a warehouse with finite charcoal, and an authored **Ore Yard**, but not a powered yard device. New geographic runs now install one village-owned generator, one cable and one work light on a clear three-tile strip of the yard. The tank starts empty; no fuel was added to the economy. Existing saves are not retrofitted. This is a dedicated lamp circuit, not a village connection to the player's electrical network.

**Ordinary New Game, seed 7606:** the natural test advances time and reloads one validated save. It never assigns a job, adds inventory, moves the engineer, or switches on a device. [Receipts and checkpoint](natural-7606.json); times below are simulated seconds after start.

| Time | Observation |
| --- | --- |
| +24.915, +294.001 | Engineer `he` loads the two charcoal units they started with, one per visit. These are not warehouse deliveries. |
| +578.475 | After exhausting personal fuel, `he` withdraws **one** charcoal from `s18s` in store `c18q`. The received unit is `s3cp` in pack `c19c`. |
| +600.990 | The same `s3cp` reaches tank `c2tl` and burns once on generator `e2ti`. The sole allocated load is the ore-yard light `e2tk` via cable `e2tj`. One charcoal pays for 55 fuel-seconds. |
| +610.000 | Reload with the light lit and 45.990 fuel-seconds remaining. Same tank and energy after validation. |
| +660.000 | First ten-second sample after exhaustion: zero energy, no allocated load, light dark. No second debit of `s3cp`. |

The renderer uses that powered state both for the bulb and for the nighttime light radius. The yard fixture is read-only to the player. Controlled tests (not natural evidence) cover a changed fuel UID, full tank, competing supply, wrong owner, broken or misplaced cable, and reserved charcoal beside an otherwise usable unit. The exhaustion check brackets the final millisecond. This does not demonstrate power to furnaces, exported energy, or autonomous construction of new circuits.

From `web/`:

```sh
npm test -- --maxWorkers=1 tests/{npc-natural-engineer,npc-engineer-fuel,industrial-power,k6-power,w07-power-offline-parity,wp2-power-global-obstacles}.test.ts
```

Verification: 21/21 tests in the six suites above, plus all four New Game regressions for mechanic, foundry, gardener and medic. Test TypeScript and production build passed (Vite chunk-size warning). The W07/WP2 fixture builders now supply the required packed device or door host; their power assertions are unchanged.
