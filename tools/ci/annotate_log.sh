#!/usr/bin/env bash
# Emit the tail of a Godot log as GitHub ::error:: annotations.
#
#   annotate_log.sh <log> <label> [lines]
#
# Why this exists: gate_log.sh already annotates the first few error lines, but
# a *runtime* failure (assert/exit 1) can be far down the log and the raw CI log
# is not always retrievable by the reviewing agent. Annotations are fetched
# through api.github.com, so they survive even when the job log is not readable.
#
# The script never changes the caller's exit code; it is an evidence helper.
set -uo pipefail

log=${1:?usage: annotate_log.sh <log> <label> [lines]}
label=${2:?usage: annotate_log.sh <log> <label> [lines]}
lines=${3:-40}

if [ ! -f "$log" ]; then
  echo "::error::${label}: log file not found: $log"
  exit 0
fi

emit() {
  local text=$1
  # GitHub annotation escaping: % -> %25, CR -> %0D, LF -> %0A.
  printf '%s' "$text" | sed -e 's/%/%25/g' -e 's/\r/%0D/g' -e 's/$/%0A/' | tr -d '\n'
}

echo "::notice::${label}: last ${lines} log line(s) attached as annotations"
tail -n "$lines" "$log" | while IFS= read -r line; do
  [ -z "$line" ] && continue
  printf '::error::%s: %s\n' "$label" "$(emit "$line")"
done
exit 0
