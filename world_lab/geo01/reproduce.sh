#!/usr/bin/env bash
# MAP-GEO-01 full reproduction. Run from any cwd.
set -euo pipefail
cd "$(dirname "$0")"
echo "== 1/7 source verification =="
node src/verify.mjs
echo "== 2/7 derived geography export =="
node src/export.mjs
echo "== 3/7 real Veyra spatial corridor =="
node src/corridor.mjs
echo "== 4/7 corridor visual inspection (needs /tmp/chromium + /tmp/al2023/lib) =="
node src/render.mjs
echo "== 5/7 PR44 contract boundary =="
node src/contract.mjs
echo "== 6/7 determinism / fidelity / no-invention tests =="
node src/test.mjs
echo "== 7/7 done =="
echo "REPRODUCE_OK"
