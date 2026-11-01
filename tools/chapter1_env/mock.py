#!/usr/bin/env python3
"""Authoring preview: compose a room the way `crucible_art.gd` will.

This is a *design* tool, not evidence. It mirrors the renderer's order — bedrock,
floor detail, wall-foot shadows, five-course wall stacks, y-sorted props, additive
lights — so an author can look at a chamber before a 12-minute CI round trip. It is
never published under docs/, and no screenshot in the evidence tree comes from it.

    python3 tools/chapter1_env/mock.py <level> <x0> <y0> <x1> <y1> <out.png> [scale]
"""

from __future__ import annotations

import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from kitlib import ROOT, T, cells, load_level  # noqa: E402

WALL_EXTRUDE = 3


def _load_json(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _blit(dst: Image.Image, src: Image.Image, x: int, y: int) -> None:
    dst.alpha_composite(src, (x, y), (0, 0))


def render(level_number: int, x0: int, y0: int, x1: int, y1: int, scale: int = 3) -> Image.Image:
    level = load_level(level_number)
    doc_path = os.path.join(ROOT, "data", "levels",
                            "chapter_1_level_%d_architecture.json" % level_number)
    document = _load_json(doc_path)
    kit = document.get("kit", "crucible")
    art = os.path.join(ROOT, "assets", "environment", "chapter1", kit)
    tiles_img = Image.open(os.path.join(art, kit + "_tiles.png")).convert("RGBA")
    props_img = Image.open(os.path.join(art, kit + "_props.png")).convert("RGBA")
    with open(os.path.join(art, kit + "_tiles.json"), encoding="utf-8") as fh:
        tile_frames = json.load(fh)["frames"]
    with open(os.path.join(art, kit + "_props.json"), encoding="utf-8") as fh:
        prop_frames = json.load(fh)["frames"]
    light_img = Image.open(os.path.join(art, "light_radial.png")).convert("RGBA")

    floor = cells(level, "Backdrop")
    geom = cells(level, "Geometry")
    w = (x1 - x0 + 1) * T
    h = (y1 - y0 + 1) * T
    ambient = document.get("ambient", [0.34, 0.30, 0.28])
    background = document.get("background", [0.04, 0.03, 0.04])
    canvas = Image.new("RGBA", (w, h), tuple(
        int(255 * (background[i] * 0.8 + ambient[i] * 0.2)) for i in range(3)) + (255,))

    def cell_px(cx: int, cy: int) -> int:
        return (cx - x0) * T, (cy - y0) * T

    def frame_region(name: str):
        f = tile_frames.get(name)
        if not f:
            return None
        return (f["x"], f["y"], f["x"] + T, f["y"] + T)

    def put_tile(name: str, cx: int, cy: int) -> None:
        region = frame_region(name)
        if region is None:
            return
        px_, py_ = cell_px(cx, cy)
        pixel = tiles_img.crop(region)
        _blit(canvas, pixel, px_, py_)

    overrides = {}
    for entry in document.get("layers", {}).get("floor", []):
        overrides[tuple(entry["cell"])] = entry["frame"]
    wall_over = {}
    for entry in document.get("layers", {}).get("wall", []):
        wall_over[tuple(entry["cell"])] = entry["frame"]

    # bedrock: everything that is neither floor nor wall, within the crop
    for cy in range(y0 - 3, y1 + 4):
        for cx in range(x0 - 3, x1 + 4):
            if (cx, cy) in floor or (cx, cy) in geom:
                continue
            put_tile("bedrock_a" if (cx * 7 + cy * 13) % 3 else "bedrock_b", cx, cy)

    # floor
    for cy in range(y0, y1 + 1):
        for cx in range(x0, x1 + 1):
            cell = (cx, cy)
            if cell not in floor or cell in geom:
                continue
            if cell in overrides:
                put_tile(overrides[cell], cx, cy)
                continue
            quad = (1 if cx % 2 else 0) + (2 if cy % 2 else 0)
            roll = (cx * 31 + cy * 17) % 23
            if roll == 0:
                put_tile("floor_worn", cx, cy)
            elif roll == 9:
                put_tile("floor_broken", cx, cy)
            else:
                put_tile(["floor_a", "floor_b", "floor_c", "floor_d"][quad], cx, cy)

    # shadows at the foot of wall faces
    for (cx, cy) in geom:
        below = (cx, cy + 1)
        if below in floor and below not in geom and y0 <= below[1] <= y1 and x0 <= cx <= x1:
            put_tile("shadow_edge", cx, below[1])

    # wall stacks
    faces = [c for c in geom if (c[0], c[1] + 1) in floor]
    for (fx, fy) in faces:
        top = fy
        while (fx, top - 1) in geom:
            top -= 1
        for row in range(top, fy + 1):
            name = wall_over.get((fx, row), "")
            if not name:
                depth = fy - row
                name = ("wall_plinth" if depth == 0 else
                        ("wall_dado_a" if depth == 1 and fx % 6 == 0 else
                         ("wall_field_a" if depth == 1 else "wall_field_b")))
            put_tile(name, fx, row)
        highest = top - 1
        for step in range(1, WALL_EXTRUDE + 1):
            cell = (fx, top - step)
            if cell in floor or cell in geom:
                break
            put_tile("wall_pier" if fx % 4 == 0 else "wall_field_a", cell[0], cell[1])
            highest = cell[1]
        for name, cell in (("wall_cornice", (fx, highest - 1)), ("wall_cap", (fx, highest - 2))):
            if cell not in floor and cell not in geom:
                put_tile(name, cell[0], cell[1])

    # props, y-sorted exactly like the Entities root
    placed = []
    for entry in document.get("props", []):
        f = prop_frames.get(entry["frame"])
        if not f:
            continue
        cx, cy = entry["cell"]
        feet = cy * T + T
        placed.append((feet, cx, cy, f, entry))
    placed.sort(key=lambda item: (item[0], item[1]))
    for feet, cx, cy, f, entry in placed:
        sprite = props_img.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
        if entry.get("flip"):
            sprite = sprite.transpose(Image.FLIP_LEFT_RIGHT)
        px_ = (cx - x0) * T + T // 2 - sprite.width // 2
        py_ = (cy - y0) * T + T - sprite.height
        if entry.get("y_sort", True) is False:
            py_ = (cy - y0) * T + T // 2 - sprite.height // 2
        _blit(canvas, sprite, px_, py_)

    # lights, additively
    light_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for light in document.get("lights", []):
        lx = light.get("x", 0) - x0 * T
        ly = light.get("y", 0) - y0 * T
        scale_factor = float(light.get("scale", 3.0))
        size = int(light_img.width * scale_factor / 32.0 * T / 4)
        size = max(24, min(1024, int(light_img.width * scale_factor * 0.25)))
        tex = light_img.resize((size, size), Image.BILINEAR)
        tint = Image.new("RGBA", (size, size), tuple(
            int(255 * min(1.0, c)) for c in light.get("color", [1, 0.7, 0.4])) + (0,))
        alpha = tex.split()[3].point(lambda a, e=light.get("energy", 1.0): int(min(255, a * e)))
        tint.putalpha(alpha)
        light_layer.alpha_composite(tint, (int(lx - size / 2), int(ly - size / 2)))
    # screen-ish add
    base = canvas.load()
    add = light_layer.load()
    for y in range(h):
        for x in range(w):
            a = add[x, y][3]
            if not a:
                continue
            weight = a / 255.0 * 0.85
            b = base[x, y]
            base[x, y] = (min(255, int(b[0] + add[x, y][0] * weight)),
                          min(255, int(b[1] + add[x, y][1] * weight)),
                          min(255, int(b[2] + add[x, y][2] * weight)), 255)
    # the engine multiplies the whole world by its CanvasModulate; do the same
    data = canvas.load()
    gain = [min(1.0, c * 1.55) for c in ambient]
    lift = [int(255 * c * 0.10) for c in background]
    for y in range(h):
        for x in range(w):
            r, g, b, a = data[x, y]
            data[x, y] = (min(255, int(r * gain[0]) + lift[0]),
                          min(255, int(g * gain[1]) + lift[1]),
                          min(255, int(b * gain[2]) + lift[2]), a)
    if scale != 1:
        canvas = canvas.resize((w * scale, h * scale), Image.NEAREST)
    return canvas.convert("RGB")


def main() -> None:
    if len(sys.argv) < 7:
        print(__doc__)
        raise SystemExit(2)
    level = int(sys.argv[1])
    x0, y0, x1, y1 = (int(v) for v in sys.argv[2:6])
    out = sys.argv[6]
    scale = int(sys.argv[7]) if len(sys.argv) > 7 else 3
    image = render(level, x0, y0, x1, y1, scale)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    image.save(out)
    print("%s %dx%d" % (out, image.width, image.height))


if __name__ == "__main__":
    main()
