# Venomwright 020 Plague Cartography: tick-180 raster blocker

Status: **NOT REGISTERED. No PASS is claimed.** 020 stays a candidate (`venom_r20.gd`), outside `SOURCE_NATIVE_IDS`, `MODULE_PATHS` and the parity index. It remains in the unresolved queue with 007, 008, 013, 015 and 016.

## What the existing evidence shows

Recorded oracle `docs/vfx/skill_readiness/oracle/venomwright_020.json` (immutable, read only). Sampled rows at ticks 160–200 (every 5 ticks), all with 16 enemies:

| tick | fx | parts | scene sha256 (first 8) | glow sha256 (first 8) |
|---|---|---|---|---|
| 160 | 20 | 27 | 63241ba2 | 2a68cd19 |
| 165 | 19 | 21 | 4c8866e5 | 9cb55079 |
| 170 | 22 | 32 | 6cc2ca15 | ea28f9b1 |
| 175 | 25 | 28 | 4531f07b | 5cd68ac6 |
| 180 | 22 | 27 | e87f64a4 | 2a81bf36 |
| 185 | 18 | 27 | 3356a2ce | 5aab0b7c |

- Cast tick 1, oracle length 445 ticks (7.4 s). The skill's authored duration is 9 s.
- The recorded hit and cue logs are complete. The native logs match them in full: hits 79/79 and cues 135/135, from run `40873041022`, job `123444719431` (see `RESTART_CHECKPOINT.md`).
- So timing, events, RNG and object creation agree with the original up to the raster. The divergence is in the raster content at tick 180, which is 3.0 s into the cast.
- Native timed diagnostics from run `40876542432` (commit `4eb26b6`) ruled out the Pulse and reservoir activation path. All 12 activations happen at 3.48–5.87 s. At tick 180 the native world has 21 `kind=fx` gnd-only objects, which are `Splash` and `Embed` objects from walk-phase `drops` particles. The oracle's recorded total at tick 180 is fx 22. The native fx and particle counts at tick 180 were not compared directly, because the first-mismatch report checks scene and glow hashes before counts.

## Remaining candidates (from the checkpoint, unresolved)

1. Draw order, or raster content, of the walk-phase particles (`venom_fx.gd` lines 159–163 against `fx.ts` 60–67).
2. `FlowNet` width lerp during the 0.55 s branch widening.
3. The closing `Flash`.

## Why this cannot be closed from the repository

Closing it needs one of the following, and neither exists in the repository or the sandbox:

- **The original raster at tick 180.** Only SHA-256 hashes are committed, so no pixel diff can be computed.
- **The original per-object state at tick 180** (Splash/Embed positions, sizes, alpha and draw index). That needs the original TypeScript `src/game/skills/s4.ts` and `fx.ts` executed in a headless Node or browser harness.

Both depend on the original Venomwright archive (SHA-256 `ab0dba56…`). It is decrypted only with `GOLD93_ARCHIVE_KEY`, which is not set in this environment, and `/tmp/gold93-src` is gone. The owner asked that the key not be requested again during this task. The original TypeScript is therefore essential, and this document records the blocker instead of guessing or redesigning the effect.

## Exact unblock steps (when the archive is available)

1. Decrypt into `/tmp/gold93-original-sources/` with the existing script and verify SHA-256 `ab0dba56…`.
2. Run the original `s4.ts` Venomwright 020 generator headlessly for ticks 1–180 and dump the drawn Splash/Embed/Flash objects and the draw order at tick 180.
3. Add a native-only dump of the same fields from `venom_r20.gd`, then diff in order. The first differing field is the fix target.
4. Re-run the 020 differential in CI with `--skill=20`. Only a passing differential may move 020 to SOURCE_PARITY_VERIFIED.

Until then 020 stays unregistered. Its tick-180 raster mismatch is not counted as passing, and no tolerance is loosened.
