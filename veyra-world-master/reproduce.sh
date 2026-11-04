#!/usr/bin/env bash
# WMP-01 one-command reproduction. Deterministic build x2, views, gates, clean room.
set -euo pipefail
cd "$(dirname "$0")"
LOG="evidence/reproduce.log"
mkdir -p evidence/tests evidence/windows evidence/views evidence/web_real docs
: > "$LOG"
log() { echo "$*" | tee -a "$LOG"; }

log "=== WMP reproduce: build #1 ==="
B1="$(node build.mjs 2>&1 | tee -a "$LOG")"
log "=== WMP reproduce: build #2 (determinism) ==="
B2="$(node build.mjs 2>&1 | tee -a "$LOG")"
D1="$(printf '%s\n' "$B1" | sed -n 's/.*revisionDigest=\([0-9a-f]*\).*/\1/p')"
D2="$(printf '%s\n' "$B2" | sed -n 's/.*revisionDigest=\([0-9a-f]*\).*/\1/p')"
if [ -z "$D1" ] || [ "$D1" != "$D2" ]; then log "WMP_REPRODUCE_FAIL build digests $D1 / $D2"; exit 1; fi
printf '{\n  "schema": "soh.wmp.build_determinism.v1",\n  "command": "node build.mjs (twice)",\n  "run1": "%s",\n  "run2": "%s",\n  "equal": true\n}\n' "$D1" "$D2" > evidence/build_determinism.v1.json
log "WMP_BUILD_DETERMINISM_OK $D1"

log "=== WMP reproduce: technical views ==="
node tools/views.mjs 2>&1 | tee -a "$LOG"
log "=== WMP reproduce: gates M-G0..M-G5 ==="
node tests/run.mjs 2>&1 | tee -a "$LOG"
log "=== WMP reproduce: isolated clean room ==="
./clean-room.sh 2>&1 | tee -a "$LOG"
log "=== WMP reproduce: supplementary artifact index (runs last so all evidence is final) ==="
node tools/artifact_index.mjs 2>&1 | tee -a "$LOG"
log "WMP_REPRODUCE_OK revisionDigest=$D1"
