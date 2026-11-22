#!/bin/bash
# Is the region worker what slows the first window after a load? Hour-8 save, standing: baseline, fix, fix without the region worker.
export AWS_EXECUTION_ENV=AWS_Lambda_nodejs20.x AWS_LAMBDA_JS_RUNTIME=nodejs20.x
cd /home/user/acc/fps
run() { local label=$1 build=$2; shift 2
  env "$@" OUT=/home/user/acc/fps/out/iso-$label timeout 1500 node timeline.mjs $build $label 2>&1 | grep '^{' >> iso.jsonl
  echo "$label done $(date +%T)"; }
: > iso.jsonl
C="DWELL=8000 FRAMES=1800 WARM=120 PHASES=0,1800 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8"
run base  b/421-416809d3 $C
run fix7  b/fix7 $C
run fix7-noworker b/fix7 $C NOREGION=1
run fix6  b/fix6 $C
echo ALL DONE
