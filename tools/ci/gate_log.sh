#!/usr/bin/env bash
# Fail-closed log gate for a Godot run that already exited.
#
#   gate_log.sh <log> <label> [<required pass line>]
#
# Why this exists: an exit code of 0 is not evidence. A test can print
# SCRIPT ERROR and still quit cleanly, and a log-grep that is *too* broad
# fails runs that passed (Godot prints its V-Sync warning with an "at:"
# frame, and its shutdown accounting starts with "ERROR:").
#
# Rules, in order:
#   1. Any SCRIPT ERROR / Parse Error / ^ERROR: line fails the run, except
#      Godot's own shutdown accounting, which is named, listed and reported
#      as a warning so it is never silently dropped. That exclusion is the
#      project's existing convention (see gate3-runtime.yml).
#   2. If <required pass line> is given, it must be present: a run that
#      never reached its PASS summary fails even if it exited 0.
#
# Annotation-friendly: matching lines are echoed as ::error::/::warning: so
# they survive even when the raw CI log is not retrievable.
set -uo pipefail

log=${1:?usage: gate_log.sh <log> <label> [<required pass line>]}
label=${2:?usage: gate_log.sh <log> <label> [<required pass line>]}
required=${3:-}

if [ ! -f "$log" ]; then
  echo "::error::${label}: log file not found: $log"
  exit 1
fi

# GitHub's annotation escaping: % -> %25, CRLF -> %0A.
emit() {
  local level=$1
  local line=$2
  printf '%s\n' "$line" | sed -e 's/%/%25/g' -e 's/\r/%0D/g' | {
    read -r safe || true
    echo "::${level}::${label}: ${safe}"
  }
}

SHUTDOWN_NOTICES="resources still in use at exit|ObjectDB instances were leaked"
ERROR_PATTERN="SCRIPT ERROR|Parse Error|^ERROR:"

# 1a. Shutdown accounting: visible, never fatal on its own.
tolerated=$(grep -E "$SHUTDOWN_NOTICES" "$log" || true)
if [ -n "$tolerated" ]; then
  while IFS= read -r line; do
    emit warning "engine shutdown notice: ${line}"
  done <<< "$tolerated"
fi

# 1b. Everything else that looks like an engine or script error.
hard=$(grep -E "$ERROR_PATTERN" "$log" || true)
real=0
if [ -n "$hard" ]; then
  real=$(printf '%s\n' "$hard" | grep -vcE "$SHUTDOWN_NOTICES" || true)
  real=${real:-0}
fi
if [ "$real" -gt 0 ]; then
  echo "::error::${label}: ${real} engine/script error line(s) in the log"
  # Print each error with up to two following stack-frame lines.
  awk '/SCRIPT ERROR|Parse Error|^ERROR:/{window=3} window>0{print; window--}' "$log" \
    | grep -E "$ERROR_PATTERN|^[[:space:]]+at: " \
    | grep -vE "$SHUTDOWN_NOTICES" \
    | head -14 \
    | while IFS= read -r line; do
        emit error "$line"
      done
  exit 1
fi

# 2. The run has to have said it passed.
if [ -n "$required" ]; then
  if ! grep -qF "$required" "$log"; then
    echo "::error::${label}: log never reported \"${required}\""
    tail -20 "$log" | while IFS= read -r line; do
      emit error "tail: ${line}"
    done
    exit 1
  fi
fi

echo "${label}: log gate passed"
exit 0
