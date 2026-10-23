#!/usr/bin/env python3
"""Build the Gate 0 evidence sheets from the NATIVE Godot 4.7 captures.

Input  : docs/gate0/evidence/before_*.png / after_*.png  (1280x720, real viewport)
Output : docs/gate0/evidence/comparison_<station>.png      before | after, same crop
         docs/gate0/evidence/closeup_<assembly>.png       4x nearest-neighbour cuts
         docs/gate0/evidence/closeup_pair_<assembly>.png  4x before/after pair

Nothing is composited, retouched or annotated onto the game pixels: a crop is a
crop and a 4x cut is a straight nearest-neighbour upscale. The before and after
frames are walked to the same stations by the same harness, so their camera
positions match to within a pixel and the crops are directly comparable.

    python3 tools/gate0/make_evidence_sheets.py
    python3 tools/gate0/make_evidence_sheets.py --check   # verify sizes only
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "docs/gate0/evidence"
EXPECTED = (1280, 720)
CAPTION_H = 34

STATIONS = ["spawn", "entry", "destination", "combat_space"]

# (name, station, left, top, width, height) in capture pixels. Chosen on the
# frames themselves and then reused verbatim for the before/after pair.
# Boxes are placed on the assemblies' actual screen positions for the current
# station set (see the station table in capture_gate0.gd), then padded so the
# joinery around the furniture is visible and a reviewer can judge whether the
# prop sits on the wall properly rather than only seeing the prop.
CLOSEUPS = [
    ("press_bank", "destination", 380, 270, 320, 190),
    ("copyist_station", "entry", 360, 330, 300, 200),
    ("long_board_collapse", "entry", 340, 520, 360, 200),
    ("east_departure", "combat_space", 640, 510, 340, 200),
]
SCALE = 4


def load(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGB")


def label(image: Image.Image, text: str) -> Image.Image:
    canvas = Image.new("RGB", (image.width, image.height + CAPTION_H), (16, 13, 20))
    canvas.paste(image, (0, CAPTION_H))
    ImageDraw.Draw(canvas).text((8, 10), text, fill=(230, 224, 212))
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    missing = []
    for station in STATIONS:
        for prefix in ("before", "after"):
            path = EVIDENCE / f"{prefix}_{station}.png"
            if not path.exists():
                missing.append(path.name)
                continue
            size = load(path).size
            if size != EXPECTED:
                print(f"WRONG SIZE: {path.name} is {size}, expected {EXPECTED}")
                return 1
    if missing:
        print("MISSING NATIVE CAPTURES: " + ", ".join(missing))
        print("Run the Gate 0 workflow (or capture_gate0.tscn) first - this script")
        print("deliberately refuses to fall back to authoring previews.")
        return 1
    if args.check:
        print(f"EVIDENCE CHECK PASSED: {len(STATIONS) * 2} native 1280x720 frames present")
        return 0

    made = 0
    for station in STATIONS:
        before = load(EVIDENCE / f"before_{station}.png")
        after = load(EVIDENCE / f"after_{station}.png")
        gap = 8
        sheet = Image.new("RGB", (before.width + gap + after.width, before.height), (12, 10, 14))
        sheet.paste(before, (0, 0))
        sheet.paste(after, (before.width + gap, 0))
        target = EVIDENCE / f"comparison_{station}.png"
        sheet.save(target)
        made += 1
        print(f"{target.relative_to(ROOT)}  {sheet.width}x{sheet.height}  (before | after)")

    for name, station, left, top, width, height in CLOSEUPS:
        box = (left, top, left + width, top + height)
        for prefix in ("before", "after"):
            frame = load(EVIDENCE / f"{prefix}_{station}.png").crop(box)
            frame = frame.resize((width * SCALE, height * SCALE), Image.Resampling.NEAREST)
            target = EVIDENCE / f"closeup_{name}_{prefix}.png"
            frame.save(target)
            print(f"{target.relative_to(ROOT)}  {frame.width}x{frame.height}  4x from "
                  f"{prefix}_{station} {box}")
            made += 1
        before = load(EVIDENCE / f"before_{station}.png").crop(box)
        after = load(EVIDENCE / f"after_{station}.png").crop(box)
        width4, height4 = width * SCALE, height * SCALE
        pair = Image.new("RGB", (width4 * 2 + 8, height4 + CAPTION_H), (16, 13, 20))
        pair.paste(before.resize((width4, height4), Image.Resampling.NEAREST), (0, CAPTION_H))
        pair.paste(after.resize((width4, height4), Image.Resampling.NEAREST),
                   (width4 + 8, CAPTION_H))
        draw = ImageDraw.Draw(pair)
        draw.text((8, 10), f"BEFORE  {station} 4x", fill=(230, 224, 212))
        draw.text((width4 + 16, 10), f"AFTER  {station} 4x", fill=(255, 232, 186))
        target = EVIDENCE / f"closeup_pair_{name}.png"
        pair.save(target)
        print(f"{target.relative_to(ROOT)}  {pair.width}x{pair.height}  (before | after 4x)")
        made += 1

    print(f"{made} evidence images written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
