#!/usr/bin/env bash
# SOH MAP AGENT — WMP-03 PHYSICAL SEMANTICS CORRECTIVE — one-command reproduction.
# ADDITIVE ONLY: no v1/v2 tracked byte is changed by this script.
set -euo pipefail
cd "$(dirname "$0")"
LOG="v3/evidence/reproduce_v3.log"
mkdir -p v3/evidence
: > "$LOG"
log() { echo "$*" | tee -a "$LOG"; }

log "=== WMP-02 BASELINE reproduction (pinned, byte-preserving) ==="
./reproduce_v2.sh > /tmp/wmp03_v2_repro_in_v3.log 2>&1 || { cat /tmp/wmp03_v2_repro_in_v3.log; exit 1; }
grep -E "WMP_V2_REPRODUCE_OK|WMP_V2_TESTS |WMP_TESTS 75|WMP_V2_CLEAN_ROOM_OK|WMP_V2_ARTIFACT_INDEX_OK" /tmp/wmp03_v2_repro_in_v3.log | tail -6 | tee -a "$LOG"

log "=== WMP-03 build #1 ==="
B1="$(node v3/src/build_v3.mjs 2>&1 | tee -a "$LOG")"
log "=== WMP-03 build #2 (determinism) ==="
B2="$(node v3/src/build_v3.mjs 2>&1 | tee -a "$LOG")"
D1="$(printf '%s\n' "$B1" | sed -n 's/.*revisionDigest=\([0-9a-f]*\).*/\1/p')"
D2="$(printf '%s\n' "$B2" | sed -n 's/.*revisionDigest=\([0-9a-f]*\).*/\1/p')"
if [ -z "$D1" ] || [ "$D1" != "$D2" ]; then log "WMP_V3_REPRODUCE_FAIL build digests $D1 / $D2"; exit 1; fi
printf '{\n  "schema": "soh.wmp.v3.build_determinism.v1",\n  "command": "node v3/src/build_v3.mjs (twice)",\n  "run1": "%s",\n  "run2": "%s",\n  "equal": true\n}\n' "$D1" "$D2" > v3/evidence/build_determinism_v3.json
log "WMP_V3_BUILD_DETERMINISM_OK $D1"

log "=== WMP-03 typed handoff + complete 25-mask spatial windows ==="
node v3/src/intake_v3.mjs 2>&1 | tee -a "$LOG"
log "=== WMP-03 analytical technical views ==="
node v3/src/views_v3.mjs 2>&1 | tee -a "$LOG"
log "=== WMP-03 physical test suite + independent negative fixtures ==="
node v3/src/run_v3.mjs 2>&1 | tee -a "$LOG"
log "=== WMP-03 isolated clean room (no GOLD/MapLab/network) ==="
./clean-room_v3.sh 2>&1 | tee -a "$LOG"
log "=== WMP-03 supplementary artifact index (runs last) ==="
node v3/src/artifact_index_v3.mjs 2>&1 | tee -a "$LOG"
log "WMP_V3_REPRODUCE_OK revisionDigest=$D1"
