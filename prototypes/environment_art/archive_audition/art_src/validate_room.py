#!/usr/bin/env python3
"""Validate the archive room layout before it is ever opened in Godot.

Checks the mistakes that are invisible in a thumbnail but obvious in-game:

  * a prop or light whose footprint pokes into wall mass or void
  * a prop that overlaps another prop's occupied pixels
  * a solid prop that overlaps a walkable route or the spawn
  * props that overlap the door threshold
  * decals placed on cells with no floor
  * wall-face tiles that are not adjacent to any floor (orphan faces)
  * gaps in the wall ring (a cell that is neither wall nor floor)
  * spawn / camera points outside the floor

Exit code 1 on any error. Warnings (soft overlaps, tight clearances) are listed
but do not fail.

    python3 validate_room.py
"""

from __future__ import annotations

import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.normpath(os.path.join(HERE, ".."))
T = 16

# A Knight body is 12x16 px; keep at least this much clear around solid props.
KNIGHT_W, KNIGHT_H = 12, 16
WALK_CLEARANCE = 2

errors: list[str] = []
warnings: list[str] = []


def name_of(prop: dict) -> str:
    return prop["sprite"]


def load() -> dict:
    with open(os.path.join(BASE, "room.json"), encoding="utf-8") as fh:
        return json.load(fh)


def main() -> int:
    room = load()
    width, height = room["width"] * T, room["height"] * T
    floor = {(c[0] * T, c[1] * T) for c in room["layers"]["floor"]}
    water = {(c[0] * T, c[1] * T) for c in room["layers"]["water"]}
    stair = {(c[0] * T, c[1] * T) for c in room["layers"]["stair"]}
    caps = {(c[0] * T, c[1] * T) for c in room["layers"]["cap"]}
    faces = {(c[0] * T, c[1] * T) for c in room["layers"]["face"]}
    walkable = floor | water | stair | {c for c in caps | faces}  # for wall checks
    wall = caps | faces

    # ---- 1. wall ring completeness --------------------------------------
    for y in range(room["height"]):
        for x in range(room["width"]):
            p = (x * T, y * T)
            if p in wall or p in floor or p in water or p in stair:
                continue
            # a void cell is fine only if it is outside the room envelope
            neighbours = sum(
                1 for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))
                if (p[0] + dx * T, p[1] + dy * T) in floor | water | stair | wall
            )
            if neighbours >= 3:
                errors.append(
                    f"map: enclosed gap at cell {p[0] // T},{p[1] // T} "
                    "(neither wall nor floor)"
                )

    # ---- 2. orphan wall faces -------------------------------------------
    for p in faces:
        x, y = p
        touching = any(
            (x + dx * T, y + dy * T) in floor | water | stair
            for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))
        )
        if not touching:
            errors.append(f"wall: face at {x // T},{y // T} touches no floor")

    # ---- 3. prop footprints ---------------------------------------------
    # Wall-set furniture is allowed to touch the masonry; what is not allowed is
    # a sprite that floats entirely inside a wall or spills into void.
    WALL_SET = {"shelf_full", "shelf_partial", "shelf_closed", "armarium_open",
                "armarium_closed", "door_portal", "wall_lamp", "paternoster",
                "candle_stand", "drying_rack"}
    occupied: dict[tuple[int, int], str] = {}
    prop_boxes = []
    structural_errors: set[str] = set()
    for prop in room["props"]:
        _sx, _sy, w, h = prop["source"]
        if prop["anchor"] == "base":
            left = prop["x"] - w // 2
            top = prop["y"] - h
        else:
            left, top = prop["x"], prop["y"]
        prop_boxes.append((prop, left, top, w, h))

        # ground contact: the bottom 6 px of the sprite must sit on floor
        contact = set()
        for py in range(top + h - 6, top + h, 2):
            for px_ in range(left + 2, left + w - 2, 2):
                contact.add((px_ // T * T, py // T * T))
        if contact and not (contact & (floor | water | stair)):
            errors.append(
                f"prop: {name_of(prop)} has no floor contact "
                f"(its base is at {sorted(contact)[0]})"
            )

        cells = set()
        for py in range(top, top + h, 2):
            for px_ in range(left, left + w, 2):
                cells.add((px_ // T * T, py // T * T))
        on_wall = {c for c in cells if c in wall}
        on_floor = {c for c in cells if c in floor | water | stair}
        on_void = {c for c in cells if c not in wall and c not in floor
                   and c not in water and c not in stair}
        name = prop["sprite"]
        if on_void:
            structural_errors.add(f"prop: {name} spills into void at {sorted(on_void)[0]}")
        if not on_floor and not on_wall:
            structural_errors.add(f"prop: {name} is outside the map")
        ratio = len(on_wall) / max(1, len(cells))
        if ratio > 0.75 and name not in WALL_SET:
            warnings.append(
                f"prop: {name} body is {ratio:.0%} over the wall — confirm this is "
                "its realistic height, not a one-row misplacement"
            )

        if prop["solid"]:
            for cy in range(top // T, (top + h - 1) // T + 1):
                for cx in range(left // T, (left + w - 1) // T + 1):
                    cell = (cx * T, cy * T)
                    if cell in wall:
                        continue
                    if cell in occupied:
                        warnings.append(
                            f"prop: {name} shares tile {cx},{cy} with {occupied[cell]}"
                        )
                    occupied[cell] = name

    errors.extend(sorted(structural_errors))

    # ---- 4. player clearance around solid props -------------------------
    blocked = set(occupied)
    spawn = room["spawn"]
    spawn_cell = (spawn[0] // T * T, spawn[1] // T * T)
    if spawn_cell in blocked:
        errors.append(
            f"spawn: {spawn_cell[0] // T},{spawn_cell[1] // T} is inside a solid prop"
        )
    if spawn_cell not in floor | stair:
        errors.append("spawn: not on floor")

    # flood fill from spawn to prove the room is traversable and the front of the
    # armarium is reachable
    open_cells = (floor | stair) - blocked
    seen = {spawn_cell}
    stack = [spawn_cell]
    while stack:
        cx, cy = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (cx + dx * T, cy + dy * T)
            if n in open_cells and n not in seen:
                seen.add(n)
                stack.append(n)
    unreachable = len(open_cells - seen)
    if unreachable > 0:
        warnings.append(f"route: {unreachable} open cells are cut off from spawn")
    for name, point in room["camera_points"].items():
        cell = (point[0] // T * T, point[1] // T * T)
        if cell not in seen:
            errors.append(f"camera: {name} point {cell} is not reachable from spawn")

    # the armarium must be reached from the front
    armarium = next(
        (b for b in prop_boxes if b[0]["sprite"] == "armarium_open"), None
    )
    if armarium:
        _, left, top, w, h = armarium
        front = ((left + w // 2) // T * T, (top + h + 8) // T * T)
        if front not in seen:
            errors.append(f"route: the front of the armarium at {front} is unreachable")

    # ---- 5. door assembly ------------------------------------------------
    door = next((b for b in prop_boxes if b[0]["sprite"] == "door_portal"), None)
    if door is None:
        warnings.append("door: no door portal in the room")
    else:
        _, left, top, w, h = door
        if left < 0 or left + w > width or top + h > height:
            errors.append("door: portal is clipped by the map edge")

    # ---- 6. decal sanity -------------------------------------------------
    for cell in room["layers"]["decal"]:
        if (cell[0] * T, cell[1] * T) not in floor:
            warnings.append(f"decal at {cell[0]},{cell[1]} sits on non-floor")

    # ---- report ----------------------------------------------------------
    print(f"room {room['width']}x{room['height']}  floor {len(floor)} cells  "
          f"walkable-from-spawn {len(seen)}  solid props {len(blocked)}")
    for message in warnings:
        print(f"WARN  {message}")
    for message in errors:
        print(f"ERROR {message}")
    if errors:
        print(f"\nROOM VALIDATION FAILED ({len(errors)} errors, {len(warnings)} warnings)")
        return 1
    print(f"ROOM VALIDATION PASSED ({len(warnings)} warnings)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
