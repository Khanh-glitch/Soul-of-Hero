#!/bin/bash
# A/B back to back (the box drifts over time): baseline build, then the fixed build, per scenario.
export AWS_EXECUTION_ENV=AWS_Lambda_nodejs20.x AWS_LAMBDA_JS_RUNTIME=nodejs20.x
cd /home/user/acc/fps
BASE=b/421-416809d3; FIX=b/fix7
run() { # label build extra-env...
  local label=$1 build=$2; shift 2
  env "$@" OUT=/home/user/acc/fps/out/ab-$label timeout 1500 node timeline.mjs $build $label 2>&1 | grep '^{' >> ab.jsonl
  echo "$label done $(date +%T)"
}
: > ab.jsonl
run fresh-base $BASE DWELL=8000 FRAMES=1800 WARM=360 PHASES=0,3600
run fresh-fix  $FIX  DWELL=8000 FRAMES=1800 WARM=360 PHASES=0,3600
run h8-base    $BASE DWELL=8000 FRAMES=1800 WARM=120 PHASES=0 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8
run h8-fix     $FIX  DWELL=8000 FRAMES=1800 WARM=120 PHASES=0 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8
run h8walk-base $BASE DWELL=8000 FRAMES=1800 WARM=120 PHASES=0 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8 WALK=d
run h8walk-fix  $FIX  DWELL=8000 FRAMES=1800 WARM=120 PHASES=0 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8 WALK=d
echo ALL DONE
