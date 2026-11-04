#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "== MAP-LR02 M0: verify PUBLISHED revision 1 (immutable) =="
node src/m0_greywater.mjs --verify
echo "== MAP-LR02 M1: full-world portal geometry (81 POIs) =="
node src/m1_portals.mjs
echo "== MAP-LR02 M2: full-world spawn / build eligibility =="
node src/m2_spawn.mjs
echo "== MAP-LR02 M3/M4/M5 (if present) =="
for g in src/m3_architecture.mjs src/m4_visual.mjs src/m5_package.mjs; do
  if [ -f "$g" ]; then node "$g"; fi
done
echo "== MAP-LR02 test gates =="
node src/test.mjs
echo "LR02_REPRODUCE_OK parentDigest=$(node -e 'import("./src/lib/lr02.mjs").then(m=>process.stdout.write(m.CONST.lr01Digest))')"
