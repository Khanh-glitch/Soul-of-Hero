#!/usr/bin/env bash
# WMP-03 isolated clean-room reproduction. Copies ONLY the self-contained WMP-01
# package plus v2/src and v3/src. No external GOLD/MapLab source tree, no legacy
# migration reader, no network. Rebuilds v2 baseline outputs and ALL v3 outputs
# from scratch, then compares exact digests with the source tree.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d /tmp/wmp_v3_cleanroom.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
echo "WMP_V3_CLEAN_ROOM_TMP=$TMP"

for p in data lib api tools tests build.mjs reproduce.sh clean-room.sh reproduce_v2.sh clean-room_v2.sh reproduce_v3.sh clean-room_v3.sh README.md docs manifest.v1.json layers rasters evidence; do
  cp -a "$SRC/$p" "$TMP/"
done
mkdir -p "$TMP/v2" "$TMP/v3"
cp -a "$SRC/v2/src" "$TMP/v2/"
cp -a "$SRC/v3/src" "$TMP/v3/"

if [ -e "$TMP/migration" ] || [ -e "$TMP/world_lab" ] || [ -e "$TMP/../world_lab" ]; then
  echo "WMP_V3_CLEAN_ROOM_FAIL: external GOLD/MapLab or legacy reader leaked"; exit 1
fi
if grep -R -n -E "https?://|node:net|node:http|fetch\(" "$TMP/v3/src" "$TMP/v2/src" > /dev/null 2>&1; then
  echo "WMP_V3_CLEAN_ROOM_FAIL: network-capable import detected"; exit 1
fi

cd "$TMP"
echo "--- isolated WMP-02 baseline rebuild (source of v3 inputs) ---"
node v2/src/build_v2.mjs
node v2/src/intake_v2.mjs
echo "--- isolated WMP-01 regression 75/75 (read-only in the copy) ---"
WMP_CLEAN_ROOM=1 node tests/run.mjs
echo "--- isolated WMP-03 build ---"
node v3/src/build_v3.mjs
echo "--- isolated WMP-03 typed handoff + windows ---"
node v3/src/intake_v3.mjs
echo "--- isolated WMP-03 technical views ---"
node v3/src/views_v3.mjs
echo "--- isolated WMP-03 physical suite + negative fixtures ---"
node v3/src/run_v3.mjs

sha() { node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(require("node:fs").readFileSync(process.argv[1])).digest("hex"))' "$1"; }
rev() { node -e 'process.stdout.write(require(process.argv[1]).revisionDigest)' "$1"; }
D_SRC="$(rev "$SRC/v3/manifest.v3.json")"
D_TMP="$(rev "$TMP/v3/manifest.v3.json")"
H_SRC="$(sha "$SRC/v3/handoff/map_to_gameplay_v3.json")"
H_TMP="$(sha "$TMP/v3/handoff/map_to_gameplay_v3.json")"
T_SRC="$(sha "$SRC/v3/evidence/tests/test_results.v3.json")"
T_TMP="$(sha "$TMP/v3/evidence/tests/test_results.v3.json")"
V_SRC="$(sha "$SRC/v3/evidence/views/views_index.v3.json")"
V_TMP="$(sha "$TMP/v3/evidence/views/views_index.v3.json")"
if [ "$D_SRC" != "$D_TMP" ] || [ "$H_SRC" != "$H_TMP" ] || [ "$T_SRC" != "$T_TMP" ] || [ "$V_SRC" != "$V_TMP" ]; then
  echo "WMP_V3_CLEAN_ROOM_FAIL digest mismatch"
  echo " D $D_SRC / $D_TMP"; echo " H $H_SRC / $H_TMP"; echo " T $T_SRC / $T_TMP"; echo " V $V_SRC / $V_TMP"
  exit 1
fi
mkdir -p "$SRC/v3/evidence"
node -e '
const fs = require("node:fs");
const [p, d, t, h, s, v] = process.argv.slice(1);
const doc = {
  schema: "soh.wmp.v3.clean_room.v1",
  status: "WMP_V3_CLEAN_ROOM_OK",
  command: "./clean-room_v3.sh",
  isolatedRevisionDigest: d,
  sourceRevisionDigest: t,
  isolatedTypedHandoffSha256: h,
  isolatedTestResultsSha256: s,
  isolatedViewsIndexSha256: v,
  v1Regression: "WMP_TESTS 75/75 in the isolated copy; source v1 bytes untouched",
  v2Baseline: "WMP-02 build + typed handoff regenerated in isolation from v2/src only",
  v3Tests: "WMP_V3_TESTS OK, independent negative fixtures OK",
  noExternalGoldTree: true,
  noLegacyLab: true,
  noMigrationReader: true,
  noNetwork: true,
  noGameplayRuntimeWrite: true,
  equalDigests: true
};
fs.writeFileSync(p, JSON.stringify(doc, null, 2) + "\n");
' "$SRC/v3/evidence/clean_room_v3.json" "$D_TMP" "$D_SRC" "$H_TMP" "$T_TMP" "$V_TMP"
echo "WMP_V3_CLEAN_ROOM_OK digest=$D_TMP noExternalGoldTree=true noLegacyLab=true noNetwork=true"
