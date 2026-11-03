#!/usr/bin/env bash
# MAP-LR01 reproducible pipeline. Run from anywhere; REPO resolves to git root.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$HERE/../.."
LAB="$HERE/.."
cd "$HERE"
export LR01_OUT="$HERE/output"

echo "== MAP-LR01 source authority =="
git -C "$REPO" rev-parse --short HEAD
node -e '
import("./src/lib/veyra.mjs").then(m=>{const v=m.loadVeyra();console.log("VEYRA_SHA",v.fingerprint.actualSha256,"verified="+v.fingerprint.verified,"pois="+v.P.pois.length);const g=m.loadGeoInputs();console.log("GEO_SHA",g.fingerprints.geography.sha256.slice(0,16),g.fingerprints.corridor.sha256.slice(0,16));}).catch(e=>{console.error(e);process.exit(1)});'

echo "== Milestone A: corrected per-POI scale =="
node src/a_scale.mjs
node tools/render_a.mjs

echo "== Milestone B: whole-world geography compiler =="
if [ -f src/b_geography.mjs ]; then node src/b_geography.mjs; else echo "B_PENDING"; fi
echo "== Milestone C: transport audit =="
if [ -f src/c_transport.mjs ]; then node src/c_transport.mjs; else echo "C_PENDING"; fi
echo "== Milestone D: POI spatial layouts =="
if [ -f src/d_poi.mjs ]; then node src/d_poi.mjs; else echo "D_PENDING"; fi
echo "== Milestone E: native views =="
if [ -f tools/render_world.mjs ]; then node tools/render_world.mjs; else echo "E_PENDING"; fi
echo "== Milestone F: geography-only handoff =="
if [ -f src/f_handoff.mjs ]; then node src/f_handoff.mjs; else echo "F_PENDING"; fi

echo "== Continuous gates =="
node src/test.mjs

echo "== GEO-01 / GEO-02 regressions =="
( cd "$LAB/geo01" && ./reproduce.sh ) | tail -3
( cd "$LAB/geo02" && ./reproduce.sh ) | tail -3

echo "MAP-LR01_REPRODUCE_OK"
