#!/usr/bin/env bash
# Run A0's conservative stand/legacy-state probe on a separately supplied A3
# source tree; never copy A3 into the production project or change its branch.
set -euo pipefail
if [[ $# != 1 || ! -d "$1" ]]; then
  echo "usage: $0 /path/to/a3-source-tree" >&2
  exit 2
fi
root="$(cd "$(dirname "$0")/../.." && pwd -P)"
a3="$(cd "$1" && pwd -P)"
engine="${GODOT_BIN:-godot}"
probe="$(mktemp -d "${TMPDIR:-/tmp}/a0-a3-probe.XXXXXXXX")"
trap 'rm -rf "$probe"' EXIT
mkdir -p "$probe/game/survival/economy" "$probe/data/survival/items" "$probe/tests" "$probe/xdg"
cp "$a3/game/survival/economy/world_source_adapter.gd" "$probe/game/survival/economy/"
cp "$a3/data/survival/items/world_source_bindings.v3.json" "$probe/data/survival/items/"
cp "$root/tests/survival_a3_owner_contract_probe.gd" "$probe/tests/"
printf 'config_version=5\n[application]\nconfig/name="A0 A3 Owner Contract Probe"\n' > "$probe/project.godot"
export A0_V3_BINDINGS="$root/data/survival/items/world_source_bindings.v3.json"
export XDG_DATA_HOME="$probe/xdg"
"$engine" --headless --path "$probe" --script res://tests/survival_a3_owner_contract_probe.gd
