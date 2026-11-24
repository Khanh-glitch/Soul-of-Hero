#!/bin/bash
# usage: sweep.sh <index...>   (index into commits.txt, 0 = main)
cd /home/user/soh-fps || exit 1
for i in "$@"; do
  if [ "$i" = 0 ]; then sha=82089fea0b28ad1662f9f04496271b92c74c03a7; else sha=$(sed -n "${i}p" /home/user/acc/fps/commits.txt); fi
  label=$(printf '%03d' $i)-${sha:0:8}; out=/home/user/acc/fps/b/$label
  if [ ! -f $out/index.html ]; then git checkout -q -f --detach $sha && git clean -qfd -e node_modules web/src web/public web/scripts 2>/dev/null; cd web; ln -sfn /home/user/soh-wd/web/node_modules node_modules; npx vite build --minify false --outDir $out --emptyOutDir >/home/user/acc/fps/logs/build-$label.log 2>&1 || { echo "$label BUILD FAILED"; tail -3 /home/user/acc/fps/logs/build-$label.log; cd ..; continue; }; cd ..; fi
  cd /home/user/acc/fps; FRAMES=${FRAMES:-240} WARM=${WARM:-360} SCEN=${SCEN:-idle} AWS_EXECUTION_ENV=AWS_Lambda_nodejs20.x AWS_LAMBDA_JS_RUNTIME=nodejs20.x OUT=/home/user/acc/fps/out/${JSONL:-sweep}-$label timeout 900 node bench.mjs $out $label 2>/dev/null | tail -1 >> /home/user/acc/fps/${JSONL:-sweep-${SCEN:-idle}}.jsonl; echo "$label done"; cd /home/user/soh-fps
done
echo ALL DONE
