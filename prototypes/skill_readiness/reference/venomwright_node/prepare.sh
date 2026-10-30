#!/usr/bin/env bash
# Builds the Node reference workspace from the ORIGINAL Venomwright source.
# The source is never copied into the repository. Set GOLD93_VENOM_SRC to the
# extracted `src` directory (default: /tmp/gold93-original-sources/venomwright/src).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${GOLD93_VENOM_SRC:-/tmp/gold93-original-sources/venomwright/src}"
WORK="${GOLD93_VENOM_REF_WORK:-/tmp/gold93-venom-ref}"
test -d "$SRC/game" || { echo "missing original source at $SRC" >&2; exit 2; }
rm -rf "$WORK" && mkdir -p "$WORK"
cp -r "$SRC" "$WORK/src"
cp "$HERE/display.stub.ts" "$WORK/src/game/display.ts"
cp "$HERE/reference.ts" "$WORK/reference.ts"
cd "$WORK" && echo '{"name":"venom-ref","private":true,"type":"module"}' > package.json
npm install --no-audit --no-fund tsx@4.19.2 >/dev/null
echo "prepared $WORK"
