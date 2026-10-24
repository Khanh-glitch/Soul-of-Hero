#!/usr/bin/env python3
"""Gate 3 — build the review sheets from the native frames.

Everything this script writes is a pure transform of a native capture: side-by-side
sheets, labelled 3x nearest-neighbour crops, and one clearly-labelled offline
diagram of the route. It never draws a game frame.

    python3 tools/gate3/make_evidence_sheets.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
EV = ROOT / "docs/gate3/evidence"
LEVEL = ROOT / "prototypes/gate3/level_data/chapter_1_level_3_gate3.json"
ART = ROOT / "prototypes/gate3/visual_placement.json"

FLOOR1 = ["spawn", "archive_entry", "landmark", "descent_landing", "cloister",
          "south_loop", "combat_space", "return_route"]
EXTRA = ["floor2_arrival", "floor2_stacks", "floor3_camp"]
CROPS = [
    ("armarium_alcove", "landmark", (300, 180, 980, 560)),
    ("cloister_garth", "cloister", (250, 200, 1030, 620)),
    ("descent_landing", "descent_landing", (280, 190, 1000, 590)),
    ("south_loop", "south_loop", (260, 210, 1020, 610)),
    ("bay_rhythm", "archive_entry", (180, 150, 900, 530)),
    ("shade_depth", "spawn", (0, 120, 720, 540)),
    # The hazard re-skin: the four spike bays around the landmark, where the opaque
    # violet plate used to read as a lavender card on the stone.
    ("hazard_bay", "landmark", (760, 300, 1000, 520)),
]
CAMERA = ["cam_baseline_1280_landmark", "cam_archive_1280_landmark",
          "cam_baseline_1024_landmark", "cam_archive_1024_landmark"]


def label(image: Image.Image, text: str) -> Image.Image:
    canvas = Image.new("RGB", (image.width, image.height + 22), (14, 12, 14))
    canvas.paste(image.convert("RGB"), (0, 22))
    ImageDraw.Draw(canvas).text((6, 5), text, fill=(238, 226, 208))
    return canvas


def comparison(station: str) -> Path | None:
    before = EV / f"before_{station}.png"
    after = EV / f"after_{station}.png"
    if not before.exists() or not after.exists():
        return None
    left = label(Image.open(before), f"BEFORE  {station}  (Candidate A)")
    right = label(Image.open(after), f"AFTER  {station}  (Gate 3)")
    sheet = Image.new("RGB", (left.width + right.width + 8, max(left.height, right.height)),
                      (32, 28, 30))
    sheet.paste(left, (0, 0))
    sheet.paste(right, (left.width + 8, 0))
    path = EV / f"comparison_{station}.png"
    sheet.save(path)
    return path


def crop(name: str, station: str, box) -> Path | None:
    after = EV / f"after_{station}.png"
    if not after.exists():
        return None
    source = Image.open(after).convert("RGB")
    box = (box[0], box[1], min(box[2], source.width), min(box[3], source.height))
    tile = source.crop(box)
    tile = tile.resize((tile.width * 3, tile.height * 3), Image.NEAREST)
    tile = label(tile, f"3x CROP of the native AFTER frame '{station}' - {name}")
    path = EV / f"inspection_crop_{name}_3x.png"
    tile.save(path)
    return path


def combat_sheet() -> Path | None:
    """The one frame taken while a fight was actually happening.

    Labelled with what it is and what it is not: it is a native frame, captured mid-fight
    with the combo landing and the skeleton swinging, not a posed still of a room that
    happens to contain an enemy.
    """
    after = EV / "after_combat_load.png"
    if not after.exists():
        return None
    image = label(Image.open(after).convert("RGB"),
                  "native frame captured mid-fight: sword combo landing, skeleton swinging")
    path = EV / "combat_under_load.png"
    image.save(path)
    return path


def camera_sheet() -> Path | None:
    tiles = []
    for name in CAMERA:
        path = EV / f"after_{name}.png"
        if not path.exists():
            return None
        image = Image.open(path).convert("RGB")
        tiles.append(label(image, name.replace("after_cam_", "camera ").replace("_landmark", "")))
    width = max(t.width for t in tiles[:2]) * 2 + 8
    height = tiles[0].height + tiles[2].height + 8 if len(tiles) > 2 else tiles[0].height
    sheet = Image.new("RGB", (width, height), (32, 28, 30))
    sheet.paste(tiles[0], (0, 0))
    sheet.paste(tiles[1], (tiles[0].width + 8, 0))
    if len(tiles) > 2:
        sheet.paste(tiles[2], (0, tiles[0].height + 8))
        sheet.paste(tiles[3], (tiles[2].width + 8, tiles[0].height + 8))
    path = EV / "camera_comparison.png"
    sheet.save(path)
    return path


def route_diagnostic() -> Path | None:
    """Offline diagram: the authored plan, the walk, the props and the stations.

    This is an authoring diagnostic drawn from data, not a game frame, and it says
    so on its own face.
    """
    if not LEVEL.exists():
        return None
    level = json.loads(LEVEL.read_text())
    art = json.loads(ART.read_text())
    tile = 6
    width, height = int(level["width"]), int(level["height"])
    floor = {(c["x"], c["y"]) for c in level["layers"]["Backdrop"]}
    solid = {(c["x"], c["y"]) for c in level["layers"]["Geometry"]}
    image = Image.new("RGB", (width * tile, height * tile), (10, 9, 12))
    draw = ImageDraw.Draw(image)
    for x, y in floor:
        draw.rectangle([x * tile, y * tile, x * tile + tile - 1, y * tile + tile - 1],
                       fill=(120, 104, 86))
    for x, y in solid:
        draw.rectangle([x * tile, y * tile, x * tile + tile - 1, y * tile + tile - 1],
                       fill=(58, 52, 60))
    for cell in art["material"].get("water", []):
        draw.rectangle([cell[0] * tile, cell[1] * tile, cell[0] * tile + tile - 1,
                        cell[1] * tile + tile - 1], fill=(48, 74, 96))
    for prop in art["props"]:
        x0, y0, x1, y1 = prop["cells"]
        colour = (196, 120, 64) if prop["solid"] else (150, 96, 60)
        draw.rectangle([x0 * tile, y0 * tile, (x1 + 1) * tile - 1, (y1 + 1) * tile - 1],
                       outline=colour)
    for entity_name, cell, colour in [("P", (17, 13), (240, 240, 120)),
                                      ("D1", (109, 16), (120, 200, 255)),
                                      ("D2", (9, 51), (120, 200, 255))]:
        draw.rectangle([cell[0] * tile - 3, cell[1] * tile - 3,
                        cell[0] * tile + tile + 2, cell[1] * tile + tile + 2], outline=colour)
    for name, cell in [("spawn", (17, 13)), ("landmark", (30, 12)),
                       ("landing", (30, 17)), ("cloister", (38, 18)),
                       ("south", (46, 23)), ("east", (58, 21)),
                       ("f2", (48, 52)), ("f3", (45, 89))]:
        draw.ellipse([cell[0] * tile - 2, cell[1] * tile - 2,
                      cell[0] * tile + tile + 1, cell[1] * tile + tile + 1],
                     outline=(255, 120, 200))
        draw.text((cell[0] * tile + 3, cell[1] * tile - 10), name, fill=(255, 190, 230))
    draw.text((8, 8), "OFFLINE DIAGRAM, not a screenshot: authored plan, Gate 3 props, "
                      "stations and the two descents", fill=(240, 230, 210))
    path = EV / "route_and_connectivity_diagram.png"
    image.save(path)
    return path


def main() -> int:
    EV.mkdir(parents=True, exist_ok=True)
    made = []
    for station in FLOOR1 + EXTRA:
        path = comparison(station)
        if path:
            made.append(path.name)
    for name, station, box in CROPS:
        path = crop(name, station, box)
        if path:
            made.append(path.name)
    path = combat_sheet()
    if path:
        made.append(path.name)
    path = camera_sheet()
    if path:
        made.append(path.name)
    path = route_diagnostic()
    if path:
        made.append(path.name)
    print(f"GATE3 SHEETS: {len(made)} files")
    for name in made:
        print(f"  {name}")
    return 0 if made else 1


if __name__ == "__main__":
    sys.exit(main())
