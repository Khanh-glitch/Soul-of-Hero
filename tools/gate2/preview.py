#!/usr/bin/env python3
"""Gate 2 — offline composition preview (AUTHORING AID, NOT EVIDENCE).

This renders the two Gate 2 documents in Python so composition can be iterated
without spending a CI run. It is deliberately dumb: it composites the same tiles
and sprites, in the same z order, that `gate2_redesign.gd` builds at runtime, at
16 px per cell. Anything judged here must still be confirmed on native Godot
frames from the gate2-runtime workflow.

    python3 tools/gate2/preview.py spawn entry garth east
    python3 tools/gate2/preview.py --all

Output: /tmp/gate2_preview/<station>.png (1280x720, the campaign's viewport).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ART = json.loads((ROOT / "prototypes/gate2/visual_placement.json").read_text())
LEVEL = json.loads((ROOT / "prototypes/gate2/level_data/chapter_1_level_3_gate2.json").read_text())
TILE = 16
VIEW = (80, 45)          # 1280x720 at 16 px
OUT = Path("/tmp/gate2_preview")

STATIONS = {
    # name: (camera centre cell, what the station is for)
    "spawn": (17, 13),
    "entry": (26, 12),
    "garth": (47, 15),
    "east": (64, 20),
    "return": (30, 12),
}


def frame_source(atlas: Image.Image, cell, index):
    x, y, ax, ay, _name = cell
    return atlas.crop((ax * TILE, ay * TILE, ax * TILE + TILE, ay * TILE + TILE))




def layer(canvas, atlas, tiles, ox, oy, modulate=None):
    cache = {}
    for cell in tiles:
        cx, cy = cell[0] - ox, cell[1] - oy
        if not (0 <= cx < VIEW[0] and 0 <= cy < VIEW[1]):
            continue
        key = (cell[2], cell[3])
        if key not in cache:
            tile = frame_source(atlas, cell, None)
            if modulate is not None:
                tile = tile.copy()
                r, g, b, a = modulate
                px = tile.load()
                for y in range(TILE):
                    for x in range(TILE):
                        pr, pg, pb, pa = px[x, y]
                        px[x, y] = (int(pr * r), int(pg * g), int(pb * b), pa)
            cache[key] = tile
        canvas.alpha_composite(cache[key], (cx * TILE, cy * TILE))


def render(name: str, centre) -> Path:
    ox = centre[0] - VIEW[0] // 2
    oy = centre[1] - VIEW[1] // 2
    canvas = Image.new("RGBA", (VIEW[0] * TILE, VIEW[1] * TILE), (16, 13, 16, 255))
    tiles = Image.open(ROOT / "prototypes/gate2/art/archive_tiles.png").convert("RGBA")
    props = Image.open(ROOT / "prototypes/gate2/art/props.png").convert("RGBA")

    # A's own atlas, so the frame shows the level's canonical floor where Gate 2
    # has not covered it. Grey on purpose: it is what Gate 2 has to beat.
    level_atlas = Image.open(
        ROOT / "assets/environment/dungeon_0x72/dungeon_tileset_ii.png").convert("RGBA")

    material = ART["material"]
    style = material["layer_style"]

    def paint(role):
        layer(canvas, tiles, material[role], ox, oy, tuple(style[role]["modulate"]))

    def level_tiles(layer_cells, scale):
        for cell in layer_cells:
            x, y = cell["x"] - ox, cell["y"] - oy
            if not (0 <= x < VIEW[0] and 0 <= y < VIEW[1]):
                continue
            ax, ay = int(cell["atlas"][0]) * scale, int(cell["atlas"][1]) * scale
            tile = level_atlas.crop((ax, ay, ax + scale, ay + scale)).resize((TILE, TILE))
            canvas.alpha_composite(tile, (x * TILE, y * TILE))

    # --- same z order the runtime builds ------------------------------------
    for role in ("vault_b5", "vault_b4", "vault_b3", "vault_b2", "vault_b1"):
        paint(role)
    level_tiles(LEVEL["layers"]["Backdrop"], 32)      # A, z -10
    paint("floor")
    paint("water")
    paint("water_edge")
    paint("shadow")
    paint("weather")
    level_tiles(LEVEL["layers"]["Geometry"], 32)      # A, z 0
    paint("mass")
    paint("wall_face")

    for prop in sorted(ART["props"], key=lambda p: p["base_y"]):
        sx, sy, w, h = prop["source"]
        sprite = props.crop((sx, sy, sx + w, sy + h))
        px = prop["x"] - ox * TILE - w / 2.0
        py = prop["base_y"] - oy * TILE - h
        canvas.alpha_composite(sprite, (int(px), int(py)))

    draw = ImageDraw.Draw(canvas)
    colours = {"torch": (255, 180, 90), "coin": (255, 230, 120), "spikes": (230, 90, 90),
               "chest": (120, 220, 255), "player": (140, 255, 160)}
    for entity in LEVEL["entities"]:
        etype = entity.get("type", "?")
        if etype not in colours:
            continue
        ex = entity["position"][0] - ox * TILE
        ey = entity["position"][1] - oy * TILE
        draw.rectangle([ex - 8, ey - 8, ex + 8, ey + 8], outline=colours[etype], width=2)
        draw.text((ex - 2, ey - 18), etype[0].upper(), fill=colours[etype])

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.png"
    canvas.convert("RGB").save(path)
    return path


def main() -> int:
    wanted = sys.argv[1:] or ["spawn"]
    if wanted == ["--all"]:
        wanted = list(STATIONS)
    for name in wanted:
        if name not in STATIONS:
            print(f"unknown station '{name}'; pick from {', '.join(STATIONS)}")
            return 2
        print(render(name, STATIONS[name]))
    print("AUTHORING AID ONLY - native Godot frames come from the gate2-runtime workflow")
    return 0


if __name__ == "__main__":
    sys.exit(main())
