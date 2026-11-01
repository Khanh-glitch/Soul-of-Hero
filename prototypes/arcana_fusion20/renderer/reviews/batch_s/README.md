# Batch S native gameplay sheets — baseline 853ab121

Each sheet contains six actual 1280×720 viewport frames at native pixel size,
arranged in a 3×2 grid with caption bars. JPEG is lossy. The frames come from
real AppRoot → Home → Overworld natural captures with a moving player, moving
Skeletons and camera in [run 41340095946](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41340095946),
AVFX SHA `853ab12164d0dba5d6e3b337926647e6b8b10657`. Labels report last-observed
source ticks (which may lag presentation), not guaranteed precise timestamps.
These are stills, not full native motion, creator Gold or combat receipts.

#03 is **before** `c60d3328`'s B screen-post ordered-dither correction; it
visibly washes out actors at flash. #15 is after the live-caster/clamped-focus
change but is one natural target/range, not a four-bearing long-range test.
See the small same-run frame and motion artifacts for higher-quality individual
images and timing, and `R21_EXECUTION_CHECKPOINT.md` for current status.
