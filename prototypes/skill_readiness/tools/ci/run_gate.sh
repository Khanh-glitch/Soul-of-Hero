#!/usr/bin/env bash
# Run one native Godot 4.7 gate and report its verdict as ONE check-run
# annotation (readable through the REST API even when raw job logs are not).
#
# usage: run_gate.sh LABEL TIMEOUT_SECONDS PASS_MARKER SCRIPT [-- user args...]
#
# Design notes (each one closes a failure mode seen on this branch):
#   * Godot writes straight to a file, never through a pipe. A pipe to `tee`
#     hid exit statuses and dropped output when a job was killed by `timeout`.
#   * Exit status, the PASS marker and SCRIPT/Parse errors are all required.
#     A gate passes only when Godot exits 0 AND prints its marker.
#   * Verdict lines and the log tail go into one annotation, so a hang or a
#     crash still shows the last phase that was reached.
set -uo pipefail

LABEL="$1"
SECS="$2"
MARKER="$3"
SCRIPT="$4"
shift 4

HERE="$(cd "$(dirname "$0")" && pwd)"
ANNOTATE="$HERE/annotate_log.py"
LOG="/tmp/gold93-${LABEL}.log"

set +e
# `-k` escalates to SIGKILL: a Godot process that ignores SIGTERM (for example
# one blocked on a parked generator thread at exit) must still end here, or the
# gate never reports its phase tail and the whole job waits for its job timeout.
timeout -k 30 "${SECS}s" godot --headless --path . --script "$SCRIPT" "$@" > "$LOG" 2>&1
STATUS=$?
set -e

# Echo the log so the step output is readable too (no pipe involved).
grep -vE '^Godot Engine v' "$LOG" | tail -400 || true

if [ "$STATUS" = "0" ] && grep -Fq "$MARKER" "$LOG" && ! grep -Eq 'SCRIPT ERROR:|Parse Error:' "$LOG"; then
  python3 "$ANNOTATE" --level notice --title "[$LABEL] PASS" --log "$LOG" --tail 0 \
    --pattern "$MARKER" --pattern 'PASS|FAIL|verdict|parity|first_divergent'
  echo "GATE_PASS $LABEL"
  exit 0
fi

echo "::error::[$LABEL] godot exit status=$STATUS, marker '$MARKER' or clean log missing"
python3 "$ANNOTATE" --level error --title "[$LABEL] FAIL status=$STATUS" --log "$LOG" --tail 80 \
  --pattern 'SCRIPT ERROR|Parse Error|ERROR:|GOLD93_|FAIL|MISMATCH|PHASE'
echo "GATE_FAIL $LABEL status=$STATUS"
exit 1
