#!/usr/bin/env bash
# Run the A6 native identity gates against a real Godot 4.7 binary.
#
#   tools/run_a6_native_gates.sh <godot-binary> [expectation: auto|ready|blocked]
#
# Two independent processes per identity prove the save round-trip; the caller is
# responsible for staging the licensed sheets privately (see
# docs/survival/ux/A6_A0_PLAYER_IDENTITY_INTEGRATION_HANDOFF_20261030.md).
set -uo pipefail

ENGINE="${1:-godot}"
EXPECTATION="${2:-auto}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SAVE_DIR="${A6_SAVE_DIR:-user://a6_gate}"

if [ ! -x "$ENGINE" ] && ! command -v "$ENGINE" >/dev/null 2>&1; then
	echo "engine not found: $ENGINE" >&2
	exit 2
fi

cd "$REPO_ROOT" || exit 2
failures=0

run_phase() {
	local gender="$1"
	local phase="$2"
	export SOUL_OF_HERO_SAVE_PATH="${SAVE_DIR}_${gender}.json"
	echo "== ${gender} / ${phase} (save: ${SOUL_OF_HERO_SAVE_PATH}) =="
	timeout --signal=TERM --kill-after=15s 420s "$ENGINE" --headless --path . -- \
		--avatar-identity-test --avatar-phase="$phase" \
		--avatar-gender="$gender" --avatar-expectation="$EXPECTATION"
	local status=$?
	if [ "$status" -ne 0 ]; then
		echo "FAILED: ${gender} ${phase} exited ${status}" >&2
		failures=$((failures + 1))
	fi
}

echo "== import =="
timeout --signal=TERM --kill-after=15s 600s "$ENGINE" --headless --editor --path . --import --quit >/tmp/a6_import.log 2>&1
echo "import exit: $? (log: /tmp/a6_import.log)"

for gender in male female; do
	run_phase "$gender" full
	run_phase "$gender" verify
done

echo "== A0 profile-choice journey regression =="
export SOUL_OF_HERO_SAVE_PATH="${SAVE_DIR}_menu.json"
timeout --signal=TERM --kill-after=15s 300s "$ENGINE" --headless --path . -- --startup-profile-choice-test
menu_status=$?
if [ "$menu_status" -ne 0 ]; then
	echo "FAILED: startup profile choice exited ${menu_status}" >&2
	failures=$((failures + 1))
fi

if [ "$failures" -ne 0 ]; then
	echo "A6 NATIVE GATES FAILED (${failures})" >&2
	exit 1
fi
echo "A6 NATIVE GATES PASSED"
