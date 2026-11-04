#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "== MAP-LR02 M0: regenerate bounded Greywater patch =="
node src/m0_greywater.mjs
echo "== MAP-LR02 test gates =="
node src/test.mjs
echo "LR02_REPRODUCE_OK parentDigest=$(node -e 'import("./src/lib/lr02.mjs").then(m=>process.stdout.write(m.CONST.lr01Digest))')"
