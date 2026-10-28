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
# .../prototypes/skill_readiness/tools/oracle
#   parents[0] = tools, [1] = skill_readiness, [2] = prototypes, [3] = repo root
# parents[4] is the HOME directory: using it silently wrote the whole oracle tree
# to ~/docs/... outside the repository. Asserted below so it cannot regress.
REPO = HERE.parents[3]
ORACLE_DIR = REPO / "docs" / "vfx" / "skill_readiness" / "oracle"
DRIVER = HERE / "venomwright_oracle_driver.ts"

# The cast tick the ORIGINAL engine is driven with, and the value every emitted
# file must report. The driver reads GOLD93_CAST_TICK; the protocol block and the
# per-file `cast_tick` field must both end up equal to this or the run aborts.
CAST_TICK = 1

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
    "cast_tick": CAST_TICK,
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


def assert_repo_root() -> None:
    """Fail loudly rather than writing the oracle outside the repository.

    `REPO` used to be HERE.parents[4], which is the home directory: the entire
    tree landed in ~/docs/... while the run still reported success. An oracle
    nobody can find is worse than a crash, so both the root marker and the
    containment of the output directory are checked before anything is written.
    """
    if not (REPO / "project.godot").is_file():
        sys.exit(
            f"REPO is not the repository root: {REPO}\n"
            f"  expected project.godot inside it (HERE={HERE})"
        )
    if ORACLE_DIR != REPO / "docs" / "vfx" / "skill_readiness" / "oracle":
        sys.exit(f"ORACLE_DIR escaped the repository: {ORACLE_DIR}")
    if REPO.name in ("", "/") or len(REPO.parts) < 2:
        sys.exit(f"implausible repository root: {REPO}")


def assert_cast_tick(data: dict, requested: int) -> None:
    """The recorded cast tick must equal the tick the engine was driven with.

    The driver previously hardcoded `cast_tick: 18` in its output while this
    builder drove it with GOLD93_CAST_TICK=1, so every oracle file advertised a
    timing it was never generated with.
    """
    got = data.get("cast_tick")
    if got != requested:
        sys.exit(
            f"cast-tick mismatch: driver reported {got!r}, builder requested "
            f"{requested!r}. Refusing to write an oracle whose recorded timing "
            f"does not describe how it was produced."
        )
    protocol = data.get("protocol") or {}
    if protocol and protocol.get("cast_tick") != requested:
        sys.exit(
            f"protocol cast_tick {protocol.get('cast_tick')!r} != requested "
            f"{requested!r}"
        )


def reproducibility_block() -> dict:
    """Fingerprints so a regenerated oracle can be proven byte-comparable."""
    import hashlib

    def digest(path: Path) -> str:
        return hashlib.sha256(path.read_bytes()).hexdigest()[:16]

    return {
        "driver_sha256_16": digest(DRIVER),
        "builder_sha256_16": digest(Path(__file__).resolve()),
        "out_dir": str(ORACLE_DIR.relative_to(REPO)),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--src",
        default=os.environ.get("GOLD93_VENOM_SRC", ""),
        help="Path to the extracted original `src` directory (contains game/).",
    )
    ap.add_argument("--only", default="", help="Comma separated skill ids to regenerate.")
    ap.add_argument("--out-dir", default=str(ORACLE_DIR))
    ap.add_argument(
        "--extra-seeds", default=os.environ.get("GOLD93_EXTRA_SEEDS", ""),
        help="Comma separated extra world seeds. The canonical oracle stays at "
             "seed 7; variants are written to the diagnostics directory so the "
             "differential test can compare more than one world.",
    )
    args = ap.parse_args()

    src = Path(args.src).expanduser() if args.src else None
    if src is None or not (src / "game" / "world.ts").is_file():
        sys.exit(
            "GOLD93_VENOM_SRC must point at the extracted original TypeScript "
            "`src` directory (expected game/world.ts inside it)."
        )

    assert_repo_root()
    esbuild = find_esbuild()
    out_dir = Path(args.out_dir)
    if not out_dir.is_absolute():
        out_dir = (REPO / out_dir).resolve()
    # Containment check: --out-dir must not be used to smuggle the oracle
    # outside the repository the way the old parents[4] bug did.
    if REPO not in out_dir.parents and out_dir != REPO:
        sys.exit(f"--out-dir is outside the repository root {REPO}: {out_dir}")
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
        extra_seeds = [int(x) for x in args.extra_seeds.split(",") if x.strip()]
        index_skills = []
        for sid in wanted:
            total = TOTALS[sid]
            ticks = total + 40
            samples = sample_ticks(total)
            env = dict(os.environ, GOLD93_CAST_TICK=str(CAST_TICK),
                       GOLD93_DENSITY="16", GOLD93_FORMATION="1")
            for seed in extra_seeds:
                venv = dict(env, GOLD93_SEED=str(seed))
                vproc = subprocess.run(
                    ["node", str(bundle), str(sid), str(ticks),
                     ",".join(str(t) for t in samples)],
                    capture_output=True, text=True, env=venv, check=False,
                )
                if vproc.returncode != 0:
                    print(f"  skill {sid} seed {seed}: FAILED\n{vproc.stderr[:800]}")
                    return 1
                vdata = json.loads(vproc.stdout)
                vproto = dict(PROTOCOL)
                vproto["seed"] = seed
                vdata["protocol"] = vproto
                assert_cast_tick(vdata, CAST_TICK)
                vdata["purpose"] = (
                    "ORIGINAL engine replay of venomwright:%03d at world seed %d; "
                    "a second differential reference so parity is not proven on a "
                    "single world." % (sid, seed))
                diag_dir = REPO / "docs" / "vfx" / "skill_readiness" / "diagnostics"
                diag_dir.mkdir(parents=True, exist_ok=True)
                vtarget = diag_dir / ("venomwright_%03d_s%d.json" % (sid, seed))
                vtarget.write_text(json.dumps(vdata, indent=1, sort_keys=True) + "\n")
                print("  %2d %-26s seed=%-3d rows=%-4d hits=%-4d cues=%-4d -> %s"
                      % (sid, vdata["name"], seed, len(vdata["rows"]),
                         len(vdata["hits"]), len(vdata["cues"]), vtarget.name))
            proc = subprocess.run(
                ["node", str(bundle), str(sid), str(ticks),
                 ",".join(str(t) for t in samples)],
                capture_output=True, text=True, env=env, check=False,
            )
            if proc.returncode != 0:
                print(f"  skill {sid}: FAILED\n{proc.stderr[:800]}")
                return 1
            data = json.loads(proc.stdout)
            data["protocol"] = PROTOCOL
            assert_cast_tick(data, CAST_TICK)
            data["canonical_id"] = "venomwright:%03d" % sid
            data["archive_sha256"] = VENOMWRIGHT_ARCHIVE_SHA256
            name = "venomwright_%03d.json" % sid
            target = out_dir / name
            (target).write_text(json.dumps(data, indent=1, sort_keys=True) + "\n")
            # Reproducibility check: the file must be where the index says it is.
            if not target.is_file():
                sys.exit(f"oracle file was not written: {target}")
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

    proto = dict(PROTOCOL)
    proto.update(reproducibility_block())
    index = {
        "schema": "gold93/venomwright-oracle-index/v1",
        "source_archive_sha256": VENOMWRIGHT_ARCHIVE_SHA256,
        "generated_by": "prototypes/skill_readiness/tools/oracle/build_venomwright_oracle.py",
        "engine": "ORIGINAL TypeScript src/game/** executed headlessly in Node",
        "protocol": proto,
        "skills": index_skills,
    }
    (out_dir / "index.json").write_text(json.dumps(index, indent=1, sort_keys=True) + "\n")

    # Reproducibility checks: every file the index advertises must exist inside
    # the repository, and the index must agree with what is on disk.
    missing = [s["file"] for s in index_skills
               if not (REPO / s["file"]).is_file()]
    if missing:
        sys.exit(f"index references missing oracle files: {missing}")
    stale = sorted(p.name for p in out_dir.glob("venomwright_*.json")
                   if int(p.stem.split("_")[1]) not in wanted)
    if stale and not args.only:
        print(f"  note: {len(stale)} oracle file(s) not regenerated: {stale[:5]}")
    print(f"oracle written: {len(index_skills)} skills -> {out_dir}")
    print(f"  repository root asserted: {REPO}")
    print(f"  cast tick asserted: {CAST_TICK} (driver, per-file and protocol agree)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
