# Restart checkpoint — Gold 93 native readiness factory

Written 2026-10-29. Branch `arena/4fa0fa84-soul-of-hero`, HEAD `9f5ec19`.

## Status: GREEN. Runtime CI 40811768711, all 24 jobs success.

https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40811768711

HEAD `36752dc`. Source-native 6/93, source-parity-verified 6/93,
host-adapter-castable 6/93, gold_visual_approved 0/93,
production-integrated 0/93.

### The red job is fixed, and it was never slow

Six runs died with exit code 124 (timeout). It was not a timeout on heavy
work: the step runs in 1.2 s. A `--script` SceneTree does not exit on a
script error, so the test ERRORED and then HUNG until `timeout` killed it.

Two defects behind the error:
1. The lifecycle test lost its `_finish()` call. A splice applied an index
   computed against one file to a different file, truncating the tail that
   calls `quit()`.
2. GDScript binds `%` tighter than `+`, so `"...%s..." + "...no placeholder"
   % id` formats only the second literal and errors.

With the step running, three more defects surfaced that CI had never reached
because they sit after the failing step:
3. `venom_source_native_canvas.gd` assigned to `Image.data` (read-only in
   Godot 4). Now `set_data()`, as the gold_pair canvases do.
4. Two tests hardcoded "exactly 1 native / 92 fail-closed". Both derive the
   split now.
5. The harness asserted `emitted > 0` on a 32-tick window that ends before
   several casts make contact. Moved to the full cast.

### How to reproduce locally (this is what unblocked everything)

A trimmed Godot 4.7 build survived at
`/home/user/tools_build/godot/bin/godot.linuxbsd.editor.x86_64`.
Probe project: copy `prototypes/ game/ data/ docs/` into `/home/user/godotprobe`
plus a minimal `project.godot`, then `--headless --editor --import --quit`,
then `--headless --path . --script res://prototypes/skill_readiness/tests/<t>.gd`.
Do NOT run Godot against the repo itself; the import writes `.uid` sidecars.

If the binary is gone, rebuild trimmed (~40 `module_*_enabled=no` flags,
`use_static_cpp=yes`, `-j2`) - a full editor build does not finish here.

### Next genuinely unimplemented skill: Venomwright 007 Hatchery Fall

Ported in `native/venom/venom_s3.gd`, NOT registered. Measured divergence
against oracle `venomwright_007.json`, seed 7: raster matches for 89 ticks
then diverges at tick 90; hit 22 knockback original `ky=-3.414105` vs port
`ky=-3.414103`; hit counts 30/30 and cue counts 5/5 agree.

`Math.hypot` was the leading suspect - the original measures every distance
with it and the port used `sqrt(x*x + y*y)`. `M.hypot()` is now ported
faithfully and applied throughout `venom_s3.gd`. It did NOT close the gap.

Next thing to actually try: dump the native and original enemy/hatchling
state at ticks 85-90 and diff them. The boids block (original `s2.ts:242-247`)
was compared line by line against the port and matches, so look one level up
- at the hatchling spawn/release and the `Cocoon` rupture pulse that fires
around then - rather than at the flocking maths again.

`v007_source_native.gd` exists but is not in `MODULE_PATHS` or
`SOURCE_NATIVE_IDS`, and `venom_skills.gd` has no case 7. Registering it
before the divergence is closed turns the skill-7 shard red.

## What was already tried (do not repeat)

All of these produced exit 124 in the same step:

| commit | change | result |
|---|---|---|
| `3bafc92` | replaced `emitted > 0` with a strict 1:1 intent-transmission assertion | 124 |
| `3d771ef` | cut the adapter sweep 18 casts → 7, capped at 900 ticks | 124 |
| `49e9919` | cut to 6 × 120 ticks + 1 full cast | 124 |
| `3ae0f85` | cut to a single representative 60-tick cast | 124 |
| `b9c01c1` | memoised `source_native_executable()` probe | 124 |
| `2dd2bae` | reverted the adapter cast out of the lifecycle test entirely | 124 |
| `9f5ec19` | raised the step budget 600 s → 1500 s | 124 (after ~25 min) |

The budget increase is the decisive data point: with 2.5× the time it still
exhausted it, so this is **not** "marginally too much work". It is either a hang
(infinite loop) or something pathologically slow. **Suspect a loop, not a cost
problem.** The most likely candidate is `Gold93SkillHandle.run_to_completion()`
not terminating because `VenomwrightSourceModule.is_finished()` never flips —
`_check_end()` matches on the authored task name (`SKILLS.defs()[id]["name"]`),
and if that string does not exactly match the name `ENGINE.cast()` registered,
the cast runs to its tick cap every time. Verify by printing `w.tasks` names.

## Real work landed and verified green

- **6/21 source-native ports, differential-parity verified.** Seeds 7/21/99, all
  `first_divergent_tick: -1` (bit-exact against the original TypeScript):
  001 Glassfang Hunt, 002, 003, 004, 005, 006.
- **21-shard differential matrix** replacing the serial suite — one job per skill,
  all 21 green, ~4 min for a ported skill vs ~1 min for an unported one.
- **Three-axis contract** in `core/gold93_runtime.gd`: `source_native_executable`,
  `source_parity_verified`, `host_adapter_castable`, plus invariants that
  parity ⊆ source-native and every host-adapter id has a source-native generator.
- **The bridge**: `skills/venomwright/venomwright_source_module.gd`
  (`VenomwrightSourceModule extends Gold93SkillModule`) plus thin ids 002–006 and
  `families/venom_source_native_canvas.gd`. One shared adapter over the
  source-native engine, not six hand-written approximations.
- `venom_s3.gd` holds ported skill 007 (Hatchery Fall) but is **intentionally
  unregistered** — no dispatch case in `venom_skills.gd`. Do not register it
  until the differential reports parity.

## Next genuinely unimplemented skill

**Venomwright 007 Hatchery Fall.** The generator is written and parses; it needs
`venom_skills.gd` case `7: return func(c): return S3.hatchery(c)`, then a
differential run. Then 008 Brine Serpents → 021, then ARCANA III 001–072
(starting with Black Sun Coronation).

## Environment notes for the restart

- A Godot binary does **not** survive a sandbox reset. A trimmed-module build was
  in flight at `/home/user/tools_build/godot` (log `/home/user/tools_build/build.log`).
- The sandbox reset also wipes local git refs/index. Always
  `git fetch origin arena/4fa0fa84-soul-of-hero && git reset --mixed origin/arena/4fa0fa84-soul-of-hero`
  before concluding work is lost — the remote branch is intact.
- `gdparse` (from `pip install --break-system-packages gdtoolkit`) gives syntax
  checking with no engine. It does **not** check identifiers or scope — a splice
  that leaves a block referencing a deleted variable will parse and then die at
  runtime.
- Source escrow: `/home/user/.gold93-private/sources/{venomwright,arcana}/src/game/`,
  outside the repo. Key is local-only; never commit or print it.

## Session update (branch arena/c7b0c4e8-soul-of-hero): V8 math and 007/008 status

Verified in Godot 4.7 on CI (`Gold 93 V8 math bit-exactness`, run 40826230510):
`native/venom/v8_math.gd` is bit-exact against Node v22 vectors for sin, cos,
atan2, hypot, asin, exp, log and pow with exponent 2 (0 mismatches each).
`pow` with a general exponent is still a KNOWN_RESIDUAL (34/1000 mismatches);
`tan` and the large-argument `__kernel_rem_pio2` path are not ported.

**Godot literal precision bug (important for every port).** Godot's GDScript
tokenizer does not round decimal literals with 16+ significant digits
correctly. Example: `6.36619772367581382433e-01` in the tokenizer is one ulp
off, which moves the pi/2 reduction by ~1e-12. All float constants in
`v8_math.gd` are now `static var X = _w2f(hi, lo)` built from exact bits. Do
not write long decimal literals in native GDScript. `venom_math.gd` TAU is
`2.0 * PI` for the same reason.

Regression, same commit: venomwright 001-006 `parity: true`,
`first_divergent_tick: -1` on seed 7 and seed 21 (runtime workflow).

**007 Hatchery Fall: still tick 90.** After the exact sin/cos fix the native
scene hash is unchanged (`7169d7dc...`) and hit 22 is still `ky=-3.414103`
vs original `-3.414105`. So libm sin/cos is NOT the cause. Remaining
candidates (not yet tested): arithmetic order differences (for example
`TAU*i/n` vs `2*PI*i/n`), spawn/release ordering at ticks 85-90, and the
Cocoon rupture pulse.

**008 Brine Serpents: first raster divergence at tick 125.** Hit count 33
vs 32 (an extra native poison hit) and authored shock cue at event 93 is
off: original (296.488, 249.885), native (296.059, 250.800). This is a logic
difference in the serpent chain state (`venom_s4.gd` line ~415-440 uses
`s.ch.s[i]` positions), not a rounding difference.

**Skip vs pass in the runtime workflow.** The runtime differential runs with
`--skip-unported`, so unregistered skills (7, 8, 9-21) report `success` as
SKIP. Only 001-006 are real checks. Do not read a green 007/008 shard as parity.

**009 Molting Harvester: not started.** There is no generator, and the original
TypeScript is not in the repo or the sandbox (escrow key unavailable). A port
needs the source decrypted outside the repo first.

CI reporting: job logs are not downloadable from the sandbox. Verdicts and log
tails are emitted as check-run annotations by
`prototypes/skill_readiness/tools/ci/annotate_log.py`. Read them with
`gh api repos/<repo>/check-runs/<job_id>/annotations`. Note: bash steps run
with `-e`, so capture the Godot exit status with `set +e` first.
