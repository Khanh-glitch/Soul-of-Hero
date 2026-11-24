#!/bin/bash
# Session 6: 4ab22fac (fix9) against the build where residents' step waits for their next event (fix10). Same scenes, both orders.
export AWS_EXECUTION_ENV=AWS_Lambda_nodejs20.x AWS_LAMBDA_JS_RUNTIME=nodejs20.x
cd /home/user/acc/fps
A=${A:-b/fix9}; B=${B:-b/fix10}; TAG=${TAG:-ab6}
run() { local label=$1 build=$2; shift 2
  env "$@" OUT=/home/user/acc/fps/out/$TAG-$label timeout 1500 node timeline.mjs $build $label 2>&1 | grep '^{' >> $TAG.jsonl
  echo "$label done $(date +%T)"; }
: > $TAG.jsonl
H8="DWELL=8000 FRAMES=1800 WARM=120 PHASES=0,1800 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8"
FR="DWELL=8000 FRAMES=1800 WARM=360 PHASES=0,3600"
run fresh-a   $A $FR
run fresh-b   $B $FR
run fresh-b-2 $B $FR
run fresh-a-2 $A $FR
run h8-a    $A $H8
run h8-b    $B $H8
run h8-b-2  $B $H8
run h8-a-2  $A $H8
echo ALL DONE
