# Venomwright original-source reference (Node)

Runs the ORIGINAL Venomwright TypeScript (`src/game/*.ts`, `skills/*.ts`) headlessly
under Node 22 + tsx, so GOLD93 hash oracles and view-A composites can be produced
without a browser or GPU. The original source is **not** stored here. `prepare.sh`
copies it from `GOLD93_VENOM_SRC` (default `/tmp/gold93-original-sources/venomwright/src`,
extracted from the verified ZIP) into a scratch workspace and replaces only
`game/display.ts` (PixiJS/DOM presentation) with `display.stub.ts`.

## Usage

    ./prepare.sh
    python3 verify_oracles.py                 # replays all 21 immutable oracles
    cd /tmp/gold93-venom-ref && ./node_modules/.bin/tsx reference.ts render 6 OUT_DIR

## What it verifies

- `verify_oracles.py` writes `results/oracle_replay.json`: row-level scene/glow SHA-256
  (32 hex) plus enemy, fx and particle counts, for every row of `oracle/venomwright_001..021.json`.
  Hash-level synchronisation only, not a visual comparison.
- `render` writes a CPU replica of the original composite fragment shader
  (`display.ts` FRAG: shock distortion, glow bloom taps, grade, vignette, Bayer dither,
  flash, 5-bit quantisation) to PNG at checkpoints. Checkpoints are defined from the
  skill data (`def.first`, hit increments, fx+particle activity). They are not GOLD labels.
  The PNGs are reference renders, not GPU screenshots.

## Limits

- The composite replicates the GLSL arithmetic in float64 on the CPU. It is not a GPU capture.
- The renders are not visual approval. Only the owner grants OWNER_VISUAL_APPROVED.
