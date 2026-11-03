#!/usr/bin/env bash
# MAP-SCALE-01A full reproduction. Run from any cwd.
# Only READS pinned git objects; never edits canonical Veyra or PR44 runtime.
set -euo pipefail
cd "$(dirname "$0")"
REPO="$(cd ../.. && pwd)"
echo "== 0/6 pinned PR44 HEAD ref =="
if ! git -C "$REPO" cat-file -e d80ad1b5d46f17b729e90898cfa2ad31b677fae3^{commit} 2>/dev/null; then
  git -C "$REPO" fetch -q origin refs/pull/44/head:refs/remotes/origin/pr44-head
fi
echo "== 1/6 source-linked benchmark =="
node src/benchmark.mjs
echo "== 2/6 visual comparison (needs /tmp/chromium + /tmp/al2023/lib) =="
node src/render.mjs
echo "== 3/6 determinism / source linkage / no-fabrication tests =="
node src/test.mjs
echo "== 4/6 accepted GEO-01 regression =="
(cd ../geo01 && ./reproduce.sh >/dev/null) && echo "GEO01_REPRODUCE_OK"
echo "== 5/6 accepted GEO-02 regression =="
(cd ../geo02 && ./reproduce.sh >/dev/null) && echo "GEO02_REPRODUCE_OK"
echo "== 6/6 done =="
echo "SCALE01A_REPRODUCE_OK"
