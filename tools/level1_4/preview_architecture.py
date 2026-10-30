#!/usr/bin/env python3
"""Offline composition preview for an authored Chapter 1 architecture document.

What this is
------------
A *composition instrument*, not a renderer and not evidence. It replays
`game/levels/presentation/crucible_art.gd` layer by layer - bedrock, floor detail,
wall-foot shadow, the wall stack with its extrusion, y-sorted props, the ambient
and the authored lights - so a level can be looked at at gameplay zoom without a
Godot build. That is how the four L1-L4 kits were judged while they were being
drawn: every defect listed in `docs/chapter1-visual-recovery/repair-ledger.md`
section H was found here first.

What it is not
--------------
It does not reproduce the engine's exposure. The ambient is multiplied here
*before* the lights rather than by a `CanvasModulate` over the finished canvas, and
`--lit` adds the light atlas with a plain screen-add. So do **not** read exposure,
saturation or a >245 / <20 clipping verdict off it, and never publish one of its
frames as evidence. Judge placement, silhouette, density, material separation and
legibility at 1x, and confirm everything else in a native frame.

usage
-----
    python3 tools/level1_4/preview_architecture.py <map> <cx> <cy> <w> <h> <out.png> [--lit]

`<map>` is the *map* stem, not the level id: Level 1's map is `crypt_entrance`,
the rest are `chapter_1_level_<n>`. `<w> <h>` are in pixels and are doubled on
output, so `640 360` is a 1280x720 frame.

Needs Pillow and numpy.
"""

from __future__ import annotations

import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
T = 16
WORLD_TOP_ROW = -6          # crucible_art.gd: the camera's own headroom
BEDROCK_MARGIN = 6
WALL_EXTRUDE = 3


def load(path: str):
    with open(os.path.join(ROOT, path), encoding="utf-8") as fh:
        return json.load(fh)


def map_cells(level: dict, layer: str) -> set:
    return {(int(t["x"]), int(t["y"])) for t in level.get("layers", {}).get(layer, [])}


def doc_cells(doc: dict, layer: str) -> set:
    return {(int(t["cell"][0]), int(t["cell"][1])) for t in doc.get("layers", {}).get(layer, [])}


def tint(doc: dict, key: str):
    raw = doc.get(key)
    if isinstance(raw, list) and len(raw) >= 3:
        return (float(raw[0]), float(raw[1]), float(raw[2]))
    return (1.0, 1.0, 1.0)


class Sheet:
    def __init__(self, art: str, index: str):
        self.img = Image.open(os.path.join(ROOT, art)).convert("RGBA")
        self.frames = load(index)["frames"]

    def crop(self, name: str):
        frame = self.frames.get(name)
        if frame is None:
            return None
        return self.img.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))


def apply_tint(sprite: Image.Image, colour) -> Image.Image:
    r, g, b, a = sprite.split()
    r = r.point(lambda v: min(255, int(v * colour[0])))
    g = g.point(lambda v: min(255, int(v * colour[1])))
    b = b.point(lambda v: min(255, int(v * colour[2])))
    return Image.merge("RGBA", (r, g, b, a))


def default_floor(cell) -> str:
    """The renderer's own fallback flagstone (`_default_floor`)."""
    x, y = cell
    quad = (1 if x % 2 else 0) + (2 if y % 2 else 0)
    roll = (x * 31 + y * 17) % 23
    if roll == 0:
        return "floor_worn"
    if roll == 9:
        return "floor_broken"
    return ["floor_a", "floor_b", "floor_c", "floor_d"][quad]


def main(argv: list) -> int:
    args = [a for a in argv if not a.startswith("--")]
    if len(args) < 5:
        print(__doc__)
        return 2
    lit = "--lit" in argv
    map_name, cx, cy, vw, vh, out = args[0], int(args[1]), int(args[2]), int(args[3]), int(args[4]), args[5]
    base = "data/levels/%s" % map_name
    doc = load(base + "_architecture.json")
    level = load(base + ".json")
    kit = doc.get("kit", "crucible")
    art = "assets/environment/chapter1/%s/" % kit
    tiles = Sheet(art + kit + "_tiles.png", art + kit + "_tiles.json")
    props = Sheet(art + kit + "_props.png", art + kit + "_props.json")

    floors = map_cells(level, "Backdrop")
    geom = map_cells(level, "Geometry")

    top = WORLD_TOP_ROW * T
    width, height = int(level["width"]), int(level["height"])
    img = Image.new("RGBA", (width * T, height * T - top),
                    tuple(int(c * 255) for c in doc.get("background", [0.04, 0.03, 0.03])[:3]) + (255,))

    def paste(sprite, cell):
        if sprite is not None:
            img.alpha_composite(sprite, (cell[0] * T, cell[1] * T - top))

    # --- bedrock: the map's own rectangle, minus floor and geometry ---------
    bedrock_tint = tint(doc, "bedrock_tint")
    bedrock_a = apply_tint(tiles.crop("bedrock_a"), bedrock_tint)
    bedrock_b = apply_tint(tiles.crop("bedrock_b"), bedrock_tint)
    content = floors | geom
    min_x = min([c[0] for c in content] + [0])
    max_x = max([c[0] for c in content] + [width - 1])
    max_y = max([c[1] for c in content] + [height - 1])
    fill_top = min(min([c[1] for c in content] + [WORLD_TOP_ROW]) - BEDROCK_MARGIN, WORLD_TOP_ROW)
    for y in range(fill_top, max_y + BEDROCK_MARGIN + 1):
        for x in range(min_x - BEDROCK_MARGIN, max_x + BEDROCK_MARGIN + 1):
            if (x, y) in content:
                continue
            paste(bedrock_b if (x * 7 + y * 13) % 3 else bedrock_a, (x, y))

    # --- floor detail, then the document's overrides ------------------------
    for cell in sorted(floors, key=lambda c: (c[1], c[0])):
        if cell not in geom:
            paste(tiles.crop(default_floor(cell)), cell)
    for entry in doc.get("layers", {}).get("floor", []):
        cell = (int(entry["cell"][0]), int(entry["cell"][1]))
        if cell in floors and cell not in geom:
            paste(tiles.crop(entry["frame"]), cell)

    # --- wall-foot shadows --------------------------------------------------
    for cell in geom:
        below = (cell[0], cell[1] + 1)
        if below in floors and below not in geom:
            paste(tiles.crop("shadow_edge"), below)

    # --- the wall stack -----------------------------------------------------
    overlays = {(int(e["cell"][0]), int(e["cell"][1])): e["frame"]
                for e in doc.get("layers", {}).get("wall", [])}
    faces = sorted([c for c in geom if (c[0], c[1] + 1) in floors], key=lambda c: (c[1], c[0]))
    face_set = set(faces)
    pier_every = int(doc.get("wall_pier_every", 0))
    wall_cells = {}
    for fx, fy in faces:
        top_row = fy
        while (fx, top_row - 1) in geom:
            top_row -= 1
        for row in range(top_row, fy + 1):
            cell = (fx, row)
            name = overlays.get(cell, "")
            if not name:
                depth = fy - row
                if depth == 0:
                    name = "wall_plinth"
                elif depth == 1:
                    name = "wall_dado_a" if fx % 6 == 0 else "wall_field_a"
                else:
                    name = "wall_field_b"
                if depth >= 1:
                    run_end = (fx - 1, row) not in face_set or (fx + 1, row) not in face_set
                    if run_end or (pier_every > 0 and fx % pier_every == 0):
                        name = "wall_pier"
            wall_cells[cell] = name
        headroom = top_row - WORLD_TOP_ROW
        extrude = max(0, min(headroom - 2, WALL_EXTRUDE))
        highest = top_row - 1
        for step in range(1, extrude + 1):
            cell = (fx, top_row - step)
            if cell in floors or cell in geom:
                break
            # the storey above a face is the kit's *plain* coursing
            wall_cells[cell] = "wall_pier" if fx % 4 == 0 else "wall_field_b"
            highest = cell[1]
        cornice = (fx, highest - 1)
        if cornice[1] >= WORLD_TOP_ROW and cornice not in floors and cornice not in geom:
            wall_cells[cornice] = "wall_cornice"
            cap = (fx, highest - 2)
            if cap[1] >= WORLD_TOP_ROW and cap not in floors and cap not in geom:
                wall_cells[cap] = "wall_cap"
    for cell in geom:
        if cell not in wall_cells:
            wall_cells[cell] = "wall_field_b" if (cell[0] + cell[1]) % 2 else "wall_field_a"
    wall_tint = tint(doc, "wall_tint")
    for cell in sorted(wall_cells, key=lambda c: (c[1], c[0])):
        paste(apply_tint(tiles.crop(wall_cells[cell]), wall_tint), cell)

    # --- props, base-anchored and y-sorted ---------------------------------
    items = []
    for entry in doc.get("props", []):
        cell = (int(entry["cell"][0]), int(entry["cell"][1]))
        frame = props.frames.get(entry.get("frame", ""))
        if frame is None:
            continue
        anchor_y = (cell[1] + 1) * T if entry.get("y_sort", True) else cell[1] * T + T // 2
        items.append((anchor_y, cell[0] * T + T // 2, frame, entry))
    items.sort(key=lambda i: (i[0], i[1]))
    for anchor_y, ax, frame, entry in items:
        sprite = props.img.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))
        if entry.get("flip"):
            sprite = sprite.transpose(Image.FLIP_LEFT_RIGHT)
        # the canvas carries the world's top offset, exactly as the tiles do
        img.alpha_composite(sprite, (ax - frame["w"] // 2, anchor_y - frame["h"] - top))

    # --- ambient, then the authored lights ---------------------------------
    amb = doc.get("ambient", [1, 1, 1])
    arr = np.asarray(img.convert("RGB"), dtype=np.float32) * np.array(amb[:3], dtype=np.float32)
    if lit:
        light_path = os.path.join(ROOT, art + "light_radial.png")
        if os.path.exists(light_path):
            light = Image.open(light_path).convert("RGBA")
            add = np.zeros_like(arr)
            for entry in doc.get("lights", []):
                colour = entry.get("color", [1, 0.7, 0.4])
                energy = float(entry.get("energy", 1.0))
                size = max(8, int(256 * float(entry.get("scale", 3.0))))
                alpha = np.asarray(light.resize((size, size), Image.BILINEAR).split()[3],
                                   dtype=np.float32) / 255.0 * min(1.0, energy)
                rgb = np.array([[c * 255.0 * min(1.0, energy) for c in colour[:3]]], dtype=np.float32)
                x0 = int(entry["x"]) - size // 2
                y0 = int(entry["y"]) - top - size // 2
                ax0, ay0 = max(0, x0), max(0, y0)
                ax1, ay1 = min(img.width, x0 + size), min(img.height, y0 + size)
                if ax1 > ax0 and ay1 > ay0:
                    add[ay0:ay1, ax0:ax1] += rgb[0] * alpha[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0][:, :, None]
            arr = arr + add
    view = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).crop(
        (cx * T - vw // 2, cy * T - top - vh // 2, cx * T + vw // 2, cy * T - top + vh // 2))
    view.resize((vw * 2, vh * 2), Image.NEAREST).save(out)
    print("wrote %s (%dx%d)" % (out, vw * 2, vh * 2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
