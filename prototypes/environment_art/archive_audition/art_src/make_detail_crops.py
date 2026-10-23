#!/usr/bin/env python3
"""Cut the 4x nearest-neighbour detail crops used in the audition report.

These are straight upscales of the native 1280x720 Godot captures — no
resampling, no compositing, no annotation. Run after the capture job has
published its frames:

    python3 art_src/make_detail_crops.py
"""

from __future__ import annotations

import os

from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAPTURES = os.path.join(BASE, "captures")

# (output name, source frame, left, top, width, height, what it shows)
CROPS = [
    ("detail_armarium", "archive_room_end.png", 468, 88, 236, 140,
     "the open armarium: doors, shelves, manuscript rows, flanking lights"),
    ("detail_doorway", "archive_room_arrival.png", 536, 480, 160, 132,
     "the doorway and its masonry: voussoir arch, jambs, threshold, wall join"),
    ("detail_breach", "archive_room_mid.png", 672, 466, 208, 148,
     "the collapsed corner: broken wall, fallen beam, rubble, standing water"),
    ("detail_study", "archive_room_entry.png", 336, 240, 232, 148,
     "the study furniture: long table, books, bench, pier bases"),
]

SCALE = 4


def main() -> int:
    for name, frame, left, top, width, height, _note in CROPS:
        source = os.path.join(CAPTURES, frame)
        if not os.path.exists(source):
            print(f"missing {source}")
            return 1
        with Image.open(source) as sheet:
            box = (left, top, left + width, top + height)
            crop = sheet.convert("RGB").crop(box)
        crop = crop.resize(
            (width * SCALE, height * SCALE), Image.Resampling.NEAREST
        )
        out = os.path.join(CAPTURES, f"{name}.png")
        crop.save(out)
        print(f"{out}  {crop.width}x{crop.height}  (from {frame} {box})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
