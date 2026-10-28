#!/usr/bin/env python3
"""Pixel-exact raster difference between the ORIGINAL engine and the native port.

The differential oracle records only SHA-256 hashes: enough to prove that the
two engines disagree, not enough to say *where*. This tool runs both engines to
the same tick, dumps their raw RGBA scene/glow buffers to a scratch directory and
reports the first differing pixels plus a tight bounding box, so a divergence can
be located instead of guessed at.

    # native side first (writes native_t<NNNN>_scene.bin into RAW):
    GOLD93_RAW_DIR=/tmp/gold93raw \
      godot --headless --path <probe> --script res://.../gold93_venom_differential_test.gd \
        -- --skill=2 --dump-tick=25

    python3 prototypes/skill_readiness/tools/oracle/diff_rasters.py \
      --skill=2 --tick=25 --raw-dir=/tmp/gold93raw

The original side is produced by re-running the ORIGINAL TypeScript through the
oracle driver with `GOLD93_RAW_DIR` set, so both buffers come from the real
engines -- nothing here is a reconstruction.

All scratch data stays in `--raw-dir` (default: a temporary directory). Nothing
is written into the repository and no original source is copied or emitted.
"""

from __future__ import annotations

import argparse
import os
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
DRIVER = HERE / "venomwright_oracle_driver.ts"

# Authored `total` frames, from the original `src/game/skills/index.ts` META.
TOTALS = {
    1: 205, 2: 265, 3: 195, 4: 360, 5: 255, 6: 345, 7: 280, 8: 290, 9: 400,
    10: 800, 11: 80, 12: 220, 13: 280, 14: 300, 15: 275, 16: 375, 17: 285,
    18: 370, 19: 295, 20: 405, 21: 850,
}

W, H = 1200, 680


def find_esbuild() -> str:
    import shutil
    for cand in ("esbuild", "npx"):
        exe = shutil.which(cand)
        if exe:
            return exe
    sys.exit("esbuild not found. Install it with `npm i -g esbuild`.")


def run_original(skill: int, tick: int, seed: int, raw_dir: Path, src: Path) -> None:
    """Drive the ORIGINAL TypeScript engine and dump its raw buffers."""
    import shutil
    esbuild = find_esbuild()
    with tempfile.TemporaryDirectory() as tmp:
        bundle = Path(tmp) / "driver.mjs"
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
        env = dict(os.environ)
        env["GOLD93_SEED"] = str(seed)
        env["GOLD93_CAST_TICK"] = "1"
        env["GOLD93_RAW_DIR"] = str(raw_dir)
        subprocess.run(
            # Only the tick under investigation is written: at 1200x680 RGBA
            # each buffer is 3.2 MB, so dumping a whole timeline is 100s of MB.
            ["node", str(bundle), str(skill), str(max(tick, TOTALS[skill])),
             str(tick)],
            check=True, env=env,
        )


def load(path: Path) -> bytes:
    if not path.is_file():
        sys.exit(f"missing buffer: {path}")
    return path.read_bytes()


def diff(name: str, a: bytes, b: bytes, limit: int) -> int:
    """Report the first differing pixels of two RGBA buffers."""
    if len(a) != len(b):
        print(f"{name}: SIZE MISMATCH original={len(a)} native={len(b)}")
        return 1
    if a == b:
        print(f"{name}: identical ({len(a)} bytes)")
        return 0
    px = len(a) // 4
    shown = 0
    minx, miny, maxx, maxy = W, H, -1, -1
    total = 0
    for i in range(px):
        if a[i * 4:i * 4 + 4] == b[i * 4:i * 4 + 4]:
            continue
        total += 1
        x, y = i % W, i // W
        if x < minx:
            minx = x
        if y < miny:
            miny = y
        if x > maxx:
            maxx = x
        if y > maxy:
            maxy = y
        if shown < limit:
            o = struct.unpack_from("<4B", a, i * 4)
            n = struct.unpack_from("<4B", b, i * 4)
            print(f"{name}: px ({x},{y}) orig=#{o[0]:02x}{o[1]:02x}{o[2]:02x}{o[3]:02x}"
                  f" native=#{n[0]:02x}{n[1]:02x}{n[2]:02x}{n[3]:02x}")
            shown += 1
    print(f"{name}: {total}/{px} pixels differ; bbox logical "
          f"x[{minx // 2}..{maxx // 2}] y[{miny // 2}..{maxy // 2}]")
    return 1


def ascii_region(a: bytes, b: bytes, cx: int, cy: int, w: int, h: int) -> None:
    """Print the same region of both buffers as a character grid.

    No image library is available in this sandbox, so each distinct colour is
    assigned a letter and the two grids are printed side by side; a '.' marks a
    pixel the two engines agree on and '?' a pixel outside the buffer.
    """
    legend: dict[bytes, str] = {}
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

    def sym(c: bytes) -> str:
        if c not in legend:
            legend[c] = letters[len(legend) % len(letters)]
        return legend[c]

    rows_a: list[str] = []
    rows_b: list[str] = []
    for y in range(cy - h // 2, cy - h // 2 + h):
        ra, rb = "", ""
        for x in range(cx - w // 2, cx - w // 2 + w):
            if not (0 <= x < W and 0 <= y < H):
                ra += "?"
                rb += "?"
                continue
            i = (y * W + x) * 4
            ca, cb = a[i:i + 4], b[i:i + 4]
            if ca == cb:
                ra += "."
                rb += "."
            else:
                ra += sym(ca)
                rb += sym(cb)
        rows_a.append(ra)
        rows_b.append(rb)
    print("region %dx%d at native (%d,%d)   ORIGINAL | NATIVE" % (w, h, cx, cy))
    for ra, rb in zip(rows_a, rows_b):
        print("  %s   %s" % (ra, rb))
    print("legend:", " ".join("#%02x%02x%02x%s" % (c[0], c[1], c[2], l)
                              for c, l in legend.items()))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skill", type=int, required=True)
    ap.add_argument("--tick", type=int, required=True)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--raw-dir", default="")
    ap.add_argument("--limit", type=int, default=24)
    ap.add_argument("--skip-original", action="store_true",
                    help="reuse the original buffers already in --raw-dir")
    ap.add_argument("--src", default=os.environ.get("GOLD93_VENOM_SRC", ""))
    ap.add_argument("--ascii", action="store_true",
                    help="print the differing region as a character grid")
    ap.add_argument("--cx", type=int, default=0)
    ap.add_argument("--cy", type=int, default=0)
    ap.add_argument("--w", type=int, default=96)
    ap.add_argument("--h", type=int, default=40)
    args = ap.parse_args()

    if args.raw_dir:
        raw_dir = Path(args.raw_dir)
        raw_dir.mkdir(parents=True, exist_ok=True)
    else:
        raw_dir = Path(tempfile.mkdtemp(prefix="gold93raw"))
    print(f"raw dir: {raw_dir}")

    if not args.skip_original:
        src = Path(args.src).expanduser() if args.src else None
        if src is None or not (src / "game" / "world.ts").is_file():
            sys.exit("--src (or GOLD93_VENOM_SRC) must point at the extracted "
                     "original TypeScript `src` directory")
        run_original(args.skill, args.tick, args.seed, raw_dir, src)

    tag = f"t{args.tick:04d}"
    bad = 0
    for layer in ("scene", "glow"):
        o = load(raw_dir / f"orig_{tag}_{layer}.bin")
        n = load(raw_dir / f"native_{tag}_{layer}.bin")
        bad |= diff(layer, o, n, args.limit)
        if args.ascii and bad and layer == "scene":
            ascii_region(o, n, args.cx, args.cy, args.w, args.h)
    return bad


if __name__ == "__main__":
    sys.exit(main())
