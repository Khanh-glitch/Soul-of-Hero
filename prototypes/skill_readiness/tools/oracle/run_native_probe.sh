#!/usr/bin/env bash
# Run a GOLD93 native GDScript probe under Godot and print its JSON.
#
# WHY THIS EXISTS
#   The repository's own project has autoloads (`game/autoload/realtime_bridge.gd`)
#   that spin inside `_process` and prevent `godot --script` from ever reaching
#   the script's `_init`/`quit`. Rather than touching `game/**` (read-only for this
#   work), probes run against a throwaway project outside the repo whose
#   `prototypes/` directory is a symlink to the real one, so `res://prototypes/...`
#   resolves to the committed source.
#
# USAGE
#   GODOT=/path/to/godot ./run_native_probe.sh <script-res-path> [extra godot args]
#     e.g. ./run_native_probe.sh \
#            res://prototypes/skill_readiness/tests/gold93_venom_ground_parity_test.gd
#
# ENV
#   GODOT   path to a Godot 4.x binary. Defaults to the locally built
#           /home/user/tools_build/godot/bin/godot.linuxbsd.editor.x86_64
#           (built from godotengine/godot 4.7-stable with scons; the GitHub
#           release assets are unreachable from the build sandbox, so the binary
#           is compiled from source: `platform=linuxbsd target=editor`).
#   PROBE_DIR  where the throwaway project lives (default /tmp/gold93-probe).

set -euo pipefail

SCRIPT="${1:?usage: run_native_probe.sh <script-res-path> [godot args...]}"
shift || true

GODOT="${GODOT:-/home/user/tools_build/godot/bin/godot.linuxbsd.editor.x86_64}"
PROBE_DIR="${PROBE_DIR:-/tmp/gold93-probe}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

if [[ ! -x "$GODOT" ]]; then
	echo "run_native_probe: Godot binary not found or not executable: $GODOT" >&2
	echo "  build it, or set GODOT=/path/to/godot" >&2
	exit 2
fi

mkdir -p "$PROBE_DIR"
ln -sfn "$REPO_ROOT/prototypes" "$PROBE_DIR/prototypes"
if [[ ! -f "$PROBE_DIR/project.godot" ]]; then
	cat >"$PROBE_DIR/project.godot" <<'EOF'
config_version=5

[application]
config/name="gold93-probe"
run/main_scene=""
config/features=PackedStringArray("4.7", "GL Compatibility")

[rendering]
renderer/rendering_method="gl_compatibility"
EOF
fi

exec "$GODOT" --headless --path "$PROBE_DIR" --script "$SCRIPT" "$@"
