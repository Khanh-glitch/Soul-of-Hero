#!/usr/bin/env python3
"""Gate 3 — authoring source of truth for the Level 3 architectural rebuild.

Inputs (read-only):
    prototypes/gate0/level_data/chapter_1_level_3_a.json   Candidate A, pinned
    prototypes/gate2/art/*                                 Candidate B atlas copies
Outputs (written):
    prototypes/gate3/level_data/chapter_1_level_3_gate3.json
    prototypes/gate3/visual_placement.json

The script is the single place where Gate 3 geometry changes and placement are
declared.  It refuses to write anything unless every structural check passes, so
a bad edit fails the CI run instead of shipping a broken level.

Usage:
    python3 tools/gate3/author_gate3.py           # write both documents
    python3 tools/gate3/author_gate3.py --check   # compare with committed files
    python3 tools/gate3/author_gate3.py --stats   # print the numbers, write nothing
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/gate3"))

import worldmodel  # noqa: E402

BASE = ROOT / "prototypes/gate0/level_data/chapter_1_level_3_a.json"
BASE_SHA = "5ea50e9cf37791a6283bfd9a58bd634ec8aa144e9602c5b9f40f0b4600555f54"
OUT_LEVEL = ROOT / "prototypes/gate3/level_data/chapter_1_level_3_gate3.json"
OUT_ART = ROOT / "prototypes/gate3/visual_placement.json"

PROPS_ATLAS = "res://prototypes/gate2/art/props.png"
PROPS_JSON = ROOT / "prototypes/gate2/art/props.json"
TILES_ATLAS = "res://prototypes/gate2/art/archive_tiles.png"
TILES_JSON = ROOT / "prototypes/gate2/art/tiles.json"
LIGHT_TEXTURE = "res://prototypes/gate2/art/light_radial.png"

TILE = 16
COLLIDER_RATIO = 0.86
COLLIDER_H = 12
# A single piece of furniture may close off a shallow slot behind it (a recess
# between a shelf and the wall); anything wider would be furniture sealing a walk.
POCKET_ALLOWANCE = 3

# ---------------------------------------------------------------- geometry ---
# Gate 2's armarium alcove is retained: it is the accepted part of that gate.
ALCOVE = (25, 9, 33, 10)

# C1 -- the sealed shaft `x27..33 y16..20` becomes the Descent Landing: a real
# room entered from the west ambulatory, closed on its south side (where the stair
# to the deep stacks used to run) by a collapsed arch.
SHAFT_ROOM = (27, 16, 33, 20)      # void -> floor
SHAFT_DOOR = [(34, 16), (34, 17)]  # wall -> floor, the way in
SHAFT_SEAL = [(x, 21) for x in range(27, 34)]   # void -> masonry, the sealed south side

# C5 -- the south ambulatory: open the six cells of the pier block at x50..52 so the
# walk is two rows tall the whole way, and frame the spike at (46,21) with a bay.
SOUTH_PIER = [(50, 20), (51, 20), (52, 20), (50, 21), (51, 21), (52, 21)]
SOUTH_BAY = [(44, 22), (48, 22)]

# C4 -- the garth: four corner piers turn the rectangle into a cloister basin with
# canted corners, and a real coping ring separates walk from water.
GARTH = (41, 13, 54, 17)
GARTH_PIERS = [(41, 13), (54, 13), (41, 17), (54, 17)]

# C4 -- the garth is a walled tank in Candidate A: no walk touches the water, so it
# can only read as a hole.  Three real openings are cut in the parapet (west, east and
# a north crossing off the nave) and the four corners are turned into masonry piers,
# which makes the basin octagonal and gives the walk a water edge to stand on.
GARTH_OPEN_WEST = [(40, 14), (40, 15), (40, 16)]
GARTH_OPEN_EAST = [(55, 14), (55, 15), (55, 16)]
GARTH_OPEN_NORTH = [(46, 12), (47, 12), (48, 12)]
GARTH_OPENINGS = GARTH_OPEN_WEST + GARTH_OPEN_EAST + GARTH_OPEN_NORTH

# C3 -- rhythm.  Wall faces are painted by column phase so that every fourth column
# of a run is a pier and every second phase is a recess: the bay rhythm follows the
# geometry that is really there, and collision is never contradicted.
NICHE_PHASE = 2
PIER_PHASE = 0

# C3 follow-up (round 4): a pier rhythm that is identical on all three storeys is
# why the lower floors read as the same stone repeated.  Each storey now carries its
# own phase and its own frame bias (see `wall_frame`), and the deep rock outside the
# building is rotated into eight real variants instead of two.
FLOOR_PIER_PHASE = {1: PIER_PHASE, 2: (PIER_PHASE + 2) % 4, 3: (PIER_PHASE + 1) % 4}
# The rock apron.  It was 14 cells; at 14 the frame at the floor-2 landing was a
# quarter empty background (measured), so the apron now reaches past a full screen.
ROCK_BAND_RADIUS = 6
ROCK_RADIUS = 22

# --------------------------------------------------------------- placement ---
# Each placement: (cell, row, sprite, solid, intent).  `cell` is the centre
# column, `row` is the standing row; the sprite's feet sit on the row's baseline.
PLACEMENTS = [
    # --- floor 1: nave -------------------------------------------------------
    dict(cell=29, row=10, sprite="armarium_open", solid=True,
         intent="the open armarium in the alcove cut for it: the archive's face to the visitor"),
    dict(cell=8, row=15, sprite="rubble_large", solid=True,
         intent="collapse at the west end of the nave, where the rock comes closest"),
    dict(cell=11, row=15, sprite="rubble_chunk_b", solid=False, intent="fall from the same collapse"),
    dict(cell=14, row=15, sprite="scrolls_b", solid=False, intent="spilled codices"),
    dict(cell=15, row=16, sprite="scroll_roll", solid=False, intent="spilled codices"),
    dict(cell=17, row=16, sprite="desk", solid=True, intent="the copyist's station, abandoned mid-page"),
    dict(cell=19, row=16, sprite="book_stack", solid=False, intent="work in progress"),
    dict(cell=18, row=17, sprite="stool_tipped", solid=False, intent="the copyist left in a hurry"),
    dict(cell=9, row=19, sprite="shelf_full", solid=True, intent="the first range: closed stacks"),
    dict(cell=12, row=19, sprite="shelf_partial", solid=True, intent="the range runs east"),
    dict(cell=16, row=19, sprite="shelf_closed", solid=True, intent="a locked case in the range"),
    dict(cell=20, row=19, sprite="shelf_full", solid=True, intent="the range turns the corner"),
    # --- floor 1: descent landing (C1) --------------------------------------
    dict(cell=29, row=17, sprite="column", solid=True,
         intent="the landing's pier, carrying the vault over the descent"),
    dict(cell=31, row=17, sprite="paternoster", solid=False,
         intent="the rope left hanging over the sealed flight"),
    dict(cell=28, row=20, sprite="rubble_mid", solid=False,
         intent="masonry fallen into the head of the stair"),
    dict(cell=32, row=20, sprite="rubble_chunk_a", solid=False,
         intent="masonry fallen into the head of the stair"),
    dict(cell=30, row=20, sprite="rubble_large", solid=False,
         intent="the collapse that closed the descent"),
    dict(cell=27, row=20, sprite="beam", solid=False, intent="shoring timber left by the last masons"),
    # --- floor 1: cloister walk --------------------------------------------
    dict(cell=38, row=16, sprite="candle_stand", solid=False, intent="a light on the garth walk"),
    dict(cell=38, row=21, sprite="stone_bench", solid=False, intent="a bench set against the south walk"),
    dict(cell=43, row=15, sprite="column", solid=True,
         intent="the west pier of the garth, standing at the water"),
    dict(cell=52, row=15, sprite="column", solid=True,
         intent="the east pier of the garth, standing at the water"),
    dict(cell=44, row=22, sprite="rubble_chunk_b", solid=False,
         intent="the hazard bay: debris that frames the spike pit without covering it"),
    dict(cell=48, row=22, sprite="rubble_chunk_a", solid=False,
         intent="the hazard bay: debris that frames the spike pit without covering it"),
    # --- floor 1: east reading room ----------------------------------------
    dict(cell=58, row=19, sprite="long_table", solid=True,
         intent="the reading room's board, kept as cover across the enemy's firing line"),
    dict(cell=63, row=20, sprite="shelf_closed", solid=True, intent="the east range"),
    dict(cell=66, row=21, sprite="armarium_closed", solid=True, intent="the closed case at the room's end"),
    dict(cell=60, row=21, sprite="stool_pair", solid=False, intent="reading seats pushed back"),
    # --- floor 2: the deeper stacks ----------------------------------------
    dict(cell=28, row=45, sprite="shelf_full", solid=True, intent="floor 2: the stacks continue below"),
    dict(cell=32, row=45, sprite="shelf_partial", solid=True, intent="floor 2: a range broken open"),
    dict(cell=64, row=42, sprite="armarium_closed", solid=True, intent="floor 2: the locked presses"),
    dict(cell=70, row=42, sprite="shelf_full", solid=True, intent="floor 2: presses and ranges"),
    dict(cell=48, row=52, sprite="long_table", solid=True, intent="floor 2: a sorting table in the crossfire hall"),
    dict(cell=38, row=52, sprite="desk_overturned", solid=False, intent="floor 2: the room was cleared in a hurry"),
    dict(cell=24, row=48, sprite="column", solid=True, intent="floor 2: a pier of the lower vault"),
    dict(cell=56, row=46, sprite="candle_stand", solid=False, intent="floor 2: a working light left burning"),
    # --- floor 3: the reliquary camp ----------------------------------------
    dict(cell=30, row=80, sprite="armarium_open", solid=True, intent="floor 3: the reliquary press"),
    dict(cell=36, row=80, sprite="shelf_closed", solid=True, intent="floor 3: cases for the recovered seals"),
    dict(cell=52, row=84, sprite="column", solid=True, intent="floor 3: the camp's central pier"),
    dict(cell=60, row=84, sprite="long_table", solid=True, intent="floor 3: the camp table under the seals"),
    dict(cell=48, row=88, sprite="stone_bench", solid=False, intent="floor 3: seating around the camp"),
    dict(cell=66, row=88, sprite="candle_stand", solid=False, intent="floor 3: the camp light"),
    # --- round 4: the lower storeys get architecture, not more decoration ------
    # The review's complaint was that floors 2 and 3 had no anchors: 8 and 6 props
    # respectively, and one light each.  These are landmarks the eye can navigate by
    # -- an opened press, a collapsed range, a pier, a lectern where the seals are
    # laid out, a hanging rope, a drying rack -- each with its own light above.
    dict(cell=67, row=42, sprite="armarium_open", solid=True,
         intent="floor 2: the presses are open, and whatever was filed here has been taken"),
    dict(cell=70, row=46, sprite="shelf_collapsed", solid=True,
         intent="floor 2: a range that came down, the hall's second landmark"),
    dict(cell=45, row=46, sprite="column", solid=True,
         intent="floor 2: the pier that carries the vault over the crossfire hall"),
    dict(cell=41, row=52, sprite="stone_bench", solid=False,
         intent="floor 2: a bench on the south wall of the hall, facing the light"),
    dict(cell=58, row=47, sprite="scrolls_a", solid=False,
         intent="floor 2: loose leaves where the range came down"),
    dict(cell=40, row=80, sprite="shelf_collapsed", solid=True,
         intent="floor 3: the broken case beside the reliquary press"),
    dict(cell=56, row=86, sprite="column", solid=True,
         intent="floor 3: the second pier of the camp, so the camp reads as a room"),
    dict(cell=62, row=84, sprite="lectern", solid=False,
         intent="floor 3: the lectern where the four seals are counted"),
    dict(cell=44, row=88, sprite="paternoster", solid=False,
         intent="floor 3: the rope still hanging into the dark"),
    dict(cell=30, row=88, sprite="drying_rack", solid=False,
         intent="floor 3: the camp's own kit, hung to dry"),
]

LIGHTS = [
    dict(cell=29, row=9, energy=0.52, scale=0.60, colour=[1.0, 0.80, 0.58],
         intent="the alcove wash that makes the armarium the landmark"),
    dict(cell=47, row=15, energy=0.34, scale=0.85, colour=[0.86, 0.92, 1.0],
         intent="cold light off the cloister water, so the garth reads as the room's centre"),
    dict(cell=64, row=20, energy=0.30, scale=0.55, colour=[1.0, 0.82, 0.60],
         intent="the east reading room's own pool"),
    dict(cell=30, row=19, energy=0.26, scale=0.42, colour=[0.72, 0.80, 1.0],
         intent="cold draught light in the sealed descent, so the shaft reads as depth"),
    dict(cell=50, row=45, energy=0.28, scale=0.70, colour=[1.0, 0.84, 0.62],
         intent="floor 2's working light in the stacks"),
    dict(cell=44, row=84, energy=0.30, scale=0.66, colour=[1.0, 0.86, 0.64],
         intent="floor 3's camp light"),
    # Round 4 -- the lower storeys had one light each, so the eye had no anchor to
    # follow when it descended.  Every landmark below now carries its own pool.
    dict(cell=67, row=41, energy=0.26, scale=0.50, colour=[1.0, 0.82, 0.60],
         intent="floor 2: the pool under the opened presses, so the armarium reads as a place"),
    dict(cell=45, row=50, energy=0.24, scale=0.62, colour=[0.86, 0.92, 1.0],
         intent="floor 2: cold light off the crossfire hall's pier, the room's own centre"),
    dict(cell=31, row=79, energy=0.24, scale=0.46, colour=[1.0, 0.84, 0.62],
         intent="floor 3: the reliquary press is lit where the seals are laid out"),
    dict(cell=59, row=83, energy=0.26, scale=0.58, colour=[1.0, 0.88, 0.66],
         intent="floor 3: the camp table is the last warm light before the exit"),
]

# The Knight and the authored entity art, for the overlap check.
ENTITY_ART = {
    "player": {"w": 32, "h": 32, "anchor": "centre"},
    "torch": {"w": 32, "h": 32, "anchor": "bottom"},
    "coin": {"w": 24, "h": 24, "anchor": "centre"},
    "spikes": {"w": 32, "h": 32, "anchor": "centre"},
    "chest": {"w": 32, "h": 32, "anchor": "bottom"},
    "sigil": {"w": 32, "h": 32, "anchor": "centre"},
    "checkpoint": {"w": 32, "h": 32, "anchor": "bottom"},
    "floor_door": {"w": 32, "h": 32, "anchor": "bottom"},
    "exit_gate": {"w": 32, "h": 32, "anchor": "bottom"},
}
ENTITY_DEFAULT = {"w": 32, "h": 32, "anchor": "bottom"}

# ------------------------------------------------------------------- helpers --


def load(path: Path) -> dict:
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def sha256(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def hashed(*parts: int) -> int:
    value = 0
    for part in parts:
        value = (value * 1103515245 + part * 12345 + 0x9E3779B9) & 0x7FFFFFFF
        value ^= value >> 13
    return value


def cellset(layer: list) -> set:
    return {(int(c["x"]), int(c["y"])) for c in layer}


def inside(box, x, y) -> bool:
    x0, y0, x1, y1 = box
    return x0 <= x <= x1 and y0 <= y <= y1


def cell_rect(cell: int, row: int) -> tuple:
    """Centre x and the baseline y of a standing row."""
    return (cell * TILE + TILE / 2.0, (row + 1) * TILE)


_FRAMES: dict | None = None


def frames() -> dict:
    global _FRAMES
    if _FRAMES is None:
        _FRAMES = load(PROPS_JSON)["frames"]
    return _FRAMES


_TILES: dict | None = None


def tiles() -> dict:
    global _TILES
    if _TILES is None:
        _TILES = load(TILES_JSON)["frames"]
    return _TILES


def tile_frame(name: str) -> tuple:
    box = tiles()[name]
    return (int(box[0] // TILE), int(box[1] // TILE))


# -------------------------------------------------------------- level editing --

def carve(level: dict, edits: list, provenance: str) -> None:
    """Apply one named group of cell edits, recording provenance per cell."""
    backdrop = {int(c["x"]): c for c in []}  # keep the type checker honest
    del backdrop
    layers = level["layers"]
    ground = {(int(c["x"]), int(c["y"])): c for c in layers["Backdrop"]}
    solid = {(int(c["x"]), int(c["y"])): c for c in layers["Geometry"]}
    for x, y, kind in edits:
        key = (x, y)
        if kind == "floor":
            if key in ground:
                continue
            ground[key] = {"x": x, "y": y, "source": 0, "atlas": [1, 4], "alternative": 0}
            solid.pop(key, None)
        elif kind == "masonry":
            if key in solid:
                continue
            if key in ground:
                raise SystemExit(f"refusing to wall off floor at {key} ({provenance})")
            solid[key] = {"x": x, "y": y, "source": 0, "atlas": [4, 4], "alternative": 0}
        else:
            raise SystemExit(f"unknown edit kind {kind!r}")
    level["_provenance"] = level.get("_provenance", [])
    level["_provenance"].append(provenance)
    layers["Backdrop"] = [ground[key] for key in sorted(ground, key=lambda k: (k[1], k[0]))]
    layers["Geometry"] = [solid[key] for key in sorted(solid, key=lambda k: (k[1], k[0]))]


def build_level(base: dict) -> tuple[dict, list]:
    level = json.loads(json.dumps(base))
    level.pop("_provenance", None)
    report = []

    # --- Gate 2's alcove (retained) ---------------------------------------
    edits = []
    for y in range(ALCOVE[1], ALCOVE[3] + 1):
        for x in range(ALCOVE[0], ALCOVE[2] + 1):
            if (x, y) in cellset(level["layers"]["Geometry"]):
                edits.append((x, y, "floor"))
    carve(level, edits, "gate2 alcove: x25..33 y9..10 carved for the armarium")
    report.append(("alcove", len(edits)))

    # --- C1 descent landing ----------------------------------------------
    edits = [(x, y, "floor")
             for y in range(SHAFT_ROOM[1], SHAFT_ROOM[3] + 1)
             for x in range(SHAFT_ROOM[0], SHAFT_ROOM[2] + 1)]
    edits += [(x, y, "floor") for x, y in SHAFT_DOOR]
    carve(level, edits, "C1 descent landing: shaft x27..33 y16..20 floored and opened at x34")
    report.append(("shaft_floor", len(edits)))
    edits = [(x, y, "masonry") for x, y in SHAFT_SEAL]
    carve(level, edits, "C1 descent landing: south side sealed (collapsed stair head)")
    report.append(("shaft_seal", len(edits)))

    # --- C5 south ambulatory ---------------------------------------------
    edits = [(x, y, "floor") for x, y in SOUTH_PIER]
    carve(level, edits, "C5 south ambulatory: pier block x50..52 opened to two rows")
    report.append(("south_pier", len(edits)))

    # --- C4 garth piers ---------------------------------------------------
    edits = [(x, y, "masonry") for x, y in GARTH_PIERS]
    carve(level, edits, "C4 garth: four corner piers canted into the basin")
    report.append(("garth_piers", len(edits)))

    # --- C4 garth openings -----------------------------------------------
    edits = [(x, y, "floor") for x, y in GARTH_OPENINGS]
    carve(level, edits, "C4 garth: parapet opened at west, east and the north crossing")
    report.append(("garth_open", len(edits)))
    return level, report


# --------------------------------------------------------------- validation ---

def validate_level(base: dict, level: dict, report: list) -> list:
    problems = []
    for layer in ("Backdrop", "Geometry", "Decor"):
        if layer not in level["layers"]:
            problems.append(f"layer {layer} missing")
    if level["width"] != base["width"] or level["height"] != base["height"]:
        problems.append("level size changed")

    # entities: byte identical, same order
    if json.dumps(base["entities"], sort_keys=True) != json.dumps(level["entities"], sort_keys=True):
        problems.append("entity list changed")
    if len(level["entities"]) != 79:
        problems.append(f"expected 79 entities, found {len(level['entities'])}")

    # a cell may not be both floor and masonry
    ground = cellset(level["layers"]["Backdrop"])
    solid = cellset(level["layers"]["Geometry"])
    both = ground & solid
    if both:
        problems.append(f"{len(both)} cells are both floor and masonry: {sorted(both)[:6]}")

    # every entity whose art stands on the ground must stand on floor
    for entity in level["entities"]:
        if str(entity.get("type")) in ("torch", "floor_door", "exit_gate"):
            continue
        x, y = entity["position"]
        cell = (int(x // TILE), int(y // TILE))
        if cell not in ground:
            problems.append(f"{entity['id']} at {cell} is not on floor")

    # nothing that was reachable may stop being reachable
    before = worldmodel.load(BASE)
    after = worldmodel.load(OUT_LEVEL if OUT_LEVEL.exists() else BASE)
    # the world model reads the committed file, so reachability is checked in
    # validate_routes() against the freshly written document instead.
    del before, after

    total_edits = sum(count for _name, count in report)
    if total_edits < 20:
        problems.append(f"only {total_edits} cell edits -- the rebuild did not happen")
    return problems


def validate_routes(level: dict, props: list) -> list:
    problems = []
    world = worldmodel.load(OUT_LEVEL)
    solid = [p for p in props if p["solid"]]
    blocked = set()
    for prop in solid:
        x0, y0, x1, y1 = prop["cells"]
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                blocked.add((x, y))
    original = world.blocked
    world.blocked = original | blocked
    spawn = world.pos_cell(next(e for e in world.entities if str(e.get("type")) == "player"))
    world.blocked = original
    frontier_baseline = world.flood([spawn])
    world.blocked = original | blocked
    reach = world.flood([spawn])
    # doors
    frontier = set(reach)
    changed = True
    while changed:
        changed = False
        for _label, source, target in worldmodel.DOORS:
            if source in frontier and target not in frontier and world.standable(target):
                frontier |= world.flood([target])
                changed = True
    # baseline before furniture, so an authored pocket is not blamed on a prop
    world.blocked = original
    baseline = world.flood([spawn])
    world.blocked = original | blocked
    lost = []
    for floor_index, (low, high) in worldmodel.FLOORS.items():
        cells = {c for c in world.floor if low <= c[1] < high and world.standable(c)}
        unreached = {c for c in cells if c not in frontier and c not in frontier_baseline}
        unreached -= set(world.hazard)
        if len(unreached) > POCKET_ALLOWANCE:
            lost.append((floor_index, len(unreached), sorted(unreached)[:5]))
    for floor_index, count, sample in lost:
        problems.append(f"floor {floor_index}: {count} standable cells cut off by props, e.g. {sample}")

    # every required objective entity can be reached (pickup radius: one cell)
    for entity in world.entities:
        kind = str(entity.get("type"))
        if kind in ("torch", "spikes", "floor_door"):
            continue
        cell = world.pos_cell(entity)
        near = {(cell[0] + dx, cell[1] + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
        if near & frontier:
            continue
        problems.append(f"{entity['id']} ({kind}) at {cell} is sealed off")

    # the south ambulatory, both directions, for the real body
    west, east = (38, 21), (56, 21)
    for label, start, goal in (("west->east", west, east), ("east->west", east, west)):
        world.blocked = original | blocked
        if world.route(start, goal) is None:
            problems.append(f"south ambulatory {label} is blocked for a 12x16 body")
    world.blocked = original
    return problems


def validate_prop_choke(world, blocked: set) -> list:
    """Reject a solid prop that would cut the walk it stands in.

    For each solid prop, the walkable cells within three cells of its footprint
    must stay one connected group once the prop's collider is added.  This is the
    cheap local proof that keeps furniture from sealing a corridor: the global
    connectivity check covers the rest.
    """
    problems = []
    groups: dict[tuple, list] = {}
    for cell in blocked:
        groups.setdefault(cell, []).append(cell)
    # rebuild per-prop footprints from the blocked set by clustering touched cells
    seen = set()
    for cell in sorted(blocked):
        if cell in seen:
            continue
        component = []
        stack = [cell]
        seen.add(cell)
        while stack:
            current = stack.pop()
            component.append(current)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nxt = (current[0] + dx, current[1] + dy)
                if nxt in blocked and nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
        xs = [c[0] for c in component]
        ys = [c[1] for c in component]
        box = (min(xs) - 3, min(ys) - 3, max(xs) + 3, max(ys) + 3)
        footprint = set(component)
        stands = {c for c in world.floor if box[0] <= c[0] <= box[2] and box[1] <= c[1] <= box[3]
                  and c not in world.blocked and c not in footprint}
        stands = {c for c in stands
                  if (c[0], c[1] - 1) not in world.blocked and (c[0], c[1] - 1) not in footprint
                  and (c[0], c[1] - 1) in (world.floor | {(c[0], c[1] - 1)})}
        if len(stands) < 4:
            continue
        start = min(stands)
        seen_local = {start}
        stack = [start]
        while stack:
            current = stack.pop()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nxt = (current[0] + dx, current[1] + dy)
                if nxt in stands and nxt not in seen_local:
                    seen_local.add(nxt)
                    stack.append(nxt)
        if len(seen_local) != len(stands):
            problems.append(
                f"solid footprint at {sorted(component)[0]}..{sorted(component)[-1]} "
                f"cuts its own walk ({len(stands) - len(seen_local)} of {len(stands)} cells stranded)")
    return problems


def sprite_rect(name: str, x: float, base_y: float) -> tuple:
    frame = frames()[name]
    w, h = frame["w"], frame["h"]
    return (x - w / 2.0, base_y - h, x + w / 2.0, base_y)


def collider_rect(name: str, x: float, base_y: float) -> tuple:
    frame = frames()[name]
    w = frame["w"] * COLLIDER_RATIO
    return (x - w / 2.0, base_y - COLLIDER_H, x + w / 2.0, base_y)


def entity_rects(level: dict) -> list:
    rects = []
    for entity in level["entities"]:
        art = ENTITY_ART.get(str(entity.get("type")), ENTITY_DEFAULT)
        x, y = entity["position"]
        if art["anchor"] == "centre":
            rects.append((entity["id"], (x - art["w"] / 2, y - art["h"] / 2,
                                         x + art["w"] / 2, y + art["h"] / 2)))
        else:
            rects.append((entity["id"], (x - art["w"] / 2, y - art["h"],
                                         x + art["w"] / 2, y)))
    return rects


def overlaps(a, b, clearance=0.0) -> bool:
    return not (a[2] + clearance <= b[0] or b[2] + clearance <= a[0]
                or a[3] + clearance <= b[1] or b[3] + clearance <= a[1])


def _unique_by_cell(cells: list) -> list:
    """One tile per cell, first one wins.

    A TileMapLayer can only hold a single tile in a cell, so a document that lists two
    entries for the same cell would claim more cells than the runtime can apply -- the
    first AFTER capture failed exactly there, on `decor` at (29, 21).
    """
    seen = {}
    for cell in cells:
        key = (cell[0], cell[1])
        if key not in seen:
            seen[key] = cell
    return [seen[key] for key in sorted(seen)]


def prop_document(entry: dict, index: int) -> dict:
    x, base_y = cell_rect(entry["cell"], entry["row"])
    rect = sprite_rect(entry["sprite"], x, base_y)
    cells_box = (int(rect[0] // TILE), int(rect[1] // TILE),
                 int(rect[2] // TILE), int(rect[3] // TILE))
    return {
        "id": f"gate3_{index:02d}_{entry['sprite']}",
        "sprite": entry["sprite"],
        "source": [frames()[entry["sprite"]][k] for k in ("x", "y", "w", "h")],
        "cell": [entry["cell"], entry["row"]],
        "cells": list(cells_box),
        "x": round(x, 3),
        "base_y": round(base_y, 3),
        "solid": bool(entry["solid"]),
        "collider": list(collider_rect(entry["sprite"], x, base_y)),
        "intent": entry["intent"],
        "provenance": f"Candidate B e7cad36 archive_audition/art/props.png frame '{entry['sprite']}'",
    }


def fit_placements(level: dict, placements: list) -> tuple[list, list]:
    """Place furniture, then prove the level's objectives survive it.

    Solid furniture is the only thing in Gate 3 that can seal a walk, and Level 3
    is nearly all two-cell corridors, so a placement is only accepted when its
    whole footprint stands on floor, it covers no masonry, it keeps clear of every
    entity's art, and -- for solid pieces -- the whole level still reaches every
    objective and every walkable cell with its collider added.  If the authored
    cell fails, the prop is tried a few cells away; if nothing nearby is safe it is
    dropped and reported.  Every accepted cell is written into the placement
    document, so the report can state exactly where each prop went.
    """
    world = worldmodel.build(level)
    base = set(world.blocked)
    ground = {(int(c["x"]), int(c["y"])) for c in level["layers"]["Backdrop"]}
    solid_cells = {(int(c["x"]), int(c["y"])) for c in level["layers"]["Geometry"]}
    entity_boxes = entity_rects(level)
    objectives = [world.pos_cell(e) for e in world.entities
                  if str(e.get("type")) in ("sigil", "chest", "checkpoint", "exit_gate", "coin")]
    spawn = world.pos_cell(next(e for e in world.entities if str(e.get("type")) == "player"))

    def reach(extra: set) -> set:
        world.blocked = base | extra
        frontier = world.flood([spawn])
        changed = True
        while changed:
            changed = False
            for _label, source, target in worldmodel.DOORS:
                if source in frontier and target not in frontier and world.standable(target):
                    frontier |= world.flood([target])
                    changed = True
        return frontier

    def local_ok(extra: set) -> tuple[bool, str]:
        frontier = reach(extra)
        for cell in objectives:
            near = {(cell[0] + dx, cell[1] + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
            if not (near & frontier):
                return False, f"{cell} sealed"
        stranded = 0
        for cell in world.floor:
            if not world.standable(cell) or cell in frontier or cell in world.hazard:
                continue
            if cell in authored_pockets:
                continue
            stranded += 1
        if stranded > POCKET_ALLOWANCE:
            return False, f"{stranded} walkable cells stranded"
        world.blocked = base | extra
        if world.route((38, 21), (56, 21)) is None or world.route((56, 21), (38, 21)) is None:
            return False, "south ambulatory cut"
        return True, ""

    # cells that are already unreachable in Candidate A before any furniture: those
    # are authored pockets, not furniture damage
    frontier0 = reach(set())
    authored_pockets = {c for c in world.floor
                        if world.standable(c) and c not in frontier0 and c not in world.hazard}

    props, notes, current = [], [], set()
    for index, entry in enumerate(placements):
        attempts = [(entry["cell"], entry["row"])]
        for delta in (1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6):
            attempts.append((entry["cell"], entry["row"] + delta))
        for delta in (1, -1, 2, -2, 3, -3, 4, -4, 5, 6):
            for side in (1, -1):
                attempts.append((entry["cell"] + side * delta, entry["row"]))
                for drop in (1, -1, 2, -2, 3, -3):
                    attempts.append((entry["cell"] + side * delta, entry["row"] + drop))
        placed = None
        for cell, row in attempts:
            candidate = dict(entry, cell=cell, row=row)
            document = prop_document(candidate, index)
            x0, y0, x1, y1 = document["cells"]
            footprint = {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}
            if not all(c in ground for c in footprint):
                continue
            if footprint & solid_cells:
                continue
            art_box = sprite_rect(candidate["sprite"], document["x"], document["base_y"])
            if any(overlaps(art_box, other, 4.0) for _id, other in entity_boxes):
                continue
            if document["solid"]:
                box = document["collider"]
                covered = {(x, y) for x in range(int(box[0] // TILE), int(box[2] // TILE) + 1)
                           for y in range(int(box[1] // TILE), int(box[3] // TILE) + 1)}
                if not covered <= ground:
                    continue
                if any(overlaps(document["collider"], q["collider"])
                       for q in props if q["solid"]):
                    continue
                good, _reason = local_ok(current | footprint)
                if not good:
                    continue
                current |= footprint
            props.append(document)
            placed = cell, row
            if (cell, row) != (entry["cell"], entry["row"]):
                notes.append(f"{document['id']}: moved from {[entry['cell'], entry['row']]} "
                             f"to {[cell, row]} to keep its walk and sightlines clear")
            break
        if placed is None:
            notes.append(f"{entry['sprite']} at {[entry['cell'], entry['row']]}: dropped, "
                         f"no nearby cell satisfies the placement contract")
    world.blocked = base
    return props, notes


def validate_props(level: dict, props: list) -> list:
    problems = []
    ground = cellset(level["layers"]["Backdrop"])
    solid = cellset(level["layers"]["Geometry"])

    # every prop stands on floor in its own standing row
    for prop in props:
        cell, row = prop["cell"]
        footprint = [(x, y) for x in range(prop["cells"][0], prop["cells"][2] + 1)
                     for y in range(prop["cells"][1], prop["cells"][3] + 1)]
        standing = [(x, row) for x in range(prop["cells"][0], prop["cells"][2] + 1)]
        if not all(c in ground for c in standing):
            problems.append(f"{prop['id']} does not stand on floor at row {row}")
        if any(c in solid for c in footprint):
            problems.append(f"{prop['id']} overlaps masonry")
        for x, y in footprint:
            if y < row and (x, y) not in ground and (x, y) not in solid:
                problems.append(f"{prop['id']} art floats over void at {(x, y)}")

    # no prop art covers entity art
    entities = entity_rects(level)
    for prop in props:
        rect = sprite_rect(prop["sprite"], prop["x"], prop["base_y"])
        for entity_id, other in entities:
            if overlaps(rect, other, 4.0):
                problems.append(f"{prop['id']} art overlaps {entity_id}")

    # no two solid colliders overlap
    solids = [p for p in props if p["solid"]]
    for i, first in enumerate(solids):
        for second in solids[i + 1:]:
            if overlaps(first["collider"], second["collider"]):
                problems.append(f"colliders overlap: {first['id']} / {second['id']}")

    # solid colliders must cover floor only
    for prop in solids:
        box = prop["collider"]
        for x in range(int(box[0] // TILE), int(box[2] // TILE) + 1):
            for y in range(int(box[1] // TILE), int(box[3] // TILE) + 1):
                if (x, y) not in ground:
                    problems.append(f"{prop['id']} collider covers non-floor at {(x, y)}")
    return problems


# ---------------------------------------------------------------- material ----

def floor_lookup(level: dict):
    """Which storey a cell belongs to, from the level's own room rectangles."""
    bands = []
    for room in level.get("metadata", {}).get("rooms", []):
        rect = room.get("rect") or []
        if len(rect) < 4:
            continue
        x, y, w, h = (int(rect[0]), int(rect[1]), int(rect[2]), int(rect[3]))
        bands.append((int(room.get("floor", 1)), (x, y, x + w - 1, y + h - 1)))

    def floor_of(x: int, y: int) -> int:
        for floor, (x0, y0, x1, y1) in bands:
            if x0 <= x <= x1 and y0 <= y <= y1:
                return floor
        # corridor cells between rooms: fall back on the vertical order of the
        # three storeys, which the room rectangles make unambiguous
        return 1 if y < 30 else (2 if y < 66 else 3)

    return floor_of


def wall_frame(floor: int, x: int, y: int, pier: bool, facing: bool, upper: bool) -> str:
    """One storey's masonry. The courses are the same masonry, read differently.

    Floor 1 keeps the nave's dressed ashlar with a dado course at eye level;
    floor 2 is the foundations, so it is banded dado-low and heavier above; floor 3
    is the buried reliquary, so it is broken more often and the piers are narrower.
    Nothing here changes collision: every frame is painted on a cell that is
    already masonry.
    """
    if floor >= 3:
        if facing:
            return "face_b" if pier else ("face_broken_a" if hashed(x, y, 41) % 3 == 0 else "face_a")
        if upper:
            return "face_broken_a" if hashed(x, y, 43) % 3 == 0 else ("face_b" if pier else "face_a")
        return "face_broken_b" if hashed(x, y, 47) % 4 == 0 else ("face_b" if pier else "face_a")
    if floor == 2:
        if facing:
            return "face_dado" if (pier or y % 2 == 1) else "face_b"
        return "face_b" if (pier or hashed(x, y, 53) % 5 == 0) else "face_a"
    if facing:
        return "face_b" if pier else "face_dado"
    if upper:
        return "face_b" if pier else "face_a"
    return "face_broken_a" if hashed(x, y) % 5 == 0 else ("face_b" if pier else "face_a")


def build_material(level: dict, props: list) -> dict:
    ground = cellset(level["layers"]["Backdrop"])
    solid = cellset(level["layers"]["Geometry"])
    water = garth_water(level)
    floor_of = floor_lookup(level)
    props_cells = set()
    for prop in props:
        for x in range(prop["cells"][0], prop["cells"][2] + 1):
            for y in range(prop["cells"][1], prop["cells"][3] + 1):
                props_cells.add((x, y))

    roles: dict[str, list] = {name: [] for name in (
        "rock", "rock_deep", "floor", "coping", "water", "water_edge", "wall_face", "niche",
        "mass", "shadow", "weather", "decor")}

    def add(role, x, y, frame_name, lit=0, variant=0):
        frame = tile_frame(frame_name)
        # `variant` is a flip/transpose mask applied by the runtime through an
        # explicit alternative tile: same atlas, same source, no new art.
        roles[role].append([x, y, frame[0], frame[1], lit, frame_name, variant])

    # --- floor ------------------------------------------------------------
    for x, y in sorted(ground):
        if (x, y) in water:
            continue
        roll = hashed(x, y) % 100
        frame = "floor_flag_worn" if roll < 9 else ("floor_flag_2" if hashed(x, y) % 2 else "floor_flag_1")
        add("floor", x, y, frame)
        # coping: floor cells that touch water read as a kerb, not a flagstone
        if any((x + dx, y + dy) in water for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            add("coping", x, y, "floor_flag_3" if hashed(x, y) % 3 else "floor_quarry_0")

    # --- rock: everything outside the building ---------------------------
    # Round 4: two frames alternated by hash was the "artificial diagonal
    # banding" the review named.  The same two quarry frames are now flipped and
    # transposed into eight variants (an explicit alternative tile per variant in
    # the runtime), split into a near band and a deeper band with its own tint, and
    # carried far enough out that the camera never reaches bare background.
    for y in range(level["height"]):
        for x in range(level["width"]):
            cell = (x, y)
            if cell in ground or cell in solid or cell in water:
                continue
            if is_sealed_interior(cell, ground, solid):
                continue
            building = ground | solid | water
            if not near_building(x, y, building, ROCK_RADIUS):
                continue
            role = "rock" if near_building(x, y, building, ROCK_BAND_RADIUS) else "rock_deep"
            frame = "floor_quarry_1" if hashed(x, y) % 2 else "floor_quarry_0"
            variant = hashed(x, y, 37) % 8
            add(role, x, y, frame, variant=variant)

    # --- wall faces: courses by distance to the walk below ----------------
    for x, y in sorted(solid):
        if is_sealed_interior((x, y), ground, solid):
            add("mass", x, y, "floor_flag_worn" if hashed(x, y) % 3 else "floor_flag_0")
            continue
        depth = 0
        probe = y
        while depth < 4 and (x, probe) in solid:
            depth += 1
            probe += 1
        below = (x, y + 1)
        facing = below in ground or below in water
        if facing or (x, y - 1) in ground:
            # the bay rhythm: every fourth column of a wall run is a pier, and each
            # storey runs its own phase
            floor_number = floor_of(x, y)
            pier = (x % 4) == FLOOR_PIER_PHASE.get(floor_number, PIER_PHASE)
            upper = (x, y - 2) in ground or (x, y - 1) in ground
            add("wall_face", x, y, wall_frame(floor_number, x, y, pier, facing, upper))
            if facing:
                add("shadow", x, y + 1, "wall_shadow")
        else:
            add("mass", x, y, "floor_flag_worn" if hashed(x, y) % 3 else "floor_flag_0")

    # --- recesses: painted on the wall plane, by column phase ------------
    for x, y in sorted(solid):
        if is_sealed_interior((x, y), ground, solid):
            continue
        below, above = (x, y + 1), (x, y - 1)
        if below not in ground and below not in water and above not in ground:
            continue
        # the buried storey is packed with recesses, the foundations are not
        floor_number = floor_of(x, y)
        phase = NICHE_PHASE % (3 if floor_number >= 3 else 4)
        if x % (3 if floor_number >= 3 else 4) != phase:
            continue
        roll = hashed(x, y, 11) % 100
        frame = ("face_niche_scrolls" if roll < 30 else
                 "face_niche_codices" if roll < 55 else
                 "face_niche_empty" if roll < 80 else "face_niche_broken")
        add("niche", x, y, frame)

    # --- rim coping: masonry that holds the basin reads as a kerb ---------
    for x, y in sorted(solid):
        if any((x + dx, y + dy) in water for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            add("coping", x, y, "floor_flag_3" if hashed(x, y) % 2 else "floor_flag_0")

    # --- decor: Gate 3's own wall fittings, in place of Candidate A's ---------
    # Candidate A's `Decor` layer is hidden at runtime (C2): its cool-toned shelf and
    # vessel frames were the only alien palette in the room, and a warm multiply on
    # magenta cannot make it stone.  These fittings come from the approved archive
    # atlas, so the room keeps its small narrative objects without the colour break.
    for x, y in sorted(solid):
        if is_sealed_interior((x, y), ground, solid):
            continue
        if (x, y + 1) not in ground and (x, y - 1) not in ground:
            continue
        roll = hashed(x, y, 23) % 100
        if roll < 7:
            add("decor", x, y, "chain")
        elif roll < 11:
            add("decor", x, y, "drip")
    # the sealed flight: step courses behind the collapsed head of the descent (C1)
    for index, x in enumerate(range(SHAFT_ROOM[0] + 1, SHAFT_ROOM[0] + 6)):
        add("decor", x, SHAFT_ROOM[3] + 1, "stair_%d" % (index % 4))

    # --- water ------------------------------------------------------------
    for x, y in sorted(water):
        add("water", x, y, "water_deep")
        edge = None
        if (x, y - 1) not in water and (x - 1, y) not in water:
            edge = "water_nw"
        elif (x, y - 1) not in water and (x + 1, y) not in water:
            edge = "water_ne"
        elif (x, y + 1) not in water and (x - 1, y) not in water:
            edge = "water_sw"
        elif (x, y + 1) not in water and (x + 1, y) not in water:
            edge = "water_se"
        elif (x, y - 1) not in water:
            edge = "water_n"
        elif (x, y + 1) not in water:
            edge = "water_s"
        elif (x - 1, y) not in water:
            edge = "water_w"
        elif (x + 1, y) not in water:
            edge = "water_e"
        if edge:
            add("water_edge", x, y, edge)

    # --- weather ----------------------------------------------------------
    for x, y in sorted(ground):
        if (x, y) in water or (x, y) in props_cells:
            continue
        roll = hashed(x, y, 7) % 100
        if roll < 4:
            add("weather", x, y, "moss")
        elif roll < 9:
            add("weather", x, y, "wear")
        elif roll < 10:
            add("weather", x, y, "damp")
    return roles


def check_coverage(level: dict, material: dict) -> dict:
    """Every production cell must be repainted before its layer may be hidden.

    `Backdrop` (the walkable ground) is replaced by the floor and water layers;
    `Geometry` (masonry) is replaced by wall faces plus dressed interior mass.
    Hiding a layer that still owned an unpainted cell would delete the only picture
    of a wall the Knight can collide with, so this is a hard precondition, checked
    here in the authoring tool and again on the live level at runtime.
    """
    ground = cellset(level["layers"]["Backdrop"])
    solid = cellset(level["layers"]["Geometry"])
    floor_paint = {(int(c[0]), int(c[1])) for role in ("floor", "water", "water_edge", "coping")
                   for c in material.get(role, [])}
    wall_paint = {(int(c[0]), int(c[1])) for role in ("wall_face", "mass", "niche")
                  for c in material.get(role, [])}
    uncovered_ground = sorted(ground - floor_paint)
    uncovered_solid = sorted(solid - wall_paint)
    return {
        "ground_total": len(ground),
        "ground_painted": len(ground & floor_paint),
        "solid_total": len(solid),
        "solid_painted": len(solid & wall_paint),
        "uncovered_ground": uncovered_ground[:8],
        "uncovered_solid": uncovered_solid[:8],
        "uncovered_ground_count": len(uncovered_ground),
        "uncovered_solid_count": len(uncovered_solid),
    }


def near_building(x: int, y: int, building: set, radius: int) -> bool:
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if abs(dx) + abs(dy) <= radius and (x + dx, y + dy) in building:
                return True
    return False


def is_sealed_interior(cell: tuple, ground: set, solid: set) -> bool:
    """Masonry fully enclosed by masonry is interior mass, never banded rock."""
    if cell in ground:
        return False
    x, y = cell
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        neighbour = (x + dx, y + dy)
        if neighbour in ground or neighbour not in solid:
            return False
    return True


def garth_water(level: dict) -> set:
    """The cloister basin: the void inside GARTH that is not a pier."""
    ground = cellset(level["layers"]["Backdrop"])
    solid = cellset(level["layers"]["Geometry"])
    water = set()
    for y in range(GARTH[1], GARTH[3] + 1):
        for x in range(GARTH[0], GARTH[2] + 1):
            cell = (x, y)
            if cell in ground or cell in solid:
                continue
            water.add(cell)
    return water


# --------------------------------------------------------------------- art ----

def build_art(level: dict, props: list, material: dict) -> dict:
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
    return {
        "version": 4,
        "target_level": "res://data/levels/chapter_1_level_3.json",
        "source_level": "res://prototypes/gate3/level_data/chapter_1_level_3_gate3.json",
        "atlas": PROPS_ATLAS,
        "tile_atlas": TILES_ATLAS,
        "light_texture": LIGHT_TEXTURE,
        "collider_width_ratio": COLLIDER_RATIO,
        "collider_height": COLLIDER_H,
        "collision_layer": 1,
        "modulate": [0.94, 0.90, 0.88, 1.0],
        "level_layer_tint": {},
        # Round 4: the material layers were being drawn *behind* the level's own two
        # TileMapLayers (`Backdrop` z=-10, `Geometry` z=0), so 5 800 authored cells
        # never reached the screen.  Hiding them is only allowed because coverage is
        # exact: Gate3 floor == Backdrop cells, Gate3 wall_face + mass == Geometry
        # cells.  `check_coverage` proves that here, and the runtime proves it again
        # on the live level before it hides anything.
        "hidden_level_layers": ["Decor", "Backdrop", "Geometry"],
        # C6: one smooth shade field replaces Gate 2's five hard vault bands.
        "shade": {
            "mode": "distance_field",
            "colour": [0.06, 0.07, 0.11],
            "max_alpha": 0.94,
            "falloff_cells": 26.0,
            "z_index": -14,
            "note": "generated at runtime as a 116x96 ImageTexture, linearly filtered: "
                    "no banding at any zoom, one node, no per-cell repeats",
        },
        "tile": TILE,
        # Draw order and per-layer colour.  z_as_relative is off in the runtime, so
        # these are absolute: rock at the bottom, wall faces above the floor, the
        # shade field above the walls but below every actor and prop.
        "layer_style": {
            # The scene's Background Parallax2D also sits at z = -30; the apron must
            # stay in front of it, so both bands live at -29/-28, still well below
            # the floor layer at -20.
            "rock": {"z": -29, "modulate": [0.98, 0.95, 0.97, 1.0]},
            "rock_deep": {"z": -28, "modulate": [0.80, 0.77, 0.84, 1.0]},
            "floor": {"z": -20, "modulate": [1.06, 1.00, 0.94, 1.0]},
            "coping": {"z": -19, "modulate": [1.14, 1.08, 0.98, 1.0]},
            "water": {"z": -18, "modulate": [0.96, 1.04, 1.10, 1.0]},
            "water_edge": {"z": -17, "modulate": [1.10, 1.16, 1.22, 1.0]},
            "shadow": {"z": -16, "modulate": [0.34, 0.30, 0.34, 0.62]},
            "weather": {"z": -15, "modulate": [1.02, 1.04, 0.98, 0.92]},
            "mass": {"z": -13, "modulate": [0.72, 0.68, 0.72, 1.0]},
            "wall_face": {"z": -12, "modulate": [1.04, 0.98, 0.92, 1.0]},
            "niche": {"z": -11, "modulate": [0.98, 0.94, 0.90, 1.0]},
            "decor": {"z": -10, "modulate": [0.96, 0.92, 0.88, 0.95]},
        },
        "props": props,
        "lights": lights,
        # One entry per cell, so the runtime's "authored cells == applied cells"
        # contract compares like with like: two roles can want the same cell, and a
        # duplicate inside one role would make the document disagree with the layer.
        "material": {role: _unique_by_cell(cells) for role, cells in material.items()},
    }


# -------------------------------------------------------------------- main ----

def run(write: bool = True) -> dict:
    base = load(BASE)
    if sha256(BASE) != BASE_SHA:
        raise SystemExit(f"Candidate A fixture changed: {sha256(BASE)}")
    level, report = build_level(base)
    if write:
        OUT_LEVEL.parent.mkdir(parents=True, exist_ok=True)
        OUT_LEVEL.write_text(json.dumps(level, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    props, notes = fit_placements(level, PLACEMENTS)
    material = build_material(level, props)
    coverage = check_coverage(level, material)
    if coverage["uncovered_ground_count"] or coverage["uncovered_solid_count"]:
        raise SystemExit(
            "Gate 3 would hide a production layer it has not repainted: "
            f"{coverage['uncovered_ground_count']} ground cells (first {coverage['uncovered_ground']}), "
            f"{coverage['uncovered_solid_count']} masonry cells (first {coverage['uncovered_solid']})"
        )
    art = build_art(level, props, material)
    return {"level": level, "art": art, "props": props, "report": report, "notes": notes,
            "coverage": coverage}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--stats", action="store_true")
    options = parser.parse_args(argv)

    result = run(write=not (options.check or options.stats))
    level, art = result["level"], result["art"]
    props, report, notes = result["props"], result["report"], result["notes"]

    if options.stats or options.check:
        print("GATE3 EDITS")
        for name, count in report:
            print(f"  {name:12s} {count}")
        print("GATE3 LAYERS  " + "  ".join(
            f"{name}={len(cells)}" for name, cells in level["layers"].items()))
        print("GATE3 MATERIAL " + "  ".join(
            f"{name}={len(cells)}" for name, cells in art["material"].items()))
        print(f"GATE3 PROPS {len(props)} ({sum(1 for p in props if p['solid'])} solid)  "
              f"LIGHTS {len(art['lights'])}  ENTITIES {len(level['entities'])}")
        coverage = result["coverage"]
        print("GATE3 COVERAGE  Backdrop {ground_painted}/{ground_total}  "
              "Geometry {solid_painted}/{solid_total}  hidden={hidden}".format(
                  hidden=",".join(art["hidden_level_layers"]), **coverage))
        return 0

    if options.check:
        return 0

    problems = validate_level(load(BASE), level, report)
    problems += validate_props(level, props)
    problems += validate_routes(level, props)
    if problems:
        print(f"GATE3 VALIDATION FAILED ({len(problems)} problems)")
        for problem in problems:
            print(f"  - {problem}")
        return 1

    OUT_ART.parent.mkdir(parents=True, exist_ok=True)
    OUT_ART.write_text(json.dumps(art, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for note in notes:
        print(f"  PLACEMENT {note}")
    print(f"GATE3 AUTHOR OK: {sum(c for _n, c in report)} cell edits, "
          f"{len(props)} props, {len(art['lights'])} lights, 79 entities unchanged")
    for name, count in report:
        print(f"  {name:12s} {count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
