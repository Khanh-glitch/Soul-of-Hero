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
