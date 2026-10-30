#!/usr/bin/env bash
# Builds the ARCANA Node reference workspace from the ORIGINAL ARCANA source
# (util.ts only; never copied into the repository).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${GOLD93_ARCANA_SRC:-/tmp/gold93-original-sources/arcana/src}"
WORK="${GOLD93_ARCANA_REF_WORK:-/tmp/gold93-arcana-ref}"
test -f "$SRC/engine/util.ts" || { echo "missing original source at $SRC" >&2; exit 2; }
rm -rf "$WORK" && mkdir -p "$WORK/src/engine"
cp "$SRC/engine/util.ts" "$WORK/src/engine/util.ts"
cp "$HERE/reference.ts" "$WORK/reference.ts"
cd "$WORK" && echo '{"name":"arcana-ref","private":true,"type":"module"}' > package.json
npm install --no-audit --no-fund tsx@4.19.2 >/dev/null
echo "prepared $WORK"
