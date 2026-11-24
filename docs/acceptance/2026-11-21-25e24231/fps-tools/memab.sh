#!/bin/bash
# Renderer memory, hour-8 save standing, three 30 s windows: baseline then fix. Samples every 5 s into memab.log.
export AWS_EXECUTION_ENV=AWS_Lambda_nodejs20.x AWS_LAMBDA_JS_RUNTIME=nodejs20.x
cd /home/user/acc/fps; : > memab.jsonl; : > memab.log
run() { local label=$1 build=$2; shift 2
  ( while sleep 5; do ps -eo rss,etimes,args | grep "type=renderer" | grep -v grep | awk -v l=$label '{printf "%s rssMB %d age %d\n", l, $1/1024, $2}' >> memab.log; done ) & local sampler=$!
  env "$@" OUT=/home/user/acc/fps/out/mem-$label timeout 1500 node timeline.mjs $build $label 2>&1 | grep '^{' >> memab.jsonl
  kill $sampler; echo "$label done $(date +%T)"; }
C="DWELL=8000 FRAMES=1800 WARM=120 PHASES=0,1800,1800 SAVE=/home/user/acc/e5-h8.save.txt HOUR=8"
run base b/421-416809d3 $C
run fix8 b/fix8 $C
echo ALL DONE
