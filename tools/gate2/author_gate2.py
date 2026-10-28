#!/usr/bin/env python3
"""Gate 2 — author the Level 3 archive environment.

Single source of truth for everything Gate 2 adds. Emits two generated
documents, and refuses to write either unless the whole design validates.

  prototypes/gate2/level_data/chapter_1_level_3_gate2.json
      Candidate A's pinned Level 3 with one architectural edit applied: an
      alcove carved into the nave's north wall for the armarium. Entities, IDs,
      positions, level size and every cell outside the Gate 2 zone are
      byte-identical to the fixture.

  prototypes/gate2/visual_placement.json
      The presentation pack: vault shadow (void), floor stone, cloister garth
      water, wall faces, contact shadows, whole-sprite props with derived
      colliders, and local lights.

    python3 tools/gate2/author_gate2.py            # write
    python3 tools/gate2/author_gate2.py --check    # verify up to date
    python3 tools/gate2/author_gate2.py --stats    # print numbers only

Design intent
-------------
Gate 1 failed on architectural cohesion: an archive annex bolted onto a grey
crypt, furniture standing in a void, black screen borders. Gate 2 does not
re-plan Level 3 — it reads Candidate A's plan as ONE building:

  * the long north corridor (row 11) is the nave and the main artery, so the
    archive's landmark goes there, not on a lateral detour;
  * the sealed void the corridors ring at x41..54, y13..17 is a cloister
    garth: a flooded courtyard you walk around and look down into;
  * every void cell in camera range is vault masonry in shadow, so the level
    never reads as sprites on black;
  * one stone language over the whole playable floor, with a dado, capped wall
    ends and contact shadow, so walls read as walls and not as texture.

Gameplay is untouched: no entity moves, no route closes, and every collider is
derived from the drawn footprint of its own sprite.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

BASE = ROOT / "prototypes/gate0/level_data/chapter_1_level_3_a.json"
BASE_SHA = "5ea50e9cf37791a6283bfd9a58bd634ec8aa144e9602c5b9f40f0b4600555f54"

OUT_LEVEL = ROOT / "prototypes/gate2/level_data/chapter_1_level_3_gate2.json"
OUT_ART = ROOT / "prototypes/gate2/visual_placement.json"

PROPS_ATLAS = "res://prototypes/gate2/art/props.png"
PROPS_JSON = ROOT / "prototypes/gate2/art/props.json"
TILES_ATLAS = "res://prototypes/gate2/art/archive_tiles.png"
TILES_JSON = ROOT / "prototypes/gate2/art/tiles.json"
LIGHT_TEXTURE = "res://prototypes/gate2/art/light_radial.png"

TILE = 16
SOLID_LAYER = 1
COLLIDER_RATIO = 0.86
COLLIDER_H = 12

# The only cells Gate 2 may touch. Everything outside must equal the fixture.
ZONE = (5, 5, 76, 27)
# Camera reach for the vault shadow: 1280x720 at 16 px tiles is 80x45 cells, and
# the camera is centred on the knight, so the spawn frame looks well past the
# level's top edge. This box comfortably covers every station Gate 2 captures.
VAULT_BOX = (-26, -14, 102, 48)

# The alcove: carved out of the nave's north wall, behind the armarium.
ALCOVE = (25, 9, 33, 10)

# The cloister garth: a sealed void ringed by the ambulatory.
GARTH = (41, 13, 54, 17)

# The nave and the ambulatory: worn stone where the traffic is.
WEAR_RECTS = [
    (11, 10, 73, 11),    # the artery, row 11 plus its north lip
    (17, 12, 25, 13),    # spawn crossing
    (35, 12, 39, 19),    # west walk of the cloister
    (56, 12, 60, 19),    # east walk
    (35, 20, 73, 21),    # south walk
]

# Niches: curated rather than sprinkled. Full frames face the artery and the
# cloister; stripped and broken frames sit on the evacuation side (east, towards
# the camp), so the room tells one story.
NICHES = {}

# Whole-sprite furniture, addressed in CELLS: `cell` is the column the sprite is
# centred on, `row` is the row it stands in (its base sits on the row's bottom
# pixel). Pixels are derived; nothing is hand-nudged.
#
# The composition, in the order you meet it walking the artery eastward:
#   spawn (17,13) -> closed stacks in the nave -> the armarium alcove (25..33)
#   -> the cloister garth -> the east reading room -> the crossfire hall.
PLACEMENTS = [
    # --- the nave: closed stacks, set in ranges along the south wall ---------
    dict(sprite="shelf_full", cell=9, row=19, solid=True,
         intent="the first press of the western range, still full"),
    dict(sprite="shelf_partial", cell=12, row=19, solid=True,
         intent="its neighbour, half-emptied: the evacuation reached this bay"),
    dict(sprite="shelf_closed", cell=16, row=19, solid=True,
         intent="a shuttered press - the bay nobody opened"),
    dict(sprite="shelf_full", cell=19, row=19, solid=True,
         intent="the range continues east, out of the nave's shadow"),
    dict(sprite="beam", cell=14, row=17, solid=False,
         intent="a fallen beam across the aisle between the ranges")
    ,
    dict(sprite="rubble_large", cell=8, row=15, solid=True,
         intent="vaulting down over the western range - the damage story starts "
                "where the traffic is thinnest"),
    dict(sprite="rubble_chunk_a", cell=11, row=15, solid=False,
         intent="a spall off the same fall"),
    dict(sprite="rubble_chunk_b", cell=14, row=15, solid=False,
         intent="another spall, further into the aisle"),

    # --- the scriptorium station, between the piers -------------------------
    dict(sprite="desk", cell=17, row=16, solid=True,
         intent="a copyist's desk left mid-page in the aisle: the human story "
                "of the evacuation"),
    dict(sprite="stool", cell=18, row=17, solid=False,
         intent="its stool, still upright"),
    dict(sprite="scroll_roll", cell=15, row=16, solid=False,
         intent="the first dropped roll of the trail east"),
    dict(sprite="scrolls_b", cell=19, row=16, solid=False,
         intent="the spill widening"),

    # --- the alcove: the armarium, the room's landmark ----------------------
    dict(sprite="armarium_open", cell=29, row=10, solid=True,
         intent="the open armarium standing in the alcove cut for it, on the "
                "artery's sightline: the archive's face to the visitor"),

    # --- the cloister garth lip --------------------------------------------
    dict(sprite="rubble_mid", cell=42, row=21, solid=False,
         intent="masonry that fell from the parapet into the garth"),
    dict(sprite="rubble_chunk_a", cell=39, row=21, solid=False,
         intent="more of the same fall, on the south walk"),

    # --- the east reading room ---------------------------------------------
    dict(sprite="long_table", cell=63, row=20, solid=True,
         intent="the long reading board of the east room - cover the player can "
                "use, dressed as furniture"),
    dict(sprite="bench", cell=66, row=21, solid=True,
         intent="its bench, pulled out and left askew"),
    dict(sprite="lectern", cell=70, row=20, solid=True,
         intent="the catalogue lectern where the exit corridor leaves the room"),
    dict(sprite="book_stack", cell=60, row=21, solid=False,
         intent="a stack set down beside the walk and never picked up"),
    dict(sprite="drying_rack", cell=58, row=19, solid=False,
         intent="a rack of hung leaves, still drying in the east range"),
]

# Two warm pools. Candidate A's own torches keep lighting the artery.
LIGHTS = [
    dict(cell=29, row=9, energy=0.52, scale=0.60, colour=[1.0, 0.80, 0.58],
         intent="the alcove wash that makes the armarium the landmark"),
    dict(cell=47, row=15, energy=0.34, scale=0.85, colour=[0.86, 0.92, 1.0],
         intent="cold light off the cloister water, so the garth reads as a "
                "light source and the room's centre"),
    dict(cell=64, row=20, energy=0.30, scale=0.55, colour=[1.0, 0.82, 0.60],
         intent="the east reading room's own pool"),
]

# Candidate A's entity art as drawn, for the overlap check.
ENTITY_ART = {
    "player": {"w": 32, "h": 32, "anchor": "centre"},
    "torch": {"w": 32, "h": 32, "anchor": "bottom"},
    "coin": {"w": 24, "h": 24, "anchor": "centre"},
    "spikes": {"w": 32, "h": 32, "anchor": "centre"},
    "chest": {"w": 32, "h": 32, "anchor": "bottom"},
    "sigil": {"w": 32, "h": 32, "anchor": "centre"},
}
ENTITY_DEFAULT = {"w": 32, "h": 32, "anchor": "bottom"}


# ----------------------------------------------------------------- helpers ---

def load(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hashed(*parts) -> int:
    """Deterministic pseudo-random, so the stonework is stable between runs."""
    return int(hashlib.sha256(",".join(str(p) for p in parts).encode()).hexdigest()[:8], 16)


def inside(box, x, y) -> bool:
    return box[0] <= x <= box[2] and box[1] <= y <= box[3]


def cells(layer) -> set:
    return {(int(c["x"]), int(c["y"])) for c in layer}


def flood(start, open_cells):
    if start not in open_cells:
        return set()
    seen, todo = {start}, deque([start])
    while todo:
        x, y = todo.popleft()
        for step in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            pos = (x + step[0], y + step[1])
            if pos in open_cells and pos not in seen:
                seen.add(pos)
                todo.append(pos)
    return seen


def overlaps(a, b, clearance=0.0) -> bool:
    return not (a[2] + clearance <= b[0] or b[2] + clearance <= a[0]
                or a[3] + clearance <= b[1] or b[3] + clearance <= a[1])


def cell_rect(cell, row):
    """Centre_x, base_y for a sprite centred on a column, standing in a row."""
    return cell * TILE + TILE / 2.0, (row + 1) * TILE


_PROP_FRAMES = None
_TILE_FRAMES = None


def frames(path: Path):
    return load(path)["frames"]


def frame_atlas(name):
    global _PROP_FRAMES
    if _PROP_FRAMES is None:
        _PROP_FRAMES = frames(PROPS_JSON)
    return _PROP_FRAMES[name]


def tile_frame(name):
    return tile_frame_all()[name]


def tile_frame_all():
    global _TILE_FRAMES
    if _TILE_FRAMES is None:
        _TILE_FRAMES = frames(TILES_JSON)
    return _TILE_FRAMES


# ------------------------------------------------------------- architecture ---

def carve_alcove(level: dict) -> dict:
    """Cut the armarium's alcove out of the nave's north wall.

    Candidate A runs solid wall along y9 at x5..39 with single-cell teeth at y10
    between the wall bays. Removing the wall over x25..33 (and the three teeth in
    that span) opens a nine-cell-wide, two-course-deep recess whose back wall is
    the intact masonry at y8. This only ever ADDS walkable floor - no cell that
    was reachable stops being reachable - and it is the single gameplay-adjacent
    edit in Gate 2.
    """
    layers = level["layers"]
    backdrop = {(int(c["x"]), int(c["y"])): c for c in layers["Backdrop"]}
    geometry = {(int(c["x"]), int(c["y"])): c for c in layers["Geometry"]}

    donor_floor = copy.deepcopy(backdrop[(20, 11)])
    carved = []
    for y in range(ALCOVE[1], ALCOVE[3] + 1):
        for x in range(ALCOVE[0], ALCOVE[2] + 1):
            if (x, y) not in geometry:
                continue
            carved.append([x, y])
            del geometry[(x, y)]
            floor = copy.deepcopy(donor_floor)
            floor["x"], floor["y"] = x, y
            backdrop[(x, y)] = floor
    layers["Backdrop"] = [backdrop[k] for k in sorted(backdrop, key=lambda p: (p[1], p[0]))]
    layers["Geometry"] = [geometry[k] for k in sorted(geometry, key=lambda p: (p[1], p[0]))]
    return {"carved": sorted(carved, key=lambda p: (p[1], p[0]))}


# ------------------------------------------------------------------- props ---

def sprite_rect(name, x, base_y):
    f = frame_atlas(name)
    return (x - f["w"] / 2.0, base_y - f["h"], x + f["w"] / 2.0, base_y)


def collider_rect(name, x, base_y):
    width = frame_atlas(name)["w"] * COLLIDER_RATIO
    return (x - width / 2.0, base_y - COLLIDER_H, x + width / 2.0, base_y)


def entity_rects(level):
    out = []
    for entity in level.get("entities", []):
        art = ENTITY_ART.get(entity.get("type", ""), ENTITY_DEFAULT)
        ex, ey = float(entity["position"][0]), float(entity["position"][1])
        half_w = art["w"] / 2.0
        if art["anchor"] == "bottom":
            top, bottom = ey - art["h"], ey
        else:
            top, bottom = ey - art["h"] / 2.0, ey + art["h"] / 2.0
        out.append((entity["id"], ex - half_w, top, ex + half_w, bottom))
    return out


# ---------------------------------------------------------------- validate ---

def validate_level(base, level, carved):
    errors = []
    if level["entities"] != base["entities"]:
        errors.append("the entity list changed; Gate 2 must not touch gameplay entities")
    if (level["width"], level["height"]) != (base["width"], base["height"]):
        errors.append("the level dimensions changed")
    if sorted(level["layers"], key=str) != sorted(base["layers"], key=str):
        errors.append("a layer was added to or removed from the level document")
    for name in base["layers"]:
        old = {(int(c["x"]), int(c["y"])): c for c in base["layers"][name]}
        new = {(int(c["x"]), int(c["y"])): c for c in level["layers"][name]}
        for pos in set(old) | set(new):
            if old.get(pos) == new.get(pos):
                continue
            if not inside(ZONE, pos[0], pos[1]):
                errors.append(f"{name} edited outside the Gate 2 zone at {pos}")
    old_open = cells(base["layers"]["Backdrop"]) - cells(base["layers"]["Geometry"])
    new_open = cells(level["layers"]["Backdrop"]) - cells(level["layers"]["Geometry"])
    start = (17, 13)
    lost = flood(start, old_open) - flood(start, new_open)
    if lost:
        errors.append(f"{len(lost)} previously reachable cells were lost, e.g. {sorted(lost)[:6]}")
    for entity in level["entities"]:
        pos = (int(entity["position"][0]) // TILE, int(entity["position"][1]) // TILE)
        if pos in old_open and pos not in new_open:
            errors.append(f"entity {entity['id']} no longer stands on floor")
    return errors, {"carved_cells": len(carved["carved"])}


def place(level, placements):
    """Resolve cell addresses to pixels and the atlas regions they come from."""
    out = []
    for index, placement in enumerate(placements):
        name = placement["sprite"]
        x, base_y = cell_rect(placement["cell"], placement["row"])
        f = frame_atlas(name)
        drawn = sprite_rect(name, x, base_y)
        box = collider_rect(name, x, base_y)
        out.append({
            "id": f"gate2_{index:02d}_{name}",
            "sprite": name,
            "cell": [placement["cell"], placement["row"]],
            "x": round(x, 3),
            "base_y": round(base_y, 3),
            "source": [f["x"], f["y"], f["w"], f["h"]],
            "cells": [int(drawn[0]) // TILE, int(drawn[1]) // TILE,
                      int(drawn[2] - 1) // TILE + 1, int(drawn[3] - 1) // TILE + 1],
            "solid": bool(placement["solid"]),
            "collider": [round((box[0] + box[2]) / 2, 3), round((box[1] + box[3]) / 2, 3),
                         round(box[2] - box[0], 3), round(box[3] - box[1], 3)],
            "intent": placement["intent"],
            "provenance": f"Candidate B e7cad36 archive_audition/art/props.png "
                          f"frame '{name}'",
        })
    out.sort(key=lambda p: (p["collider"][1], p["x"]))
    return out


def validate_props(level, props):
    errors = []
    backdrop = cells(level["layers"]["Backdrop"])
    geometry = cells(level["layers"]["Geometry"])
    floor = backdrop - geometry
    entities = entity_rects(level)
    solids = []
    for entry in props:
        name = entry["sprite"]
        drawn = (entry["x"] - entry["source"][2] / 2.0, entry["base_y"] - entry["source"][3],
                 entry["x"] + entry["source"][2] / 2.0, entry["base_y"])
        standing_row = entry["cell"][1]
        for column in range(int(drawn[0]) // TILE, int(drawn[2] - 1) // TILE + 1):
            if (column, standing_row) not in floor:
                errors.append(f"{name}@col{entry['cell'][0]}: col {column} is not floor "
                              f"in the standing row {standing_row}")
        for entity_id, *rect in entities:
            if overlaps(drawn, tuple(rect), 4.0):
                errors.append(f"{name}@col{entry['cell'][0]}: sprite overlaps entity "
                              f"art '{entity_id}'")
        if entry["solid"]:
            box = (entry["collider"][0] - entry["collider"][2] / 2.0,
                   entry["collider"][1] - entry["collider"][3] / 2.0,
                   entry["collider"][0] + entry["collider"][2] / 2.0,
                   entry["collider"][1] + entry["collider"][3] / 2.0)
            for column in range(int(box[0]) // TILE, int(box[2] - 1) // TILE + 1):
                for row in range(int(box[1]) // TILE, int(box[3] - 1) // TILE + 1):
                    if (column, row) not in floor:
                        errors.append(f"{name}@col{entry['cell'][0]}: collider covers "
                                      f"non-floor {column},{row}")
            for other, other_box in solids:
                if overlaps(box, other_box):
                    errors.append(f"{name} collider overlaps {other}")
            solids.append((name, box))
    return errors


def validate_routes(level, props):
    """Nothing the campaign needs may be cut off, and no prop may seal a pocket
    that holds an entity. Small dead-end pockets filled by furniture are the
    point of furniture and are reported, not forbidden."""
    errors = []
    backdrop = cells(level["layers"]["Backdrop"])
    geometry = cells(level["layers"]["Geometry"])
    floor = backdrop - geometry
    blocked = set()
    for entry in props:
        if not entry["solid"]:
            continue
        box = (entry["collider"][0] - entry["collider"][2] / 2.0,
               entry["collider"][1] - entry["collider"][3] / 2.0,
               entry["collider"][0] + entry["collider"][2] / 2.0,
               entry["collider"][1] + entry["collider"][3] / 2.0)
        for column in range(int(box[0]) // TILE, int(box[2] - 1) // TILE + 1):
            for row in range(int(box[1]) // TILE, int(box[3] - 1) // TILE + 1):
                blocked.add((column, row))
    before = flood((17, 13), floor)
    after = flood((17, 13), floor - blocked)
    lost = before - after
    entity_cells = {(int(e["position"][0]) // TILE, int(e["position"][1]) // TILE)
                    for e in level["entities"]}
    sealed_entities = sorted(p for p in lost if p in entity_cells)
    if sealed_entities:
        errors.append(f"props seal {len(sealed_entities)} entity cells: {sealed_entities}")
    # every pocket left behind must be small and empty
    pockets = []
    remaining = (before - after) - blocked
    while remaining:
        seed = next(iter(remaining))
        pocket = flood(seed, floor - blocked)
        remaining -= pocket
        pockets.append(pocket)
    big = [len(p) for p in pockets if len(p) > 16]
    if big:
        errors.append(f"props cut off {len(big)} region(s) larger than 16 cells: {big}")
    with_entities = [sorted(p)[:3] for p in pockets if p & entity_cells]
    if with_entities:
        errors.append(f"a pocket holding an entity was cut off: {with_entities}")
    return errors, {
        "blocked_cells": len(blocked),
        "reachable_after": len(after),
        "pockets": len(pockets),
        "pocket_cells": sum(len(p) for p in pockets),
    }


def validate_material(level, art):
    """The material must dress the level without ever hiding the level.

    Scenery over a walkable cell would be a lie about where the player can go,
    and a floor tile missing from an authored floor cell would leave Candidate
    A's grey showing through in the middle of the archive.
    """
    errors = []
    material = art["material"]
    backdrop = cells(level["layers"]["Backdrop"])
    geometry = cells(level["layers"]["Geometry"])
    floor = backdrop - geometry
    # `shadow` and `weather` are decals and are *supposed* to lie on the floor.
    for role in ("vault_b1", "vault_b2", "vault_b3", "vault_b4", "vault_b5",
                 "water", "water_edge", "mass", "wall_face"):
        for tile in material[role]:
            if (int(tile[0]), int(tile[1])) in floor:
                errors.append(f"{role} covers walkable cell {tile[0]},{tile[1]}")
                break
    painted = {(int(t[0]), int(t[1])) for t in material["floor"]}
    missing = sorted(floor - painted)
    if missing:
        errors.append(f"{len(missing)} authored floor cells have no archive stone, "
                      f"e.g. {missing[:4]}")
    extra = sorted(painted - floor)
    if extra:
        errors.append(f"{len(extra)} archive floor tiles sit on non-walkable cells, "
                      f"e.g. {extra[:4]}")
    for tile in material["wall_face"]:
        if (int(tile[0]), int(tile[1])) not in geometry:
            errors.append(f"wall face at {tile[0]},{tile[1]} is not a wall cell")
            break
    # Mass may also fill an enclosed void inside the masonry (a duct), which is
    # why it is checked against "not floor rather than against "is wall".
    for tile in material["mass"]:
        if (int(tile[0]), int(tile[1])) in floor:
            errors.append(f"mass at {tile[0]},{tile[1]} covers walkable floor")
            break
    # Every frame named in the document must resolve in the atlas the runtime
    # will load, or the adapter would silently draw nothing.
    for role in ("vault_b1", "vault_b2", "vault_b3", "vault_b4", "vault_b5",
                 "floor", "water", "water_edge", "shadow", "weather",
                 "mass", "wall_face"):
        for tile in material[role]:
            if tile[4] not in tile_frame_all():
                errors.append(f"{role} names an unknown atlas frame '{tile[4]}'")
                break
    return errors, {"floor_painted": len(painted), "floor_authored": len(floor)}


# ---------------------------------------------------------------- material ---

def build_material(level) -> tuple[dict, dict]:
    """Paint the archive's stone over Candidate A's grey 0x72 tileset.

    Every layer is a prototype-local TileMapLayer composited over the level's own
    layers, so the level document, its TileSet sources and its collision are
    untouched. Frames are chosen from Candidate B's approved atlas; `damp`,
    `moss`, `wear`, `drip` and `wall_shadow` are DECALS (near-transparent), so
    they go on their own overlay layers instead of being used as base tiles.
    """
    backdrop = cells(level["layers"]["Backdrop"])
    geometry = cells(level["layers"]["Geometry"])
    floor = backdrop - geometry

    garth = set()
    for y in range(GARTH[1], GARTH[3] + 1):
        for x in range(GARTH[0], GARTH[2] + 1):
            if (x, y) not in floor and (x, y) not in geometry:
                garth.add((x, y))

    wear = set()
    for x0, y0, x1, y1 in WEAR_RECTS:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                wear.add((x, y))

    def near_garth(x, y):
        return any((x + dx, y + dy) in garth
                   for dx in (-1, 0, 1) for dy in (-1, 0, 1))

    # ---- floor: opaque flagstone only -------------------------------------
    floor_tiles = []
    weather = []
    for (x, y) in sorted(floor, key=lambda p: (p[1], p[0])):
        if near_garth(x, y):
            frame = "floor_flag_1"
            weather.append([x, y, "damp"])
        elif (x, y) in wear:
            frame = "floor_flag_1" if hashed(x, y, 3) % 5 else "floor_flag_worn"
            if hashed(x, y, 31) % 3 == 0:
                weather.append([x, y, "wear"])
        elif hashed(x, y, 5) % 41 == 0:
            frame = "floor_grate"
        else:
            frame = "floor_flag_2" if hashed(x, y, 3) % 3 else "floor_flag_1"
            if hashed(x, y, 7) % 17 == 0:
                weather.append([x, y, "moss"])
        floor_tiles.append([x, y, frame])

    # ---- the cloister garth: deep water with a dressed shoreline -----------
    water_tiles = [[x, y, "water_deep"] for (x, y) in garth]
    water_edge = []
    for (x, y) in sorted(garth, key=lambda p: (p[1], p[0])):
        north = (x, y - 1) in garth
        south = (x, y + 1) in garth
        west = (x - 1, y) in garth
        east = (x + 1, y) in garth
        if north and south and west and east:
            continue
        if not north and not west:
            frame = "water_nw"
        elif not north and not east:
            frame = "water_ne"
        elif not south and not west:
            frame = "water_sw"
        elif not south and not east:
            frame = "water_se"
        elif not north:
            frame = "water_n"
        elif not south:
            frame = "water_s"
        elif not west:
            frame = "water_w"
        else:
            frame = "water_e"
        water_edge.append([x, y, frame])

    # ---- wall faces: two courses of ashlar where a wall meets a floor ------
    face_tiles = []
    alcove_left = (ALCOVE[0] - 1, ALCOVE[1])
    alcove_right = (ALCOVE[2] + 1, ALCOVE[1])
    for (x, y) in sorted(geometry, key=lambda p: (p[1], p[0])):
        if (x, y) == alcove_left:
            frame = "face_left_end"
        elif (x, y) == alcove_right:
            frame = "face_right_end"
        elif (x, y + 1) in floor:
            # The course that meets the floor is a plinth: a continuous dado
            # line along every wall is what stops long walls reading as planks.
            frame = "face_dado" if hashed(x, y, 37) % 5 else "face_a"
        elif (x, y + 2) in floor:
            frame = "face_b" if hashed(x, y, 11) % 4 else "face_broken_a"
        elif (x - 1, y) in floor or (x + 1, y) in floor:
            frame = "face_a" if hashed(x, y, 13) % 4 else "face_broken_b"
        else:
            continue
        face_tiles.append([x, y, frame])

    face_cells = {(t[0], t[1]) for t in face_tiles}
    mass_tiles = []
    for (x, y) in sorted(geometry, key=lambda p: (p[1], p[0])):
        if (x, y) in face_cells:
            continue
        # The wall MASS reads as the same stone as the floor, unlit - not a
        # second material. Candidate A's grey hatch is what Gate 1 was judged on.
        mass_tiles.append([x, y, "floor_flag_worn" if (x + y) % 3 else "floor_flag_0"])

    # ---- contact shadow, and weather that hangs off the parapets ----------
    shadow_tiles = []
    for (x, y) in sorted(floor, key=lambda p: (p[1], p[0])):
        if (x, y - 1) in geometry:
            shadow_tiles.append([x, y, "wall_shadow"])
    for (x, y) in sorted(garth, key=lambda p: (p[1], p[0])):
        if (x, y - 1) not in garth:
            shadow_tiles.append([x, y, "wall_shadow"])

    # ---- the vault: void cells graded into darkness by distance -----------
    distance = {}
    queue = deque()
    for p in floor:
        distance[p] = 0
        queue.append(p)
    for p in geometry:
        distance.setdefault(p, 0)
        queue.append(p)
    while queue:
        cx, cy = queue.popleft()
        d = distance[(cx, cy)] + 1
        if d > 26:
            continue
        for step in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            pos = (cx + step[0], cy + step[1])
            if pos in distance or not inside(VAULT_BOX, pos[0], pos[1]):
                continue
            distance[pos] = d
            queue.append(pos)

    # A void that the building completely surrounds is not open air - it is a
    # duct inside the masonry, so it gets the mass tone and reads as solid. Only
    # voids you could walk out of become rock face falling into darkness.
    void = {(x, y) for y in range(VAULT_BOX[1], VAULT_BOX[3] + 1)
            for x in range(VAULT_BOX[0], VAULT_BOX[2] + 1)}
    void -= floor
    void -= geometry
    void -= garth
    open_void = set()
    edge = [p for p in void
            if p[0] in (VAULT_BOX[0], VAULT_BOX[2]) or p[1] in (VAULT_BOX[1], VAULT_BOX[3])]
    queue2 = deque(edge)
    open_void.update(edge)
    while queue2:
        cx, cy = queue2.popleft()
        for step in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            pos = (cx + step[0], cy + step[1])
            if pos in void and pos not in open_void:
                open_void.add(pos)
                queue2.append(pos)
    enclosed = void - open_void
    for (x, y) in sorted(enclosed, key=lambda p: (p[1], p[0])):
        mass_tiles.append([x, y, "floor_flag_worn" if (x + y) % 3 else "floor_flag_0"])

    bands = {name: [] for name in ("b1", "b2", "b3", "b4", "b5")}
    for (x, y) in sorted(open_void, key=lambda p: (p[1], p[0])):
        d = distance.get((x, y))
        if d is None or d > 20:
            band = "b5"
        elif d <= 4:
            band = "b1"
        elif d <= 8:
            band = "b2"
        elif d <= 12:
            band = "b3"
        elif d <= 16:
            band = "b4"
        else:
            band = "b5"
        bands[band].append([x, y, "floor_flag_worn" if hashed(x, y, 19) % 5
                            else "floor_flag_0"])

    def packed(tiles):
        out = []
        for x, y, name in tiles:
            f = tile_frame(name)
            out.append([x, y, f[0] // TILE, f[1] // TILE, name])
        return out

    return {
        "atlas": TILES_ATLAS,
        "tile": TILE,
        "vault_b1": packed(bands["b1"]),
        "vault_b2": packed(bands["b2"]),
        "vault_b3": packed(bands["b3"]),
        "vault_b4": packed(bands["b4"]),
        "vault_b5": packed(bands["b5"]),
        "floor": packed(floor_tiles),
        "water": packed(water_tiles),
        "water_edge": packed(water_edge),
        "shadow": packed(shadow_tiles),
        "weather": packed(weather),
        "mass": packed(mass_tiles),
        "wall_face": packed(face_tiles),
        # Draw order and tint for every material layer, so the runtime adapter
        # and the offline preview cannot drift apart.
        "layer_style": {
            # The rock the level is cut into: the same tone as the wall mass at
            # the level's edge, falling away to near-black at 20+ cells, so the
            # building reads as embedded in stone rather than standing on it.
            "vault_b5": {"z": -17, "modulate": [0.09, 0.08, 0.09, 1.0]},
            "vault_b4": {"z": -16, "modulate": [0.16, 0.14, 0.15, 1.0]},
            "vault_b3": {"z": -15, "modulate": [0.25, 0.21, 0.22, 1.0]},
            "vault_b2": {"z": -14, "modulate": [0.36, 0.31, 0.31, 1.0]},
            "vault_b1": {"z": -13, "modulate": [0.50, 0.43, 0.42, 1.0]},
            "floor": {"z": -8, "modulate": [1.42, 1.35, 1.26, 1.0]},
            # Water is the one cool note in a warm room, and the cloister is the
            # level's light source, so it is lifted well clear of the stone.
            "water": {"z": -7, "modulate": [1.05, 1.18, 1.32, 1.0]},
            "water_edge": {"z": -6, "modulate": [1.0, 1.12, 1.24, 1.0]},
            "shadow": {"z": -6, "modulate": [0.86, 0.82, 0.84, 1.0]},
            "weather": {"z": -5, "modulate": [1.0, 1.0, 1.0, 1.0]},
            "mass": {"z": 0, "modulate": [0.58, 0.52, 0.50, 1.0]},
            "wall_face": {"z": 1, "modulate": [1.30, 1.26, 1.22, 1.0]},
        },
        "garth": [[x, y] for (x, y) in sorted(garth, key=lambda p: (p[1], p[0]))],
    }, {"garth": len(garth), "vault": sum(len(b) for b in bands.values()),
        "mass": len(mass_tiles), "shadow": len(shadow_tiles),
        "weather": len(weather), "water_edge": len(water_edge),
        "floor_tiles": len(floor_tiles), "water_tiles": len(water_tiles),
        "face_tiles": len(face_tiles)}


def build_art(level) -> tuple[dict, dict]:
    material, counts = build_material(level)
    props = place(level, PLACEMENTS)
    lights = []
    for entry in LIGHTS:
        x, base_y = cell_rect(entry["cell"], entry["row"])
        lights.append({
            "x": round(x, 3),
            "y": round(base_y - TILE / 2.0, 3),
            "energy": entry["energy"],
            "scale": entry["scale"],
            "colour": entry["colour"],
            "intent": entry["intent"],
        })
    art = {
        "version": 2,
        "target_level": "res://data/levels/chapter_1_level_3.json",
        "source_level": "res://prototypes/gate2/level_data/chapter_1_level_3_gate2.json",
        "atlas": PROPS_ATLAS,
        "light_texture": LIGHT_TEXTURE,
        "modulate": [0.90, 0.87, 0.86, 1.0],
        "collision_layer": SOLID_LAYER,
        "collider_width_ratio": COLLIDER_RATIO,
        "collider_height": COLLIDER_H,
        "material": material,
        # Candidate A's own Decor tiles are the only cool-toned art left in the
        # room (purple grates, blue vessels) and they read as a second palette
        # pinned to a warm wall. A warm multiply on that ONE level layer pulls
        # them onto the archive's palette without touching a single file.
        "level_layer_tint": {"Decor": [1.15, 1.02, 0.86]},
        "lights": lights,
        "props": props,
    }
    return art, counts


# -------------------------------------------------------------------- main ---

def run():
    if sha256(BASE) != BASE_SHA:
        raise SystemExit("Candidate A's pinned Level 3 fixture changed; refusing to author")
    base = load(BASE)
    level = copy.deepcopy(base)
    carved = carve_alcove(level)

    errors, stats = validate_level(base, level, carved)
    art, counts = build_art(level)
    errors += validate_props(level, art["props"])
    material_errors, material_stats = validate_material(level, art)
    errors += material_errors
    route_errors, route_stats = validate_routes(level, art["props"])
    errors += route_errors
    if errors:
        for error in errors:
            print("  ERROR " + error)
        raise SystemExit(f"GATE2 DESIGN INVALID ({len(errors)} problems)")

    stats.update(counts)
    stats.update(material_stats)
    stats.update(route_stats)
    stats.update({
        "props": len(art["props"]),
        "solids": sum(1 for p in art["props"] if p["solid"]),
        "entities": len(level["entities"]),
        "Backdrop": len(level["layers"]["Backdrop"]),
        "Geometry": len(level["layers"]["Geometry"]),
        "Decor": len(level["layers"]["Decor"]),
    })
    return level, art, stats


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--stats", action="store_true")
    args = parser.parse_args()
    level, art, stats = run()

    if args.stats:
        print(json.dumps(stats, indent=2, sort_keys=True))
        return 0

    for path, document in ((OUT_LEVEL, level), (OUT_ART, art)):
        text = json.dumps(document, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != text:
                print(f"CHECK FAILED: {path.relative_to(ROOT)} is stale")
                return 1
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")

    print("GATE2 DESIGN PASSED " + json.dumps(stats, sort_keys=True))
    if not args.check:
        for path, _ in ((OUT_LEVEL, level), (OUT_ART, art)):
            print(f"  wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
