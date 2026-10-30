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

**009 Molting Harvester: source parity verified** (run 40830034083 on `f6f36f8`,
job 123302218901). Ported from the decrypted original `s2.ts` 409-535 into
`native/venom/venom_s2_harvester.gd`. `parity: true`, `first_divergent_tick: -1`
on seed 7 (440 ticks, 104 sampled rows). Still needs owner visual approval and
production integration.

**010 The Walking Crucible: source parity verified** (run 40832336038 on
`5ecb4aa`, job 123309419652). Ported line-by-line from `s2.ts` 531-684 into
`native/venom/venom_s2_crucible.gd`. The shared `FlowNet` and `mkBranch`
(`lib.ts` 136-247) are in `native/venom/venom_flow.gd`. `parity: true`,
`first_divergent_tick: -1` on seed 7 (840 ticks, 184 sampled rows, 82 hits,
89 cues). Still needs owner visual approval and production integration.

Registered native ids are 1-6, 9 and 10. All of them are verified against the
original TypeScript on seed 7. 001-006 are also verified on seed 21. 009 and 010
have only seed-7 oracles on disk. The 007 and 008 divergences are unchanged and out
of scope for this session.

**Porting rule that held for 009 and 010.** Re-read the original TypeScript before
every port, not recalled code. Inner GDScript classes cannot call the outer
script's static helpers, so each inner class carries its own copy (for example,
`_lf` in `Crucible` and `FlowNet`). Draw callbacks receive five arguments
(`g, x, y - z, z, a, self`), and `Custom` callbacks receive `(g, age/life, self)`.

CI reporting: job logs are not downloadable from the sandbox. Verdicts and log
tails are emitted as check-run annotations by
`prototypes/skill_readiness/tools/ci/annotate_log.py`. Read them with
`gh api repos/<repo>/check-runs/<job_id>/annotations`. Note: bash steps run
with `-e`, so capture the Godot exit status with `set +e` first.

## Venomwright 011-016 status (latest checkpoint)

Verified on remote Godot 4.7 (`first_divergent_tick: -1`, seed 7):
- 011 Catalyst (run 40836889066), 012 Verdigris (run 40839728409), 014 Cascade
  (run 40840130966 and run 40840839754, job 14).
- Regression on `770d951`: 001, 006, 009, 010, 011, 012, 014 still pass.

Written and registered, NOT source-parity verified:
- 013 Garden (`venom_s3_garden.gd`, id 13). CI job fails with no output
  (runs 40839971799, 40840839754, 40842437136, 40845135970, 40847085577,
  40848940298).
- 015 Vat (`venom_s3_vat.gd`, id 15). Same silent failure.
- 016 Crystal Rot (`venom_s3_rot.gd`, id 16, commit `d1c49f0`). Same silent failure
  on its first run (runs 40842557140 and later).

Diagnosis so far for 013/015/016 (not conclusive):
- The differential step ends about 60 s after it starts, with no `::error::`
  lines, not even for its own failure message. Skill 014 runs about 65 s and passes.
- Refuted: a `stdout` buffering loss (`stdbuf` changed nothing), and generator
  threads still parked at exit (`drain_all()` added in `770d951`, no change).
- Not yet known: whether the runner or Godot process is killed (suspect a memory
  blow-up in these three generators), or whether the test fails before the first
  step. Verbose step lines were added with `printerr` in `b3d8abc`, but they did
  not appear in the annotations for passing or failing jobs, so they cannot
  localise the failure yet.
- Next debugging step: reproduce memory growth locally with a Godot build if one
  becomes available, or bisect the three generators by early `return`s in CI.

Not started: 017-021 (`s4.ts` 11-189 read for 017), 007/008 discrepancies, and
ARCANA 001-072.

## Real verdicts for 013, 015, 016 (run 40857702000 on `2c062d0`)

The earlier "silent failure" was not a crash. The differential step ran, but its
verdict never reached the annotations. The always-run diagnostics step
(`Venomwright differential diagnostics (always)`) now reports the log tail.

- 013 Garden: hits 7/7 match, glow matches, scene hash first diverges at tick 320
  (the last oracle tick). Mismatch is in the scene raster only.
- 015 Vat: `parity: false`, 79 sampled rows, 34 original hits. Divergent tick not
  yet read from the log tail.
- 016 Crystal Rot: hits 15/15 match, glow matches, scene hash first diverges at
  tick 195.

Memory and disk were never the cause: peak RSS was about 207 MB, free disk 85 GB,
MemAvailable about 15 GB. The `setsid` change and watchdog are kept as diagnostics.

## State after run 40861447433 on `6db5a1d`

Regression: 001-006, 009, 010, 011, 012 and 014 all still PASS.

- 013 Garden, still unverified. Scene first diverges at tick 320. The six live
  shots at tick 320 are the Flower bloom shots (`age=0.067`, `z=5`, `sy=0`).
  Native `Shot` now matches `fx.ts` `Shot.upd` (commit `6db5a1d`). Shot
  constructor arguments match `s3.ts` 197-200. The remaining mismatch is not
  yet localised. Candidates: the shot `air` draw (`shard` + ellipse) or the
  position integration per frame.
- 015 Vat, unverified. `parity: false`, `first_divergent_tick: -1`, so the
  mismatch is in hits or cues, not the raster. Next: read `hit_mismatch` and
  `cue_mismatch` from the always-step output. Its JSON fields were cut by the
  diagnostic grep, which needs `\t`-indented keys.
- 016 Crystal Rot, unverified. Scene first diverges at tick 195. Trace at that
  tick shows native `fx` objects with `up` hooks and a `Custom` with all four hooks.

CI diagnostics that are now in place (kept, cheap): watchdog with RSS, log size
and disk limits; `setsid` for Godot; an `if: always()` diagnostics step that
prints the trace and the key JSON fields as notices.

Sequencing: 017 (`s4.ts` 11-99) is read but not written. 018-021, 007/008 and
ARCANA 001-072 are not started.

## 017 Reverse Extraction: candidate blocker (open)

- Runs: `40864102529` (`945167e`), `40864438265` (`020b3cc`), `40864970748` (`c5f19fe`), `40865231544` (`2d5f69f`).
- Symptom: native 0/44 hits and 0/45 cues, raster diverges at tick 2. Each tick logs
  `SCRIPT ERROR: Invalid call. Nonexistent function 'is_valid' in base 'Nil'` at `venom_world.gd:603`
  (`t["gen"]` is nil). Cast tick is 1.
- Ruled out: registry `venom_skills.run_factory` has no arm for 17 and returns null, so the candidate
  factory is used. Candidates 007 and 008 in the same run have no nil-generator error. No compile or
  preload error appears for `venom_r17.gd`.
- Unresolved: markers `R17 candidate factory invoked` and `R17 extraction factory gen_null=` never appear
  in annotations, even after `annotate_log.py` was changed to keep the first 60 matches (`2d5f69f`).
  The marker lines are absent from every candidate-lane annotation, so `R17.extraction` is not reached.
- Tool fix (kept): `annotate_log.py` previously kept only the last 200 matches. Repeated SCRIPT ERROR
  lines pushed early evidence out. It now keeps the first 60 and the last 140. The candidate workflow
  pattern now includes `R17`.
- Next step: determine why the candidate closure from `venom_candidates.run_factory(17)` does not run
  during `ENGINE.cast` (`venom_engine.gd:187`). Options: print from the test harness at the cast point
  (`gold93_venom_differential_test.gd:377-380`), or trace what `factory.call(c)` returns. Do not change
  generator logic before this is known.

## 017-021 status (branch arena/c7b0c4e8-soul-of-hero, 2026-10-29)

Verified against the original TypeScript (seed 7, first_divergent_tick -1), recorded in `docs/vfx/skill_readiness/parity/index.json`:

| Skill | Port | Registry | Evidence |
|---|---|---|---|
| 017 Reverse Extraction | `venom_r17.gd` | registered (`01d1780`) | run 40870350179, job 123435508257: cues 45/45, hits 44/44. Main-lane regression run 40871453817 (`e52001c`): 017 success. |
| 018 Bitter Rain | `venom_r18.gd` | registered (`3607387`) | candidate run 40871453819, job 123439265843: cues 12/12, hits 11/11; reproduced in 40873041022 (`56ee285`). |
| 019 False Remedy | `venom_r19.gd` | registered (`d50f4a0`) | candidate run 40872333988, job 123442298081 (`b58aa3c`): cues 138/138, hits 10/10. |
| 020 Plague Cartography | `venom_r20.gd` | candidate only | `56ee285` run 40873041022, job 123444719431: hits 79/79 and cues 135/135 match; first raster divergence at tick 180. |
| 021 The Last Distillation | `venom_r21.gd` | registered (`4eb26b6`) | candidate run 40875117169, job 123451839886 (`e10ac66`): parity true, `first_divergent_tick -1`, hits 132/132, cues 192/192. Runtime regression run 40876542573 (`4eb26b6`): job 123463648343 `parity: true`, `first_divergent_tick -1`. Runtime PASS set in that run: 1-6, 9-12, 14, 17, 18, 19, 21; the run failed only on 13, 15, 16 (expected open items). |

Root causes found this session (all visible in annotations):

- The runtime path guard rejected `docs/vfx/acceptance/ACCEPTANCE_STATES.md`. The guard allows only `docs/vfx/skill_readiness/**`, `prototypes/skill_readiness/**`, and `.github/workflows/gold-93-readiness-*.yml`. The file moved to `docs/vfx/skill_readiness/ACCEPTANCE_STATES.md` (`e52001c`).
- `M.PI` does not exist in `venom_math.gd`. The GDScript constant is `PI`. Two ports hit this (017, 019). gdparse does not catch it.
- Inner classes cannot call the outer script's static helpers. `Pulse` (020) and `Column`/`Chamber` (021) each need their own `_p`. The parse error broke the whole candidate file, which surfaced as `Invalid call ... 'is_valid' in base 'Nil'` at `venom_world.gd:603`. That message means a nil generator; it is a consequence, not the cause.
- Particle `fn` callbacks run as `p.fn.call(p, w, dt)`, so they need three arguments.

Open items:

- 020 tick-180 raster divergence (candidate, not registered). Narrowed with timed diagnostics from run 40876542432 (commit 4eb26b6, job 123456713070; the TEMP-DIAG lines were removed afterwards):
  - Tick 180 is t = 3.0 s. All 12 reservoir activations happen at t = 3.48-5.87 s, so Pulses and activation effects do not exist at tick 180. Pulses were ruled out.
  - Pulse creation was verified against TS: `best` is found for all 12 reservoirs, each creates a dir +1 and a dir -1 Pulse, and `Pulse` init/upd/gnd/lit match `s4.ts` 258-273.
  - The 21 `kind=fx` gnd-only objects at tick 180 are `Splash`/`Embed` objects created by landing walk-phase `drops` particles (`venom_fx.gd` 159-163, matching `fx.ts` 60-67). The walk loop, `drops` defaults and `Splash` gnd were checked line by line against the TS and match.
  - Remaining candidates: draw order or raster content of the walk-phase particles, `FlowNet` width lerp during the 0.55 s branch widening, or the closing `Flash`. Needs a raster-level diff at tick 180 or a per-object dump of Splash/Drop state. Not resolved.
- 021: re-run after `e10ac66` to read the next divergence.
- Registry runtime lane for 018 and 019 (`40873595693`, `40873147804`): pending at time of writing.
- Still open from earlier: 013 tick-320 raster, 015 event-32 knockback, 016 tick-195 raster, 007 tick-90 and 008 tick-125 candidates.
- Note: the `PASS` lines beside `SKIP skill N (generator not ported)` in the runtime lane are placeholders, not verdicts.

## ARCANA III status (not started; verification method needs a decision)

- Source: `ARCANA_III_V2_72_SKILLS_FULLFX_2X.zip` decrypted to `/tmp/gold93-original-sources/` (SHA-256 `8402633c...` verified). Extracted to `/tmp/gold93-arcana/` (outside the repo). Skill files: `src/skills/{eclipse,dragonbone,fan,spindle,lantern,v2-independent,v2-fusion,remixes,index}.ts`; engine `src/engine/core.ts` (41 KB) plus `draw.ts`, `sprites.ts`, `post.ts`, `fx.ts`, `pixtex.ts`.
- Renderer: PixiJS 8 WebGL multipass at 480x270. There is no CPU-deterministic frame, so the Venomwright raster-hash differential cannot be used as-is. Headless Godot in CI has no WebGL reference. Options are recorded in the session summary.
- Skill 1 "Black Sun Coronation" is `ECLIPSE[0]` in `eclipse.ts` (id 1, dur 10, 4 phases). Its `setup(c: Ctx)` depends on the engine's particle, layer, and post stack.
- No ARCANA native module, no oracle, and no parity record exists yet.

## Session checkpoint: native runtime gates and host castability (CI bec65d1)

Evidence: native runtime run `40930552334` at `bec65d1`, read from check-run annotations.

- Lifecycle, baseline oracle, 93-id Lab walk, render, capture, ports, family, world diff, ground and per-skill harness (all 93) all pass.
- Host adapters pass for 15 Venomwright ids: 001–006, 009–012, 014, 017–019, 021. Each one checks canonical id, cancel, full cast, replay, dispose and the Lab. Library level only (HOST_CASTABLE_VERIFIED), not production integration.
- Still red, as before: differential for 013 (tick-320 raster), 015 (event-32 knockback) and 016 (tick-195 raster). Candidate 007, 008 and 020 also still fail. These are not regressions. They are unregistered or unresolved.

What was broken in the runtime gates and is now fixed (not weakened):

1. Lifecycle and Lab-walk hang: `VenomWorld.drain_all()` released parked generator bodies directly. A body parked in `y()` waits on the world clock. Released with `_kill`, `y()` returns at once while `time` stands still, so an authored loop conditioned on world time never exits. `drain_all()` now settles the discarded world on its own clock, bounded to 60 s, before releasing what remains. Nothing from that settle reaches a host.
   - The cancel contract in `venomwright_source_module.gd` was updated to say so.
   - The pilot still passes (`f5c530d`).
2. Canvas nil on first upload (harness, skill 011): `VenomSourceNativeCanvas` creates its sprites on demand now.
3. Lab test: the Lab scene is awaited until ready, the Lab resolves its nodes by path, and the Lab is removed after a frame. The `bool()` call on a string control was replaced by a typed formatter.
4. `run_gate.sh` escalates to SIGKILL (`timeout -k 30`). A Godot process that ignores SIGTERM no longer blocks the job until its job timeout.
5. Harness fixture: three more reachable targets on the caster side. 011's recorded hits sit at x 222–260, which the old fixture did not reach.
6. Host test: the raster assertion applies only to sources that produce VenomWorld rasters. Skill 001 renders through the gold_pair family path.

Open, not started this session:
- 020 tick-180 raster: still blocked on the original TypeScript and archive key. See `VENOMWRIGHT_020_TICK180_BLOCKER.md`.
- 013, 015, 016 and 007, 008 differentials: unchanged.
- ARCANA III: still blocked on the original archive.
- Manifest evidence pointers: `source_numeric_oracle` is now the per-skill `docs/vfx/skill_readiness/oracle/venomwright_NNN.json` for each host-castable entry (all 15 files exist). The earlier generic `prototypes/gold_pair/tests` pointer is removed. `per_skill_harness` and `render_surface` point at CI artifacts under `.artifacts/`, which are not committed.

## Session checkpoint: round directive 2026-10-30 (006/010 compositing, 021 timing, vault access)

### Private source vault: BLOCKED (permission, not key)
- `git clone` of `Khanh-glitch/APEX-CHAOS-ASSET-VAULT` (branch `handoff/gold93-original-sources-20261030`) returned `HTTP 403`, "Write access to repository not granted".
- `gh api repos/Khanh-glitch/APEX-CHAOS-ASSET-VAULT` returned `403 Resource not accessible by integration`. The sandbox `gh` token authenticates as `Khanh-glitch` but has no read permission on the vault.
- No GitHub connector is available in this conversation (`list_connector_tools github` → unsupported).
- Consequence: the original TypeScript/PixiJS sources (Venomwright and ARCANA III) are not available. Nothing below claims parity against them. No ZIP, hash or plaintext was fetched, stored or committed.
- Needed to unblock: read access for the Arena GitHub identity to the vault, or the owner reconnecting GitHub in Arena. Then the SHA-256 check in `GOLD93_PRIVATE_SOURCE_ACCESS.md` step 2 comes first.

### 006 / 010 real-map compositing: cause and fix (presentation overlay only)
Root cause, from the native code (not from a visual guess):
1. The overlay cleared the scene raster to OPAQUE BLACK and composited it with `BLEND_MODE_ADD`. Black adds nothing, so the scene only ever contributed light. Solid and translucent effect pixels (dark bodies, smoke, acid) could not occlude the map. That is the washed-out look.
2. The raster has no coverage. Partial-coverage draws use Bayer dithering (`dl < 16`), so an effect is a pattern of unpainted pixels. In GOLD those holes show the ground. In the overlay they showed black, so the map was lost in holes.
3. Scene and glow were both additive, so the map was never occluded by the effect body.

Fix (`venom_pixel.gd`, `venom_pilot_stage.gd`, `venom_pilot_real_map_test.gd`):
- `Layer.cov` (default false). When true, the alpha byte carries coverage: opaque writes 255, partial writes `a + A*(1-a)`, additive light leaves coverage unchanged. RGB math is unchanged, so the buffer is premultiplied.
- The overlay scene clears to transparent and is composited with `BLEND_MODE_PREMULT_ALPHA`. Unpainted pixels show the real map. Solid and translucent effects occlude it. Additive light stays additive. The glow layer stays `ADD`.
- The GOLD path (`cov = false`, `copy_from(ground)`) is untouched, so the oracle raster hashes cannot change.
- `legacy_additive` keeps the previous composite, only as the A/B baseline.

Map darkening (`venom_map_darkening.gd`, host presentation only):
- Changes only the `modulate` of `Level.backdrop`, `Level.geometry` and `Level.decor`. Knight, enemies, HUD, text, VFX, glow, particles and hit flashes are not attached, so they are never touched.
- Default strength 0.12 (RGB ×0.88), clamped 0.0–0.25. Fade in 0.12 s, fade out 0.20 s, sim-time. One shared level and an owner set, so overlapping casts do not flicker. OFF (`enabled = false`) and `restore()` return the exact original modulate.
- It is NOT in the source-native renderer, and the darkening is not a fix for the compositing error.
- Lab UI control is not implemented. The parameters exist on the controller only.

A/B capture plan (`real_map/venom_pilot_real_map_test.gd`), same seed, cast tick and ticks per mode:
- B `gold_isolated`: native GOLD-mode render, isolated 1200×680 viewport.
- C `legacy_additive`: previous real-map composite (baseline).
- D `coverage`: corrected composite, darkening OFF.
- E `coverage_darkened`: corrected composite, darkening ON.
- A original GOLD: NOT rendered. An `s0NN_gold_original_UNAVAILABLE.txt` record states the vault 403. Nothing is substituted.
- Checkpoints from the oracle timeline (tick = 1 + round(t×60)): 006 anticipation 7, wind-up 16, impact 25, peak 335, finisher 354, aftermath 385. 010 anticipation 7, wind-up 31, impact 54, peak 715, finisher 821, aftermath 840.
- `ab_index.json` lists every frame with uncovered-pixel fraction and darkening level.
- NOT done: a rendered interactive demo with toggles (the capture is headless), and the common desktop scaling review (150%).

Unit gates (`tests/venom_presentation_unit_test.gd`): coverage raster semantics, GOLD alpha stays 255, darkening OFF is exact, fade times, overlap monotonicity, exact restore, strength clamp, non-map items untouched. Wired into the pilot-headless job.

### 021 host adapter runtime: profile and bounds
Profile, from the code paths (not measured here; no local Godot):
- Every `venom_world.draw()` runs per tick and is not pure: `venom_fx.gd` calls `w.rng.next()` and `w.parts.add(...)` from the draw path. So rendering cannot be deferred or skipped without changing RNG and parity. This is kept.
- Found and removed: `VenomwrightSourceModule._render()` ran `_count_ink()`, a GDScript scan of the scene raster, on every tick, purely for an informational stat. It now runs only when `frame_payload()` is requested. `ink_peak` tracking is removed.
- Found and fixed: `VenomLayer.clear()` wrote every pixel in a GDScript loop, on every tick, for the glow layer. It now doubles a native block to produce the same bytes.
- Measured wall-clock acceptance (`gold93_host_adapter_skill_test.gd`): cancel ≤ 20 s, dispose after cancel ≤ 20 s, dispose after a finished cast ≤ 20 s, lab release ≤ 20 s, full cast / replay / Lab run ≤ 180 s each. Exceeding a bound FAILS. Timings print as `GOLD93_HOST_ADAPTER_TIMING`.
- Not done: thread-handoff measurement, overlapping-cast wall-clock test, leak counting. Those need CI timing evidence first.

### Not started this round (blocked by the vault)
- 007, 008, 013, 015, 016, 020 original-TypeScript divergence capture. Stays as before.
- ARCANA III skill 001 original PixiJS reference.
