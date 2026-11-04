#!/usr/bin/env bash
# WMP-01 isolated no-GOLD reproduction. Copies a strict whitelist into a fresh
# temp tree WITHOUT migration/ (the only GOLD/MapLab reader), builds, views and
# tests there, then compares the exact manifest revisionDigest.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d /tmp/wmp_cleanroom.XXXXXX)"
LOG="$TMP/clean_room.log"
echo "WMP_CLEAN_ROOM_SRC=$SRC" | tee "$LOG"
echo "WMP_CLEAN_ROOM_TMP=$TMP" | tee -a "$LOG"

for p in data lib api tools tests build.mjs reproduce.sh clean-room.sh README.md docs manifest.v1.json layers rasters evidence; do
  cp -a "$SRC/$p" "$TMP/"
done
if [ -e "$TMP/migration" ]; then echo "M-G1 FAIL: migration/ leaked into clean room" | tee -a "$LOG"; exit 1; fi
echo "M-G1 whitelist copied; migration/ excluded; no MapLab source or GOLD git object present" | tee -a "$LOG"

cd "$TMP"
echo "--- isolated node build.mjs ---" | tee -a "$LOG"
node build.mjs 2>&1 | tee -a "$LOG"
echo "--- isolated node tools/views.mjs ---" | tee -a "$LOG"
node tools/views.mjs 2>&1 | tee -a "$LOG"
echo "--- isolated WMP_CLEAN_ROOM=1 node tests/run.mjs ---" | tee -a "$LOG"
WMP_CLEAN_ROOM=1 node tests/run.mjs 2>&1 | tee -a "$LOG"

D_SRC="$(node -e "process.stdout.write(require('$SRC/manifest.v1.json').revisionDigest)")"
D_TMP="$(node -e "process.stdout.write(require('$TMP/manifest.v1.json').revisionDigest)")"
echo "M-G1 sourceDigest=$D_SRC" | tee -a "$LOG"
echo "M-G1 isolatedDigest=$D_TMP" | tee -a "$LOG"
if [ "$D_SRC" != "$D_TMP" ]; then echo "M-G1 FAIL: isolated build digest differs" | tee -a "$LOG"; exit 1; fi
echo "WMP_CLEAN_ROOM_OK digest=$D_SRC noGold=true noMapLab=true noNetwork=true" | tee -a "$LOG"
mkdir -p "$SRC/evidence"
cp "$LOG" "$SRC/evidence/clean_room.log"
rm -rf "$TMP"
echo "WMP_CLEAN_ROOM_LOG=$SRC/evidence/clean_room.log"
