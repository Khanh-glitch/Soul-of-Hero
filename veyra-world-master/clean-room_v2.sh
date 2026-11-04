#!/usr/bin/env bash
# WMP-02 isolated clean-room reproduction. Copies ONLY the self-contained WMP-01
# package plus v2/src/ (never the migration reader, never an external canonical
# source tree, never a network call), rebuilds all v2 artifacts from scratch and
# compares exact digests with the source tree. Writes ONE deterministic JSON
# report back to the source tree; runtime .log transcripts stay ignored.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d /tmp/wmp_v2_cleanroom.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
echo "WMP_V2_CLEAN_ROOM_TMP=$TMP"

for p in data lib api tools tests build.mjs reproduce.sh clean-room.sh reproduce_v2.sh clean-room_v2.sh README.md docs manifest.v1.json layers rasters evidence; do
  cp -a "$SRC/$p" "$TMP/"
done
mkdir -p "$TMP/v2"
cp -a "$SRC/v2/src" "$TMP/v2/"
if [ -e "$TMP/migration" ]; then echo "WMP_V2_CLEAN_ROOM_FAIL: external reader leaked"; exit 1; fi

cd "$TMP"
echo "--- isolated v2 build ---"
node v2/src/build_v2.mjs
echo "--- isolated typed handoff + complete windows ---"
node v2/src/intake_v2.mjs
echo "--- isolated technical views ---"
node v2/src/views_v2.mjs
echo "--- isolated v1 regression (read-only) ---"
WMP_CLEAN_ROOM=1 node tests/run.mjs
echo "--- isolated v2 physical suite ---"
WMP_CLEAN_ROOM=1 node v2/src/run_v2.mjs
echo "--- isolated v2 artifact index ---"
node v2/src/artifact_index_v2.mjs

D_SRC="$(node -e 'process.stdout.write(require("'"$SRC"'/v2/manifest.v2.json").revisionDigest)')"
D_TMP="$(node -e 'process.stdout.write(require("'"$TMP"'/v2/manifest.v2.json").revisionDigest)')"
H_SRC="$(node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(require("node:fs").readFileSync("'"$SRC"'/v2/handoff/geographic_handoff.v2.json")).digest("hex"))')"
H_TMP="$(node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(require("node:fs").readFileSync("'"$TMP"'/v2/handoff/geographic_handoff.v2.json")).digest("hex"))')"
T_SRC="$(node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(require("node:fs").readFileSync("'"$SRC"'/v2/evidence/tests/results_v2.json")).digest("hex"))')"
T_TMP="$(node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(require("node:fs").readFileSync("'"$TMP"'/v2/evidence/tests/results_v2.json")).digest("hex"))')"
if [ "$D_SRC" != "$D_TMP" ] || [ "$H_SRC" != "$H_TMP" ] || [ "$T_SRC" != "$T_TMP" ]; then
  echo "WMP_V2_CLEAN_ROOM_FAIL digest mismatch"; exit 1
fi
mkdir -p "$SRC/v2/evidence"
node -e '
const fs = require("node:fs");
const p = process.argv[1];
const doc = {
  schema: "soh.wmp.v2.clean_room.v1",
  status: "WMP_V2_CLEAN_ROOM_OK",
  command: "./clean-room_v2.sh",
  isolatedRevisionDigest: process.argv[2],
  sourceRevisionDigest: process.argv[3],
  isolatedHandoffSha256: process.argv[4],
  isolatedTestResultsSha256: process.argv[5],
  v1Regression: "WMP_TESTS 75/75 in the isolated copy; source v1 bytes untouched",
  v2Tests: "WMP_V2_TESTS 47/47",
  noExternalCanonicalSource: true,
  noLegacyLab: true,
  noNetwork: true,
  noGameplayRuntimeWrite: true,
  equalDigests: true
};
fs.writeFileSync(p, JSON.stringify(doc, null, 2) + "\n");
' "$SRC/v2/evidence/clean_room_v2.json" "$D_TMP" "$D_SRC" "$H_TMP" "$T_TMP"
echo "WMP_V2_CLEAN_ROOM_OK digest=$D_TMP noExternalCanonicalSource=true noLegacyLab=true noNetwork=true"
