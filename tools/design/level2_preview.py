#!/usr/bin/env python3
"""Offline preview renderer for Level 2 (real atlas art, no Godot required).

This is a *design review* tool, not a gameplay capture: it composites the same
tileset and entity markers the runtime will use so floor materials, wall masses,
decor and light rhythm can be judged before a CI capture round. Final visual
proof always comes from the real Godot 4.7 captures.

Usage:
    python3 tools/design/level2_preview.py                 # full atlas + bands
    python3 tools/design/level2_preview.py --camera 94 71  # 1280x720 crop
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
LEVEL = ROOT / "data" / "levels" / "chapter_1_level_2.json"
TILESETS = {
    0: ROOT / "assets/environment/dungeon_0x72/dungeon_tileset_ii.png",
    1: ROOT / "assets/environment/dungeon_0x72/atlas_walls_low.png",
}
TINT = {
    "Backdrop": (0.68, 0.73, 0.82),
    "Geometry": (0.74, 0.78, 0.86),
    "Decor": (0.84, 0.80, 0.78),
}
DECOR_TILE = 16
COLOR_BY_TYPE = {
    "player": (110, 235, 255),
    "skeleton": (240, 96, 96),
    "sigil": (255, 214, 92),
    "checkpoint": (120, 255, 150),
    "exit_gate": (150, 210, 255),
    "floor_door": (140, 160, 255),
    "chest": (255, 190, 90),
    "spikes": (255, 80, 140),
    "torch": (255, 150, 60),
    "coin": (255, 230, 120),
}


def tinted(tile: Image.Image, tint) -> Image.Image:
    r, g, b, a = tile.split()
    from PIL import ImageEnhance  # local import keeps cold start small
    rgb = Image.merge("RGB", (r, g, b))
    rgb = ImageEnhance.Brightness(rgb).enhance(1.0)
    bands = rgb.split()
    bands = [band.point(lambda v, f=f: int(v * f)) for band, f in zip(bands, tint)]
    return Image.merge("RGBA", (*bands, a))


def render(document: dict, scale: int = 2) -> Image.Image:
    width = document["width"] * DECOR_TILE
    height = document["height"] * DECOR_TILE
    canvas = Image.new("RGBA", (width, height), (11, 8, 18, 255))
    sheets = {key: Image.open(path).convert("RGBA") for key, path in TILESETS.items()}
    cache: dict[tuple, Image.Image] = {}
    for layer_name in ("Backdrop", "Geometry", "Decor"):
        for cell in document["layers"][layer_name]:
            key = (layer_name, cell["source"], cell["atlas"][0], cell["atlas"][1])
            if key not in cache:
                sheet = sheets[cell["source"]]
                ax, ay = cell["atlas"]
                tile = sheet.crop((ax * 16, ay * 16, ax * 16 + 16, ay * 16 + 16))
                cache[key] = tinted(tile, TINT[layer_name])
            canvas.alpha_composite(cache[key], (cell["x"] * 16, cell["y"] * 16))
    image = canvas.resize((width * scale, height * scale), Image.NEAREST)
    return image


def annotate(image: Image.Image, document: dict, scale: int) -> Image.Image:
    draw = ImageDraw.Draw(image, "RGBA")
    for room in document["metadata"]["rooms"]:
        x, y, w, h = room["rect"]
        draw.rectangle([x * 16 * scale, y * 16 * scale,
                        (x + w) * 16 * scale, (y + h) * 16 * scale],
                       outline=(90, 200, 255, 160), width=2)
        draw.text((x * 16 * scale + 6, y * 16 * scale + 4),
                  f"{room['id']}  F{room['floor']}", fill=(150, 225, 255, 255))
    for camp in document["metadata"]["combat_camps"]:
        x, y, w, h = camp["rect"]
        draw.rectangle([x * 16 * scale, y * 16 * scale,
                        (x + w) * 16 * scale, (y + h) * 16 * scale],
                       outline=(255, 120, 90, 180), width=3)
    for entity in document["entities"]:
        px, py = entity["position"]
        cx, cy = px * scale, py * scale
        color = COLOR_BY_TYPE.get(entity["type"], (255, 255, 255))
        radius = 5 * scale
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
                     outline=color, width=2)
        if entity["type"] in ("sigil", "exit_gate", "chest", "player", "checkpoint",
                              "floor_door"):
            draw.text((cx + 7 * scale, cy - 6 * scale), entity["id"].replace("l2_", ""),
                      fill=color)
    return image


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--camera", nargs=2, type=int, metavar=("CX", "CY"),
                        help="centre cell for a 1280x720 crop")
    parser.add_argument("--scale", type=int, default=2)
    parser.add_argument("--out", default=".artifacts/level2_preview.png")
    args = parser.parse_args()
    document = json.loads(LEVEL.read_text(encoding="utf-8"))
    (ROOT / ".artifacts").mkdir(exist_ok=True)
    image = render(document, 1)
    if args.camera:
        cx, cy = args.camera
        left = int(cx * 16 - 640)
        top = int(cy * 16 - 360)
        left = max(0, min(left, image.width - 1280))
        top = max(0, min(top, image.height - 720))
        image = image.crop((left, top, left + 1280, top + 720))
        image = image.resize((1280 * args.scale // 2, 720 * args.scale // 2), Image.NEAREST)
        target = ROOT / args.out
        image.save(target)
        print(f"wrote {target.relative_to(ROOT)}")
        return 0
    image = image.resize((image.width * args.scale, image.height * args.scale), Image.NEAREST)
    image = annotate(image, document, args.scale)
    target = ROOT / args.out
    image.save(target)
    print(f"wrote {target.relative_to(ROOT)} ({image.width}x{image.height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
