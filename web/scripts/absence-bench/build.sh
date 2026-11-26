#!/bin/sh
# Build the absence benchmark from the current working tree into node_modules/.sim/<name>/ (see scn.ts).
set -e
cd "$(dirname "$0")/../.."
npx vite build --ssr scripts/absence-bench/scn.ts --outDir "node_modules/.sim/${1:?name}" --minify false --sourcemap 2>&1 | tail -2
