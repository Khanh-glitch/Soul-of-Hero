#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node v4/tests/run_v4.mjs
