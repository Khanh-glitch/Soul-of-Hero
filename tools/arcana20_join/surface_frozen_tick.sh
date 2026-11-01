#!/usr/bin/env bash
# One exact source-tick extract, complete viewport reduced for annotation.
# The source video is the full native lossless frozen-world capture; this
# selected frame is not moving-world evidence or a complete visual verdict.
set -euo pipefail
root="$1"
tick="$2"
video=$(find "$root" -name native-lossless.mkv -print -quit)
test -n "$video"
mkdir -p preview
label=$(printf 'temporal_tick_%03d' "$tick")
ffmpeg -hide_banner -loglevel error -y -i "$video" -vf "select=eq(n\\,$tick)" -fps_mode vfr -frames:v 1 "preview/$label.png"
test -s "preview/$label.png"
echo "FROZEN_SOURCE_FRAME skill=18 tick=$tick frame=$label source_run=41297073989"
python3 prototypes/arcana_fusion20/renderer/c10_review_surface.py preview "$label"
