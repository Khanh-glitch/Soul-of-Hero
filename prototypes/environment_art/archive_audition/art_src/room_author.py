#!/usr/bin/env python3
"""Author the Monastic Archive room and emit room.json for the Godot scene.

The room is laid out as ASCII so the composition is readable in the source, then
resolved into three tile layers (floor / wall-cap / wall-face), decals, props,
lights and collision rectangles.

room.json is the single source of truth: `preview_room.py` renders it with PIL
and `archive_room.gd` builds the TileMapLayers from it, so what the preview shows
is what Godot draws.

    python3 room_author.py            # writes ../room.json + ../art/room_preview.png
"""

from __future__ import annotations

import json
import math
import os
import random

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
ART = os.path.join(ROOT, "art")
T = 16

# ---------------------------------------------------------------------------
# Legend
#   '.'  floor (flagstone variants, deterministic)
#   '='  floor, quarry-tile aisle (the processional walk)
#   ','  floor, worn (under the cabinet apron)
#   '~'  water
#   '1'-'4' stair tread, 1 = lowest (south) .. 4 = highest (north)
#   '#'  wall mass
#   ' '  void (nothing drawn)
# ---------------------------------------------------------------------------
W, H = 50, 30
_WALL_ROWS = 4          # rows 2..5 (row 5 is the wall face the room sees)
_INTERIOR_ROWS = 20     # rows 6..25
_SOUTH_WALL_ROWS = 3    # rows 26..28
MAP = (
    [" " * W] * 2
    + ["#" * W] * _WALL_ROWS
    + ["###" + "." * (W - 6) + "###"] * _INTERIOR_ROWS
    + ["#" * W] * _SOUTH_WALL_ROWS
    + [" " * W]
)

W = len(MAP[0])
H = len(MAP)

# Aisle: the diagonal walk from the door up to the armarium, painted as a
# distinct quarry-tile band. Given as a polyline through cell centres.
AISLE_PATH = [(27, 25), (26, 22), (24, 19), (22, 16), (21, 13), (20, 10), (19, 7)]
AISLE_HALF_WIDTH = 1.35

FLOOR_VARIANTS = ["floor_flag_0", "floor_flag_1", "floor_flag_3"]
WORN_VARIANTS = ["floor_flag_worn", "floor_flag_2"]
AISLE_VARIANTS = ["floor_quarry_0", "floor_quarry_1"]

DECOR_SEED = 0x5A04


def cell_of(text, x: int, y: int) -> str:
    """Row-major read with (x, y) argument order — MAP is indexed [y][x]."""
    if 0 <= y < len(text) and 0 <= x < len(text[y]):
        return text[y][x]
    return " "


def nearest_aisle_distance(x: float, y: float) -> float:
    best = 1e9
    pts = AISLE_PATH
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        vx, vy = bx - ax, by - ay
        wx, wy = x - ax, y - ay
        seg = vx * vx + vy * vy
        t = 0.0 if seg == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / seg))
        px_, py_ = ax + vx * t, ay + vy * t
        best = min(best, math.hypot(x - px_, y - py_))
    return best


def hash01(*values) -> float:
    h = 2166136261
    for v in values:
        h ^= (int(v) & 0xFFFFFFFF)
        h = (h * 16777619) & 0xFFFFFFFF
    return (h % 100000) / 100000.0


# ---------------------------------------------------------------------------
# Props. Positioned by the tile the object STANDS ON: the sprite's bottom-centre
# is pinned to the bottom edge of that cell, so a tall cabinet grows upward over
# the wall the way a real object's height does in a top-down view. Every entry is
# (sprite, cell_x, cell_y, solid, z).
# ---------------------------------------------------------------------------
PROPS = [
    # ---- north range: the press bank against the wall --------------------
    ("shelf_full",       5,  6, True, 0),
    ("shelf_partial",   10,  6, True, 0),
    ("candle_stand",    13,  6, False, -1),
    ("armarium_open",   18,  6, True, 0),   # 6 tiles wide: the destination
    ("candle_stand",    23,  6, False, -1),
    ("shelf_closed",    27,  6, True, 0),
    ("drying_rack",     31,  6, False, 0),
    ("rubble_mid",      36,  6, True, 0),
    ("scroll_roll",     34,  6, False, 2),
    ("book_stack",      40,  6, False, 2),

    # ---- the colonnade: two rows of piers carrying the vault ------------
    # North row separates the press bank from the study floor; the gap in the
    # middle keeps the armarium framed and reachable.
    ("column",           8,  9, True, 0),
    ("column",          13,  9, True, 0),
    ("column",          25,  9, True, 0),
    ("column",          31,  9, True, 0),
    ("column",          38,  9, True, 0),
    ("column",          43,  9, True, 0),
    # South row frames the door approach.
    ("column",           8, 22, True, 0),
    ("column",          14, 22, True, 0),
    ("column",          35, 22, True, 0),
    ("column",          41, 22, True, 0),

    # ---- west carrel: the desk that was in use when it happened ----------
    ("desk",             5, 14, True, 0),
    ("stool",            6, 16, False, 0),
    ("stool_tipped",     8, 17, False, 0),
    ("scrolls_a",        3, 16, False, 2),
    ("lectern",          5, 20, True, 0),
    ("candle_stand",     3, 21, False, -1),
    ("scrolls_b",        7, 20, False, 2),

    # ---- the study hall: two long boards between the piers --------------
    ("long_table",      19, 13, True, 0),
    ("bench",           19, 11, True, 0),
    ("bench",           19, 15, True, 0),
    ("long_table",      19, 18, True, 0),
    ("bench",           19, 20, True, 0),
    ("stool_pair",      21, 16, False, 0),
    ("stool_tipped",    24, 14, False, 0),
    ("long_table",      29, 14, True, 0),
    ("bench",           29, 12, True, 0),
    ("bench",           29, 16, True, 0),

    # ---- mid-room: the catalogue lectern, off the walking axis ----------
    ("lectern",         22, 21, True, 0),
    ("ink_horn",        24, 21, False, 2),
    ("stool",           20, 24, False, 0),

    # ---- the eastern bay: a press pulled away from the wall -------------
    ("shelf_closed",    34, 11, True, 0),
    ("stool_tipped",    36, 13, False, 0),
    ("scrolls_a",       37, 14, False, 2),
    ("book_stack",      32, 12, False, 2),
    ("bench",           34, 19, True, 0),
    ("paternoster",     31,  8, False, 4),

    # ---- the evacuation trail: volumes dropped toward the door ----------
    ("book_stack",      23, 23, False, 2),
    ("scrolls_b",       21, 24, False, 2),
    ("scroll_roll",     25, 23, False, 2),
    ("scroll_roll",     27, 24, False, 2),
    ("scrolls_a",       24, 24, False, 2),
    ("book_stack",      28, 23, False, 2),

    # ---- south: the door you came in by, now half buried -----------------
    ("door_portal",     26, 25, False, 3),
    ("door_leaf",       22, 24, False, 1),
    ("rubble_chunk_a",  24, 25, False, 1),
    ("rubble_chunk_b",  28, 25, False, 1),
    ("rubble_large",    34, 24, True, 0),
    ("beam",            31, 23, False, 1),
    ("beam",            39, 25, False, 1),
    ("bench",           42, 24, True, 0),
    ("rubble_mid",      43, 21, True, 0),
    ("scrolls_b",       40, 25, False, 2),

    # ---- east alcove: the collapsed shelf -------------------------------
    ("shelf_collapsed", 39, 17, True, 0),
    ("rubble_mid",      36, 17, True, 0),
    ("scrolls_a",       41, 19, False, 2),
    ("book_stack",      43, 17, False, 2),
]

# Wall-mounted items sit on the face row and are drawn between the wall and the
# props. (sprite, cell x, cell y) with the sprite bottom on the face row.
WALL_ITEMS = [
    ("wall_lamp",  7, 5),
    ("wall_lamp", 15, 5),
    ("wall_lamp", 26, 5),
    ("wall_lamp", 34, 5),
    ("wall_lamp",  2, 10),
    ("wall_lamp",  2, 18),
    ("wall_lamp",  2, 24),
    ("wall_lamp", 47, 12),
    ("wall_lamp", 47, 20),
]

# Blind arcading: niches recessed into the wall faces. This is the single
# strongest "this room stores things" signal, so it wraps both side walls and
# the free stretches of the north face. (x, y) -> niche variant.
NICHES = {}
for _row in (8, 10, 12, 14, 16, 18, 20, 22):
    NICHES[(2, _row)] = "face_niche_scrolls" if _row % 4 == 0 else (
        "face_niche_codices" if _row % 4 == 2 else "face_niche_empty"
    )
for _row in (8, 10, 12, 14, 16):
    NICHES[(47, _row)] = "face_niche_codices" if _row % 4 == 0 else "face_niche_scrolls"
NICHES[(47, 18)] = "face_niche_broken"
NICHES[(47, 20)] = "face_niche_empty"
# north face, in the gaps between the press bank pieces
for _col in (7, 15, 26, 33, 44, 45):
    NICHES[(_col, 5)] = "face_niche_scrolls" if _col % 2 else "face_niche_empty"
# south face, flanking the doorway
for _col in (14, 18, 34, 38):
    NICHES[(_col, 26)] = "face_niche_codices" if _col % 4 == 2 else "face_niche_scrolls"

LIGHTS = [
    # (pixel x, pixel y, colour, energy, scale, kind)
    (296,  78, (1.00, 0.80, 0.52), 1.35, 2.6, "armarium"),   # left of the cabinet
    (392,  78, (1.00, 0.80, 0.52), 1.35, 2.6, "armarium"),   # right of the cabinet
    (238,  86, (1.00, 0.78, 0.48), 0.95, 1.7, "candle"),
    (392,  86, (1.00, 0.78, 0.48), 0.95, 1.7, "candle"),
    (150, 196, (1.00, 0.80, 0.55), 0.85, 1.7, "table"),
    (150, 214, (1.00, 0.80, 0.55), 0.85, 1.7, "table"),
    (542, 196, (1.00, 0.80, 0.55), 0.80, 1.6, "table"),
    (352, 200, (1.00, 0.82, 0.58), 0.90, 2.6, "pendant"),
    (74,  290, (1.00, 0.80, 0.55), 0.85, 1.5, "candle"),
    (360, 330, (1.00, 0.80, 0.55), 0.75, 1.4, "candle"),
    (616, 404, (0.50, 0.60, 0.74), 0.70, 2.4, "breach"),
    (470, 380, (0.54, 0.64, 0.78), 0.40, 1.6, "breach"),
    (424, 396, (1.00, 0.80, 0.55), 0.55, 1.5, "threshold"),
    # the side-wall lamps: each light sits on the fixture that casts it
    (40,  166, (1.00, 0.78, 0.50), 0.75, 1.7, "sconce"),
    (40,  294, (1.00, 0.78, 0.50), 0.75, 1.7, "sconce"),
    (760, 198, (1.00, 0.78, 0.50), 0.75, 1.7, "sconce"),
    (760, 326, (1.00, 0.78, 0.50), 0.70, 1.7, "sconce"),
    (40,  390, (1.00, 0.78, 0.50), 0.65, 1.6, "sconce"),
    (552,  86, (1.00, 0.78, 0.50), 0.60, 1.5, "sconce"),
]

# Explicit collision rectangles in tile units: (x, y, w, h). Props with a
# footprint contribute theirs; these are the extra architectural ones.
COLLISION_RECTS = [
    # the stair cheeks, so the flight reads as a rising passage
    (26.0, 25.0, 0.5, 3.0),
    (29.5, 25.0, 0.5, 3.0),
]

SPAWN = (448, 372)  # px, just inside the door on the top tread
# Camera anchors, given as floor cells the view is centred on.
CAMERA_POINTS = {
    "entry": (25, 21),   # one step inside the door, looking up the hall
    "mid": (17, 15),     # the study hall between the piers
    "end": (19, 8),      # the armarium wall
}


def build() -> dict:
    floor_cells = []
    water_cells = []
    decal_cells = []
    stair_cells = []
    for y in range(H):
        for x in range(W):
            ch = cell_of(MAP, x, y)
            if ch == " ":
                continue
            if ch == "#":
                continue
            px_, py_ = x, y
            cx, cy = x + 0.5, y + 0.5
            aisle = nearest_aisle_distance(cx, cy)
            near_wall = any(
                cell_of(MAP, x + dx, y + dy) == "#"
                for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))
            )
            r = hash01(x, y, DECOR_SEED)
            if ch == "~":
                water_cells.append([x, y])
                continue
            if ch.isdigit():
                stair_cells.append([x, y, int(ch)])
                continue
            if aisle <= AISLE_HALF_WIDTH:
                name = AISLE_VARIANTS[0 if r < 0.5 else 1]
            elif near_wall and r < 0.55:
                name = WORN_VARIANTS[0 if r < 0.3 else 1]
            else:
                name = FLOOR_VARIANTS[int(r * 997) % len(FLOOR_VARIANTS)]
            floor_cells.append([x, y, name])

    # ---- decals ----------------------------------------------------------
    rng = random.Random(4242)
    for (x, y, name) in floor_cells:
        # dust and wear concentrated where feet and rubble were
        near_rubble = (x - 34) ** 2 + (y - 24) ** 2 < 60
        wet = (x - 30) ** 2 * 0.6 + (y - 24) ** 2 < 34
        if near_rubble and rng.random() < 0.42:
            decal_cells.append([x, y, "damp" if wet else "wear"])
        elif wet and rng.random() < 0.5:
            decal_cells.append([x, y, "damp"])
        elif rng.random() < 0.05:
            decal_cells.append([x, y, "moss"])
        # contact shadow beneath every wall face that has floor below it
        if cell_of(MAP, x, y - 1) == "#":
            decal_cells.append([x, y, "wall_shadow"])
    # water sitting in the low south-east corner
    for (x, y) in [(31, 24), (32, 25), (33, 24), (34, 25), (35, 24), (32, 24), (34, 24)]:
        if cell_of(MAP, x, y) != "#":
            water_cells.append([x, y])
    for (x, y) in [(33, 25), (35, 25), (30, 25)]:
        if cell_of(MAP, y, x) != "#":
            decal_cells.append([x, y, "damp"])

    # ---- wall layers -----------------------------------------------------
    caps = []
    faces = []
    for y in range(H):
        for x in range(W):
            if cell_of(MAP, x, y) != "#":
                continue
            neighbours = 0
            if cell_of(MAP, x, y - 1) == "#":
                neighbours |= 1
            if cell_of(MAP, x + 1, y) == "#":
                neighbours |= 2
            if cell_of(MAP, x, y + 1) == "#":
                neighbours |= 4
            if cell_of(MAP, x - 1, y) == "#":
                neighbours |= 8
            touching_floor = any(
                cell_of(MAP, x + dx, y + dy) not in ("#", " ")
                for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))
            )
            if touching_floor:
                # face variant: the outer ends of each run get a terminating quoin
                run_west = cell_of(MAP, x - 1, y) in ("#", " ")
                run_east = cell_of(MAP, x + 1, y) in ("#", " ")
                vertical_run = (
                    cell_of(MAP, x, y - 1) in ("#", " ")
                    and cell_of(MAP, x, y + 1) in ("#", " ")
                )
                if run_west and not run_east:
                    face = "face_left_end"
                elif run_east and not run_west:
                    face = "face_right_end"
                elif vertical_run:
                    face = "face_a" if hash01(x, y, 7) < 0.5 else "face_b"
                else:
                    face = "face_a" if hash01(x, y, 7) < 0.5 else "face_b"
                faces.append([x, y, NICHES.get((x, y), face), neighbours])
            else:
                caps.append([x, y, neighbours])

    room = {
        "width": W,
        "height": H,
        "tile": T,
        "layers": {
            "floor": floor_cells,
            "water": water_cells,
            "stair": stair_cells,
            "cap": caps,
            "face": faces,
            "decal": decal_cells,
        },
        "wall_items": [[n, x, y] for (n, x, y) in WALL_ITEMS],
        "props": [
            {
                "sprite": n,
                "x": cx * T + T // 2,
                "y": cy * T + T,
                "anchor": "base",
                "cell": [cx, cy],
                "solid": solid,
                "z": z,
            }
            for (n, cx, cy, solid, z) in PROPS
        ],
        "lights": [
            {"x": lx, "y": ly, "color": c, "energy": e, "scale": s, "kind": k}
            for (lx, ly, c, e, s, k) in LIGHTS
        ],
        "collision_rects": [
            {"x": r[0] * T, "y": r[1] * T, "w": r[2] * T, "h": r[3] * T}
            for r in COLLISION_RECTS
        ],
        "spawn": list(SPAWN),
        "camera_points": {
            k: [v[0] * T + T // 2, v[1] * T + T // 2] for k, v in CAMERA_POINTS.items()
        },
        "name": "Monastic Archive — Scriptorium Ante-room",
    }
    return room


# ---------------------------------------------------------------------------
# Preview renderer (uses the same room.json + the same art atlases)
# ---------------------------------------------------------------------------
def load_atlases():
    with open(os.path.join(ART, "tiles.json"), encoding="utf-8") as fh:
        tiles = json.load(fh)["frames"]
    with open(os.path.join(ART, "props.json"), encoding="utf-8") as fh:
        props = json.load(fh)["frames"]
    tile_img = Image.open(os.path.join(ART, "archive_tiles.png")).convert("RGBA")
    prop_img = Image.open(os.path.join(ART, "props.png")).convert("RGBA")
    caps_img = Image.open(os.path.join(ART, "wall_caps.png")).convert("RGBA")
    return tiles, props, tile_img, prop_img, caps_img


def tile_sprite(tiles_img, frames, name):
    x, y, w, h = frames[name]
    return tiles_img.crop((x, y, x + w, y + h))


def render(room, scale=1, crop=None):
    tiles, props, tiles_img, prop_img, caps_img = load_atlases()
    width, height = room["width"], room["height"]
    image = Image.new("RGBA", (width * T, height * T), (10, 9, 12, 255))
    draw = ImageDraw.Draw(image, "RGBA")

    cap_cache = {}
    for (x, y, mask) in room["layers"]["cap"]:
        if mask not in cap_cache:
            cap_cache[mask] = caps_img.crop(
                ((mask % 4) * T, (mask // 4) * T, (mask % 4) * T + T, (mask // 4) * T + T)
            )
        image.alpha_composite(cap_cache[mask], (x * T, y * T))

    for (x, y, name, ax, ay) in room["layers"]["floor"]:
        image.alpha_composite(tiles_img.crop((ax * T, ay * T, ax * T + T, ay * T + T)), (x * T, y * T))
    for (x, y, _ax, _ay) in room["layers"]["water"]:
        # water edges: pick the tile variant from neighbouring water cells
        wset = {(c[0], c[1]) for c in room["layers"]["water"]}
        north = (x, y - 1) not in wset
        south = (x, y + 1) not in wset
        east = (x + 1, y) not in wset
        west = (x - 1, y) not in wset
        key = ""
        if north and west:
            key = "water_nw"
        elif north and east:
            key = "water_ne"
        elif south and west:
            key = "water_sw"
        elif south and east:
            key = "water_se"
        elif north:
            key = "water_n"
        elif south:
            key = "water_s"
        elif east:
            key = "water_e"
        elif west:
            key = "water_w"
        else:
            key = "water_deep"
        image.alpha_composite(tile_sprite(tiles_img, tiles, key), (x * T, y * T))
    for (x, y, _index, ax, ay) in room["layers"]["stair"]:
        image.alpha_composite(tiles_img.crop((ax * T, ay * T, ax * T + T, ay * T + T)), (x * T, y * T))

    for (x, y, ax, ay) in room["layers"]["face"]:
        image.alpha_composite(tiles_img.crop((ax * T, ay * T, ax * T + T, ay * T + T)), (x * T, y * T))

    for (x, y, ax, ay) in room["layers"]["decal"]:
        image.alpha_composite(tiles_img.crop((ax * T, ay * T, ax * T + T, ay * T + T)), (x * T, y * T))

    for item in room["wall_items"]:
        sx, sy, sw, sh = item["source"]
        x, y = item["cell"]
        sprite = prop_img.crop((sx, sy, sx + sw, sy + sh))
        image.alpha_composite(sprite, (x * T + T // 2 - sw // 2, y * T + T - sh))

    # contact shadows: a soft ellipse where every object meets the floor
    for p in room["props"]:
        if p["anchor"] != "base":
            continue
        _sx, _sy, fw, fh = p["source"]
        w = max(10, int(fw * 0.72))
        h = max(5, int(w * 0.42))
        cx = p["x"] - w // 2
        cy = p["y"] - h // 2
        shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        for i in range(3):
            a = 44 - i * 12
            sd.ellipse([i, i, w - 1 - i, h - 1 - i], fill=(8, 6, 6, a))
        image.alpha_composite(shadow, (cx, cy))

    ordered = sorted(room["props"], key=lambda p: (p["z"], p["y"]))
    for p in ordered:
        sx, sy, sw, sh = p["source"]
        sprite = prop_img.crop((sx, sy, sx + sw, sy + sh))
        if p["anchor"] == "base":
            pos = (p["x"] - sw // 2, p["y"] - sh)
        else:
            pos = (p["x"], p["y"])
        image.alpha_composite(sprite, (int(pos[0]), int(pos[1])))

    # spawn marker for the authoring preview only (never in the Godot scene)
    sx, sy = room["spawn"]
    draw.ellipse([sx - 6, sy - 10, sx + 6, sy + 2], outline=(90, 240, 170, 220), width=1)
    draw.line([sx, sy, sx, sy - 22], fill=(90, 240, 170, 120))

    if crop is not None:
        cx, cy, cw, chh = crop
        image = image.crop((int(cx), int(cy), int(cx + cw), int(cy + chh)))
    if scale != 1:
        image = image.resize(
            (image.width * scale, image.height * scale), Image.NEAREST
        )
    return image


def resolve_atlas(room: dict) -> dict:
    """Attach exact atlas coordinates so the Godot scene needs no name lookup."""
    with open(os.path.join(ART, "tiles.json"), encoding="utf-8") as fh:
        tile_frames = json.load(fh)["frames"]
    with open(os.path.join(ART, "props.json"), encoding="utf-8") as fh:
        prop_frames = json.load(fh)["frames"]

    def tile_ref(name: str):
        x, y, _w, _h = tile_frames[name]
        return [x // T, y // T]

    layers = room["layers"]
    room["layers"] = {
        "floor": [[x, y, name, *tile_ref(name)] for (x, y, name) in layers["floor"]],
        "water": [[x, y, *tile_ref("water_deep")] for (x, y) in layers["water"]],
        "stair": [[x, y, i, *tile_ref(f"stair_{i - 1}")] for (x, y, i) in layers["stair"]],
        "cap": [[x, y, mask] for (x, y, mask) in layers["cap"]],
        "face": [[x, y, *tile_ref(name)] for (x, y, name, _m) in layers["face"]],
        "decal": [[x, y, *tile_ref(name)] for (x, y, name) in layers["decal"]],
    }
    room["wall_items"] = [
        {"name": n, "source": [prop_frames[n]["x"], prop_frames[n]["y"],
                               prop_frames[n]["w"], prop_frames[n]["h"]],
         "cell": [x, y]}
        for (n, x, y) in room["wall_items"]
    ]
    room["props"] = [
        {
            **prop,
            "source": [prop_frames[prop["sprite"]]["x"], prop_frames[prop["sprite"]]["y"],
                       prop_frames[prop["sprite"]]["w"], prop_frames[prop["sprite"]]["h"]],
        }
        for prop in room["props"]
    ]
    room["tileset"] = {
        "archive_tiles": {"columns": 8, "frame": T},
        "wall_caps": {"columns": 4, "frame": T},
        "props_columns": 1,
    }
    return room


def main() -> int:
    room = resolve_atlas(build())
    with open(os.path.join(ROOT, "room.json"), "w", encoding="utf-8") as fh:
        json.dump(room, fh, separators=(",", ":"))
    os.makedirs(ART, exist_ok=True)
    full = render(room, scale=1)
    full.convert("RGB").save(os.path.join(ART, "room_preview.png"))
    # a 1280x720 crop around the entry, matching the gameplay camera
    view = render(room, scale=1, crop=(448 - 320, 372 - 196, 640, 360))
    view = view.resize((1280, 720), Image.NEAREST)
    view.convert("RGB").save(os.path.join(ART, "room_preview_entry.png"))
    print(
        f"room {room['width']}x{room['height']}  floor {len(room['layers']['floor'])} "
        f"water {len(room['layers']['water'])} face {len(room['layers']['face'])} "
        f"cap {len(room['layers']['cap'])} decal {len(room['layers']['decal'])} "
        f"props {len(room['props'])} lights {len(room['lights'])}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
