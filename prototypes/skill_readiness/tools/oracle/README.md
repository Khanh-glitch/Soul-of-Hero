# GOLD93 differential oracle

The oracle is the **authoritative reference** the native Godot port must match.
It is produced by executing the **ORIGINAL** source in its own language and
runtime, not by re-describing it.

## What it does

`venomwright_oracle_driver.ts` imports the original `src/game/**` TypeScript,
builds the same `Gfx` triple the original `Engine` builds (scene Layer, glow
Layer, SDF Field at `k=2` → 1200×680), replays the original deterministic stage
protocol, steps `World.step(1/60)` and emits, per sampled tick:

* `scene_sha256` — SHA-256 of the whole 1200×680 RGBA8 scene raster,
* `glow_sha256` — SHA-256 of the whole 1200×680 RGBA8 glow raster,
* live `fx` count and live particle count,
* and, separately, **every authored hit** (target, amount, damage kind, contact
  point, knockback, stagger, kill) and **every authored cue** (`mark`,
  `poison`, `shake`, `shock`, `screenFlash`) with its source timestamp.

Nothing is approximated: the numbers come out of the original functions.

## Reproducing

```bash
# 1. recover the original archives OUTSIDE the repository
export GOLD93_ARCHIVE_KEY='<owner-supplied key>'
python3 prototypes/skill_readiness/source_escrow/decrypt_gold93_sources.py \
  --out-dir /tmp/gold93-original-sources
unset GOLD93_ARCHIVE_KEY
unzip -q "/tmp/gold93-original-sources/venomwright-combat-vfx-design (4).zip" -d /tmp/gold93-src/venomwright

# 2. regenerate the oracle
npm i -g esbuild
export GOLD93_VENOM_SRC=/tmp/gold93-src/venomwright/src
python3 prototypes/skill_readiness/tools/oracle/build_venomwright_oracle.py
```

Output lands in `docs/vfx/skill_readiness/oracle/`.

## Protocol (recorded in every oracle file)

| setting | value |
|---|---|
| logical / native resolution | 600×340 / 1200×680 (`k=2`) |
| world step | 60 Hz, `World.step(1/60)` |
| seed | 7 |
| enemies | `World.reset(7, true)` formation placement, density 16 (app default) |
| cast | tick 1, via `Engine.autoAim(def)` → `Engine.resolve(...)` |
| cast RNG | `(seed*1315423911 + uid*2654435761 + skillId*97) >>> 0` |
| ground | `makeGround(Layer, 17)` |
| overlays | none — no aim reticle, no cursor, no HUD text |

## Honest limitation

The earlier hand-written table
`docs/vfx/VENOM_21_SOURCE_RUNTIME_ULTRA_ALL_CAST_BASELINES.md` records a
different fixture ("the original simulated player and three enemy actors"),
whose exact positions were never recorded. Its SHA prefixes and fx/particle
counts therefore cannot be reproduced and are **not** used as an equality
oracle here. This oracle replaces it: it is generated from the original source
under a fully recorded protocol, so it is reproducible and auditable.

## Native parity harness

`prototypes/skill_readiness/tests/gold93_venom_ground_parity_test.gd` builds the
same ground as `makeGround(Layer, 17)` at 1200×680 / `k=2` and compares the
SHA-256 of the raw LE RGBA8 buffer with the reference above.

```sh
prototypes/skill_readiness/tools/oracle/run_native_probe.sh \
  res://prototypes/skill_readiness/tests/gold93_venom_ground_parity_test.gd
```

Expected (GDScript, Godot 4.7 built from godotengine/godot 4.7-stable):

```
{"bit_exact":true,"ground_sha256":"ba1207e70d8a7b82b3d6a134a792bc5f9bec32d74a28236d0cf11d3c82487594"}
```

`run_native_probe.sh` exists because the repository's own project autoloads
`game/autoload/realtime_bridge.gd`, which loops inside `_process` and blocks
`godot --script`. The probe therefore runs against a throwaway project outside
the repo whose `prototypes/` is a symlink to the real one, so no file under
`game/**` has to be touched.

### Transcription rules proven by bit-exactness

These are not stylistic preferences; each one was found by diffing the native
buffer against the original byte-for-byte.

1. **Packed colour is `0xAABBGGRR`.** Writing the `#RRGGBB` literal straight
   into the table as `0xFFRRGGBB` swaps R and B in the LE buffer — it produced
   304 692 differing pixels before it was caught.
2. **`Math.round` is `floor(v + 0.5)`**, never GDScript's `round()` (banker's
   rounding on `.5`).
3. **Never hoist a `for`-loop bound that calls the RNG.** The original crack
   loop is `for (let i = 0; i < (r.int(40) + 25) * k; i++)`: the bound is
   re-evaluated every iteration, so `r.int(40)` burns one draw per step plus one
   for the final failing check. Hoisting it into a variable looked equivalent
   and diverged every crack path (2 390 differing pixels).
4. GDScript `sin`, `cos`, `sqrt`, `pow`, `atan2` and the mulberry32 port are
   bit-identical to the original at double precision (verified by comparing IEEE
   bit patterns, not decimal strings).
5. An inner `class` cannot call the enclosing script's `static func`, and a
   script cannot reference its own `class_name` while compiling — hence the
   split into `venom_math.gd` (pure helpers) and `venom_rng.gd` (which *is* the
   RNG, so its instance methods and its noise statics share one
   implementation).
