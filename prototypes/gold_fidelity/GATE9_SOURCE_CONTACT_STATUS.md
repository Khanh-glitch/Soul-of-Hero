# Gate 9 — Original enemy motion and enemy-centered contact FX

Date: 2026-10-27. **Status: source-derived modules tested, NOT integrated whole-cast Gold S01.**

## Truth / provenance

The source is the user's original `top-down-sword-vfx-laboratory.zip`, **not** our prior proxy enemy scene. Original `src/engine/actors.ts` was compiled unmodified with `tsc --target ES2020 --module commonjs` and its actual `Enemy.hit()/Enemy.update()/Enemy.center()` executed in Node.js to create numerical oracles.

Original `actors.ts` SHA-256: `6422b09b706705b07a0b13bf695baf981363c1dafb2a283f85457de17e717e57`.

The original `src/engine/fxlib.ts contact()` was likewise compiled and called against original compiled `Blob`, `Part`, `LightFx` plus actual `Enemy`. The seeded fixture uses a 32-bit LCG, source actor constructor consuming its original random draw. These snapshots are **isolated controlled callgraphs**: the full seven-second Gold skill's globally interleaved RNG is not yet reproduced.

## Shipped code

- `gold_s01_enemy_presentation.gd`: exact source hit/knockback/airborne/gravity/bounce/stun/flash/lean/facing equations, enemy-specific mass and dynamically moving `center() = (x,y-z-hc)`. These states cannot write SOH gameplay damage or health. Original actor art is NOT ported in this module.
- `tests/s01_enemy_source_oracle_smoke.gd`: independently replays source Enemy from the original TS on 4 cases: heavy 430 power, grunt 150 up, grunt 150 down, initial heavy 22 power. Checks x/y/z/vx/vy/vz/flash/stun/down/lean/centerY at original tick 0,1,5,15,30,60,90 as available. **Native Godot 4.7 PASS:** [source enemy oracle](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40544108454).
- `gold_s01_contact_source.gd`: direct source `contact` callgraph: use actual *moving* enemy center, flash Blob with source RNG spikes and seed, 14 SILVER sparks for heavy or 6 for grunt, and 46px light. Emits request metadata for hitstop (0.09 heavy / 0.035 grunt) and shake (4/2). No damage or fake drawn-circle substitutes.
- `gold_rupture_glyph.gd`: proper original `SILVER_RAMP` for contact sparks, preserving original `CRIMSON_RAMP` for rupture waves.
- `tests/s01_contact_source_oracle_smoke.gd`: 3 original compiled TS `contact()` oracles, checking exact source RNG end state, flash seed/spikes, spark initial vx/vz/life, 46px light and no gameplay writes. The original source returns 1 Blob + 14 Part + 1 Light for heavy; 1 Blob + 6 Part + 1 Light per grunt. Native 480x270 heavy contact visual captured at 8 ticks. **Native Godot 4.7 PASS:** [source contact emitter CI](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40544884462), artifact `SOH_Gate9_Heavy_Contact_Native.zip`.

The source-contact render is isolated on a dark test surface to distinguish small sparks and flash, not the final Gold S01 appearance or actual enemy art.

## Next required: do not falsely call the skill 'done'

1. Assemble authoritative Gold `World.update` **single-clock** callgraph with S01 actor, hitstop, random calls and timeline; replay exact global seed across setup, 0.55s crouch sparks, dash, early heavy hit, sheets, 13 delayed waves, center and grunt contacts.
2. Integrate the source motion/impact cue with the original enemy sprites/poses and full source `contact()` while maintaining SOH gameplay authority. **Never apply hit damage a second time.**
3. Compare moving full-skill Gold vs Godot at source-equivalent simulation times. Test center 90 ring, attached flashes, 14/6 silver sparks, 46 light, 3 real enemy reactions, hitstop/shake, 7s cleanup. Do not reuse isolated-fixture IoU as whole-cast metrics.
4. Verify 1080p/2K/4K pixel fidelity, camera layer ordering, real Knight adapter, multiplayer/lifecycle if applicable, and runtime performance.
5. Keep branch isolated: no edits to production `game/`, `data/`, `assets/`, `project.godot` or any team's maps. No merge to main until all fidelity gates pass.

The user has asked for continued work without per-step approval and an hourly task automation is enabled. Prioritize source evidence over quickly marking abilities complete.
