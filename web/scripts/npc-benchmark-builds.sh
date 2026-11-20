#!/usr/bin/env bash
# Prepare fixed-sha, read-only archives, never switch the working branch. Run
# from web/, after regression workers exit, with CHROME_BIN set if necessary.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
work=$(realpath -m "${1:?temporary build directory}"); out=$(realpath -m "${2:?report directory}")
mkdir -p "$work" "$out"; shas=(82089fea0b28ad1662f9f04496271b92c74c03a7 e93982f87bd23805d300b464f05ccf23c04a32c0 "$(git -C "$root" rev-parse HEAD)"); specs=()
for sha in "${shas[@]}"; do
  dir="$work/$sha"; mkdir -p "$dir"
  paths=(web/src web/package.json web/package-lock.json web/tsconfig.json web/index.html web/public web/vite.http.config.ts web/geography)
  for name in web/ref web/evidence/g1b web/scripts/vfx-assets-plugin.ts; do
    if git -C "$root" cat-file -e "$sha:$name" 2>/dev/null; then paths+=("$name"); fi
  done
  git -C "$root" archive "$sha" "${paths[@]}" | tar -x -C "$dir"
  cmp "$dir/web/package-lock.json" "$root/web/package-lock.json"
  ln -sfn "$root/web/node_modules" "$dir/web/node_modules"
  (cd "$dir/web" && VITE_SOH_QA=1 node_modules/.bin/vite build --config vite.http.config.ts) >"$out/build-${sha:0:7}.txt" 2>&1
  specs+=("$sha=$dir/web/dist-http")
done
node "$root/web/scripts/npc-scene-benchmark.mjs" "$out" "${specs[@]}"
node "$root/web/scripts/npc-scene-summary.mjs" "$out" "${shas[@]}"
