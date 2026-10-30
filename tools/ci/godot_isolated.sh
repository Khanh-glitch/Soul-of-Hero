#!/usr/bin/env bash
# Godot 4.7 has no --user-data-dir option. Route user:// via XDG instead.
# Keep every other argument byte-for-byte, including user args after --.
set -euo pipefail
args=()
data_dir=''
while (($#)); do
  if [[ "$1" == '--user-data-dir' ]]; then
    [[ $# -ge 2 && -z "$data_dir" && -n "$2" ]] || { echo 'invalid --user-data-dir' >&2; exit 2; }
    data_dir="$2"
    shift 2
  elif [[ "$1" == '--' ]]; then
    args+=("$@")
    break
  else
    args+=("$1")
    shift
  fi
done
if [[ -n "$data_dir" ]]; then
  mkdir -p "$data_dir"
  export XDG_DATA_HOME="$(cd "$data_dir" && pwd -P)"
fi
exec godot "${args[@]}"
