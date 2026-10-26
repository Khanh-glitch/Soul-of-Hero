#!/usr/bin/env python3
"""Levels 1-4 - composition. One pass per level, from that level's own layout.

These four levels used to be dressed by a single generic facade: one palette triple
and one repeating masonry band, so the Sealing Crypt, the Ossuary Fork, the Crossfire
Archive and the Spiral Reliquary were the same room in four tints. Each now gets its
own composition, written against its own floor plan and its own gameplay:

* **L1 Sealing Crypt** - a set of closed galleries around a central shaft. Every
  gallery is a burial room, and each one is used differently: a columbarium wall, a
  pair of tombs, a bier with the shroud still on it, the sealed door. The processional
  aisle runs from the spawn to the first seal, and the walls carry the loculus course.
* **L2 White Bone Fork** - the fork itself is the level. A bone arch stands over the
  crossing, the fork's arms are lined with skull banks, charnel floors mark the ways
  the dead were carried, and lanterns in vertebra cages light the junctions.
* **L3 Crossfire Archive** - a scriptorium shot through. Bookcases stand in ranks
  against the reading-room walls, lecterns face them, the floor is ash and fallen
  paper, chandeliers hang over the rooms that were being read in, and the wall above
  every shelf is sooted.
* **L4 Spiral Reliquary** - a procession that turns around one relic. The floor
  carries a bronze-and-jade spiral inlay cut around the shrine, dais drums mark each
  turn, reliquary lamps hang along the way, and the shrine itself is a stepped plinth
  with a lit crystal.

Everything here is additive and derived: it paints cells the level already defines,
never creates walkable or solid ground, and keeps every gameplay cell and its
neighbourhood clear of props. `kitlib.validate()` enforces that on every run.

Run: python3 tools/level1_4/architecture.py
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chapter1_env"))

from kitlib import (  # noqa: E402
    ROOT, Plan, cells, normalise_lights, protected, validate, wall_faces, write_document,
)

LEVELS = {
    1: {"map": "crypt_entrance", "kit": "crypt", "title": "The Sealing Crypt"},
    2: {"map": "chapter_1_level_2", "kit": "ossuary", "title": "The White Bone Fork"},
    3: {"map": "chapter_1_level_3", "kit": "archive", "title": "The Crossfire Archive"},
    4: {"map": "chapter_1_level_4", "kit": "spiral", "title": "The Spiral Reliquary"},
}

T = 16


# ---------------------------------------------------------------------------
# shared helpers
# ---------------------------------------------------------------------------
def load(map_name: str) -> dict:
    import json
    with open(os.path.join(ROOT, "data", "levels", map_name + ".json"), encoding="utf-8") as fh:
        return json.load(fh)


def entity_cells(level: dict) -> dict:
    out = {}
    for entity in level.get("entities", []):
        position = entity.get("position", [0, 0])
        out[str(entity.get("id", ""))] = (int(position[0]) // T, int(position[1]) // T)
    return out


def floor_base(plan, floor, geom) -> None:
    """Lay the paving: quadrants for the flag joints, a hash for the variation.

    The quadrant is parity, so the four cells of one 32 px flag always meet on the
    same slab. Which of the eight variants a cell gets is a hash of its position, so
    two neighbours are usually different stones and the repeat is not visible as a
    period. Deterministic: the same cell gets the same slab on every rebuild.
    """
    for cell in sorted(floor):
        if cell in geom:
            continue
        variant = (cell[0] * 37 + cell[1] * 61 + cell[0] * cell[1] * 13) % 8
        plan.floor_tile(cell, "floor_%s" % "abcdefgh"[variant])


def walk(floor, geom):
    return sorted(c for c in floor if c not in geom)


def face_of(geom, floor) -> dict:
    """cell -> True for solid cells with walkable ground below."""
    return {c for c in geom if (c[0], c[1] + 1) in floor and (c[0], c[1] + 1) not in geom}


def wall_adjacent(floor, geom) -> list:
    """Walkable cells with a solid cell directly north: where a prop can stand."""
    out = []
    for cell in walk(floor, geom):
        if (cell[0], cell[1] - 1) in geom:
            out.append(cell)
    return out


def side_adjacent(floor, geom) -> list:
    out = []
    for cell in walk(floor, geom):
        if (cell[0] - 1, cell[1]) in geom or (cell[0] + 1, cell[1]) in geom:
            out.append(cell)
    return out


class Placer:
    """Placement with the level's own rules: no props on protected cells, no two
    props on one cell, and a limit on how close two can stand."""

    def __init__(self, plan, level, floor, geom):
        self.plan = plan
        self.floor = floor
        self.geom = geom
        self.guard = protected(level)
        self.used = set()

    def free(self, cell, *, spacing: int = 0) -> bool:
        if cell not in self.floor or cell in self.geom:
            return False
        if cell in self.guard or cell in self.used:
            return False
        if spacing:
            for dx in range(-spacing, spacing + 1):
                for dy in range(-spacing, spacing + 1):
                    if (cell[0] + dx, cell[1] + dy) in self.used:
                        return False
        return True

    def put(self, frame, cell, **kwargs) -> bool:
        if not self.free(cell):
            return False
        self.plan.prop(frame, cell, **kwargs)
        self.used.add(cell)
        return True

    def lamp(self, cell, colour, energy, scale, *, dy=-20, note="lamp"):
        return {"x": cell[0] * T + 8, "y": cell[1] * T + dy, "color": colour,
                "energy": energy, "scale": scale, "cell": [cell[0], cell[1]], "note": note}


def band(plan, floor, geom, y: int, x0: int, x1: int, frame: str) -> int:
    """Paint one horizontal run of floor, wherever the level actually has floor."""
    painted = 0
    for x in range(x0, x1 + 1):
        if (x, y) in floor and (x, y) not in geom:
            plan.floor_tile((x, y), frame)
            painted += 1
    return painted


def column(plan, floor, geom, x: int, y0: int, y1: int, frame: str) -> int:
    painted = 0
    for y in range(y0, y1 + 1):
        if (x, y) in floor and (x, y) not in geom:
            plan.floor_tile((x, y), frame)
            painted += 1
    return painted


## A lamp's chain is six rows long, so it must hang within that of the wall band it
## is fixed to. For a lamp whose chain would end in mid-air, the honest answer is not
## to draw the lamp.
LAMP_CHAIN_ROWS = 6


def _hangs(cell, geom, rows: int = LAMP_CHAIN_ROWS) -> bool:
    for dy in range(1, rows + 1):
        if (cell[0], cell[1] - dy) in geom:
            return True
    return False


def nearest_face(faces, cell, limit: int = 6):
    """The wall face a landmark would be read against: the closest one to it."""
    best = None
    best_d = limit + 1
    for f in faces:
        dx, dy = abs(f[0] - cell[0]), abs(f[1] - cell[1])
        # the face must be above or beside the landmark, never below it
        if f[1] - cell[1] > 1:
            continue
        d = max(dx, dy)
        if d < best_d:
            best_d = d
            best = f
    return best


def near(point, cell, dx: int, dy: int) -> bool:
    return abs(point[0] - cell[0]) <= dx and abs(point[1] - cell[1]) <= dy


def pick(spread: list, cell, salt: int = 0):
    return spread[(cell[0] * 7 + cell[1] * 13 + salt) % len(spread)]


def ranks(p: Placer, frame, *, every_x: int, every_y: int, off_x: int = 0,
          off_y: int = 0, clear_above: int = 1, skip: int = 0, **kwargs) -> int:
    """Furniture standing in ranks across open floor, not just against the walls.

    Every prop placed against a wall leaves the middle of a forty-cell hall empty,
    which is what a room with two bookcases in it looks like from the gameplay
    camera. A scriptorium is ranks of shelving with aisles between them; an ossuary
    is ranks of bone stacks. The rank is a grid with a fixed stride, so the aisles
    are straight and walkable, and a prop is only placed where there is open floor
    above it for its own height to stand in.
    """
    placed = 0
    for cell in sorted(p.floor):
        if cell in p.geom:
            continue
        if (cell[0] - off_x) % every_x or (cell[1] - off_y) % every_y:
            continue
        # a rank with every slot filled is a lattice, not furniture: leave a share of
        # the positions empty, chosen by position so it is the same every rebuild
        if skip and (cell[0] * 29 + cell[1] * 43) % skip == 0:
            continue
        if not p.free(cell, spacing=0):
            continue
        ok = True
        for dy in range(1, clear_above + 1):
            if (cell[0], cell[1] - dy) in p.geom:
                ok = False
                break
        if not ok:
            continue
        options = dict(kwargs)
        # Mirror half of them: a rank of nine identical cases with the same chained
        # volume on the same shelf is a stamped pattern, and the atlas can afford one
        # boolean per sprite.
        if (cell[0] // max(1, every_x) + cell[1] // max(1, every_y)) % 2:
            options["flip"] = True
        name = frame
        if isinstance(frame, (list, tuple)):
            name = frame[(cell[0] * 3 + cell[1] * 5) % len(frame)]
        if p.put(name, cell, **options):
            placed += 1
    return placed


# ---------------------------------------------------------------------------
# Level 1 - the Sealing Crypt
# ---------------------------------------------------------------------------
# The plan is a grid of galleries: four rooms on each of three tiers, joined by
# doorways and a central shaft. Each room is furnished as a distinct burial space.
L1_GALLERIES = [
    # (x0, y0, x1, y1, kind)
    ((14, 4, 20, 18), "columbarium"),
    ((31, 4, 62, 24), "great hall"),
    ((67, 5, 91, 22), "reliquary of the first seal"),
    ((14, 31, 34, 46), "tomb pair"),
    ((38, 27, 66, 50), "central shaft"),
    ((70, 31, 94, 48), "bier chamber"),
    ((14, 59, 34, 72), "store"),
    ((38, 55, 74, 75), "procession"),
    ((78, 58, 99, 73), "the sealed way"),
]


def build_level1(level: dict) -> dict:
    floor = cells(level, "Backdrop")
    geom = cells(level, "Geometry")
    guard = protected(level)
    ent = entity_cells(level)
    faces = face_of(geom, floor)
    plan = Plan()
    floor_base(plan, floor, geom)

    # --- floor: the processional aisle, thresholds, worn gallery borders
    aisle = 0
    aisle += column(plan, floor, geom, 51, 0, 75, "floor_aisle_w")
    aisle += column(plan, floor, geom, 52, 0, 75, "floor_aisle_e")
    # The cross-passage at the central shaft, so the aisle reads as a crossing.
    # The two aisle frames are *halves* of the strip - each carries the kerb on its
    # outside edge - so the crossing has to keep the split. Naming a single
    # `floor_aisle` frame that the kit does not draw left all 92 crossing cells with
    # no floor at all, which the validator missed while it skipped Level 1.
    for y, side in ((36, "n"), (37, "s"), (44, "n"), (45, "s")):
        aisle += band(plan, floor, geom, y, 36, 50, "floor_aisle_" + side)
        aisle += band(plan, floor, geom, y, 53, 68, "floor_aisle_" + side)
    # thresholds: the sill under every doorway, in the level's own worn stone
    thresholds = 0
    for door in ("door_f1_to_f2", "door_f2_to_f1", "door_f2_to_f3", "door_f3_to_f2"):
        cell = ent.get(door)
        if cell is None:
            continue
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                c = (cell[0] + dx, cell[1] + dy)
                if c in floor and c not in geom:
                    plan.floor_tile(c, "floor_threshold")
                    thresholds += 1
    # wall-hugging wear: the paving a hundred years of feet has darkened
    wear = 0
    for cell in side_adjacent(floor, geom):
        if (cell[0] * 5 + cell[1] * 3) % 7 == 0:
            plan.floor_tile(cell, "floor_worn")
            wear += 1

    # --- walls. The columbarium is the kit's own storey (see crypt_kits.py), so the
    #     document only names the *specials*: the ends of a gallery run are a dressed
    #     jamb, and a wall that turns a corner gets the vault band, because that is
    #     where a mason would spring an arch. Nothing here is placed on a modulus.
    walls = 0
    for cell in sorted(faces):
        x, y = cell
        left = (x - 1, y) in faces
        right = (x + 1, y) in faces
        if not left or not right:
            plan.wall_tile(cell, "wall_dado_a")
            walls += 1
        elif (x, y - 1) in geom and (x, y - 1) not in faces:
            plan.wall_tile(cell, "wall_vault")
            walls += 1

    p = Placer(plan, level, floor, geom)
    props = 0
    lights = 0

    # --- the great hall: two tombs flanking the aisle, on the axis of the shaft
    for cell in ((44, 12), (59, 12)):
        if p.put("sarcophagus", cell):
            props += 1
    for cell in ((44, 19), (59, 19)):
        if p.put("bier", cell):
            props += 1

    # --- the columbarium: a standing loculus in each corner of the little room
    for cell in ((15, 6), (19, 6)):
        if p.put("loculus", cell):
            props += 1
    if p.put("grave_goods", (16, 17)):
        props += 1

    # --- the first seal's chamber: the sealed door in the back wall, grave goods
    for cell in ((68, 6), (90, 6)):
        if p.put("loculus", cell):
            props += 1
    for cell in ((71, 21), (87, 21)):
        if p.put("candelabrum", cell, light=p.lamp(cell, [1.0, 0.80, 0.48], 0.55, 1.6,
                                                   dy=-40, note="candelabrum")):
            props += 1
            lights += 1

    # --- the central shaft: four candelabra at the corners of the crossing
    for cell in ((40, 29), (65, 29), (40, 48), (65, 48)):
        if p.put("candelabrum", cell, light=p.lamp(cell, [1.0, 0.82, 0.52], 0.5, 1.5,
                                                   dy=-40, note="shaft candle")):
            props += 1
            lights += 1

    # --- the bier chamber and the store: different burial business in each room
    for cell in ((72, 33), (86, 33)):
        if p.put("sarcophagus", cell):
            props += 1
    if p.put("grave_urn", (78, 46)):
        props += 1
    for cell in ((16, 61), (30, 61)):
        if p.put("bier", cell):
            props += 1
    for cell in ((18, 70), (28, 70)):
        if p.put("grave_goods", cell):
            props += 1

    # --- the sealed way: the exit door, an ajar door beside it, tomb guardians
    for cell in ((80, 59), (97, 59)):
        if p.put("crypt_door", cell):
            props += 1
    if p.put("crypt_door_ajar", (88, 59)):
        props += 1
    for cell in ((84, 72), (93, 72)):
        if p.put("sarcophagus", cell):
            props += 1

    # --- the galleries' own furniture: tomb rows down each long room, so a gallery
    #     reads as a place full of tombs rather than a corridor with two in it
    # Four kinds of burial, not one repeated: an effigy chest, a cheaper chest with a
    # cut cross and a chipped corner, a two-burial chest, and the one that has been
    # opened. A rank of identical gisants read as wallpaper from the camera.
    tombs = ranks(p, ("sarcophagus", "sarcophagus_worn", "sarcophagus_pair",
                      "sarcophagus", "sarcophagus_worn", "sarcophagus_open"),
                  every_x=8, every_y=8, off_x=3, off_y=2, skip=5)
    props += tombs
    for cell in ((30, 20), (60, 46), (86, 52), (44, 66)):
        if p.put("grave_goods", cell):
            props += 1

    # --- hanging lamps down the aisle, hung from the wall band they reach
    lamps = 0
    for cell in ((52, 10), (52, 24), (52, 33), (52, 50), (52, 62), (52, 71)):
        if not _hangs(cell, geom):
            continue
        if p.put("hanging_lamp", cell, hang=False,
                 light=p.lamp(cell, [1.0, 0.86, 0.62], 0.5, 1.7, dy=-64, note="aisle lamp")):
            props += 1
            lights += 1
            lamps += 1

    document = _document(level, "crypt", L1_DOC, plan, {
        "galleries": len(L1_GALLERIES),
        "aisle_cells": aisle,
        "threshold_cells": thresholds,
        "wear_cells": wear,
        "tomb_rows": tombs,
        "hanging_lamps": lamps,
        "wall_dressing": walls,
        "props": props,
    })
    return document


L1_DOC = {
    "note": (
        "The Sealing Crypt: a columbarium of closed galleries around one shaft. The "
        "loculus course runs along the bottom of every wall face, the aisle from the "
        "spawn to the first seal is a dressed processional strip, and each gallery is "
        "furnished as its own kind of burial room rather than repeated."
    ),
    "ambient": [0.72, 0.74, 0.84],
    "background": [0.038, 0.042, 0.052],
    "wall_tint": [0.92, 0.94, 1.00],
    "bedrock_tint": [0.86, 0.88, 0.96],
}


# ---------------------------------------------------------------------------
# Level 2 - the White Bone Fork
# ---------------------------------------------------------------------------
L2_FORK = (75, 66)          # the crossing the whole level is named for
L2_ARCHES = ((75, 66),)     # the arch stands at the fork


def build_level2(level: dict) -> dict:
    floor = cells(level, "Backdrop")
    geom = cells(level, "Geometry")
    ent = entity_cells(level)
    faces = face_of(geom, floor)
    plan = Plan()
    floor_base(plan, floor, geom)

    # --- floor: charnel drifts against the walls, a bone-dust procession on the
    #     fork's own axes, and the ring the third seal sits in
    procession = 0
    for x in range(0, level["width"]):
        if (x, 66) in floor and (x, 66) not in geom:
            plan.floor_tile((x, 66), "floor_procession")
            procession += 1
    for y in range(30, 100):
        if (75, y) in floor and (75, y) not in geom:
            plan.floor_tile((75, y), "floor_procession")
            procession += 1
    charnel = 0
    for cell in side_adjacent(floor, geom):
        if (cell[0] * 3 + cell[1] * 11) % 5 == 0:
            plan.floor_tile(cell, "floor_charnel")
            charnel += 1

    # --- walls. The bond of long bones and the frieze of skulls are the kit's own
    #     wall material, so the document adds only what is specific to this level: a
    #     bank of skulls built into the wall where the fork's three ways meet, because
    #     that is where the dead were laid out and it is the one wall the player will
    #     stand in front of.
    walls = 0
    fork_face = nearest_face(faces, L2_FORK, 10)
    if fork_face is not None:
        for cell in sorted(faces):
            if near(fork_face, cell, 4, 1):
                plan.wall_tile(cell, "wall_skulls")
                walls += 1

    p = Placer(plan, level, floor, geom)
    props = 0
    lights = 0

    # --- the fork: the bone arch, and a lantern either side of it
    for cell in L2_ARCHES:
        if p.put("bone_arch", cell):
            props += 1
    for cell in ((70, 70), (80, 70)):
        if not _hangs(cell, geom):
            continue
        if p.put("bone_lantern", cell,
                 light=p.lamp(cell, [1.0, 0.90, 0.72], 0.62, 1.7, dy=-36, note="bone lantern")):
            props += 1
            lights += 1

    # --- the fork's arms: skull banks along the walls, a few per run
    banks = 0
    for cell in wall_adjacent(floor, geom):
        if not p.free(cell, spacing=4):
            continue
        if (cell[0] * 13 + cell[1] * 7) % 11 != 3:
            continue
        if p.put("skull_bank", cell):
            props += 1
            banks += 1

    # --- the ossuary stacks: the level's bookcases, lining the three halls
    # Bone stacks stand in ranks through the halls, the way an ossuary's charnel is
    # actually arranged: walls of bone with passages between them, not a ring of
    # ornaments around an empty floor.
    # Wide-spaced, because a stack is a two-by-six cell object: at a tight stride a
    # hall of them is a lattice of identical cases, and the player walks through what
    # looks like a solid wall. A rank every eleven cells leaves a broad passage and
    # each stack reads as its own piece of furniture.
    stacks = ranks(p, ("ossuary_stack", "ossuary_stack_skull", "ossuary_stack_shaft",
                       "ossuary_stack"),
                   every_x=11, every_y=11, off_x=3, off_y=4, skip=4)
    props += stacks
    for cell in ((30, 40), (30, 56), (44, 40), (44, 56), (108, 40), (108, 56)):
        if p.put("ossuary_stack", cell):
            props += 1

    # --- charnel hearths: the cold fires the bone lanterns answer to
    for cell in ((52, 62), (98, 62)):
        if p.put("charnel_hearth", cell, light=p.lamp(cell, [0.62, 0.86, 0.92], 0.45, 1.4,
                                                      dy=-24, note="charnel fire")):
            props += 1
            lights += 1

    # --- bundles of long bones, leaning where the dead were laid out
    for cell in wall_adjacent(floor, geom):
        if not p.free(cell, spacing=3):
            continue
        if (cell[0] * 5 + cell[1] * 17) % 23 != 5:
            continue
        if p.put("bone_bundle", cell):
            props += 1

    # --- lanterns down the three ways, so no hall is lit only by its doorway
    for cell in ((75, 30), (75, 100), (40, 66), (110, 66), (75, 78)):
        if not _hangs(cell, geom):
            continue
        if p.put("bone_lantern", cell,
                 light=p.lamp(cell, [1.0, 0.90, 0.74], 0.5, 1.6, dy=-36, note="hall lantern")):
            props += 1
            lights += 1

    document = _document(level, "ossuary", L2_DOC, plan, {
        "procession_cells": procession,
        "charnel_cells": charnel,
        "skull_banks": banks,
        "bone_stacks": stacks,
        "wall_dressing": walls,
        "props": props,
    })
    return document


L2_DOC = {
    "note": (
        "The White Bone Fork: walls coursed from stacked long bones with skulls at the "
        "joints, a bone arch over the crossing the level is named for, skull banks and "
        "bone stacks lining the halls, and charnel fires that burn cold."
    ),
    "ambient": [0.80, 0.78, 0.74],
    "background": [0.048, 0.044, 0.040],
    "wall_tint": [1.00, 0.98, 0.94],
    "bedrock_tint": [0.92, 0.90, 0.86],
}


# ---------------------------------------------------------------------------
# Level 3 - the Crossfire Archive
# ---------------------------------------------------------------------------
def build_level3(level: dict) -> dict:
    floor = cells(level, "Backdrop")
    geom = cells(level, "Geometry")
    ent = entity_cells(level)
    faces = face_of(geom, floor)
    plan = Plan()
    floor_base(plan, floor, geom)

    # --- floor: ash and fallen paper everywhere, boardwalks along the reading
    #     rooms' long walls, a chalk register ring in each catalogue room
    ash = 0
    for cell in walk(floor, geom):
        if (cell[0] * 7 + cell[1] * 5) % 4 == 0:
            plan.floor_tile(cell, "floor_ash")
            ash += 1
    boards = 0
    for cell in wall_adjacent(floor, geom):
        if (cell[0] * 11 + cell[1] * 3) % 3 == 0:
            plan.floor_tile(cell, "floor_boards")
            boards += 1
    registers = 0
    for centre in ((60, 3), (51, 56), (78, 70)):
        for (dx, dy) in ((-2, -2), (-1, -2), (0, -2), (1, -2), (2, -2),
                         (-2, -1), (2, -1), (-2, 0), (2, 0), (-2, 1), (2, 1),
                         (-2, 2), (-1, 2), (0, 2), (1, 2), (2, 2)):
            cell = (centre[0] + dx, centre[1] + dy)
            if cell in floor and cell not in geom:
                plan.floor_tile(cell, "floor_register")
                registers += 1

    # --- walls. The soot and the boarded recess are the kit's wall material. What
    #     the document adds is a barred recess directly behind each rank of shelving,
    #     because that is where a locked cabinet would be: ornament tied to function,
    #     and it moves when the shelves move.
    walls = 0
    for cell in sorted(faces):
        x, y = cell
        behind = (x, y - 2)
        if behind in geom:
            plan.wall_tile(cell, "wall_grille")
            walls += 1

    p = Placer(plan, level, floor, geom)
    props = 0
    lights = 0

    # --- bookcases in ranks against the reading-room walls. A shelf is furniture,
    #     so it stands where furniture stands: one cell off the wall, in runs.
    # Ranks, with an aisle every third column and every fifth row. This is the room's
    # whole character: a scriptorium is rows of shelving, and the first pass hung two
    # bookcases on a forty-cell wall and left the hall bare.
    # A rank every five cells across and seven down, so a 44 px case leaves a
    # two-cell aisle on either side: dense enough that the room reads as a
    # scriptorium, open enough that the player can run and fight in it.
    shelves = ranks(p, ("bookshelf", "bookshelf_b", "bookshelf_c", "bookshelf_b",
                        "bookshelf_c"), every_x=5, every_y=7, off_x=1, off_y=2)
    props += shelves
    # a few of the ranks are burnt out: the shell of a case, no books
    burnt = 0
    for cell in sorted(p.used):
        if (cell[0] * 7 + cell[1] * 11) % 7 == 0:
            for entry in plan.props:
                if tuple(entry["cell"]) == cell:
                    entry["frame"] = ("bookshelf_burnt" if (cell[1] // 7) % 2
                                      else "bookshelf_burnt_b")
                    burnt += 1
                    break
    # and cases standing against the walls, where a reader would actually take a
    # volume down from one
    for cell in wall_adjacent(floor, geom):
        if not p.free(cell, spacing=2):
            continue
        if (cell[0] * 17 + cell[1] * 5) % 4 != 1:
            continue
        if p.put("bookshelf", cell):
            props += 1
            shelves += 1

    # --- lecterns facing the shelves, in the rooms the level calls a camp
    for cell in ((103, 12), (103, 18), (103, 44), (103, 50), (72, 68), (86, 68)):
        if p.put("lectern", cell, light=p.lamp(cell, [1.0, 0.84, 0.54], 0.42, 1.1,
                                               dy=-30, note="lectern candle")):
            props += 1
            lights += 1

    # --- scroll racks under the grilles
    for cell in ((30, 24), (30, 50), (46, 68)):
        if p.put("scroll_rack", cell):
            props += 1

    # --- chandeliers over the reading rooms: the only real light in the level
    for cell in ((34, 16), (66, 16), (34, 46), (66, 46), (52, 66)):
        if not _hangs(cell, geom):
            continue
        if p.put("chandelier", cell,
                 light=p.lamp(cell, [1.0, 0.78, 0.46], 0.72, 2.0, dy=-44,
                              note="archive chandelier")):
            props += 1
            lights += 1

    # --- braziers of burning paper, at the rooms' working ends
    for cell in ((24, 20), (76, 20), (24, 52), (76, 52)):
        if p.put("brazier", cell, light=p.lamp(cell, [1.0, 0.62, 0.32], 0.55, 1.3,
                                               dy=-28, note="burning papers")):
            props += 1
            lights += 1

    # --- barred doors: the archive was locked before it was shot through
    for cell in ((40, 12), (40, 44)):
        if p.put("grille_door", cell):
            props += 1

    # --- ladders hooked to the shelf rails
    for cell in ((46, 30), (58, 58)):
        if p.put("ladder", cell):
            props += 1

    document = _document(level, "archive", L3_DOC, plan, {
        "ash_cells": ash,
        "board_cells": boards,
        "register_cells": registers,
        "shelves": shelves,
        "burnt_shelves": burnt,
        "wall_dressing": walls,
        "props": props,
    })
    return document


L3_DOC = {
    "note": (
        "The Crossfire Archive: warm sandstone under soot, ranks of bookcases against "
        "the reading-room walls, iron grilles over the shelf recesses, lecterns and "
        "scroll racks, and the ash and fallen paper of a scriptorium that was fought "
        "through. The chandeliers are the level's only real light."
    ),
    "ambient": [0.78, 0.72, 0.64],
    "background": [0.050, 0.040, 0.030],
    "wall_tint": [0.94, 0.90, 0.86],
    "bedrock_tint": [0.88, 0.84, 0.78],
}


# ---------------------------------------------------------------------------
# Level 4 - the Spiral Reliquary
# ---------------------------------------------------------------------------
L4_SHRINE = (70, 24)        # the level's relic


def build_level4(level: dict) -> dict:
    floor = cells(level, "Backdrop")
    geom = cells(level, "Geometry")
    ent = entity_cells(level)
    faces = face_of(geom, floor)
    plan = Plan()
    floor_base(plan, floor, geom)

    # --- the spiral inlay. It is cut around the shrine's own cell, so the thing the
    #     level is named for is what the floor is turning around.
    radius = 5
    spiral = 0
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            cell = (L4_SHRINE[0] + dx, L4_SHRINE[1] + dy)
            if cell in floor and cell not in geom:
                plan.floor_tile(cell, "spiral_%d_%d" % (dx, dy))
                spiral += 1
    # a second, smaller turn at the level's other landmark cells
    turns = 0
    for centre in ((106, 8), (62, 51), (80, 70), (31, 24)):
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                cell = (centre[0] + dx, centre[1] + dy)
                if cell in floor and cell not in geom and _ring_dist(dx, dy) <= 2:
                    plan.floor_tile(cell, "floor_dais" if _ring_dist(dx, dy) <= 1 else "floor_shrine")
                    turns += 1
    shrine_floor = 0
    for cell in side_adjacent(floor, geom):
        if (cell[0] * 3 + cell[1] * 7) % 6 == 0:
            plan.floor_tile(cell, "floor_shrine")
            shrine_floor += 1

    # --- the processional route. The reliquary's halls are one continuous field of
    #     ivory paving with nothing in them: from the camera, a wide room and an empty
    #     room look the same. The route from the entrance to the shrine is walked out
    #     and inlaid in the darker stone, so the level has a legible spine and the
    #     player can see where the relic is from anywhere on it. Only cells the map
    #     already makes walkable are painted, so this cannot change collision.
    route_cells = []
    start = ent.get("player_spawn") or (8, 14)
    goal = L4_SHRINE
    if start in floor and goal in floor:
        route_cells = _route(floor, geom, start, goal)
        for cell in route_cells:
            plan.floor_tile(cell, "floor_route")

    # --- walls. The shrine niche is the kit's dado course. The document puts the
    #     bronze-framed one in the wall behind each of the level's four chapels, so
    #     the room a sigil is in is the room the wall was built for.
    walls = 0
    chapels = ((106, 8), (62, 51), (80, 70), (31, 24), L4_SHRINE)
    anchors = [f for f in (nearest_face(faces, c, 9) for c in chapels) if f is not None]
    for cell in sorted(faces):
        for anchor in anchors:
            if near(anchor, cell, 2, 1):
                plan.wall_tile(cell, "wall_shrine")
                walls += 1
                break

    p = Placer(plan, level, floor, geom)
    props = 0
    lights = 0

    # --- the shrine itself. The relic's own cell carries the live objective sprite,
    #     so the plinth stands directly behind it: the relic is silhouetted against
    #     the shrine instead of being covered by it, and the floor spiral turns
    #     around the pair.
    for offset in (2, 3, -2, -3):
        stand = (L4_SHRINE[0], L4_SHRINE[1] + offset)
        if p.put("relic_plinth", stand,
                 light=p.lamp(stand, [0.72, 1.0, 0.84], 0.85, 2.2, dy=-70,
                              note="the relic's own light")):
            props += 1
            lights += 1
            break

    # --- dais drums where the procession turns
    for cell in ((62, 20), (78, 20), (62, 28), (78, 28)):
        if p.put("processional_dais", cell):
            props += 1

    # --- reliquary lamps along the procession, one per turn of the spiral
    for cell in ((60, 24), (80, 24), (70, 14), (70, 34), (48, 16), (92, 32)):
        if not _hangs(cell, geom):
            continue
        if p.put("reliquary_lamp", cell,
                 light=p.lamp(cell, [1.0, 0.84, 0.56], 0.58, 1.6, dy=-40,
                              note="reliquary lamp")):
            props += 1
            lights += 1

    # --- the shrines in the side chapels: each camp gets one, so the four sigils
    #     all sit in a place that looks like it was built for them
    for cell in ((104, 10), (64, 53), (78, 68), (33, 26)):
        if p.put("shrine", cell, light=p.lamp(cell, [1.0, 0.86, 0.60], 0.5, 1.3,
                                              dy=-34, note="chapel votive")):
            props += 1
            lights += 1

    # --- a colonnade of reliquary lamps orbiting the shrine, on the floor that the
    #     spiral inlay turns through, so the procession is lit from where it walks
    orbit = 0
    for dy in range(-8, 9):
        for dx in range(-8, 9):
            if _ring_dist(dx, dy) not in (7, 8):
                continue
            if (dx * 5 + dy * 3) % 7:
                continue
            cell = (L4_SHRINE[0] + dx, L4_SHRINE[1] + dy)
            if not p.free(cell) or not _hangs(cell, geom):
                continue
            if p.put("reliquary_lamp", cell,
                     light=p.lamp(cell, [1.0, 0.86, 0.60], 0.55, 1.5, dy=-40,
                                  note="orbit lamp")):
                props += 1
                lights += 1
                orbit += 1
    # --- the colonnade: engaged piers down the long walls, so a hall has verticals
    #     and therefore depth. They stand on the floor against the wall, which is
    #     where a pier belongs, so they never stand in the way of a crossing.
    piers = 0
    for cell in wall_adjacent(floor, geom):
        if not p.free(cell, spacing=3):
            continue
        if (cell[0] * 7 + cell[1] * 11) % 9 != 4:
            continue
        if math.hypot(cell[0] - L4_SHRINE[0], cell[1] - L4_SHRINE[1]) < 3:
            continue
        if p.put("pier", cell):
            props += 1
            piers += 1

    # --- jade urns and serpent reliefs, set against the walls
    for cell in wall_adjacent(floor, geom):
        if not p.free(cell, spacing=3):
            continue
        roll = (cell[0] * 13 + cell[1] * 29) % 17
        if roll == 2:
            if p.put("jade_urn", cell):
                props += 1
        elif roll == 9:
            if p.put("serpent_relief", cell):
                props += 1

    document = _document(level, "spiral", L4_DOC, plan, {
        "spiral_cells": spiral,
        "turn_cells": turns,
        "shrine_floor_cells": shrine_floor,
        "orbit_lamps": orbit,
        "piers": piers,
        "route_cells": len(route_cells),
        "wall_dressing": walls,
        "props": props,
    })
    return document


def _route(floor: set, geom: set, start, goal):
    """The shortest walkable route between two cells, as a list of cells.

    Four-way, over the map's own floor. Used to lay the processional inlay along the
    way the player actually walks rather than along a straight line through rock.
    """
    from collections import deque
    previous = {start: None}
    queue = deque([start])
    while queue:
        cell = queue.popleft()
        if cell == goal:
            break
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            step = (cell[0] + dx, cell[1] + dy)
            if step in previous or step not in floor or step in geom:
                continue
            previous[step] = cell
            queue.append(step)
    if goal not in previous:
        return []
    path = []
    cell = goal
    while cell is not None:
        path.append(cell)
        cell = previous[cell]
    path.reverse()
    return path


def _ring_dist(dx: int, dy: int) -> int:
    return max(abs(dx), abs(dy))


L4_DOC = {
    "note": (
        "The Spiral Reliquary: aged ivory, bronze and dark green serpentine. A bronze "
        "and jade spiral is cut into the floor around the relic's own cell, dais drums "
        "mark each turn of the procession, reliquary lamps hang along the way, and each "
        "chapel has the shrine its sigil was put in."
    ),
    "ambient": [0.76, 0.76, 0.70],
    "background": [0.044, 0.046, 0.040],
    "wall_tint": [0.98, 0.97, 0.92],
    "bedrock_tint": [0.90, 0.90, 0.86],
}


# ---------------------------------------------------------------------------
# document assembly
# ---------------------------------------------------------------------------
## Prop frames that are part of a wall rather than an object standing on the floor:
## a leaning bundle or a standing stack is drawn from its cell's floor upwards, and
## a base-anchored sprite would sink half of it into the paving.
LOW_PROPS = {"bone_bundle", "ossuary_stack", "jade_urn"}

## Which cells in this level a tall prop may stand on. The fixture props - the arch,
## the plinth, the shafts and uprights - reach two to six rows above their own cell,
## and a sprite is not collision: what it must not do is stand in the middle of a
## walkable hall, where it would hide the player from themselves.
UPRIGHT_PROPS = {"bone_arch", "relic_plinth", "serpent_relief"}


def _document(level: dict, kit: str, meta: dict, plan, stats_in: dict) -> dict:
    for entry in plan.props:
        if entry["frame"] in LOW_PROPS:
            entry["low"] = True
    lights = plan.lights
    document = {
        "schema": "chapter1_architecture/1",
        "level": str(level.get("name", "")),
        "kit": kit,
        "tile_size": T,
        "note": meta["note"] + " Generated by tools/level1_4/architecture.py.",
        "ambient": meta["ambient"],
        "background": meta["background"],
        "wall_tint": meta["wall_tint"],
        "bedrock_tint": meta["bedrock_tint"],
        "layers": {"floor": plan.floor, "wall": plan.wall},
        "props": plan.props,
        "lights": lights,
        "stats": dict(stats_in, floor_overrides=len(plan.floor),
                      wall_overrides=len(plan.wall), props_total=len(plan.props),
                      lights_total=len(lights)),
    }
    return document


def main() -> None:
    failures = 0
    for number, spec in LEVELS.items():
        level = load(spec["map"])
        builder = {1: build_level1, 2: build_level2, 3: build_level3, 4: build_level4}[number]
        document = builder(level)
        problems = validate(document, level)
        normalise_lights(document)
        out = os.path.join(ROOT, "data", "levels", spec["map"] + "_architecture.json")
        write_document(out, document)
        print("%s -> %s" % (spec["title"], os.path.relpath(out, ROOT)))
        for key, value in document["stats"].items():
            print("  %-22s %s" % (key, value))
        if problems:
            failures += len(problems)
            print("  PROBLEMS (%d):" % len(problems))
            for problem in problems[:20]:
                print("   ", problem)
        else:
            print("  validation: clean")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
