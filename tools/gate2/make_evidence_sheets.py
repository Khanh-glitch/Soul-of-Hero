#!/usr/bin/env python3
"""Gate 2 evidence sheets.

Builds honest before/after pairs from the native 1280x720 frames the
`gate2-runtime` workflow captures. Nothing here simulates, re-renders or
repaints a game frame: every pixel comes from the Godot viewport. The only
transformations are side-by-side pasting and labelled nearest-neighbour crops of
a native frame, which the filenames and the run report both say out loud.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "docs/gate2/evidence"

STATIONS = ("spawn", "archive_entry", "landmark", "cloister", "combat_space", "return_route")

# Labelled nearest-neighbour crops of AFTER frames, for inspecting material and
# prop detail at 3x. Boxes are in native-frame pixels.
CROPS = (
    ("landmark", "armarium_alcove", (400, 200, 860, 500)),
    ("cloister", "cloister_garth", (380, 180, 900, 520)),
    ("combat_space", "reading_room_cover", (420, 240, 940, 560)),
    ("spawn", "nave_stacks", (300, 300, 840, 620)),
)


def load(station: str, prefix: str) -> Image.Image:
    path = EVIDENCE / f"{prefix}_{station}.png"
    if not path.exists():
        raise SystemExit(f"missing native frame {path.relative_to(ROOT)}")
    image = Image.open(path)
    if image.size != (1280, 720):
        raise SystemExit(f"{path.name} is {image.size}, expected (1280, 720)")
    return image.convert("RGB")


def main() -> int:
    made = 0
    for station in STATIONS:
        before = load(station, "before")
        after = load(station, "after")
        sheet = Image.new("RGB", (1280 * 2 + 8, 720), (14, 12, 16))
        sheet.paste(before, (0, 0))
        sheet.paste(after, (1288, 0))
        sheet.save(EVIDENCE / f"comparison_{station}.png")
        made += 1

    for station, label, box in CROPS:
        with Image.open(EVIDENCE / f"after_{station}.png") as image:
            crop = image.convert("RGB").crop(box)
            crop = crop.resize((crop.width * 3, crop.height * 3), Image.Resampling.NEAREST)
            crop.save(EVIDENCE / f"inspection_crop_{label}_3x.png")
            made += 1

    print(f"GATE2 EVIDENCE: {made} sheets from native 1280x720 frames "
          f"({len(STATIONS)} before/after pairs, {len(CROPS)} labelled 3x crops)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
