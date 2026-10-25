#!/usr/bin/env python3
"""PIL preview of the authored Blood Crucible architecture.

This is NOT gameplay evidence and is never published as such: it is a fast
composition check that runs in a second, so the authored plan can be judged at
the real gameplay scale before a native Godot run is spent on it. The Godot
runtime draws the same document (see chapter1_crucible_art.gd); this tool only
reproduces the same geometry with Pillow so composition can be iterated.

Usage:
    python3 tools/level5/preview_architecture.py            # write previews
"""

from __future__ import annotations

import json
import math
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
ART = os.path.join(ROOT, "assets", "environment", "chapter1", "crucible")
LEVEL = os.path.join(ROOT, "data", "levels", "chapter_1_level_5.json")
ARCH = os.path.join(ROOT, "data", "levels", "chapter_1_level_5_architecture.json")
OUT = os.path.join(ROOT, "docs", "chapter1-visual-overhaul", "architecture-breakthrough", "preview")
T = 16

# Camera: the shipped game runs a 1280x720 viewport at 1:1 zoom, clamped to the
# level's camera bounds. Stations below are the ones the capture harness uses.
VIEW_W, VIEW_H = 1280, 720


def load():
    with open(LEVEL, encoding="utf-8") as fh:
        level = json.load(fh)
    with open(ARCH, encoding="utf-8") as fh:
        arch = json.load(fh)
    frames = {}
    for name in ("crucible_tiles", "crucible_props"):
        with open(os.path.join(ART, name + ".json"), encoding="utf-8") as fh:
            frames[name] = json.load(fh)["frames"]
    tiles = Image.open(os.path.join(ART, "crucible_tiles.png")).convert("RGBA")
    props = Image.open(os.path.join(ART, "crucible_props.png")).convert("RGBA")
    return level, arch, frames, tiles, props


def sprite(sheet: Image.Image, frame: dict) -> Image.Image:
    return sheet.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))


def tint(img: Image.Image, rgb) -> Image.Image:
    r, g, b = [int(v * 255) for v in rgb[:3]]
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            pr, pg, pb, pa = px[x, y]
            px[x, y] = (pr * r // 255, pg * g // 255, pb * b // 255, pa)
    return out


def draw_floor(world: Image.Image, level: dict, arch: dict, frames, tiles, palette) -> None:
    overlays = {(c["cell"][0], c["cell"][1]): c["frame"] for c in arch["layers"]["floor"]}
    for tile in level["layers"]["Backdrop"]:
        cell = (int(tile["x"]), int(tile["y"]))
        frame = overlays.get(cell)
        if frame and frame in frames["crucible_tiles"]:
            sprite_img = sprite(tiles, frames["crucible_tiles"][frame])
        else:
            sprite_img = None
        if sprite_img is None:
            # base floor: use the crucible kit's plain flags, chosen deterministically
            name = "floor_a" if (cell[0] * 7 + cell[1] * 13) % 5 else "floor_b"
            sprite_img = sprite(tiles, frames["crucible_tiles"][name])
        tinted = tint(sprite_img, palette["floor"])
        world.alpha_composite(tinted, (cell[0] * T, cell[1] * T))


def draw_walls(world: Image.Image, level: dict, arch: dict, frames, tiles, palette) -> None:
    geom = {(int(t["x"]), int(t["y"])) for t in level["layers"]["Geometry"]}
    floor = {(int(t["x"]), int(t["y"])) for t in level["layers"]["Backdrop"]}
    wall_overlays = {(c["cell"][0], c["cell"][1]): c["frame"] for c in arch["layers"]["wall"]}
    # The wall stack, drawn per visible face: plinth at the bottom of the band,
    # field above it, cornice above that, cap on top. This is what gives a wall
    # its stratification in the game.
    for (x, y) in sorted(geom, key=lambda c: (c[1], c[0])):
        if (x, y + 1) not in floor:
            # interior of the wall mass: plain cap so the top of the wall reads solid
            img = sprite(tiles, frames["crucible_tiles"]["wall_cap"])
            world.alpha_composite(tint(img, palette["wall_top"]), (x * T, y * T))
            continue
        top = y
        while (x, top - 1) in geom:
            top -= 1
        band = y - top + 1
        overlay = wall_overlays.get((x, y))
        for row in range(top, y + 1):
            depth = y - row
            if overlay:
                img = sprite(tiles, frames["crucible_tiles"][overlay])
            elif depth == 0:
                name = "wall_plinth"
            elif depth == 1:
                name = "wall_dado_a" if (x % 5) == 0 else ("wall_pier" if (x % 9) == 0 else "wall_field_a")
            elif binary := (depth == 2):
                name = "wall_field_b"
            else:
                name = "wall_field_a"
            img = sprite(tiles, frames["crucible_tiles"][name])
            world.alpha_composite(tint(img, palette["wall_face"]),
                                  (x * T, row * T))
        # cornice + cap on the topmost row of the band
        img = sprite(tiles, frames["crucible_tiles"]["wall_cornice"])
        world.alpha_composite(tint(img, palette["wall_face"]), (x * T, (top - 1) * T))
        img = sprite(tiles, frames["crucible_tiles"]["wall_cap"])
        world.alpha_composite(tint(img, palette["wall_top"]), (x * T, (top - 2) * T))


def draw_props(world: Image.Image, arch: dict, frames, props: Image.Image) -> None:
    lights = []
    for entry in arch["props"]:
        frame = frames["crucible_props"].get(entry["frame"])
        if frame is None:
            continue
        img = sprite(props, frame)
        cx, cy = entry["cell"]
        anchor = entry.get("anchor", "base")
        if entry["y_sort"]:
            # base-anchored: the sprite's feet sit on the base of the cell
            px = cx * T + T // 2 - img.width // 2
            py = cy * T + T - img.height
        else:
            # centred on the cell (basins, the apparatus)
            px = cx * T + T // 2 - img.width // 2
            py = cy * T + T // 2 - img.height // 2
        world.alpha_composite(img, (px, py))
        if "light" in entry:
            lights.append(entry["light"])
    return lights


def apply_lighting(world: Image.Image, lights: list, ambient: float) -> Image.Image:
    """Multiply the world by a dark ambient mask, then add each light's falloff.

    Deliberately simple and deterministic: the goal of the preview is to judge
    whether the composition has bright and dark zones, not to reproduce Godot's
    exact light model (the native frames do that).
    """
    w, h = world.size
    mask = Image.new("L", (w, h), int(255 * ambient))
    add = Image.new("RGB", (w, h), (0, 0, 0))
    mpx = mask.load()
    apx = add.load()
    for light in lights:
        lx, ly = float(light["x"]), float(light["y"])
        radius = float(light.get("scale", 3.0)) * 60.0
        energy = float(light.get("energy", 1.0))
        colour = light.get("color", [1.0, 0.7, 0.4])
        r0 = max(24, int(radius * 1.7))
        for y in range(max(0, int(ly - r0)), min(h, int(ly + r0))):
            dy = (y - ly) / r0
            for x in range(max(0, int(lx - r0)), min(w, int(lx + r0))):
                dx = (x - lx) / r0
                d = math.hypot(dx, dy)
                if d >= 1.0:
                    continue
                falloff = (1.0 - d) ** 3.0 * energy
                mpx[x, y] = min(255, mpx[x, y] + int(255 * falloff * 0.95))
                ar, ag, ab = apx[x, y]
                apx[x, y] = (
                    min(255, int(ar + 255 * colour[0] * falloff * 0.30)),
                    min(255, int(ag + 255 * colour[1] * falloff * 0.30)),
                    min(255, int(ab + 255 * colour[2] * falloff * 0.30)),
                )
    darkened = Image.composite(world, Image.new("RGBA", world.size, (0, 0, 0, 255)), mask)
    lit = Image.blend(darkened, add.convert("RGBA"), 0.32)
    return lit


PALETTE = {
    "floor": [0.95, 0.86, 0.84],
    "wall_face": [1.0, 0.92, 0.88],
    "wall_top": [0.80, 0.72, 0.72],
}


def station_world(level, arch, frames, tiles, props_sheet, x0: int, y0: int,
                  w_cells: int, h_cells: int, *, ambient: float = 0.42) -> Image.Image:
    world = Image.new("RGBA", (w_cells * T, h_cells * T), (14, 11, 13, 255))
    sub = {
        "layers": {
            "Backdrop": [t for t in level["layers"]["Backdrop"]
                         if x0 - 2 <= t["x"] < x0 + w_cells + 2 and y0 - 2 <= t["y"] < y0 + h_cells + 2],
            "Geometry": [t for t in level["layers"]["Geometry"]
                         if x0 - 2 <= t["x"] < x0 + w_cells + 2 and y0 - 2 <= t["y"] < y0 + h_cells + 2],
        }
    }
    draw_floor(world, sub, arch, frames, tiles, PALETTE)
    draw_walls(world, sub, arch, frames, tiles, PALETTE)
    lights = draw_props(world, arch, frames, props_sheet)
    # shift everything into the window
    window = world.crop((x0 * T, y0 * T, (x0 + w_cells) * T, (y0 + h_cells) * T))
    shifted = []
    for light in lights:
        lx, ly = light["x"] - x0 * T, light["y"] - y0 * T
        if -80 <= lx <= VIEW_W + 80 and -80 <= ly <= VIEW_H + 80:
            shifted.append(dict(light, x=lx, y=ly))
    return apply_lighting(window, shifted, ambient)


STATIONS = [
    ("f1_spawn", "F1 — spawn, first frame", 4, 8, 80, 45),
    ("f1_gate", "F1 — the processional gate and the altar", 15, 4, 80, 45),
    ("f2_court", "F2 — the blood court", 55, 32, 80, 45),
    ("f3_arena", "F3 — the boss arena", 72, 62, 80, 45),
]


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    level, arch, frames, tiles, props_sheet = load()
    for (name, label, x0, y0, w, h) in STATIONS:
        frame = station_world(level, arch, frames, tiles, props_sheet, x0, y0, w, h)
        frame = frame.convert("RGB")
        d = ImageDraw.Draw(frame)
        d.rectangle([0, 0, frame.width - 1, 16], fill=(0, 0, 0))
        d.text((4, 3), "PIL COMPOSITION PREVIEW (not gameplay evidence) - " + label,
               fill=(255, 230, 160))
        frame.save(os.path.join(OUT, name + ".png"))
        print("wrote", os.path.join(OUT, name + ".png"))


if __name__ == "__main__":
    main()
