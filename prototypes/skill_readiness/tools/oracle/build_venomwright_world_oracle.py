#!/usr/bin/env python3
"""Supplementary differential oracle: the ORIGINAL world WITHOUT any cast.

`build_venomwright_oracle.py` produces the per-skill oracle (world + skill). When
a native cast diverges on the very first sampled tick it is impossible to tell
whether the fault is in the skill generator or in the world simulation /
renderer underneath it. This builder produces the missing half: the same
protocol, the same seed, the same ground and the same sampling schedule, but the
cast is pushed past the end of the run so **only** `World.step` + `World.draw`
are exercised.

Output: docs/vfx/skill_readiness/diagnostics/venomwright_world_only.json

It is a diagnostic reference, not a readiness gate, and it is generated from the
ORIGINAL TypeScript sources exactly like the main oracle:

    export GOLD93_VENOM_SRC=/tmp/gold93-src/venomwright/src
    python3 prototypes/skill_readiness/tools/oracle/build_venomwright_world_oracle.py
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
OUT_DIR = REPO / "docs" / "vfx" / "skill_readiness" / "diagnostics"
DRIVER = HERE / "venomwright_oracle_driver.ts"

TICKS = 245
SAMPLES = sorted({t for t in range(1, TICKS + 1) if t % 5 == 0 or t <= 20} | {TICKS})

# Push the cast past the end of the run: the driver casts when `n === castN`,
# so a value beyond TICKS means the world is observed with no skill at all.
NO_CAST_TICK = TICKS + 1000


SEEDS = [int(x) for x in os.environ.get("GOLD93_ORACLE_SEEDS", "7,21,99").split(",") if x.strip()]


def main() -> int:
    src = Path(os.environ.get("GOLD93_VENOM_SRC", "")).expanduser()
    if not (src / "game" / "world.ts").is_file():
        sys.exit("GOLD93_VENOM_SRC must point at the extracted original `src` dir")
    if not (REPO / "project.godot").is_file():
        sys.exit(f"REPO is not the repository root: {REPO}")
    if REPO not in OUT_DIR.parents:
        sys.exit(f"OUT_DIR escaped the repository: {OUT_DIR}")
    esbuild = shutil.which("esbuild") or shutil.which("npx")
    if not esbuild:
        sys.exit("esbuild not found (npm i -g esbuild)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    for seed in SEEDS:
        written.append(run_seed(src, esbuild, seed))
    print("world-only oracle: %s" % ", ".join(written))
    return 0


def run_seed(src: Path, esbuild: str, seed: int) -> str:
    with tempfile.TemporaryDirectory() as tmp:
        bundle = Path(tmp) / "driver.mjs"
        staged = src / ".gold93_world_driver.ts"
        shutil.copyfile(DRIVER, staged)
        try:
            cmd = [esbuild, str(staged), "--bundle", "--platform=node",
                   "--format=esm", f"--outfile={bundle}", "--log-level=warning"]
            if esbuild.endswith("npx"):
                cmd = [esbuild, "-y", "esbuild"] + cmd[1:]
            subprocess.run(cmd, check=True)
        finally:
            staged.unlink(missing_ok=True)

        env = dict(os.environ, GOLD93_CAST_TICK=str(NO_CAST_TICK),
                   GOLD93_DENSITY="16", GOLD93_FORMATION="1",
                   GOLD93_SEED=str(seed))
        proc = subprocess.run(["node", str(bundle), "1", str(TICKS),
                               ",".join(str(t) for t in SAMPLES)],
                              capture_output=True, text=True, env=env, check=False)
        if proc.returncode != 0:
            sys.exit(f"driver failed:\n{proc.stderr[:2000]}")
        data = json.loads(proc.stdout)

    if data["hits"] or data["cues"]:
        sys.exit("world-only run produced hits/cues: the cast was not suppressed")
    data["purpose"] = ("ORIGINAL World.step+draw with NO cast: isolates the world "
                       "simulation and renderer from skill generators")
    data["cast_tick"] = None
    data["protocol"] = {
        "schema": "gold93/venomwright-world-oracle/v1",
        "seed": seed, "enemy_density": 16, "ground_seed": 17,
        "enemy_placement": "formation (World.reset(seed, true))",
        "logical_resolution": [600, 340], "native_resolution": [1200, 680],
        "raster_density_k": 2, "world_step_hz": 60,
        "cast": "suppressed (GOLD93_CAST_TICK beyond the run length)",
        "hash": "sha256 of the raw little-endian Uint32 buffer, truncated to 32 hex",
    }
    name = ("venomwright_world_only.json" if seed == 7
            else "venomwright_world_only_s%d.json" % seed)
    out = OUT_DIR / name
    out.write_text(json.dumps(data, indent=1, sort_keys=True) + "\n")
    return f"seed {seed}: {len(data['rows'])} rows -> {name}"


if __name__ == "__main__":
    raise SystemExit(main())
