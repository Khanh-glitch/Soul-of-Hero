#!/usr/bin/env python3
"""Regenerate the Venomwright GOLD93 differential oracle from the ORIGINAL source.

The original archive bytes are never committed. Supply the extracted original
TypeScript tree (see `prototypes/skill_readiness/source_escrow/README.md`) and
this script bundles the driver against it, runs every Venomwright skill in the
real original engine and writes one authoritative reference file per skill.

    export GOLD93_VENOM_SRC=/tmp/gold93-src/venomwright/src
    python3 prototypes/skill_readiness/tools/oracle/build_venomwright_oracle.py

Requirements: node (>=20) and esbuild (`npm i -g esbuild`, resolved from PATH or
from a local node_modules). Nothing is written inside the source tree.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]  # .../prototypes/skill_readiness/tools/oracle -> repo root
ORACLE_DIR = REPO / "docs" / "vfx" / "skill_readiness" / "oracle"
DRIVER = HERE / "venomwright_oracle_driver.ts"

VENOMWRIGHT_ARCHIVE_SHA256 = (
    "ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716"
)

# Authored `total` frame count per skill, taken from the original
# `src/game/skills/index.ts` META table. The oracle samples the authored
# timeline plus a 40-tick aftermath tail.
TOTALS = {
    1: 205, 2: 265, 3: 195, 4: 360, 5: 255, 6: 345, 7: 280, 8: 290, 9: 400,
    10: 800, 11: 80, 12: 220, 13: 280, 14: 300, 15: 275, 16: 375, 17: 285,
    18: 370, 19: 295, 20: 405, 21: 850,
}

PROTOCOL = {
    "schema": "gold93/venomwright-oracle-protocol/v1",
    "logical_resolution": [600, 340],
    "native_resolution": [1200, 680],
    "raster_density_k": 2,
    "world_step_hz": 60,
    "seed": 7,
    "enemy_placement": "formation (World.reset(seed, true))",
    "enemy_density": 16,
    "cast_tick": 1,
    "ground_seed": 17,
    "aim": "Engine.autoAim(def) -> Engine.resolve(def, cluster centroid)",
    "buffers_hashed": ["scene RGBA8 (g.s.d)", "glow RGBA8 (g.l.d)"],
    "hash": "sha256 of the raw little-endian Uint32 buffer, truncated to 32 hex",
    "overlays": "none (no aim reticle, no mouse cursor, no HUD text)",
    "rng": "World Rng(seed) for the world stream; cast Rng = (seed*1315423911 + id*2654435761 + skill*97) >>> 0",
}


def find_esbuild() -> str:
    for cand in ("esbuild", "npx"):
        exe = shutil.which(cand)
        if exe:
            return exe
    local = Path.cwd() / "node_modules" / ".bin" / "esbuild"
    if local.is_file():
        return str(local)
    sys.exit("esbuild not found. Install it with `npm i -g esbuild`.")


def sample_ticks(total: int) -> list[int]:
    ticks = total + 40
    return sorted({t for t in range(1, ticks + 1) if t % 5 == 0 or t <= 20} | {ticks})


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--src",
        default=os.environ.get("GOLD93_VENOM_SRC", ""),
        help="Path to the extracted original `src` directory (contains game/).",
    )
    ap.add_argument("--only", default="", help="Comma separated skill ids to regenerate.")
    ap.add_argument("--out-dir", default=str(ORACLE_DIR))
    args = ap.parse_args()

    src = Path(args.src).expanduser() if args.src else None
    if src is None or not (src / "game" / "world.ts").is_file():
        sys.exit(
            "GOLD93_VENOM_SRC must point at the extracted original TypeScript "
            "`src` directory (expected game/world.ts inside it)."
        )

    esbuild = find_esbuild()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        bundle = Path(tmp) / "driver.mjs"
        # The driver is copied next to the original sources so its relative
        # imports resolve; the original tree is never modified afterwards.
        staged = src / ".gold93_oracle_driver.ts"
        shutil.copyfile(DRIVER, staged)
        try:
            cmd = [esbuild, str(staged), "--bundle", "--platform=node",
                   "--format=esm", f"--outfile={bundle}", "--log-level=warning"]
            if esbuild.endswith("npx"):
                cmd = [esbuild, "-y", "esbuild", str(staged), "--bundle",
                       "--platform=node", "--format=esm", f"--outfile={bundle}",
                       "--log-level=warning"]
            subprocess.run(cmd, check=True)
        finally:
            staged.unlink(missing_ok=True)

        wanted = [int(x) for x in args.only.split(",") if x.strip()] or sorted(TOTALS)
        index_skills = []
        for sid in wanted:
            total = TOTALS[sid]
            ticks = total + 40
            samples = sample_ticks(total)
            env = dict(os.environ, GOLD93_CAST_TICK="1", GOLD93_DENSITY="16",
                       GOLD93_FORMATION="1")
            proc = subprocess.run(
                ["node", str(bundle), str(sid), str(ticks),
                 ",".join(str(t) for t in samples)],
                capture_output=True, text=True, env=env, check=False,
            )
            if proc.returncode != 0:
                print(f"  skill {sid}: FAILED\n{proc.stderr[:800]}")
                return 1
            data = json.loads(proc.stdout)
            data["canonical_id"] = "venomwright:%03d" % sid
            data["archive_sha256"] = VENOMWRIGHT_ARCHIVE_SHA256
            data["protocol"] = PROTOCOL
            name = "venomwright_%03d.json" % sid
            (out_dir / name).write_text(json.dumps(data, indent=1, sort_keys=True) + "\n")
            index_skills.append({
                "canonical_id": data["canonical_id"], "skill": sid,
                "name": data["name"], "ticks": ticks,
                "sampled_ticks": len(data["rows"]),
                "hits": len(data["hits"]), "cues": len(data["cues"]),
                "file": "docs/vfx/skill_readiness/oracle/" + name,
            })
            print("  %2d %-26s ticks=%-4d rows=%-4d hits=%-4d cues=%-4d"
                  % (sid, data["name"], ticks, len(data["rows"]),
                     len(data["hits"]), len(data["cues"])))

    index = {
        "schema": "gold93/venomwright-oracle-index/v1",
        "source_archive_sha256": VENOMWRIGHT_ARCHIVE_SHA256,
        "generated_by": "prototypes/skill_readiness/tools/oracle/build_venomwright_oracle.py",
        "engine": "ORIGINAL TypeScript src/game/** executed headlessly in Node",
        "protocol": PROTOCOL,
        "skills": index_skills,
    }
    (out_dir / "index.json").write_text(json.dumps(index, indent=1, sort_keys=True) + "\n")
    print(f"oracle written: {len(index_skills)} skills -> {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
