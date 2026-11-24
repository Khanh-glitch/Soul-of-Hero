#!/bin/bash
# Session 5 (quiet machine): build before the fix and the final fix (4ab22fac), back to back; hour-8 standing in both orders.
export AWS_EXECUTION_ENV=AWS_Lambda_nodejs20.x AWS_LAMBDA_JS_RUNTIME=nodejs20.x
cd /home/user/acc/fps
BASE=b/421-416809d3; FIX=b/fix9
run() { local label=$1 build=$2; shift 2
  env "$@" OUT=/home/user/acc/fps/out/ab5-$label timeout 1500 node timeline.mjs $build $label 2>&1 | grep '^{' >> ab5.jsonl
  echo "$label done $(date +%T)"; }
: > ab5.jsonl
H8="DWELL=8000 FRAMES=1800 WARM=120 PHASES=0,1800 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8"
run h8-base    $BASE $H8
run h8-fix     $FIX  $H8
run h8-fix-2   $FIX  $H8
run h8-base-2  $BASE $H8
run fresh-base $BASE DWELL=8000 FRAMES=1800 WARM=360 PHASES=0,3600
run fresh-fix  $FIX  DWELL=8000 FRAMES=1800 WARM=360 PHASES=0,3600
run h8walk-base $BASE DWELL=8000 FRAMES=1800 WARM=120 PHASES=0 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8 WALK=d
run h8walk-fix  $FIX  DWELL=8000 FRAMES=1800 WARM=120 PHASES=0 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8 WALK=d
echo ALL DONE
