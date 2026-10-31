#!/usr/bin/env bash
# Run the A0 Round 12 native set in the current tree (A0 branch or a composed
# tree), one OS process per suite, and print one truthful summary line per run.
#
# Usage: tools/a0/run_round12_native.sh [--headless] [--out DIR] [suite...]
#   Default suites are the Round 12 obligations; passing names overrides them.
#   `--headless` skips the display-dependent suites instead of pretending a
#   headless run rendered anything.
set -uo pipefail

GODOT="${GODOT:-godot}"
OUT="artifacts/round12"
HEADLESS=0
SUITES=()
while [ $# -gt 0 ]; do
  case "$1" in
    --headless) HEADLESS=1; shift ;;
    --out) OUT="$2"; shift 2 ;;
    --*) echo "unknown flag $1" >&2; exit 2 ;;
    *) SUITES+=("$1"); shift ;;
  esac
done
if [ ${#SUITES[@]} -eq 0 ]; then
  # Truly headless-safe suites first; the journey suites need a real renderer.
  SUITES=(survival_foundation_test survival_a0_pin_fence_test survival_a0_profile_port_test
          survival_a0_run_lifecycle_test survival_a0_tool_and_offline_test survival_a0_player_return_test
          survival_a0_damage_death_probe_test)
  if [ "$HEADLESS" -eq 0 ]; then
    SUITES+=(survival_normal_home_journey_test survival_a0_production_threat_test)
  fi
fi

mkdir -p "$OUT"
pass=0
fail=0
for suite in "${SUITES[@]}"; do
  log="$OUT/$suite.log"
  mkdir -p "$OUT/ud_$suite"
  if [ "$HEADLESS" -eq 1 ]; then
    runner=("$GODOT" --headless)
  else
    runner=(xvfb-run -a -s "-screen 0 1280x720x24" "$GODOT" --audio-driver Dummy
            --resolution 1280x720 --windowed)
  fi
  timeout --signal=TERM --kill-after=10s 900s "${runner[@]}" --path . \
    --user-data-dir "$OUT/ud_$suite" --script "res://tests/$suite.gd" > "$log" 2>&1
  rc=$?
  verdict="$(grep -E 'PASSED|FAILED' "$log" | tail -1)"
  printf '%-42s exit=%d %s\n' "$suite" "$rc" "$verdict"
  if [ "$rc" -eq 0 ] && [ -n "$verdict" ] && ! grep -q 'FAILED' <<<"$verdict"; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
  fi
done
echo "ROUND12 NATIVE SUMMARY passed=$pass failed=$fail logs=$OUT"
[ "$fail" -eq 0 ]
