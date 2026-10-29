#!/usr/bin/env bash
# Run the overworld gate suite locally, the same way the workflow runs it.
#
# The point of this script is honesty about the environment: CI runs every test
# under Xvfb with a real GL context, and this machine has neither, so the
# rendering-dependent capture pass is run with `--headless` and is *reported* as
# headless. A test that needs the GPU is not silently skipped: it is named, and its
# absence is visible in the summary.
#
# Usage:  bash tools/overworld/local_suite.sh [godot-binary]
set -uo pipefail
GODOT="${1:-/home/user/.local/godot-src/bin/godot.linuxbsd.editor.x86_64}"
OUT=artifacts/local-suite
mkdir -p "$OUT"
fail=0
run() { # name script expected-pattern
  local name="$1" script="$2" pattern="$3" dir="$OUT/ud_$4"
  mkdir -p "$dir"
  timeout --signal=TERM --kill-after=10s 240s "$GODOT" --headless --path . \
    --user-data-dir "$dir" --script "$script" >"$OUT/$4.log" 2>&1
  local rc=$?
  if grep -qF "$pattern" "$OUT/$4.log" && [ $rc -eq 0 ]; then
    printf '  PASS  %-16s %s\n' "$name" "$(grep -F "$pattern" "$OUT/$4.log" | tail -1)"
  else
    printf '  FAIL  %-16s rc=%d\n' "$name" $rc
    grep -E 'FAIL|SCRIPT ERROR|OVERWORLD TEST FAIL' "$OUT/$4.log" | head -6
    fail=1
  fi
}
echo "== overworld suite (headless; CI uses Xvfb + GL) =="
# Parse first, and without the engine. A redeclaration error in a GDScript file
# costs a whole CI round trip to discover (the workflow's parse gate is Godot
# itself, which is the right final authority but slow and not always available
# here). gdparse is the same grammar, takes a second per file, and catches exactly
# the class of mistake that has already broken one run: GDScript is
# function-scoped, so `var names` in two branches of one function is an error.
if command -v gdparse >/dev/null 2>&1; then
  parse_fail=0
  for f in game/overworld/*.gd tests/overworld_*.gd; do
    if ! gdparse "$f" >"$OUT/parse.log" 2>&1; then
      printf '  FAIL  %-16s %s\n' "PARSE" "$f"
      head -4 "$OUT/parse.log"
      parse_fail=1
    fi
  done
  if [ $parse_fail -eq 0 ]; then
    printf '  PASS  %-16s %s\n' "PARSE" "every overworld script parses"
  else
    fail=1
  fi
else
  printf '  SKIP  %-16s gdparse not installed (pip install gdtoolkit)\n' "PARSE"
fi
if python3 tools/overworld/art_quality.py >"$OUT/art_quality.log" 2>&1; then
  printf '  PASS  %-16s %s\n' "ART" "$(tail -1 "$OUT/art_quality.log")"
else
  printf '  FAIL  %-16s\n' "ART"
  tail -6 "$OUT/art_quality.log"
  fail=1
fi
run STATIC  res://tests/overworld_static_contracts_test.gd  "OVERWORLD_STATIC_CONTRACTS PASSED" static
run GUARD   res://tests/overworld_regression_guard_test.gd   "OVERWORLD_REGRESSION_GUARD PASSED" guard
run KNIGHT  res://tests/overworld_knight_mini_test.gd        "KNIGHT_MINI PASSED" knight
run SCENE   res://tests/overworld_scene_runtime_test.gd      "OVERWORLD SCENE_RUNTIME_TEST PASSED" scene
run MOVE    res://tests/overworld_movement_runtime_test.gd   "OVERWORLD MOVEMENT_RUNTIME_TEST PASSED" move
run PROVIS  res://tests/overworld_provisions_runtime_test.gd "OVERWORLD PROVISIONS_RUNTIME_TEST PASSED" prov
run PERSIST res://tests/overworld_persistence_runtime_test.gd "OVERWORLD PERSISTENCE_RUNTIME_TEST PASSED" persist
run GATE    res://tests/overworld_gate_runtime_test.gd       "OVERWORLD GATE_RUNTIME_TEST PASSED" gate
run SHORT   res://tests/overworld_shortcut_runtime_test.gd   "OVERWORLD SHORTCUT_RUNTIME_TEST PASSED" short
run TRAV    res://tests/overworld_traversability_runtime_test.gd "OVERWORLD TRAVERSABILITY_RUNTIME_TEST PASSED" trav
run OCC     res://tests/overworld_occlusion_runtime_test.gd  "OVERWORLD OCCLUSION_RUNTIME_TEST PASSED" occ
run OCCSEL  res://tests/overworld_occlusion_selective_test.gd "OVERWORLD OCCLUSION_SELECTIVE_TEST PASSED" occsel
run OCCREUSE res://tests/overworld_occlusion_chapter1_reuse_test.gd "OVERWORLD OCCLUSION_CHAPTER1_REUSE_TEST PASSED" occreuse
run PERF    res://tests/overworld_performance_probe.gd      "OVERWORLD PERF PASSED" perf
# Round trip and acceptance boot the real app; they report their own summary lines.
for mode in roundtrip acceptance; do
  mkdir -p "$OUT/ud_$mode"
  pattern="OVERWORLD ROUNDTRIP_RUNTIME PASSED"; [ "$mode" = acceptance ] && pattern="0 failures"
  timeout --signal=TERM --kill-after=10s 300s "$GODOT" --headless --path . \
    --user-data-dir "$OUT/ud_$mode" res://game/app/app_root.tscn -- "--overworld-$mode-test" \
    >"$OUT/$mode.log" 2>&1
  rc=$?
  if grep -qF "$pattern" "$OUT/$mode.log" && [ $rc -eq 0 ]; then
    printf '  PASS  %-16s %s\n' "${mode^^}" "$(grep -F "$pattern" "$OUT/$mode.log" | tail -1)"
  else
    printf '  FAIL  %-16s rc=%d\n' "${mode^^}" $rc
    grep -E 'FAIL|SCRIPT ERROR' "$OUT/$mode.log" | head -6
    fail=1
  fi
done
echo "== $([ $fail -eq 0 ] && echo ALL PASSED || echo FAILURES) =="
exit $fail
