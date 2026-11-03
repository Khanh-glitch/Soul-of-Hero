#!/usr/bin/env bash
# MAP-GEO-01 milestone A reproduction. Run from any cwd.
set -euo pipefail
cd "$(dirname "$0")"
echo "== 1/3 source verification =="
node src/verify.mjs
echo "== 2/3 derived geography export =="
node src/export.mjs
echo "== 3/3 determinism / fidelity / no-invention tests =="
node src/test.mjs
echo "REPRODUCE_OK"
