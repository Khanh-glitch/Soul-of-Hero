#!/usr/bin/env bash
# Native gate for the A6 survival return UI (season chip, guidance, return digest,
# season record, D061 cues).
#
#   tools/run_a6_return_ui_gate.sh <godot-binary>
#
# This gate is deliberately independent of the avatar gate: it boots its own scene
# so no A0 route has to know it exists, and it needs no private art at all.
set -uo pipefail

ENGINE="${1:-godot}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SAVE_DIR="${A6_RETURN_SAVE_DIR:-user://a6_return_gate}"

if [ ! -x "$ENGINE" ] && ! command -v "$ENGINE" >/dev/null 2>&1; then
	echo "engine not found: $ENGINE" >&2
	exit 2
fi

cd "$REPO_ROOT" || exit 2
failures=0

echo "== import =="
timeout --signal=TERM --kill-after=15s 600s "$ENGINE" --headless --editor --path . --import --quit >/tmp/a6_return_import.log 2>&1
import_status=$?
echo "import exit: ${import_status} (log: /tmp/a6_return_import.log)"
if [ "$import_status" -ne 0 ]; then
	failures=$((failures + 1))
fi

echo "== ownership boundary: A6 return UI holds no save authority =="
# The UI may read projections and call display helpers. Anything that could write
# the save, mint an item, unlock a recipe or start a transaction must not appear.
if grep -rnE "transact_once|patch_state_path|grant_inventory_item|add_items_to_candidate|save_now\(|set_player_avatar|unlock_story_hero" \
		game/survival/ui/return/ >/tmp/a6_return_boundary.log 2>&1; then
	echo "FAILED: the return UI references an A0 write API:" >&2
	cat /tmp/a6_return_boundary.log >&2
	failures=$((failures + 1))
else
	echo "no save/mint/unlock call in game/survival/ui/return/"
fi

echo "== native scene run =="
export SOUL_OF_HERO_SAVE_PATH="${SAVE_DIR}.json"
LOG="${TMPDIR:-/tmp}/a6_return_ui_gate.log"
timeout --signal=TERM --kill-after=15s 300s "$ENGINE" --headless --path . \
	res://tests/survival/ui/a6_survival_return_native_test.tscn 2>&1 | tee "$LOG"
run_status=${PIPESTATUS[0]}
if [ "$run_status" -ne 0 ]; then
	echo "FAILED: the return UI gate exited ${run_status}" >&2
	failures=$((failures + 1))
fi
if ! grep -q "A6 RETURN UI NATIVE PASSED" "$LOG"; then
	echo "FAILED: the gate did not print its pass line" >&2
	failures=$((failures + 1))
fi
if grep -q "SCRIPT ERROR" "$LOG"; then
	echo "FAILED: the gate printed a script error" >&2
	failures=$((failures + 1))
fi

if [ "$failures" -ne 0 ]; then
	echo "A6 RETURN UI GATE FAILED (${failures})" >&2
	exit 1
fi
echo "A6 RETURN UI GATE PASSED"
