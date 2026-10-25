#!/usr/bin/env python3
"""Level 6 — The Relay House. Composition.

"This level teaches relay in both directions." The art has to say that without a
tooltip, so the composition is built on three authored ideas, one per floor:

* **The stepped approach** (floor 1). The west approach is cut into shallow
  terraces with visible risers, climbing east toward the first Soul Anchor. Pylon
  pairs mark each terrace brow, so the climb is counted by the eye.
* **The split diamond** (floor 2). Two lanes run north and south around the
  central block. Both carry copper conduit; each carries chevrons pointing the
  opposite way, and a signal wheel is hung where the lanes divide, its two needles
  opposed. A player who reads the floor learns the lesson by walking it.
* **The return loop** (floor 3). The conduit circles the final Anchor chamber and
  comes back west to the exit, against the direction of every chevron.

Under each Anchor a large inlaid medallion is cut into the paving: concentric
copper and verdigris rings around a two-diamond mark, the same mark the exit arch
carries. It is drawn as floor tiles, so it follows the room and never invents
ground.

Run: python3 tools/level6/architecture_relay.py
"""

from __future__ import annotations

import os
import sys
from collections import deque

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chapter1_env"))

from kitlib import (  # noqa: E402
    ROOT, Plan, cells, entities, load_level, protected, room_around, validate,
    wall_faces, write_document, ascii_map,
    normalise_lights,
)
from art_relay import medallion_offsets  # noqa: E402

LEVEL = 6
OUT = os.path.join(ROOT, "data", "levels", "chapter_1_level_6_architecture.json")
RADIUS = 4

# The three Anchor chambers, from the map's own `special_zones` (x, y, w, h).
ANCHORS = [
    {"sigil": (74, 14), "zone": (64, 9, 15, 12), "name": "relay_shrine"},
    {"sigil": (78, 49), "zone": (68, 44, 15, 12), "name": "split_diamond"},
    {"sigil": (79, 81), "zone": (70, 76, 13, 10), "name": "return_loop"},
]
SPAWN = (9, 23)
EXIT = (12, 75)
DOORS = [(108, 15), (10, 46), (108, 45), (106, 74)]
# Named rooms from the map metadata; used to bound dressing, never to invent cells.
ROOMS = {
    "spawn": (4, 17, 18, 12),
    "f1_anchor": (45, 4, 34, 22),
    "f1_breather": (91, 4, 24, 20),
    "f2_landing": (4, 39, 18, 15),
    "f2_breather": (94, 37, 21, 18),
    "f3_landing": (96, 66, 19, 16),
    "f3_exit": (4, 67, 24, 17),
}


def in_rect(cell, rect) -> bool:
    x, y, w, h = rect
    return rect[0] <= cell[0] < rect[0] + w and rect[1] <= cell[1] < rect[1] + h


def bfs(floor, geom, start, goal):
    """Shortest walkable route, deterministic in neighbour order."""
    if start not in floor or goal not in floor:
        return []
    previous = {start: None}
    queue = deque([start])
    while queue:
        current = queue.popleft()
        if current == goal:
            break
        for dx, dy in ((0, -1), (1, 0), (-1, 0), (0, 1)):
            nxt = (current[0] + dx, current[1] + dy)
            if nxt in previous or nxt not in floor or nxt in geom:
                continue
            previous[nxt] = current
            queue.append(nxt)
    if goal not in previous:
        return []
    path = []
    node = goal
    while node is not None:
        path.append(node)
        node = previous[node]
    return list(reversed(path))


def ring_around(block: set) -> list:
    """Floor cells touching the block, ordered clockwise from the north-west."""
    ring = set()
    for (bx, by) in block:
        for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
            ring.add((bx + dx, by + dy))
    return sorted(ring)


def conduit_path(plan, floor, geom, path, *, chevron_at=(), seed_note="", stop=()):
    """Paint a copper conduit along a route and light the junctions."""
    for index, cell in enumerate(path):
        if any(abs(cell[0] - s[0]) <= 2 and abs(cell[1] - s[1]) <= 2 for s in stop):
            continue
        prev_cell = path[index - 1] if index else None
        next_cell = path[index + 1] if index + 1 < len(path) else None
        horizontal = any(c and c[1] == cell[1] for c in (prev_cell, next_cell))
        vertical = any(c and c[0] == cell[0] for c in (prev_cell, next_cell))
        if horizontal and vertical:
            frame = "conduit_node"
        elif horizontal:
            frame = "conduit_h"
        else:
            frame = "conduit_v"
        plan.floor_tile(cell, frame)
        if index % 10 == 3:
            plan.lights.append({
                "x": cell[0] * 16 + 8, "y": cell[1] * 16 + 8,
                "color": [0.55, 0.95, 0.82], "energy": 0.18, "scale": 0.70,
                "cell": [cell[0], cell[1]], "note": "conduit glow" + seed_note,
            })
    for cell, direction in chevron_at:
        if cell in floor and cell not in geom:
            plan.floor_tile(cell, "chevron_" + direction)


def spurs(plan, floor, geom, path, faces, guard) -> None:
    """Branch the signal off the trunk run toward the wall every dozen cells.

    A single line across a large room leaves the rest of the floor inert; a few
    short spurs that end at an insulator post make the room read as wired.
    """
    for index in range(6, len(path), 12):
        cell = path[index]
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            if (cell[0] + dx, cell[1] + dy) not in floor:
                continue
            if (cell[0] + dx, cell[1] + dy) in geom:
                continue
            # walk up to three cells toward that direction, stop at anything solid
            stepped = []
            cursor = cell
            for _ in range(3):
                nxt = (cursor[0] + dx, cursor[1] + dy)
                if nxt not in floor or nxt in geom or nxt in guard:
                    break
                stepped.append(nxt)
                cursor = nxt
            if len(stepped) < 2:
                continue
            for spur_cell in stepped:
                plan.floor_tile(spur_cell, "conduit_h" if dy else "conduit_v")
            post_cell = stepped[-1]
            if post_cell not in guard:
                plan.prop("conduit_post", post_cell, note="spur insulator")
            break


def scatter(plan, floor, geom, guard) -> None:
    """Small, deterministic debris near the wall feet: a place people used."""
    for (cx, cy) in sorted(floor):
        if (cx, cy) in geom or (cx, cy) in guard:
            continue
        near_wall = any((cx + dx, cy + dy) in geom
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if not near_wall:
            continue
        roll = ((cx * 53 + cy * 91) % 97) / 97.0
        if roll < 0.035:
            plan.prop("rubble", (cx, cy), note="fallen masonry")
        elif roll < 0.055:
            plan.prop("cable_coil", (cx, cy), note="spare conduit")


def medallion(plan, floor, geom, centre, radius=RADIUS) -> int:
    """Cut the inlaid relay disc into the paving, clipped to real floor."""
    painted = 0
    for (dx, dy), frame in medallion_offsets(radius).items():
        cell = (centre[0] + dx, centre[1] + dy)
        if cell in floor and cell not in geom:
            plan.floor_tile(cell, frame)
            painted += 1
    plan.lights.append({
        "x": centre[0] * 16 + 8, "y": centre[1] * 16 + 8,
        "color": [0.60, 0.98, 0.86], "energy": 0.30, "scale": 1.7,
        "cell": [centre[0], centre[1]], "note": "the medallion's own light",
    })
    return painted


def chambers(plan, floor, geom, faces, guard, level) -> None:
    for index, anchor in enumerate(ANCHORS):
        sx, sy = anchor["sigil"]
        rect = anchor["zone"]
        medallion(plan, floor, geom, (sx, sy))

        # --- the dais: a ring of raised slabs around the medallion ----------
        for offset in range(-6, 7):
            for cell, frame in (((sx + offset, sy + 6), "step_lip"),
                                ((sx - 6, sy + offset), "step_lip_v"),
                                ((sx + offset, sy - 6), "terrace"),
                                ((sx + 6, sy + offset), "terrace")):
                if cell in floor and cell not in geom:
                    plan.floor_tile(cell, frame)

        # --- the processional ring: a railed aisle one step out from the dais --
        for side, horizontal in (("north", True), ("south", True),
                                 ("west", False), ("east", False)):
            cells_of_side = []
            for offset in range(-8, 9):
                cell = ((sx + offset, sy - 8) if side == "north" else
                        (sx + offset, sy + 8) if side == "south" else
                        (sx - 8, sy + offset) if side == "west" else
                        (sx + 8, sy + offset))
                cells_of_side.append(cell)
            if not all(c in floor and c not in geom for c in cells_of_side):
                continue
            for cell in cells_of_side:
                plan.floor_tile(cell, "aisle_h" if horizontal else "aisle_v")
        for dx, dy in ((-8, -8), (8, -8), (-8, 8), (8, 8)):
            cell = (sx + dx, sy + dy)
            if cell in floor and cell not in guard:
                plan.floor_tile(cell, "terrace")
                plan.prop("lamp_standing", cell, light={
                    "x": cell[0] * 16 + 8, "y": cell[1] * 16 - 34,
                    "color": [1.0, 0.82, 0.52], "energy": 0.7, "scale": 1.5,
                    "cell": [cell[0], cell[1]], "note": "ring lamp",
                })

        # --- the Anchor itself: a crystal monument on the axis behind the core
        monument = (sx, sy - 3)
        if monument in floor and monument not in guard:
            plan.prop("crystal_anchor", monument,
                      note="the Soul Anchor's crystal monument")
            plan.lights.append({
                "x": monument[0] * 16 + 8, "y": monument[1] * 16 - 56,
                "color": [0.68, 1.0, 0.90], "energy": 0.95, "scale": 2.0,
                "cell": [monument[0], monument[1]], "note": "crystal core light",
            })
        # broken crystal growth spilling from the plinth
        for dx, dy in ((-2, -3), (2, -2)):
            cell = (sx + dx, sy + dy)
            if cell in floor and cell not in guard:
                plan.prop("crystal_shard", cell, note="spilled Anchor crystal")

        # --- pylons frame the approach to the dais -------------------------
        for dx in (-5, 5):
            cell = (sx + dx, sy + 1)
            if cell in floor and cell not in guard:
                plan.prop("pylon_tall" if index == 0 else "pylon", cell,
                          light={"x": cell[0] * 16 + 8, "y": cell[1] * 16 - 62,
                                 "color": [0.60, 0.98, 0.86], "energy": 0.42,
                                 "scale": 1.35, "cell": [cell[0], cell[1]],
                                 "note": "pylon lantern"})

        # --- conduit posts at the medallion's rim, all four quadrants ------
        for dx, dy in ((-3, -3), (3, -3), (-3, 3), (3, 3)):
            cell = (sx + dx, sy + dy)
            if cell in floor and cell not in guard:
                plan.prop("conduit_post", cell, note="signal take-off at the rim")

        # --- console, seating and offerings on the dais' outer ring --------
        for dx, frame, dy in ((6, "pedestal", 2), (-7, "bench", 6), (7, "bench", 6),
                              (-8, "rubble", -3), (8, "urn", 6)):
            cell = (sx + dx, sy + dy)
            if cell in floor and cell not in guard:
                plan.prop(frame, cell)

        # --- wall dressing inside the chamber ------------------------------
        chamber_faces = sorted(c for c in faces if in_rect(c, rect))
        for cell in chamber_faces:
            offset = abs(cell[0] - sx)
            if offset == 5 and cell[1] < sy - 6:
                plan.prop("soul_figure", cell, note="a bound soul in the wall")
            elif offset == 8 and cell[1] < sy - 6:
                plan.prop("banner", cell, note="relay banner")
            elif cell[1] > sy + 7 and offset % 4 == 1:
                plan.prop("plaque", cell)

        # --- the chamber's own machines -------------------------------------
        if index == 0 and len(chamber_faces) > 1:
            plan.prop("bell", chamber_faces[1], note="relay bell over the first Anchor")
        elif index == 1:
            for cell in ((sx - 9, sy - 2), (sx - 9, sy + 3)):
                if cell in faces:
                    plan.prop("signal_wheel", cell, note="the two lanes, opposed")
        else:
            for cell in ((sx - 6, sy - 5), (sx + 3, sy - 5)):
                if cell in faces:
                    plan.prop("relay_horn", cell, note="return-loop horn")


def stepped_approach(plan, floor, geom) -> int:
    """Terraces climbing east through the west corridor into the first hall."""
    painted = 0
    for (cx, cy) in sorted(floor):
        if cy < 13 or cy > 26 or cx < 22 or cx > 52:
            continue
        band = (cx - 22) // 3
        if band % 2:
            continue
        if cx == 22 + band * 3:
            plan.floor_tile((cx, cy), "step_lip_v")
        else:
            plan.floor_tile((cx, cy), "terrace")
        painted += 1
    # a pylon at every second terrace brow, one on each side of the climb
    for cx in (25, 31, 37, 43, 49):
        for cy in (14, 24):
            cell = (cx, cy)
            if cell in floor and cell not in geom:
                plan.prop("pylon", cell, note="terrace brow")
                break
    return painted


def corridors(plan, floor, geom, faces, guard) -> None:
    """Dressing that reads as infrastructure rather than clutter."""
    for cell in sorted(faces):
        wall_light = cell[0] * 7 + cell[1] * 13
        if wall_light % 23 == 0:
            plan.prop("sconce", cell, light={
                "x": cell[0] * 16 + 8, "y": cell[1] * 16 - 22,
                "color": [1.0, 0.82, 0.54], "energy": 0.8, "scale": 1.4,
                "cell": [cell[0], cell[1]], "note": "wall sconce",
            })
        elif wall_light % 31 == 0:
            plan.prop("banner", cell)
    # standing lamps at the corners of the machine rooms
    for name in ("f1_breather", "f2_breather", "f3_landing", "f2_landing", "spawn"):
        rect = ROOMS[name]
        for dx, dy in ((1, 1), (rect[2] - 2, rect[3] - 2), (rect[2] - 2, 1), (1, rect[3] - 2)):
            cell = (rect[0] + dx, rect[1] + dy)
            if cell in floor and cell not in guard:
                plan.prop("lamp_standing", cell, light={
                    "x": cell[0] * 16 + 8, "y": cell[1] * 16 - 34,
                    "color": [1.0, 0.84, 0.56], "energy": 0.95, "scale": 1.7,
                    "cell": [cell[0], cell[1]], "note": "room lamp",
                })


def exit_room(plan, floor, geom, faces, guard) -> None:
    ex, ey = EXIT
    medallion(plan, floor, geom, (ex, ey), radius=2)
    for step in range(1, 10):
        cell = (ex, ey - step)
        if cell in faces:
            plan.prop("arch_relay", cell, note="the chapter door behind the exit")
            plan.lights.append({
                "x": cell[0] * 16 + 8, "y": cell[1] * 16 - 20,
                "color": [1.0, 0.86, 0.62], "energy": 1.35, "scale": 2.6,
                "cell": [cell[0], cell[1]], "note": "exit arch light",
            })
            break
    for dx in (-4, 4):
        cell = (ex + dx, ey + 2)
        if cell in floor and cell not in guard:
            plan.prop("pylon_tall", cell, light={
                "x": cell[0] * 16 + 8, "y": cell[1] * 16 - 62,
                "color": [0.64, 1.0, 0.88], "energy": 0.55, "scale": 1.4,
                "cell": [cell[0], cell[1]], "note": "exit pylon",
            })
    # the tally of cores: three plaques on the exit room's wall
    faces_here = sorted(c for c in faces if in_rect(c, ROOMS["f3_exit"]))
    for i, cell in enumerate(faces_here[:3]):
        plan.prop("plaque", cell, note="core tally %d" % (i + 1))


def door_dressing(plan, floor, geom, faces, guard) -> None:
    for (dx_, dy_) in DOORS:
        for step in range(1, 6):
            cell = (dx_, dy_ + step)
            if cell in faces:
                plan.prop("door_frame", cell, note="floor door surround")
                break


def long_run(cell, faces) -> bool:
    """True when this face is part of a wall seen broadside, not a cut end."""
    run = 1
    for dx in (-1, 1):
        probe = (cell[0] + dx, cell[1])
        while probe in faces and run < 4:
            run += 1
            probe = (probe[0] + dx, probe[1])
    return run >= 3


def wall_dressing(plan, floor, geom, faces) -> None:
    """Inlaid verdigris panels in the Anchor rooms; lancets at the exit."""
    for cell in sorted(faces):
        if not long_run(cell, faces):
            continue
        if any(in_rect(cell, anchor["zone"]) for anchor in ANCHORS):
            plan.wall_tile(cell, {0: "wall_panel", 1: "wall_panel_b", 2: "wall_panel_c"}[
                cell[0] % 3])
        elif in_rect(cell, ROOMS["f3_exit"]) or in_rect(cell, ROOMS["spawn"]):
            if cell[0] % 3 == 0:
                plan.wall_tile(cell, "wall_lancet")
        elif cell[0] % 5 == 0:
            plan.wall_tile(cell, "wall_relay")


def build() -> dict:
    level = load_level(LEVEL)
    floor = cells(level, "Backdrop")
    geom = cells(level, "Geometry")
    guard = protected(level)
    face_map = wall_faces(floor, geom)
    faces = {cell for values in face_map.values() for cell in values}

    plan = Plan()
    wall_dressing(plan, floor, geom, faces)
    terraces = stepped_approach(plan, floor, geom)
    chambers(plan, floor, geom, faces, guard, level)
    exit_room(plan, floor, geom, faces, guard)
    corridors(plan, floor, geom, faces, guard)
    door_dressing(plan, floor, geom, faces, guard)

    scatter(plan, floor, geom, guard)

    # wear follows the wall feet, where traffic and damp collect
    for (cx, cy) in sorted(floor):
        if (cx, cy) in geom:
            continue
        near_wall = any((cx + dx, cy + dy) in geom
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if not near_wall:
            continue
        roll = ((cx * 71 + cy * 137) % 100) / 100.0
        if roll < 0.10:
            plan.floor_tile((cx, cy), "floor_broken")
        elif roll < 0.38:
            plan.floor_tile((cx, cy), "floor_worn")

    # --- floor 1: the approach, then the anchor, then the east breather ----
    route_1 = bfs(floor, geom, SPAWN, ANCHORS[0]["sigil"])
    conduit_path(plan, floor, geom, route_1[: len(route_1) // 2],
                 chevron_at=[(route_1[i], "e") for i in (6, 18, 30)
                             if i < len(route_1) // 2], seed_note=" (floor 1 approach)",
                 stop=[ANCHORS[0]["sigil"]])
    remaining_1 = route_1[len(route_1) // 2:]
    conduit_path(plan, floor, geom, remaining_1, seed_note=" (floor 1 anchor)",
                 stop=[ANCHORS[0]["sigil"]])

    # --- floor 2: two lanes round the diamond, chevrons opposed -----------
    block_2 = {(x, y) for (x, y) in geom if 50 <= x <= 64 and 39 <= y <= 51}
    ring_2 = [c for c in sorted(ring_around(block_2)) if c in floor and c not in geom]
    for cell in ring_2:
        plan.floor_tile(cell, "conduit_h" if abs(cell[1] - 45) > 1 else "conduit_v")
    north = [c for c in ring_2 if c[1] < 45]
    south = [c for c in ring_2 if c[1] > 45]
    for i, cell in enumerate(north):
        if i % 4 == 2:
            plan.floor_tile(cell, "chevron_e")
    for i, cell in enumerate(south):
        if i % 4 == 2:
            plan.floor_tile(cell, "chevron_w")
    route_2 = bfs(floor, geom, (11, 46), ANCHORS[1]["sigil"])
    conduit_path(plan, floor, geom, route_2, seed_note=" (floor 2 west lane)",
                 stop=[ANCHORS[1]["sigil"]])

    # --- floor 3: the return loop, westward -------------------------------
    block_3 = {(x, y) for (x, y) in geom if 50 <= x <= 70 and 68 <= y <= 80}
    ring_3 = [c for c in sorted(ring_around(block_3)) if c in floor and c not in geom]
    for cell in ring_3:
        plan.floor_tile(cell, "conduit_h" if abs(cell[1] - 74) > 1 else "conduit_v")
    for i, cell in enumerate(sorted(ring_3)):
        if i % 4 == 1:
            plan.floor_tile(cell, "chevron_w")
    route_3 = bfs(floor, geom, (105, 74), ANCHORS[2]["sigil"]) + bfs(
        floor, geom, ANCHORS[2]["sigil"], EXIT)
    conduit_path(plan, floor, geom, route_3, seed_note=" (floor 3 return)",
                 stop=[ANCHORS[2]["sigil"]])

    for route in (route_1, route_2, route_3):
        spurs(plan, floor, geom, route, faces, guard)

    document = {
        "schema": "chapter1_architecture/1",
        "level": "chapter_1_level_6",
        "kit": "relay",
        "tile_size": 16,
        "note": (
            "Authored architecture for The Relay House. Derived, additive and "
            "deterministic: it decorates cells the level already defines and never "
            "creates walkable or solid ground of its own. Generated by "
            "tools/level6/architecture_relay.py."
        ),
        # A cold, damp signal-house: teal shadow, a pale sky-lit background, and a
        # palette that never warms past the copper fittings.
        "ambient": [0.72, 0.76, 0.82],
        "background": [0.020, 0.032, 0.045],
        "layers": {"floor": plan.floor, "wall": plan.wall},
        "props": plan.props,
        "lights": plan.lights,
        "stats": {
            "floor_overrides": len(plan.floor),
            "wall_overrides": len(plan.wall),
            "props": len(plan.props),
            "lights": len(plan.lights),
            "terraced_cells": terraces,
            "diamond_ring_cells": len(ring_2),
            "return_ring_cells": len(ring_3),
        },
    }
    return document, level


def main() -> None:
    document, level = build()
    problems = validate(document, level)
    normalise_lights(document)
    write_document(OUT, document)
    stats = document["stats"]
    print("level 6 architecture -> %s" % os.path.relpath(OUT, ROOT))
    for key, value in stats.items():
        print("  %-20s %s" % (key, value))
    if problems:
        print("  PROBLEMS (%d):" % len(problems))
        for problem in problems[:20]:
            print("    " + problem)
        raise SystemExit(1)
    print("  validation: clean")


if __name__ == "__main__":
    main()
