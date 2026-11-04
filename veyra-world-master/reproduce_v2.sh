#!/usr/bin/env bash
# WMP-02 / MAP-LR03R one-command reproduction.
# ADDITIVE ONLY: v1 files are never rewritten. `node tests/run.mjs` is used for
# the v1 75/75 regression because it is byte-read-only; `./reproduce.sh` is NOT
# re-run because it would regenerate the pinned WMP-01 artifact index/log.
set -euo pipefail
cd "$(dirname "$0")"
LOG="v2/evidence/reproduce_v2.log"
mkdir -p v2/evidence
: > "$LOG"
log() { echo "$*" | tee -a "$LOG"; }

log "=== WMP-02 build #1 ==="
B1="$(node v2/src/build_v2.mjs 2>&1 | tee -a "$LOG")"
log "=== WMP-02 build #2 (determinism) ==="
B2="$(node v2/src/build_v2.mjs 2>&1 | tee -a "$LOG")"
D1="$(printf '%s\n' "$B1" | sed -n 's/.*revisionDigest=\([0-9a-f]*\).*/\1/p')"
D2="$(printf '%s\n' "$B2" | sed -n 's/.*revisionDigest=\([0-9a-f]*\).*/\1/p')"
if [ -z "$D1" ] || [ "$D1" != "$D2" ]; then log "WMP_V2_REPRODUCE_FAIL build digests $D1 / $D2"; exit 1; fi
printf '{\n  "schema": "soh.wmp.v2.build_determinism.v1",\n  "command": "node v2/src/build_v2.mjs (twice)",\n  "run1": "%s",\n  "run2": "%s",\n  "equal": true\n}\n' "$D1" "$D2" > v2/evidence/build_determinism_v2.json
log "WMP_V2_BUILD_DETERMINISM_OK $D1"

log "=== WMP-02 typed handoff + complete spatial windows ==="
node v2/src/intake_v2.mjs 2>&1 | tee -a "$LOG"
log "=== WMP-02 technical analytical views ==="
node v2/src/views_v2.mjs 2>&1 | tee -a "$LOG"
log "=== WMP-01 75/75 regression is executed ONLY in the isolated clean room below ==="
log "(v1 tests/run.mjs writes a timing field into evidence/tests/test_results.v1.json;"
log " running it in the main tree would silently change a pinned WMP-01 digest.)"
log "=== WMP-02 physical test suite + negative fixtures ==="
node v2/src/run_v2.mjs 2>&1 | tee -a "$LOG"
log "=== WMP-02 isolated clean room ==="
./clean-room_v2.sh 2>&1 | tee -a "$LOG"
log "=== WMP-02 supplementary artifact index (runs last) ==="
node v2/src/artifact_index_v2.mjs 2>&1 | tee -a "$LOG"
log "WMP_V2_REPRODUCE_OK revisionDigest=$D1"
