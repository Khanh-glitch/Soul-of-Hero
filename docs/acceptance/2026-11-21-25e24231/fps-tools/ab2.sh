#!/bin/bash
# Fresh game, back to back: baseline then the fixed build.
export AWS_EXECUTION_ENV=AWS_Lambda_nodejs20.x AWS_LAMBDA_JS_RUNTIME=nodejs20.x
cd /home/user/acc/fps
run() { local label=$1 build=$2; shift 2
  env "$@" OUT=/home/user/acc/fps/out/ab7-$label timeout 1500 node timeline.mjs $build $label 2>&1 | grep '^{' >> ab7.jsonl
  echo "$label done $(date +%T)"; }
: > ab7.jsonl
run fresh-base b/421-416809d3 DWELL=8000 FRAMES=1800 WARM=360 PHASES=0,3600
run fresh-fix  b/fix7 DWELL=8000 FRAMES=1800 WARM=360 PHASES=0,3600
run h8walk-base b/421-416809d3 DWELL=8000 FRAMES=1800 WARM=120 PHASES=0 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8 WALK=d
run h8walk-fix  b/fix7 DWELL=8000 FRAMES=1800 WARM=120 PHASES=0 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8 WALK=d
echo ALL DONE
