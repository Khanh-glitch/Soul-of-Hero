#!/bin/bash
# base (0d9cc3b3 code) and fix, alternating, so drift of the box hits both.
for round in 1 2; do for pair in "base /home/user/soh-wd/web" "fix /home/user/Soul-of-Hero/web"; do set -- $pair
  cp /home/user/acc/perf/ticks.test.ts $2/_y.local.test.ts
  (cd $2 && TAG=$1-$round timeout 1200 node node_modules/vitest/vitest.mjs run _y.local.test.ts --maxWorkers=1 --testTimeout=1200000 2>&1 | grep -E "^TICKS|^block|FAIL|Error" )
  rm -f $2/_y.local.test.ts; done; done; echo ALL DONE
