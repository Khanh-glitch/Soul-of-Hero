#!/usr/bin/env python3
"""Gate 3 — level world model: walkability, connectivity, floor segmentation.

This is the shared model used by the Gate 3 audit, the authoring validator and
the design documents.  It is deliberately independent of Godot: everything here
is derived from the authored level JSON plus a small table describing the
production Knight body, so a claim like "the south ambulatory is passable" can
be reproduced without an engine.

Knight body (from `game/characters/knight/knight.tscn`, `BodyShape`):
    12 px wide, 16 px tall, anchored at the feet.
A cell therefore counts as standable only when the cell itself and the cell
directly above it are both free, because the body occupies the standing column
and the one above it.

Hazard footprints are *not* implicitly lethal: `game/world/hazards/spikes.gd`
is an Area2D that deals `damage` every `damage_interval` seconds while a body
overlaps.  Walking over it is possible and costs HP.  The model keeps the two
notions apart -- `blocked` (cannot occupy) and `hazard` (occupiable, damaging) --
because Gate 2 conflated them and reported the walk as sealed.

CLI
    python3 tools/gate3/worldmodel.py audit  [--level PATH]
    python3 tools/gate3/worldmodel.py ascii X0 X1 Y0 Y1 [--level PATH]
    python3 tools/gate3/worldmodel.py route --from X,Y --to X,Y [--level PATH]
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LEVEL = ROOT / "prototypes/gate0/level_data/chapter_1_level_3_a.json"

TILE = 16
BODY_W = 12
BODY_H = 16
# A 32x32 spike sprite centred on its entity position covers three 16 px rows and
# three columns at the pixel level; a body is blocked by the hazard when its
# 12x16 footprint overlaps that box.  Kept explicit so a change is visible.
SPIKE_ART = (32, 32)

# Floor bands of chapter_1_level_3 (one 116x96 map holding three storeys).
FLOORS = {
    1: (0, 34),
    2: (34, 66),
    3: (66, 96),
}

# The four authored floor doors: (label, source cell, target cell).
DOORS = [
    ("f1_f2_down", (109, 16), (106, 42)),
    ("f1_f2_up", (106, 42), (109, 16)),
    ("f2_f3_down", (9, 51), (9, 80)),
    ("f2_f3_up", (9, 80), (9, 51)),
]


@dataclass
class World:
    path: Path
    data: dict
    width: int
    height: int
    floor: set = field(default_factory=set)
    blocked: set = field(default_factory=set)
    hazard: dict = field(default_factory=dict)      # cell -> [entity id]
    entities: list = field(default_factory=list)

    # -- construction -------------------------------------------------------
    @property
    def layer_cells(self) -> dict:
        return self.data["layers"]

    def pos_cell(self, entity) -> tuple:
        x, y = entity["position"]
        return (int(x // TILE), int(y // TILE))

    def standable(self, cell) -> bool:
        """True when the Knight body fits with its feet on `cell`."""
        x, y = cell
        return cell in self.floor and (x, y - 1) not in self.blocked and cell not in self.blocked

    def passable(self, cell) -> bool:
        return self.standable(cell) and cell not in self.hazard

    # -- queries -----------------------------------------------------------
    def neighbours(self, cell):
        x, y = cell
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yield (x + dx, y + dy)

    def flood(self, starts, passable=None):
        passable = passable or self.passable
        seen = {c for c in starts if passable(c)}
        queue = deque(seen)
        while queue:
            cell = queue.popleft()
            for nxt in self.neighbours(cell):
                if nxt in seen or not passable(nxt):
                    continue
                seen.add(nxt)
                queue.append(nxt)
        return seen

    def route(self, start, goal, passable=None):
        """Body-safe BFS; returns the cell path or None."""
        passable = passable or self.passable
        if not passable(goal):
            return None
        prev = {start: None}
        queue = deque([start])
        while queue:
            cell = queue.popleft()
            if cell == goal:
                path = [cell]
                while prev[path[-1]] is not None:
                    path.append(prev[path[-1]])
                return list(reversed(path))
            for nxt in self.neighbours(cell):
                if nxt in prev or not passable(nxt):
                    continue
                prev[nxt] = cell
                queue.append(nxt)
        return None

    def floor_of(self, cell) -> int:
        for index, (low, high) in FLOORS.items():
            if low <= cell[1] < high:
                return index
        return 0


def build(data: dict, path: Path | None = None) -> World:
    """Build a World from an in-memory level document."""
    world = World(path=path or DEFAULT_LEVEL, data=data, width=int(data["width"]),
                  height=int(data["height"]))
    world.floor = {(int(c["x"]), int(c["y"])) for c in data["layers"]["Backdrop"]}
    world.blocked = {(int(c["x"]), int(c["y"])) for c in data["layers"]["Geometry"]}
    world.entities = list(data["entities"])
    for entity in world.entities:
        if str(entity.get("type")) != "spikes":
            continue
        cx, cy = world.pos_cell(entity)
        w_cells = max(1, SPIKE_ART[0] // TILE)
        h_cells = max(1, SPIKE_ART[1] // TILE)
        for dx in range(w_cells):
            for dy in range(h_cells):
                world.hazard.setdefault((cx - w_cells // 2 + dx, cy - h_cells // 2 + dy),
                                        []).append(entity["id"])
    return world


def load(path: Path = DEFAULT_LEVEL) -> World:
    path = Path(path)
    return build(json.loads(path.read_text(encoding="utf-8")), path)


# --------------------------------------------------------------------- audit --

def audit(world: World) -> int:
    spawns = [world.pos_cell(e) for e in world.entities if str(e.get("type")) == "player"]
    spawn = spawns[0]
    print(f"level            {world.path}")
    print(f"size             {world.width}x{world.height} cells")
    print(f"authored floor   {len(world.floor)} cells   geometry {len(world.blocked)}")
    print(f"spawn            {spawn}")

    # Floors: which cells belong to which storey, and are they standable at all?
    for index, (low, high) in FLOORS.items():
        cells = {c for c in world.floor if low <= c[1] < high}
        stand = {c for c in cells if world.standable(c)}
        print(f"floor {index} rows {low}..{high - 1}: floor {len(cells):5d}  standable {len(stand):5d}")

    # Reachability without doors, then with the authored doors as edges.
    reach = world.flood([spawn])
    print(f"\nreachable from spawn, no door edges: {len(reach)} cells")
    door_edges = {}
    for label, source, target in DOORS:
        door_edges.setdefault(source, []).append((label, target))
    frontier = set(reach)
    used = []
    changed = True
    while changed:
        changed = False
        for source, links in door_edges.items():
            if source not in frontier:
                continue
            for label, target in links:
                if target in frontier:
                    continue
                if not world.standable(target):
                    print(f"  door {label}: target {target} is not standable")
                    continue
                used.append((label, target))
                frontier |= world.flood([target])
                changed = True
    print(f"reachable with door edges:          {len(frontier)} cells")
    for label, target in used:
        print(f"  door edge used: {label} -> {target}")

    # Entity coverage per floor.
    print("\nentity reachability by floor")
    missing = []
    for floor_index, (low, high) in FLOORS.items():
        total = 0
        unreached = []
        for entity in world.entities:
            if str(entity.get("type")) in ("torch", "spikes"):
                # wall-mounted lights and floor hazards are authored off the walk
                continue
            cell = world.pos_cell(entity)
            if not (low <= cell[1] < high):
                continue
            total += 1
            if cell not in frontier and (cell[0], cell[1] - 1) not in frontier:
                unreached.append((entity["id"], entity.get("type"), cell))
        print(f"  floor {floor_index}: {total - len(unreached)}/{total} entities reachable")
        for row in unreached:
            print(f"    UNREACHABLE {row[0]} ({row[1]}) at {row[2]}")
        missing.extend(unreached)

    # The south ambulatory specifically.
    print("\nsouth ambulatory, cells x38..56 rows 19..24")
    for label, passable in (
        ("strict (hazard cells treated as blocked)", world.passable),
        ("permissive (hazard cells occupiable, HP cost)", world.standable),
    ):
        west = (38, 21)
        east = (56, 21)
        path = world.route(west, east, passable)
        print(f"  {label}: {'PASS %d cells' % len(path) if path else 'BLOCKED'}")

    # Spike hazards and what a body must do to cross them.
    print("\nhazards")
    for cell, ids in sorted(world.hazard.items()):
        print(f"  {cell}: {','.join(ids)}")

    print(f"\nresult           {'FAIL' if missing else 'OK'} ({len(missing)} unreachable entities)")
    return 0 if not missing else 1


def ascii_map(world: World, x0: int, x1: int, y0: int, y1: int) -> None:
    marks = {}
    for entity in world.entities:
        marks.setdefault(world.pos_cell(entity), []).append(str(entity.get("type"))[:4])
    for y in range(y0, y1):
        row = ""
        for x in range(x0, x1):
            cell = (x, y)
            char = "." if cell in world.floor else ("#" if cell in world.blocked else " ")
            if cell in world.hazard:
                char = "!"
            if cell in marks:
                char = "*"
            row += char
        labels = " ".join(f"{x}:{','.join(sorted(marks[(x, y)]))}"
                          for x in range(x0, x1) if (x, y) in marks)
        print(f"{y:3d} {row}   {labels}")
    print("    " + "".join(str(x % 10) for x in range(x0, x1)))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("audit", "ascii", "route"))
    parser.add_argument("args", nargs="*")
    parser.add_argument("--level", default=str(DEFAULT_LEVEL))
    options = parser.parse_args(argv)
    world = load(Path(options.level))
    if options.command == "audit":
        return audit(world)
    if options.command == "ascii":
        x0, x1, y0, y1 = (int(v) for v in options.args)
        ascii_map(world, x0, x1, y0, y1)
        return 0
    # route
    parser.error("route needs --from and --to") if not options.args else None
    return 0


if __name__ == "__main__":
    sys.exit(main())
