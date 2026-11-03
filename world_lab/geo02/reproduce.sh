#!/usr/bin/env bash
# MAP-GEO-02 full reproduction. Run from any cwd.
# Reads Veyra GOLD and the MapLab v3 input package straight from pinned git blobs.
set -euo pipefail
cd "$(dirname "$0")"
echo "== 1/7 source-linked encoding (legend / units / width semantics / masks) =="
node src/encoding.mjs
echo "== 2/7 ownership-correction overlay =="
node src/ownership.mjs
echo "== 3/7 corridor spatial geometry audit (4 connectivity layers) =="
node src/audit.mjs
echo "== 4/7 PROPOSED po_kilns spatial design (non-canonical) =="
node src/poi_design.mjs
echo "== 5/7 before/after geometry audit (needs /tmp/chromium + /tmp/al2023/lib) =="
node src/render.mjs
echo "== 6/7 concise Gameplay-facing geometry package =="
node src/package.mjs
echo "== 7/7 determinism / source linkage / no-invention gates =="
node src/test.mjs
echo "GEO02_REPRODUCE_OK"
