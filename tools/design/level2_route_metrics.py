#!/usr/bin/env python3
"""Measure Level 2 route lengths on the authored floor mask.

The numbers are cell counts of the real 4-connected walkable shortest path
(obstructions removed), converted to pixels and to seconds at the Knight's
authored 96 px/s (`game/characters/knight/knight.gd`). They are *route
lengths*, not playthrough timings: combat, dodging and reading the room are
not modelled here.

    python3 tools/design/level2_route_metrics.py
"""

from __future__ import annotations

import json
from collections import deque

LEVEL = "data/levels/chapter_1_level_2.json"
CELL = 16
SPEED = 96.0  # knight.gd move_speed
HURDLE = 0.35  # seconds a cautious player loses per spike band, planning only

# (label, id-or-cell start, id-or-cell goal) — ids resolve to entity positions.
ROUTES = [
    ("spawn -> jaw fork", "player_spawn", (50, 26)),
    ("spawn -> high-road sigil (Reliquary Chapel)", "player_spawn", "l2_sigil_choice_north"),
    ("spawn -> low-road sigil (Flooded Nave)", "player_spawn", "l2_sigil_choice_south"),
    ("high-road sigil -> rotunda door", "l2_sigil_choice_north", "door_l2_f1_f2_down"),
    ("low-road sigil -> rotunda door", "l2_sigil_choice_south", "door_l2_f1_f2_down"),
    ("floor-2 landing -> island sigil", "door_l2_f1_f2_up", "l2_sigil_ring"),
    ("island sigil -> floor-3 door", "l2_sigil_ring", "door_l2_f2_f3_down"),
    ("floor-3 landing -> choir sigil", "door_l2_f2_f3_up", "l2_sigil_gauntlet"),
    ("choir sigil -> exit", "l2_sigil_gauntlet", "l2_exit"),
    ("floor-3 landing -> exit, direct", "door_l2_f2_f3_up", "l2_exit"),
    ("floor-3 landing -> discovery chest -> exit", "door_l2_f2_f3_up", "l2_chest_gauntlet"),
    ("discovery chest -> exit", "l2_chest_gauntlet", "l2_exit"),
    ("floor-1 landing -> risky-branch chest", "player_spawn", "l2_chest_risky_branch"),
    ("floor-2 landing -> floor-3 door, north rim", "door_l2_f1_f2_up", "door_l2_f2_f3_down", [(58, 60)]),
    ("floor-2 landing -> floor-3 door, south rim", "door_l2_f1_f2_up", "door_l2_f2_f3_down", [(58, 86)]),
]


def load(path: str) -> dict:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def floor_mask(level: dict) -> set:
    return {(int(c["x"]), int(c["y"])) for c in level["layers"]["Backdrop"]}


def knight_clear(level: dict) -> set:
    """Cells a 12x16 Knight body can stand in (body above the origin cell)."""
    floor = floor_mask(level)
    return {(x, y) for (x, y) in floor if (x, y - 1) in floor}


def resolve(level: dict, key) -> tuple:
    if isinstance(key, tuple):
        return key
    for entity in level["entities"]:
        if entity["id"] == key:
            px = entity["position"]
            return (int(px[0]) // CELL, int(px[1]) // CELL)
    raise KeyError(key)


def snap(cells: set, cell: tuple) -> tuple:
    if cell in cells:
        return cell
    best, score = cell, None
    for candidate in cells:
        d = (candidate[0] - cell[0]) ** 2 + (candidate[1] - cell[1]) ** 2
        if score is None or d < score:
            best, score = candidate, d
    return best


def bfs(cells: set, start: tuple, goal: tuple) -> int | None:
    if start not in cells or goal not in cells:
        return None
    seen = {start}
    queue = deque([(start, 0)])
    while queue:
        (x, y), depth = queue.popleft()
        if (x, y) == goal:
            return depth
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nxt = (x + dx, y + dy)
            if nxt in cells and nxt not in seen:
                seen.add(nxt)
                queue.append((nxt, depth + 1))
    return None


def main() -> int:
    level = load(LEVEL)
    clear = knight_clear(level)
    rows = []
    for route in ROUTES:
        label, start_key, goal_key = route[0], route[1], route[2]
        waypoints = route[3] if len(route) > 3 else []
        legs = [resolve(level, start_key)]
        legs += [snap(clear, point) for point in waypoints]
        legs.append(resolve(level, goal_key))
        total = 0
        for a, b in zip(legs, legs[1:]):
            leg = bfs(clear, snap(clear, a), snap(clear, b))
            if leg is None:
                total = None
                break
            total += leg
        cells = total
        if cells is None:
            rows.append((label, "unreachable", "-", "-"))
            continue
        px = cells * CELL
        rows.append((label, str(cells), f"{px}", f"{px / SPEED:.1f}"))

    print("| route | cells | px | traversal s @96 px/s |")
    print("| --- | ---: | ---: | ---: |")
    for label, cells, px, seconds in rows:
        print(f"| {label} | {cells} | {px} | {seconds} |")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
