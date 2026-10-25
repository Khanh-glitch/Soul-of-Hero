#!/usr/bin/env python3
"""Level 10 — The Castellan's Throne. Composition.

The chapter's last room, so it is built on one axis and every element on it is
meant to be read from the south door: the antechamber, the nave, the crimson
runner, the steps, the throne, and the portal above and behind it.

This file adds no colliders, no cells and no mechanics. It decorates:

* **The throne and its steps** — a colossal seat on the arena's north edge with a
  four-tier approach drawn in the paving, low enough that the camera sees the whole
  seat (the map edge is at the top, and a throne taller than the frame is a wall).
* **The crimson cross** — the runner up the axis and a band across the arena, which
  is exactly the crossing the fight is built around, drawn as carpet.
* **The chapter portal** — a moon-lit arch with two gold-banded pillars, framed on
  the axis behind the throne, its light the only cold light in the level.
* **The court** — heavy columns on the four pillars, gold-leaf friezes, a moon
  window in the wall, banners, statues, candelabra and the wreckage of the fight
  that got this far.

Run: python3 tools/level10/architecture_castellan.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chapter1_env"))

from kitlib import (  # noqa: E402
    ROOT, Plan, cells, load_level, protected, validate, wall_faces, write_document,
)

LEVEL = 10
OUT = os.path.join(ROOT, "data", "levels", "chapter_1_level_10_architecture.json")
KIT = "castellan"

AXIS = (49, 50, 51)
THRONE = (50, 19)
PORTAL = (50, 7)
BOSS = (50, 25)
CROSS_BAND = (31, 32)
CROSS_SPAN = (34, 65)
# fixtures that must stand on masonry, never in the walk
TALL = {"column", "column_broken", "statue", "banner", "banner_torn", "censer"}


def face_rows(faces) -> dict:
    rows = {}
    for (x, y) in faces:
        rows.setdefault(y, []).append(x)
    return {y: sorted(xs) for y, xs in rows.items()}


def floor_base(plan, floor, geom) -> None:
    for (cx, cy) in sorted(floor):
        if (cx, cy) in geom:
            continue
        plan.floor_tile((cx, cy), "floor_" + "abcd"[(cx % 2) * 2 + (cy % 2)])


def runner(plan, floor, geom) -> int:
    """The crimson runner up the axis, with two places where the fight broke it."""
    painted = 0
    breaks = (49, 50, 36, 37)
    for (cx, cy) in sorted(floor):
        if (cx, cy) in geom or cx not in AXIS:
            continue
        if cy < 20 or cy > 71:
            continue
        if cy in breaks:
            plan.floor_tile((cx, cy), "broken_" + "abcd"[(cx % 2) * 2 + (cy % 2)])
        else:
            plan.floor_tile((cx, cy), "carpet_v")
        painted += 1
    return painted


def cross(plan, floor, geom) -> int:
    """The crossing lanes of the fight, drawn as the same carpet."""
    painted = 0
    for cy in CROSS_BAND:
        for cx in range(CROSS_SPAN[0], CROSS_SPAN[1] + 1):
            cell = (cx, cy)
            if cell not in floor or cell in geom or cx in AXIS:
                continue
            plan.floor_tile(cell, "carpet_h")
            painted += 1
    return painted


def steps(plan, floor, geom) -> int:
    """The four steps up to the throne: widening as they come down into the room."""
    painted = 0
    tiers = ((20, 47, 54), (21, 46, 55), (22, 44, 57), (23, 42, 59))
    for (cy, x0, x1) in tiers:
        for cx in range(x0, x1 + 1):
            cell = (cx, cy)
            if cell not in floor or cell in geom:
                continue
            if cx in AXIS:
                plan.floor_tile(cell, "carpet_v")
            elif cx in (x0, x1):
                plan.floor_tile(cell, "aisle_" + "abcd"[(cx % 2) * 2 + (cy % 2)])
            else:
                plan.floor_tile(cell, "lane_" + "abcd"[(cx % 2) * 2 + (cy % 2)])
            painted += 1
    return painted


def portal_floor(plan, floor, geom) -> int:
    """A lit threshold under the portal: the last thing the player sees."""
    painted = 0
    for cy in range(8, 13):
        for cx in range(46, 55):
            cell = (cx, cy)
            if cell not in floor or cell in geom:
                continue
            if cx in (49, 50, 51) and cy <= 11:
                plan.floor_tile(cell, "lane_" + "abcd"[(cx % 2) * 2 + (cy % 2)])
            else:
                plan.floor_tile(cell, "aisle_" + "abcd"[(cx % 2) * 2 + (cy % 2)])
            painted += 1
    return painted


def wear(plan, floor, geom) -> int:
    """Damage concentrated on the approach, where the Castellan's guard fell back."""
    painted = 0
    for (cx, cy) in sorted(floor):
        if (cx, cy) in geom or cx in AXIS:
            continue
        roll = ((cx * 67 + cy * 103) % 100) / 100.0
        if 44 <= cy <= 60 and roll < 0.10:
            plan.floor_tile((cx, cy), "floor_broken")
            painted += 1
        elif 14 <= cy <= 45 and roll < 0.04:
            plan.floor_tile((cx, cy), "floor_worn")
            painted += 1
    return painted


def walls(plan, faces) -> int:
    """Gold frieze and moon windows on the arena wall; plain ashlar elsewhere."""
    painted = 0
    rows = face_rows(faces)
    for cell in sorted(faces):
        x, y = cell
        roll = ((x * 71 + y * 37) % 100) / 100.0
        if y == 13:
            if roll < 0.24:
                plan.wall_tile(cell, "wall_window")
            elif roll < 0.46:
                plan.wall_tile(cell, "wall_gold")
            painted += 1
        elif y in (23, 34):
            plan.wall_tile(cell, "wall_gold")
            painted += 1
        elif y == 3:
            if roll < 0.4:
                plan.wall_tile(cell, "wall_gold")
                painted += 1
        else:
            if roll < 0.18:
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


def candle(cell, energy=0.75, scale=1.6, y=-40, note="candle"):
    return {"x": cell[0] * 16 + 8, "y": cell[1] * 16 + y,
            "color": [1.0, 0.84, 0.60], "energy": energy, "scale": scale,
            "cell": [cell[0], cell[1]], "note": note}


def moon(cell, energy=0.8, scale=2.2, y=-30, note="moonlight"):
    return {"x": cell[0] * 16 + 8, "y": cell[1] * 16 + y,
            "color": [0.62, 0.86, 1.0], "energy": energy, "scale": scale,
            "cell": [cell[0], cell[1]], "note": note}


def throne_and_steps(p: Placer, rows) -> int:
    """The seat itself, the two chained candelabra beside it, the statues."""
    placed = 0
    placed += p.floor_prop("throne", THRONE, light=candle(THRONE, 0.55, 2.0, -70,
                                                        "throne light"),
                           note="the Castellan's throne")
    for cell in ((44, 20), (56, 20)):
        placed += p.floor_prop("candelabrum", cell, light=candle(cell),
                               note="throne candelabrum")
    for x in (27, 73):
        placed += p.wall("statue", (x, 13), light=moon((x, 13), 0.45, 1.5, 0, "statue light"),
                         note="statue of a predecessor")
    for x in (31, 35, 65, 69):
        placed += p.wall("banner", (x, 13), note="royal banner")
    for x in (39, 59):
        placed += p.wall("censer", (x, 13), light=candle((x, 13), 0.5, 1.3, 0, "censer"),
                         note="censer")
    return placed


def arena(p: Placer) -> int:
    """The court: columns on the four pillars, candelabra round the crossing."""
    placed = 0
    for cell in ((38, 23), (61, 23), (30, 34), (69, 34)):
        placed += p.wall("column", cell, note="pillar column")
    for cell in ((46, 28), (54, 28), (46, 38), (54, 38)):
        placed += p.floor_prop("candelabrum", cell, light=candle(cell),
                               note="court candelabrum")
    for cell in ((41, 42), (59, 42), (36, 18), (64, 18)):
        placed += p.floor_prop("rubble", cell, note="fallen masonry")
    # the flanks of the court: the Castellan's household stood here
    for cell in ((30, 22), (70, 22), (30, 42), (70, 42)):
        placed += p.floor_prop("candelabrum", cell, light=candle(cell),
                               note="flank candelabrum")
    for cell in ((33, 36), (67, 36), (33, 28), (67, 28)):
        placed += p.floor_prop("bench", cell, note="court bench")
    for cell in ((28, 45), (72, 45), (44, 16), (56, 16)):
        placed += p.floor_prop("rubble", cell, note="fallen masonry")
    for cell in ((47, 43), (53, 43)):
        placed += p.floor_prop("bench", cell, note="bench")
    return placed


def nave(p: Placer) -> int:
    """The processional: benches, candles, and the damage of the retreat."""
    placed = 0
    for cell in ((47, 52), (62, 52)):
        placed += p.floor_prop("bench", cell, note="bench")
    for cell in ((47, 57), (62, 57)):
        placed += p.floor_prop("candelabrum", cell, light=candle(cell),
                               note="nave candelabrum")
    for cell in ((46, 48), (63, 48)):
        placed += p.floor_prop("rubble", cell, note="fallen masonry")
    placed += p.floor_prop("rubble", (46, 55), note="broken column")
    placed += p.floor_prop("rubble", (63, 55), note="broken column")
    return placed


def antechamber(p: Placer, rows) -> int:
    """The checkpoint room: the last place the chapter lets you breathe."""
    placed = 0
    for cell in ((44, 62), (56, 62)):
        placed += p.floor_prop("candelabrum", cell, light=candle(cell),
                               note="vigil candle")
    for cell in ((43, 69), (56, 69)):
        placed += p.floor_prop("bench", cell, note="bench")
    for cell in ((45, 66), (55, 66)):
        placed += p.floor_prop("rubble", cell, note="fallen masonry")
    return placed


def portal(p: Placer) -> int:
    """The chapter portal: arch, pillars, and the light it throws."""
    placed = 0
    placed += p.floor_prop("portal_arch", (50, 8), light=moon((50, 8), 1.15, 2.8, -80,
                                                             "portal light"),
                           note="the chapter portal")
    for cell in ((43, 9), (57, 9)):
        placed += p.floor_prop("portal_pillar", cell,
                               light=moon(cell, 0.6, 1.8, -60, "portal pillar light"),
                               note="portal pillar")
    return placed


def build():
    level = load_level(LEVEL)
    floor = cells(level, "Backdrop")
    geom = cells(level, "Geometry")
    guard = protected(level)
    face_map = wall_faces(floor, geom)
    faces = {cell for values in face_map.values() for cell in values}
    rows = face_rows(faces)

    plan = Plan()
    floor_base(plan, floor, geom)
    painted_runner = runner(plan, floor, geom)
    painted_cross = cross(plan, floor, geom)
    painted_steps = steps(plan, floor, geom)
    painted_portal = portal_floor(plan, floor, geom)
    painted_wear = wear(plan, floor, geom)
    painted_walls = walls(plan, faces)

    p = Placer(plan, floor, geom, guard, faces)
    placed = 0
    placed += portal(p)
    placed += throne_and_steps(p, rows)
    placed += arena(p)
    placed += nave(p)
    placed += antechamber(p, rows)

    # the room's own light: cold from the windows and the portal, warm from candles
    for cell in ((34, 26), (66, 26), (34, 40), (66, 40), (50, 34), (50, 44)):
        plan.lights.append({"x": cell[0] * 16 + 8, "y": cell[1] * 16 + 8,
                            "color": [0.58, 0.54, 0.86], "energy": 0.12, "scale": 2.6,
                            "cell": [cell[0], cell[1]], "note": "throne room fill"})

    document = {
        "schema": "chapter1_architecture/1",
        "level": "chapter_1_level_10",
        "kit": KIT,
        "tile_size": 16,
        "note": (
            "Authored architecture for the Castellan's throne room. Derived, "
            "additive and deterministic: it decorates cells the level already "
            "defines, never creates walkable or solid ground, keeps the boss, the "
            "portal, the checkpoint and the spawn clear of props, and leaves the "
            "crossing lanes of the fight empty. Generated by "
            "tools/level10/architecture_castellan.py."
        ),
        # A throne room at nightfall: violet stone, warm candles, cold moonlight.
        "ambient": [0.44, 0.40, 0.52],
        "background": [0.040, 0.034, 0.052],
        "layers": {"floor": plan.floor, "wall": plan.wall},
        "props": plan.props,
        "lights": plan.lights,
        "stats": {
            "floor_overrides": len(plan.floor),
            "wall_overrides": len(plan.wall),
            "props": len(plan.props),
            "lights": len(plan.lights),
            "runner_cells": painted_runner,
            "cross_cells": painted_cross,
            "step_cells": painted_steps,
            "portal_cells": painted_portal,
            "wear_cells": painted_wear,
            "wall_dressing": painted_walls,
        },
    }
    return document, level


def main() -> None:
    document, level = build()
    problems = validate(document, level, tall=TALL)
    write_document(OUT, document)
    print("level 10 architecture -> %s" % os.path.relpath(OUT, ROOT))
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
