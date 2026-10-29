#!/usr/bin/env python3
"""Placeholder construction art for the SURV-010 slice.

These are **development placeholders**, not production art. The blocker recorded
in `docs/survival/STATE.json` (`BUILD-ART`) says the modular building kit has not
been selected or licensed yet; what the mechanics need in the meantime is a frame
per build piece that reads as that piece at 16 px and makes the placement ghost
legible. A6 replaces this atlas when the kit is chosen.

Drawn programmatically so the palette stays inside the existing Soul of Hero
palette (grey-violet stone, rusted iron, dry timber) and so the slice ships no
third-party art.

    python3 tools/survival/build_art.py

Writes:
  assets/survival/build/placeholder_build.png
  data/survival/placeholder_build.json   (frame rects + which are solid)
"""

from __future__ import annotations

import json
import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_PNG = os.path.join(ROOT, "assets", "survival", "build", "placeholder_build.png")
OUT_JSON = os.path.join(ROOT, "data", "survival", "placeholder_build.json")

TILE = 16

WOOD = (108, 76, 50, 255)
WOOD_HI = (144, 106, 70, 255)
WOOD_DK = (66, 46, 32, 255)
IRON = (124, 126, 136, 255)
IRON_HI = (176, 178, 186, 255)
IRON_DK = (72, 74, 84, 255)
STONE = (96, 96, 108, 255)
STONE_HI = (128, 128, 142, 255)
STONE_DK = (60, 60, 72, 255)
SHADOW = (14, 12, 16, 150)


def new(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def px(img, x, y, colour):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((int(x), int(y)), colour)


def rect(img, x, y, w, h, colour):
    for yy in range(int(y), int(y + h)):
        for xx in range(int(x), int(x + w)):
            px(img, xx, yy, colour)


def hline(img, x, y, w, colour):
    rect(img, x, y, w, 1, colour)


def vline(img, x, y, h, colour):
    rect(img, x, y, 1, h, colour)


def foundation() -> Image.Image:
    """A laid plank floor: the piece the player stands on."""
    img = new(TILE, TILE)
    rect(img, 0, 0, TILE, TILE, (84, 62, 44, 255))
    for y in range(0, TILE, 4):
        hline(img, 0, y, TILE, WOOD)
        hline(img, 0, y + 1, TILE, (118, 84, 56, 255))
        hline(img, 0, y + 3, TILE, WOOD_DK)
    # Staggered joints, never in the same column twice in a row.
    for row, offsets in enumerate(((3, 11), (7, 13), (1, 9), (5, 12))):
        for x in offsets:
            vline(img, x, row * 4, 4, WOOD_DK)
    # Nail heads at the corners.
    for x, y in ((2, 2), (13, 2), (2, 13), (13, 13)):
        px(img, x, y, IRON)
    # A soft inner edge so a floor reads as a raised deck, not as ground.
    for x in range(TILE):
        px(img, x, 0, (150, 112, 74, 255))
    return img


def wall() -> Image.Image:
    """A wall seen from above: a thick band with a lit top lip and a cast shadow."""
    img = new(TILE, 20)
    rect(img, 0, 0, TILE, 14, WOOD_DK)
    rect(img, 1, 2, TILE - 2, 10, WOOD)
    for x in range(1, TILE - 1, 5):
        vline(img, x, 2, 10, WOOD_DK)
    hline(img, 0, 2, TILE, WOOD_HI)
    hline(img, 0, 0, TILE, (170, 132, 92, 255))
    rect(img, 0, 12, TILE, 2, (58, 40, 28, 255))
    # The shadow the wall throws south, so it reads as standing up.
    for y in range(14, 20):
        alpha = max(0, 150 - (y - 14) * 40)
        for x in range(TILE):
            px(img, x, y, (14, 12, 16, alpha))
    return img


def door() -> Image.Image:
    """A door in a wall: the same band, a plank leaf, a handle, iron bands."""
    img = wall()
    rect(img, 2, 1, 12, 13, (92, 64, 42, 255))
    for x in range(3, 14, 4):
        vline(img, x, 2, 11, WOOD_DK)
    hline(img, 2, 3, 12, IRON_DK)
    hline(img, 2, 10, 12, IRON_DK)
    px(img, 11, 7, IRON_HI)
    px(img, 11, 8, IRON)
    return img


def chest() -> Image.Image:
    """A storage chest: banded lid, iron lock, and a grounded shadow."""
    img = new(TILE, 18)
    rect(img, 1, 4, 14, 11, WOOD)
    rect(img, 1, 4, 14, 4, WOOD_HI)
    hline(img, 1, 4, 14, (170, 132, 92, 255))
    hline(img, 1, 8, 14, WOOD_DK)
    for x in (3, 12):
        vline(img, x, 5, 9, IRON_DK)
        vline(img, x + 1, 5, 9, IRON)
    rect(img, 6, 7, 4, 4, IRON_DK)
    px(img, 7, 8, IRON_HI)
    hline(img, 1, 14, 14, (58, 40, 28, 255))
    for y in range(15, 18):
        alpha = max(0, 140 - (y - 15) * 40)
        for x in range(1, 15):
            px(img, x, y, (14, 12, 16, alpha))
    return img


FRAMES = {
    "foundation_wood": foundation,
    "wall_wood": wall,
    "door_wood": door,
    "chest_wood": chest,
}


def main() -> int:
    images = {name: fn() for name, fn in FRAMES.items()}
    width = max(img.width for img in images.values())
    height = sum(img.height + 2 for img in images.values())
    sheet = new(width, height)
    frames = {}
    y = 0
    for name, img in images.items():
        sheet.alpha_composite(img, (0, y))
        frames[name] = {"x": 0, "y": y, "w": img.width, "h": img.height}
        y += img.height + 2
    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    sheet.save(OUT_PNG)
    with open(OUT_JSON, "w") as handle:
        json.dump({
            "status": "development_placeholder",
            "note": "Generated by tools/survival/build_art.py. Not production art; "
                    "replaced when the licensed modular kit is chosen (STATE.json BUILD-ART).",
            "tile": TILE,
            "frames": frames,
        }, handle, indent=2)
        handle.write("\n")
    print("placeholder build atlas: %d frames, %dx%d" % (len(frames), sheet.width, sheet.height))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
