#!/usr/bin/env python3
"""Level 9 — The Crimson Gate. Composition.

The level is a cross: a nave cut through the middle of a gatehouse, with a seal
chamber in each of three arms and the gate itself at the head of the fourth. The
architectural job is therefore not decoration but **navigation**: a player must
know, from any point in the nave, which arm they have already broken and which
one they have not, and the gate must be visible as the thing all three seals
belong to.

What this file builds:

* **The gate.** At the head of the arena: two towers, a pointed arch with a
  portcullis behind it, chains, and a keystone seal socket. It is the only cold
  light in the level, so it reads as the exit from anywhere in the nave.
* **Three seal stations.** A bronze bell in the west arm, a burning cauldron in
  the east arm, the great winch wheel in the north throat. Same platform, same
  floor ring, three unmistakable silhouettes — the stations are fixtures, not
  markers, and no prop stands on a seal cell or beside one.
* **The iron aisle.** A riveted iron band runs the length of the building on its
  axis, straight from the spawn to the gate, so the level's spine is drawn on the
  floor.
* **The gatehouse's holdings.** Banners, trophy shields, skull piles, broken
  blades, war drums and braziers: the loot of everyone who tried the gate.

Run: python3 tools/level9/architecture_gatehouse.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chapter1_env"))

from kitlib import (  # noqa: E402
    ROOT, Plan, cells, load_level, protected, validate, wall_faces, write_document,
    normalise_lights,
)
from art_gatehouse import ring_tiles  # noqa: E402

LEVEL = 9
OUT = os.path.join(ROOT, "data", "levels", "chapter_1_level_9_architecture.json")
KIT = "gatehouse"

EXIT = (48, 7)
REAPER = (48, 15)
SEALS = ((18, 45), (78, 45), (48, 32))
# Each station's floor ring, and how that ring terminates. The west and east
# stations stand a cell from their arm's end wall, so their rings are horseshoes
# whose cut ends are capped with a bronze socket where the mechanism enters the
# plinth. The throat and the gate carry complete rings.
RINGS = (((18, 45), "ringW"), ((78, 45), "ringE"), ((48, 32), "ring"),
         ((48, 7), "ring"))
TALL = {"chain_column", "banner", "banner_torn", "seal_bell", "seal_brazier"}


def ring_offsets(radius: int = 2):
    return {(dx, dy): "ring_%d_%d" % (dx, dy)
            for dy in range(-radius, radius + 1)
            for dx in range(-radius, radius + 1)}


def bevel_wall_rows(faces) -> dict:
    rows = {}
    for cell in faces:
        rows.setdefault(cell[1], []).append(cell[0])
    return {y: sorted(xs) for y, xs in rows.items()}


def floor_base(plan, floor, geom) -> None:
    for (cx, cy) in sorted(floor):
        if (cx, cy) in geom:
            continue
        plan.floor_tile((cx, cy), "floor_" + "abcd"[(cx % 2) * 2 + (cy % 2)])


def aisle(plan, floor, geom) -> int:
    """The iron aisle: the building's axis, drawn on the floor from spawn to gate."""
    painted = 0
    for (cx, cy) in sorted(floor):
        if (cx, cy) in geom:
            continue
        if cx in (47, 48):
            plan.floor_tile((cx, cy), "iron_v")
            painted += 1
        elif cy in (45, 32) and (cx in (17, 19) or True) and False:
            painted += 0
    # short cross bands where the arms meet the nave, so the cross is legible
    for y in (36, 44):
        for x in range(8, 34):
            if (x, y) in floor and (x, y) not in geom:
                plan.floor_tile((x, y), "iron_h")
                painted += 1
        for x in range(64, 88):
            if (x, y) in floor and (x, y) not in geom:
                plan.floor_tile((x, y), "iron_h")
                painted += 1
    return painted


def rings(plan, floor, geom) -> int:
    """Paint all four floor rings, each with the frame set its arm allows."""
    painted = 0
    for centre, tag in RINGS:
        offsets = ring_offsets(2)
        for (dx, dy) in offsets:
            cell = (centre[0] + dx, centre[1] + dy)
            if cell in floor and cell not in geom:
                plan.floor_tile(cell, "%s_%d_%d" % (tag, dx, dy))
                painted += 1
    return painted


def blood(plan, floor, geom) -> int:
    painted = 0
    for (cx, cy) in sorted(floor):
        if (cx, cy) in geom:
            continue
        roll = ((cx * 61 + cy * 113) % 100) / 100.0
        near_gate = abs(cx - EXIT[0]) <= 12 and cy <= 20
        near_seal = any(abs(cx - s[0]) + abs(cy - s[1]) <= 5 for s in SEALS)
        if near_gate and roll < 0.22:
            plan.floor_tile((cx, cy), "blood_a" if roll < 0.12 else "blood_b")
            painted += 1
        elif near_seal and roll < 0.12:
            plan.floor_tile((cx, cy), "blood_b")
            painted += 1
    return painted


def walls(plan, faces) -> int:
    """Iron plating on the gate wall, banner-hung ashlar on the nave."""
    painted = 0
    for cell in sorted(faces):
        x, y = cell
        roll = ((x * 47 + y * 31) % 100) / 100.0
        if y == 3:
            if roll < 0.22:
                plan.wall_tile(cell, "wall_banner")
            else:
                plan.wall_tile(cell, "wall_plate")
            painted += 1
        elif y == 46:
            plan.wall_tile(cell, "wall_plate")
            painted += 1
        else:
            if roll < 0.20:
                plan.wall_tile(cell, "wall_banner")
                painted += 1
            elif roll < 0.32:
                plan.wall_tile(cell, "wall_dado_a")
                painted += 1
    return painted


class Placer:
    def __init__(self, plan, floor, geom, guard, faces):
        self.plan = plan
        self.floor = floor
        self.geom = geom
        self.guard = guard
        self.faces = faces

    def wall(self, frame, cell, light=None, note="") -> bool:
        if cell not in self.geom or cell in self.guard or cell not in self.faces:
            return False
        if any(tuple(e["cell"]) == tuple(cell) for e in self.plan.props):
            return False
        self.plan.prop(frame, cell, light=light, note=note)
        return True

    def floor_prop(self, frame, cell, light=None, note="") -> bool:
        if cell not in self.floor or cell in self.geom or cell in self.guard:
            return False
        if any(tuple(e["cell"]) == tuple(cell) for e in self.plan.props):
            return False
        self.plan.prop(frame, cell, light=light, note=note)
        return True


def ember(cell, energy=0.95, scale=1.6, y=-40, note="brazier"):
    return {"x": cell[0] * 16 + 8, "y": cell[1] * 16 + y,
            "color": [1.0, 0.58, 0.26], "energy": energy, "scale": scale,
            "cell": [cell[0], cell[1]], "note": note}


def gate_light(cell, y=-70):
    # The gate's light is a threshold glow, not a floodlight: a 614 px pool at 1.05
    # energy was covering the arch, the towers and half the arena floor at once, and
    # the detail of the relief disappeared inside its own light. A pool of roughly
    # 330 px behind the bars keeps the arch dark enough to read while still marking
    # the gate as the coldest thing in the room.
    return {"x": cell[0] * 16 + 8, "y": cell[1] * 16 + y,
            "color": [0.62, 0.76, 1.0], "energy": 0.66, "scale": 1.3,
            "cell": [cell[0], cell[1]], "note": "the gate's light"}


def seal_glow(cell):
    return {"x": cell[0] * 16 + 8, "y": cell[1] * 16 + 8,
            "color": [0.88, 0.24, 0.24], "energy": 0.45, "scale": 1.9,
            "cell": [cell[0], cell[1]], "note": "seal ring glow"}


# --- the great hall ---------------------------------------------------------
# The hall is eighty-four cells wide and eighteen deep, and until now it was one
# floor material with furniture scattered on it: no axis, no bays, no edge, nothing
# for the eye to follow. That is why the room read as a car park in the audit. The
# four passes below give it a plan.
HALL = (36, 53)                 # rows of the great hall
AVENUE_X = (43, 52)             # the dressed processional way
RAIL_X = (42, 53)               # the iron rails that bound it
# Each seal shrine stands in a carved dais ring: concentric stone courses with a
# riveted iron hoop and four carved diamonds, nine cells across.
MEDALLIONS = ((18, 45), (78, 45), (48, 32), (48, 11), (48, 20))
# Free-standing piers turn the hall into a nave with aisles. They flank the avenue
# five cells out, three bays deep, and they are the only vertical mass inside the
# room - the one thing a great hall of this size cannot do without.
PIERS = tuple((x, y) for x in (38, 57) for y in (38, 44, 50))


def avenue(plan, floor, geom) -> int:
    """The processional way: dressed stone down the middle, rails, thresholds.

    The iron band that was already here ran the length of the building on its axis
    as two cells of riveted iron. On its own that is a stripe, not an avenue, and it
    was the only floor material in a room eighty-four cells wide. The avenue is the
    band plus eight cells of paler dressed paving either side of it, two iron rails
    terminating the courses, and a carved threshold at each end of the hall. The
    band stays where it was: it is the spine the level is navigated by.
    """
    painted = 0
    for y in range(HALL[0], HALL[1] + 1):
        for x in range(AVENUE_X[0], AVENUE_X[1] + 1):
            cell = (x, y)
            if cell not in floor or cell in geom:
                continue
            # 47 and 48 are the iron spine the level is navigated by; the avenue is
            # dressed stone either side of it, not a replacement for it.
            if x in (47, 48):
                continue
            quad = (x % 2) * 2 + (y % 2)
            plan.floor_tile(cell, "aisle_" + "abcd"[quad])
            painted += 1
    for x in RAIL_X:
        for y in range(HALL[0], HALL[1] + 1):
            cell = (x, y)
            if cell not in floor or cell in geom:
                continue
            plan.floor_tile(cell, "rail_e" if x == RAIL_X[0] else "rail_w")
            painted += 1
    # a two-cell chancel step at each end of the hall, wider than the avenue by a
    # cell so it reads as the avenue being set into the hall rather than drawn on it
    for row, part in ((HALL[0], "nosing"), (HALL[0] + 1, "tread"),
                      (HALL[1] - 1, "tread"), (HALL[1], "nosing")):
        for x in range(AVENUE_X[0] - 1, AVENUE_X[1] + 2):
            cell = (x, row)
            if cell not in floor or cell in geom:
                continue
            plan.floor_tile(cell, "step_" + part)
            painted += 1
    return painted


def medallions(plan, floor, geom) -> int:
    """Carve a dais ring into the paving under every station and the altar.

    The shrines already stood in a 5 x 5 iron seal ring, which read as a marking on
    the floor rather than as a platform the shrine is built on. This is the platform:
    an inner bevel, a riveted hoop, a broad dressed band with four carved diamonds
    and radial grooves, a setting joint and an outer rim, nine cells across. Painted
    before the seal rings so the mechanism still sits inside its own dais.
    """
    painted = 0
    radius = 4
    for centre in MEDALLIONS:
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                cell = (centre[0] + dx, centre[1] + dy)
                if cell not in floor or cell in geom:
                    continue
                plan.floor_tile(cell, "medal_%d_%d" % (dx, dy))
                painted += 1
    return painted


def colonnade(p: Placer) -> int:
    """Six piers, three bays: the hall gets a nave and two aisles."""
    placed = 0
    for cell in PIERS:
        placed += p.floor_prop("pier", cell, note="nave pier")
    return placed


def gate_assembly(p: Placer, faces) -> int:
    """The monumental gate: towers, arch, portcullis teeth, banners either side."""
    placed = 0
    # The gate is built up from the arena floor rather than hung on the top wall:
    # the camera stops at the map edge, and a gate whose head is off-screen is not
    # a gate, it is a lintel.
    placed += p.floor_prop("gate_arch", (48, 11), light=gate_light((48, 11), -60),
                           note="the Crimson Gate")
    placed += p.floor_prop("gate_tower", (41, 11), note="west gate tower")
    placed += p.floor_prop("gate_tower_l", (55, 11), note="east gate tower")
    # No portcullis prop here. The kit has one, and it was placed in the gate mouth
    # during this pass - then the native frame showed it drawn *behind* the arch
    # sprite, because it stood on the cell above and the y-sort put it there. It added
    # nothing to the picture, and the gate already has its bars: prop_gate_arch draws
    # the portcullis inside its own lit opening, where they read against the cold
    # light. The gate's real problem was never missing bars; it was a 614 px light at
    # 1.05 covering the whole assembly. Placing a prop that implies nothing is the same
    # fault as leaving a room empty, so it is not left in the document as decoration.
    for x in (36, 60):
        placed += p.wall("banner", (x, 3), note="gate banner")
    for x in (34, 62):
        placed += p.wall("trophy_shields", (x, 3), note="trophies of the gate")
    for x in (44, 52):
        placed += p.floor_prop("brazier", (x, 22), light=ember((x, 22), 0.8, 1.6),
                               note="arena brazier")
    for x in (38, 58):
        placed += p.wall("brazier", (x, 3), light=ember((x, 3), 0.7, 1.4, 6, "gate brazier"),
                         note="gate brazier")
    return placed


def arena(p: Placer) -> int:
    """Where the Crimson Reaper waits: an altar, and the wreck of the last attempt."""
    placed = 0
    placed += p.floor_prop("altar", (48, 20), light=ember((48, 20), 0.6, 1.8, -18,
                                                         "altar fire"),
                           note="the arena altar")
    for cell in ((42, 21), (54, 21)):
        placed += p.floor_prop("skulls", cell, note="skull pile")
    for cell in ((44, 18), (52, 18)):
        placed += p.floor_prop("broken_blades", cell, note="broken blades")
    for cell in ((39, 22), (57, 22)):
        placed += p.floor_prop("brazier", cell, light=ember(cell), note="arena brazier")
    for cell in ((38, 12), (58, 12)):
        placed += p.floor_prop("war_drum", cell, note="war drum")
    return placed


def west_station(p: Placer) -> int:
    """West arm: the bell. Its ring is drawn and its shrine stands over the seal."""
    placed = 0
    placed += p.wall("seal_bell", (14, 46), light=ember((14, 46), 0.55, 1.3, -30,
                                                       "bell shrine light"),
                     note="west seal: the bell")
    placed += p.plan.lights.append(seal_glow(SEALS[0])) or 0
    placed += p.floor_prop("brazier", (11, 50), light=ember((11, 50)), note="arm brazier")
    placed += p.floor_prop("brazier", (25, 50), light=ember((25, 50)), note="arm brazier")
    for cell in ((9, 50), (26, 42)):
        placed += p.floor_prop("skulls", cell, note="skull pile")
    placed += p.floor_prop("bench", (11, 42), note="bench")
    placed += p.floor_prop("rubble", (30, 51), note="fallen masonry")
    for x in (8, 24, 32):
        placed += p.wall("banner_torn", (x, 35), note="torn banner")
    return placed


def east_station(p: Placer) -> int:
    """East arm: the cauldron. Same ring, different silhouette."""
    placed = 0
    placed += p.wall("seal_brazier", (80, 46), light=ember((80, 46), 1.0, 1.5, -40,
                                                          "cauldron light"),
                     note="east seal: the cauldron")
    placed += p.plan.lights.append(seal_glow(SEALS[1])) or 0
    placed += p.floor_prop("brazier", (69, 50), light=ember((69, 50)), note="arm brazier")
    placed += p.floor_prop("brazier", (85, 50), light=ember((85, 50)), note="arm brazier")
    for cell in ((68, 41), (88, 51)):
        placed += p.floor_prop("broken_blades", cell, note="broken blades")
    placed += p.floor_prop("war_drum", (74, 40), note="war drum")
    placed += p.floor_prop("bench", (86, 44), note="bench")
    for x in (64, 74, 86):
        placed += p.wall("banner", (x, 35), note="gate banner")
    return placed


def north_station(p: Placer) -> int:
    """The throat: the winch that raises the gate, on the floor beside its seal."""
    placed = 0
    placed += p.floor_prop("seal_wheel", (52, 31),
                           light={"x": 52 * 16 + 8, "y": 31 * 16 - 40,
                                  "color": [1.0, 0.62, 0.32], "energy": 0.5,
                                  "scale": 1.5, "cell": [52, 31],
                                  "note": "winch lamp"},
                           note="north seal: the winch")
    placed += p.plan.lights.append(seal_glow(SEALS[2])) or 0
    for cell in ((42, 30), (44, 33)):
        placed += p.floor_prop("brazier", cell, light=ember(cell), note="throat brazier")
    placed += p.floor_prop("chain_coil" if False else "rubble", (44, 29),
                           note="fallen masonry")
    placed += p.floor_prop("skulls", (41, 33), note="skull pile")
    return placed


def nave(p: Placer) -> int:
    """The nave: benches, drums, trophies and the wreckage of the last assault."""
    placed = 0
    for x in (11, 21, 28):
        placed += p.wall("chain_column", (x, 35), note="chained column")
    for x in (67, 76, 85):
        placed += p.wall("chain_column", (x, 35), note="chained column")
    for cell in ((12, 52), (24, 52), (66, 52), (82, 52)):
        placed += p.floor_prop("bench", cell, note="bench")
    for cell in ((15, 39), (30, 39), (68, 39), (84, 39)):
        placed += p.floor_prop("brazier", cell, light=ember(cell), note="nave brazier")
    for cell in ((26, 47), (72, 47)):
        placed += p.floor_prop("war_drum", cell, note="war drum")
    for cell in ((9, 46), (33, 44), (63, 46), (88, 44)):
        placed += p.floor_prop("skulls", cell, note="skull pile")
    for cell in ((31, 48), (66, 43)):
        placed += p.floor_prop("rubble", cell, note="fallen masonry")
    return placed


def south(p: Placer, rooms) -> int:
    """The approach: where the living wait, and where the dead stop."""
    placed = 0
    for cell in ((37, 57), (58, 57)):
        placed += p.floor_prop("bench", cell, note="bench")
    for cell in ((38, 60), (57, 60)):
        placed += p.floor_prop("brazier", cell, light=ember(cell), note="approach brazier")
    for cell in ((45, 56), (52, 61)):
        placed += p.floor_prop("skulls", cell, note="skull pile")
    placed += p.floor_prop("rubble", (36, 61), note="fallen masonry")
    for cell in ((45, 71), (52, 71)):
        placed += p.floor_prop("war_drum", cell, note="war drum")
    for cell in ((44, 66), (53, 66)):
        placed += p.floor_prop("brazier", cell, light=ember(cell), note="approach brazier")
    return placed


def build():
    level = load_level(LEVEL)
    floor = cells(level, "Backdrop")
    geom = cells(level, "Geometry")
    guard = protected(level)
    faces_all = wall_faces(floor, geom)
    faces = {cell for values in faces_all.values() for cell in values}
    rows = bevel_wall_rows(faces)

    plan = Plan()
    floor_base(plan, floor, geom)
    painted_avenue = avenue(plan, floor, geom)
    painted_aisle = aisle(plan, floor, geom)
    painted_medallions = medallions(plan, floor, geom)
    painted_rings = rings(plan, floor, geom)
    painted_blood = blood(plan, floor, geom)
    painted_walls = walls(plan, faces)

    p = Placer(plan, floor, geom, guard, faces)
    placed = 0
    placed += gate_assembly(p, faces)
    placed += arena(p)
    placed += west_station(p)
    placed += east_station(p)
    placed += north_station(p)
    placed += nave(p)
    placed += south(p, {})
    placed += colonnade(p)

    # fill light: the gatehouse is lit by fire, so the ember lights do the work
    for cell in ((48, 43), (48, 57), (20, 45), (76, 45), (48, 25)):
        plan.lights.append({"x": cell[0] * 16 + 8, "y": cell[1] * 16 + 8,
                            "color": [1.0, 0.52, 0.34], "energy": 0.22, "scale": 3.0,
                            "cell": [cell[0], cell[1]], "note": "hall fill"})

    document = {
        "schema": "chapter1_architecture/1",
        "level": "chapter_1_level_9",
        "kit": KIT,
        "tile_size": 16,
        "note": (
            "Authored architecture for The Crimson Gate. Derived, additive and "
            "deterministic: it decorates cells the level already defines, never "
            "creates walkable or solid ground, and keeps all three gate seals, the "
            "exit, the checkpoint and the named elite clear of props. Generated by "
            "tools/level9/architecture_gatehouse.py."
        ),
        # A gatehouse lit by fire and nothing else.
        "ambient": [0.76, 0.68, 0.68],
        "background": [0.046, 0.028, 0.032],
        # Ledger: paving 93, wall mass 93. The gate hall had no mid value at all, so
        # its walls dissolved into its floor. The wall mass steps down; the rock,
        # already under both, comes down a little further to keep the order.
        "wall_tint": [0.84, 0.83, 0.83],
        "bedrock_tint": [0.80, 0.80, 0.82],
        "layers": {"floor": plan.floor, "wall": plan.wall},
        "props": plan.props,
        "lights": plan.lights,
        "stats": {
            "floor_overrides": len(plan.floor),
            "wall_overrides": len(plan.wall),
            "props": len(plan.props),
            "lights": len(plan.lights),
            "aisle_cells": painted_aisle,
            "avenue_cells": painted_avenue,
            "medallion_cells": painted_medallions,
            "piers": len(PIERS),
            "ring_cells": painted_rings,
            "blood_cells": painted_blood,
            "wall_dressing": painted_walls,
            "face_rows": len(rows),
        },
    }
    return document, level


def main() -> None:
    document, level = build()
    problems = validate(document, level, tall=TALL)
    normalise_lights(document)
    write_document(OUT, document)
    print("level 9 architecture -> %s" % os.path.relpath(OUT, ROOT))
    for key, value in document["stats"].items():
        print("  %-20s %s" % (key, value))
    if problems:
        print("  PROBLEMS (%d):" % len(problems))
        for problem in problems[:20]:
            print("   ", problem)
    else:
        print("  validation: clean")


if __name__ == "__main__":
    main()
