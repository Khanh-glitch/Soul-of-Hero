#!/usr/bin/env python3
"""Before/after coverage sheets for the overworld.

The station list lives here, in one place, so a new station cannot appear in one
artefact and not another. Two sheets are produced:

    docs/overworld/evidence/overworld_gallery_stations.png   every travel/目的地
    docs/overworld/evidence/overworld_gallery_landmarks.png  the ten landmarks

Each panel is the *whole* 640x360 station frame, downscaled to 320x180, so the
comparison is of real renders and not of crops. "Before" frames are rendered from
an older commit by checking that commit out into a temporary worktree and running
its own `tools/overworld/evidence.py` there, which keeps the two sides honest:
the after side cannot accidentally be produced by the before code.

    python3 tools/overworld/gallery.py --before 8be364cf
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageChops, ImageStat

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
EVIDENCE = os.path.join(ROOT, "docs", "overworld", "evidence")
DATA = os.path.join(ROOT, "data", "overworld")

PANEL = (320, 180)
HEADER = 26
PAD = 8

# (file stem, label, kind). The stems match `evidence.STATIONS`, so a station
# cannot be covered by one artefact and missed by another.
STATIONS = [
    ("refuge_start", "Ashen Refuge (spawn)", "spawn"),
    ("crypt_approach", "L01 Crypt approach", "landmark"),
    ("ossuary_approach", "L02 Ossuary approach", "landmark"),
    ("archive_approach", "L03 Archive approach", "landmark"),
    ("reliquary_approach", "L04 Reliquary approach", "landmark"),
    ("crucible", "L05 Blood Crucible", "landmark"),
    ("relay", "L06 The Relay", "landmark"),
    ("beacon", "L07 Beacon", "landmark"),
    ("divided", "L08 The Divided", "landmark"),
    ("gate", "L09 Crimson Gate", "landmark"),
    ("throne", "L10 Castellan Throne", "landmark"),
    ("camp_refuge", "Camp: Ashen Refuge", "camp"),
    ("camp_crossroads", "Camp: Wayfarer Stones", "camp"),
    ("camp_relay_base", "Camp: Relay Foot", "camp"),
    ("camp_ridge", "Camp: Watch Ridge", "camp"),
]

LANDMARKS = [s for s in STATIONS if s[2] == "landmark"]


def _diff_share(before: Image.Image, after: Image.Image) -> float:
    if before.size != after.size:
        return 100.0
    diff = ImageChops.difference(before.convert("RGB"), after.convert("RGB"))
    gray = diff.convert("L")
    changed = sum(1 for p in gray.getdata() if p > 8)
    total = gray.width * gray.height
    return 100.0 * changed / max(1, total)


# Older revisions used different station names for the same place. The gallery
# compares the same *viewpoint*, so the alias is by viewpoint, not by label.
BEFORE_ALIAS = {
    "camp_refuge": "refuge_start",
}


def _load(directory: str, stem: str) -> Image.Image | None:
    path = os.path.join(directory, "overworld_%s.png" % stem)
    if not os.path.exists(path) and stem in BEFORE_ALIAS:
        path = os.path.join(directory, "overworld_%s.png" % BEFORE_ALIAS[stem])
    if not os.path.exists(path):
        return None
    return Image.open(path).convert("RGB")


def _sheet(rows, before_dir: str, after_dir: str, out_path: str) -> str:
    width = PANEL[0] * 2 + PAD * 3
    title_w = 96
    height = PAD
    for _ in rows:
        height += PANEL[1] + HEADER + PAD
    sheet = Image.new("RGB", (width + title_w, height), (14, 12, 18))
    draw = ImageDraw.Draw(sheet)
    y = PAD
    for stem, label, _kind in rows:
        before = _load(before_dir, stem)
        after = _load(after_dir, stem)
        draw.text((PAD, y), label, fill=(238, 228, 196))
        if before is None:
            draw.text((PAD, y + 13), "no before frame", fill=(180, 120, 120))
        else:
            sheet.paste(before.resize(PANEL, Image.LANCZOS), (PAD, y + HEADER - 8))
        if after is None:
            draw.text((PAD + PANEL[0] + 8, y + 13), "no after frame", fill=(180, 120, 120))
            share = 0.0
        else:
            sheet.paste(after.resize(PANEL, Image.LANCZOS), (PAD * 2 + PANEL[0], y + HEADER - 8))
            share = _diff_share(before, after) if before is not None else 0.0
        draw.text((width, y + PANEL[1] // 2), "%4.1f%%" % share, fill=(210, 200, 170))
        y += PANEL[1] + HEADER + PAD
    sheet.save(out_path)
    return out_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", default="", help="git revision to render the before side from")
    args = parser.parse_args()

    after_dir = os.path.join(EVIDENCE, "stations")
    missing = [s[0] for s in STATIONS if _load(after_dir, s[0]) is None]
    if missing:
        print("missing after frames: %s" % ", ".join(missing))
        print("run: python3 tools/overworld/evidence.py --stations")
        return 1

    if not args.before:
        # No revision given: compare the current render against the last committed
        # one, which is what "this pass" means in the docs.
        args.before = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True
        ).stdout.strip()

    before_dir = ""
    worktree = tempfile.mkdtemp(prefix="soh-before-")
    shutil.rmtree(worktree, ignore_errors=True)
    ok = subprocess.run(["git", "worktree", "add", "--detach", worktree, args.before],
                        cwd=ROOT, capture_output=True, text=True)
    if ok.returncode == 0:
        subprocess.run([sys.executable, "tools/overworld/evidence.py", "--stations"],
                       cwd=worktree, capture_output=True, text=True)
        before_dir = os.path.join(worktree, "docs", "overworld", "evidence", "stations")
        if not os.path.isdir(before_dir):
            # Older revisions predate `--stations`; their plain run writes the
            # same station names one level up, so read those instead of claiming
            # there is no before side.
            subprocess.run([sys.executable, "tools/overworld/evidence.py"],
                           cwd=worktree, capture_output=True, text=True)
            before_dir = os.path.join(worktree, "docs", "overworld", "evidence")
    else:
        print("could not check out %s: %s" % (args.before[:8], ok.stderr.strip()[:200]))

    try:
        print(_sheet(STATIONS, before_dir, after_dir,
                     os.path.join(EVIDENCE, "overworld_gallery_stations.png")))
        print(_sheet(LANDMARKS, before_dir, after_dir,
                     os.path.join(EVIDENCE, "overworld_gallery_landmarks.png")))
    finally:
        subprocess.run(["git", "worktree", "remove", "--force", worktree], cwd=ROOT,
                       capture_output=True, text=True)
        shutil.rmtree(worktree, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
