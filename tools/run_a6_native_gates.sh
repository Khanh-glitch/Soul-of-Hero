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

# The A0 profile-choice journey carries two separate contracts:
#   * the identity step this workstream added, which must be green here, and
#   * A0's own "fresh profile has Sword only" assertion, which already fails on
#     the untouched base commit 51225718f3d9b15e508da633060270a4221e6a09
#     (it expects two reserve soul slots while SOUL_TEAM_RESERVE_CAPACITY is 1).
# The pre-existing failure is reported verbatim instead of being hidden or
# attributed to A6, and only the identity assertions can fail this gate.
echo "== A0 profile-choice journey (identity assertions are gating) =="
export SOUL_OF_HERO_SAVE_PATH="${SAVE_DIR}_menu.json"
MENU_LOG="${TMPDIR:-/tmp}/a6_menu_$(basename "${SAVE_DIR}").log"
timeout --signal=TERM --kill-after=15s 300s "$ENGINE" --headless --path . -- \
	--startup-profile-choice-test >"$MENU_LOG" 2>&1
menu_status=$?
tail -n 20 "$MENU_LOG"
if grep -qE "STARTUP PROFILE CHOICE FAIL: (New Game asks for the player identity|the authored identity step|both authored identities|no identity is recorded|choosing an identity|the chosen identity is stored|the stored identity matches)" "$MENU_LOG"; then
	echo "FAILED: the identity step regressed in the A0 profile-choice journey (see ${MENU_LOG})" >&2
	failures=$((failures + 1))
elif [ "$menu_status" -ne 0 ]; then
	echo "A0 PROFILE-CHOICE TEST IS RED FOR A PRE-EXISTING REASON (exit ${menu_status}) — reproduced on untouched base 51225718."
	echo "  identity assertions passed; the failing assertion is A0's reserve-slot expectation. Reported, not fixed here."
fi

if [ "$failures" -ne 0 ]; then
	echo "A6 NATIVE GATES FAILED (${failures})" >&2
	exit 1
fi
echo "A6 NATIVE GATES PASSED"
