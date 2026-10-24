#!/usr/bin/env python3
"""Offline plan renderer for DungeonLevel JSON maps.

Composes Backdrop / Geometry / Decor exactly the way `game/levels/dungeon_level.gd`
does (same source textures, same 16 px atlas grids, same layer modulations, same
z-order) so a designer can iterate on architecture without a Godot install.

This is a *plan renderer*, not evidence: it never draws entities, lighting, HUD,
sprites or shaders, and must never be labelled a native capture.

Usage:
    python3 tools/level5/render_level_plan.py DATA_JSON OUT_PNG [--crop x,y,w,h]
        [--scale N] [--grid]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
TEXTURES = {
    0: ROOT / "assets/environment/dungeon_0x72/dungeon_tileset_ii.png",
    1: ROOT / "assets/environment/dungeon_0x72/atlas_walls_low.png",
}
GRIDS = {0: (32, 32), 1: (12, 4)}
# crypt_entrance.tscn / dungeon_level.gd defaults.
TINTS = {
    "Backdrop": (0.68, 0.73, 0.82),
    "Geometry": (0.74, 0.78, 0.86),
    "Decor": (0.84, 0.80, 0.78),
}
# z-order in the scene: Backdrop -10, Geometry 0, Decor 2.
ORDER = ("Backdrop", "Geometry", "Decor")
TILE = 16


def _tinted(texture: Image.Image, tint) -> Image.Image:
    out = texture.copy()
    r, g, b = (int(round(c * 255)) for c in tint)
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            pr, pg, pb, pa = px[x, y]
            px[x, y] = (pr * r // 255, pg * g // 255, pb * b // 255, pa)
    return out


def render(document: dict, tint_override: dict | None = None) -> Image.Image:
    w = int(document["width"]) * TILE
    h = int(document["height"]) * TILE
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    textures = {sid: Image.open(path).convert("RGBA") for sid, path in TEXTURES.items()}
    tints = dict(TINTS)
    if tint_override:
        tints.update(tint_override)
    palette = {name: _tinted(textures[0], tints[name]) for name in ORDER}
    for name in ORDER:
        cells = document["layers"].get(name, [])
        for cell in cells:
            source = int(cell.get("source", 0))
            ax, ay = (int(v) for v in cell.get("atlas", [0, 0]))
            gx, gy = GRIDS.get(source, (32, 32))
            if not (0 <= ax < gx and 0 <= ay < gy):
                continue
            if source == 0:
                sheet = palette[name]
            else:
                sheet = _tinted(textures[source], tints[name])
            tile = sheet.crop((ax * TILE, ay * TILE, (ax + 1) * TILE, (ay + 1) * TILE))
            canvas.alpha_composite(tile, (int(cell["x"]) * TILE, int(cell["y"]) * TILE))
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("data")
    parser.add_argument("out")
    parser.add_argument("--crop", default="")
    parser.add_argument("--scale", type=int, default=1)
    parser.add_argument("--grid", action="store_true")
    args = parser.parse_args()

    document = json.loads(Path(args.data).read_text(encoding="utf-8"))
    image = render(document)
    if args.crop:
        x, y, cw, ch = (int(v) for v in args.crop.split(","))
        image = image.crop((x, y, x + cw, y + ch))
    if args.scale > 1:
        image = image.resize((image.width * args.scale, image.height * args.scale), Image.NEAREST)
    if args.grid:
        draw = ImageDraw.Draw(image)
        step = TILE * args.scale
        for gx in range(0, image.width, step * 8):
            draw.line([(gx, 0), (gx, image.height)], fill=(255, 0, 0, 90))
        for gy in range(0, image.height, step * 8):
            draw.line([(0, gy), (image.width, gy)], fill=(255, 0, 0, 90))
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
