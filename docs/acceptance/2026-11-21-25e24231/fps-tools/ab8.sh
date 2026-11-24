#!/bin/bash
# Session 8: fog dots as one picture (B) against one fill per dot (A). Hour-8 save (always FOG), standing and walking, order a, b, b, a.
export AWS_EXECUTION_ENV=AWS_Lambda_nodejs20.x AWS_LAMBDA_JS_RUNTIME=nodejs20.x
cd /home/user/acc/fps
A=${A:-b/fix11}; B=${B:-b/fix12}; TAG=${TAG:-ab8}
run() { local label=$1 build=$2; shift 2
  env "$@" OUT=/home/user/acc/fps/out/$TAG-$label timeout 1500 node timeline.mjs $build $label 2>&1 | grep '^{' >> $TAG.jsonl
  echo "$label done $(date +%T)"; }
: > $TAG.jsonl
H8="DWELL=8000 FRAMES=1800 WARM=120 PHASES=0,1800 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8"
WK="DWELL=8000 FRAMES=1800 WARM=120 PHASES=0 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8 WALK=d"
run h8-a    $A $H8
run h8-b    $B $H8
run h8-b-2  $B $H8
run h8-a-2  $A $H8
run walk-a   $A $WK
run walk-b   $B $WK
run walk-b-2 $B $WK
run walk-a-2 $A $WK
echo ALL DONE
