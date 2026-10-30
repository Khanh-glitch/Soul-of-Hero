#!/usr/bin/env bash
# Surface the end of every captured log as GitHub annotations.
#
# Why this exists: this project's sandbox cannot read job logs (the log blob host
# is blocked), so annotations are the only channel that survives. GitHub caps
# annotations at ten per step and silently drops the rest, so this emits ONE
# compact annotation per log rather than one per line. With roughly twenty logs,
# line-per-annotation meant the failing assertion was usually among the ones
# dropped, and a red run reported nothing but shutdown noise.
#
# Order matters: logs holding a failed assertion come first, then script errors,
# then the tail of anything that printed nothing recognisable (usually a process
# that died before its first assertion).
#
#   emit_diagnostics.sh <artifact-dir>
set -uo pipefail

dir=${1:?usage: emit_diagnostics.sh <artifact-dir>}

emit() {
  local title=$1
  local text=$2
  text=${text//'%'/'%25'}
  text=${text//$'\r'/}
  text=${text//$'\n'/ }
  # Keep the annotation readable and inside GitHub's limits.
  printf '::error title=%s::%.900s\n' "$title" "$text"
}

shopt -s nullglob
logs=("$dir"/*.log)
if [ ${#logs[@]} -eq 0 ]; then
  emit "diagnostics" "no logs were captured in ${dir}"
  exit 0
fi

FAIL_RE='  FAIL |OVERWORLD.*FAILED'
ERR_RE='SCRIPT ERROR|Parse Error'

for f in "${logs[@]}"; do
  if grep -qE "$FAIL_RE" "$f"; then
    emit "$(basename "$f") [assertions]" \
      "$(grep -E "$FAIL_RE" "$f" | head -n 6 | tr '\n' '~')"
  fi
done

for f in "${logs[@]}"; do
  if grep -qE "$ERR_RE" "$f"; then
    emit "$(basename "$f") [script errors]" \
      "$(grep -E "$ERR_RE" "$f" | head -n 4 | tr '\n' '~')"
  fi
done

for f in "${logs[@]}"; do
  if ! grep -qE "${FAIL_RE}|${ERR_RE}" "$f"; then
    # Strip ANSI colour first: Godot's progress lines are full of it, and an
    # annotation that is 40 % escape sequences carries almost no information.
    emit "$(basename "$f") [no failure marker, tail]" \
      "$(tail -n 6 "$f" | sed -e 's/\x1b\[[0-9;]*m//g' | tr '\n' '~')"
  fi
done
