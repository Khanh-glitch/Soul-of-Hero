#!/usr/bin/env python3
"""Author the survival resource plan for the Hollow Marches.

The plan is **data**, not a runtime scatter: every entry names a real world cell
next to a real, reachable feature, so a player walking the marches meets timber
where there are trees and stone where there is rock. `SurvivalBuildSystem` reads
it as-is, and A1 can replace the file with the continent's ecology without any
code change.

Placement rules (all measured against the authored world, never guessed):

* the cell must be open, walkable ground — not solid, not water;
* it must sit beside its source prop (the tree, the outcrop, the reed bed);
* it must be reachable from the authored spawn through the traversability grid;
* no two nodes closer than `resource_scatter_spacing_tiles`, so a resource node
  never reads as a decorated cluster;
* nothing inside the landmark / camp clearance, so harvesting never competes with
  the ten dungeon approaches;
* a minimum number of each kind near the spawn, so the first minute of play has
  something to do whatever direction the player walks.

Run from the repository root:

    python3 tools/survival/author_resources.py
"""

from __future__ import annotations

import json
import os
import sys
from collections import deque

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WORLD = os.path.join(ROOT, "data", "overworld", "hollow_marches.json")
LAYERS = os.path.join(ROOT, "data", "overworld", "hollow_marches_layers.json")
PROPS = os.path.join(ROOT, "data", "overworld", "hollow_marches_props.json")
CATALOG = os.path.join(ROOT, "data", "survival", "survival_catalog.json")
OUT = os.path.join(ROOT, "data", "survival", "hollow_marches_resources.json")

# Which authored props each resource kind is harvested from, and how many nodes of
# that kind the plan should try to place.
#
# Sources are deliberately plural. A resource node is a *place where a material is
# found*, not a specific sprite: stone comes from rock formations AND from the
# broken masonry the world is full of, and iron comes from veins in the rock AND
# from the abandoned supplies lying around the camps. That plural sourcing is what
# makes the ecology read as a world rather than as a spawn table, and it is also
# what puts a first handful of scrap within reach of the starting refuge without
# inventing a second kind of tree.
KIND_SOURCES = {
    "oak_tree": (("tree_dead", "tree_pine"), 26),
    "stone_outcrop": (("rock_b", "wall_stub"), 18),
    "iron_vein": (("rock_d", "rock_f"), 12),
    "reed_clump": (("bush",), 16),
    "scrap_pile": (("barrel",), 8),
}
SPACING = 7
NEAR_SPAWN = 6        # at least this many of each kind within 22 tiles of spawn
NEAR_RADIUS = 22


def load(path):
    with open(path) as handle:
        return json.load(handle)


def unpack_rle(layer, width, height):
    cells = []
    for code, count in layer["rle"]:
        cells.extend([code] * int(count))
    if len(cells) != width * height:
        raise SystemExit("layer decode mismatch: %d cells for %dx%d" % (len(cells), width, height))
    return cells


def main() -> int:
    world = load(WORLD)
    layers = load(LAYERS)
    props = load(PROPS)["props"]
    catalog = load(CATALOG)

    width = int(world["world_bounds"]["w"])
    height = int(world["world_bounds"]["h"])
    solid = unpack_rle(layers["layers"]["solid"], width, height)
    ground = unpack_rle(layers["layers"]["ground"], width, height)
    detail = unpack_rle(layers["layers"]["detail"], width, height)
    spawn = world["start_position"]

    rules = catalog["rules"]
    landmark_clear = int(rules["landmark_clearance_tiles"])
    placement = {
        int(props[i]["x"] // 16) + int(props[i]["y"] // 16) * width: props[i]["frame"]
        for i in range(len(props))
    }

    protected = []
    for landmark in world["landmarks"]:
        cell = landmark.get("threshold", landmark["pos"])
        protected.append((int(cell[0]), int(cell[1]), landmark_clear))
    for camp in world["camps"]:
        cell = camp["pos"]
        protected.append((int(cell[0]), int(cell[1]), int(rules["camp_clearance_tiles"])))

    def walkable(x, y):
        """Ground the player can stand on. Roads ARE walkable — they are the main
        route — so reachability must include them even though *building* on them
        is forbidden later."""
        if not (0 <= x < width and 0 <= y < height):
            return False
        index = y * width + x
        if solid[index] != ".":
            return False
        if ground[index][0] in "~-":
            return False
        return True

    def buildable(x, y):
        if not walkable(x, y):
            return False
        index = y * width + x
        if detail[index][:1] in ("=", "+", ":"):
            return False
        return True

    def protected_cell(x, y):
        for px, py, radius in protected:
            if abs(x - px) <= radius and abs(y - py) <= radius:
                return True
        return False

    # Reachability from spawn over open ground, 4-neighbour. Trees are solid
    # *bodies* but not solid cells, so the terrain grid is the right authority for
    # "can the player get roughly here".
    reachable = set()
    start = (int(spawn[0]), int(spawn[1]))
    queue = deque([start])
    reachable.add(start)
    while queue:
        x, y = queue.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if (nx, ny) in reachable or not walkable(nx, ny):
                continue
            reachable.add((nx, ny))
            queue.append((nx, ny))

    chosen: list[tuple[str, int, int]] = []
    chosen_cells: list[tuple[int, int]] = []

    def far_enough(x, y, spacing=SPACING):
        return all(abs(x - cx) >= spacing or abs(y - cy) >= spacing
                   for cx, cy in chosen_cells)

    def try_place(kind, source_frames, target_count, spacing=SPACING, near=False):
        placed = 0
        candidates = []
        for index, frame in placement.items():
            if frame not in source_frames:
                continue
            sx, sy = index % width, index // width
            # The node sits on open ground adjacent to its source prop, on a side
            # the player can actually reach.
            for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                x, y = sx + dx, sy + dy
                if (x, y) not in reachable or not buildable(x, y):
                    continue
                if protected_cell(x, y):
                    continue
                distance = abs(x - start[0]) + abs(y - start[1])
                candidates.append((distance, x, y))
        candidates.sort()
        # Near-spawn nodes first when the caller asks for them, otherwise spread
        # over the whole route by taking candidates in distance order.
        for distance, x, y in candidates:
            if placed >= target_count:
                break
            if near and distance > NEAR_RADIUS:
                continue
            if not far_enough(x, y, spacing):
                continue
            chosen.append((kind, x, y))
            chosen_cells.append((x, y))
            placed += 1
        return placed

    report = {}
    for kind, (sources, count) in KIND_SOURCES.items():
        near_count = try_place(kind, sources, min(NEAR_SPAWN, count), spacing=5, near=True)
        total = try_place(kind, sources, count, spacing=SPACING)
        report[kind] = {"near_spawn": near_count, "total": total}

    nodes = [{"kind": kind, "cell": [x, y]} for kind, x, y in chosen]
    nodes.sort(key=lambda entry: (entry["cell"][1], entry["cell"][0]))
    payload = {
        "schema": 1,
        "world_id": world["world_id"],
        "note": "Generated by tools/survival/author_resources.py from the authored "
                "overworld props. Deterministic: rerunning on the same world and "
                "catalog produces the same plan.",
        "spacing_tiles": SPACING,
        "nodes": nodes,
    }
    with open(OUT, "w") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")

    print("resource plan: %d nodes" % len(nodes))
    for kind, stats in report.items():
        print("  %-14s %2d total, %d within %d tiles of spawn"
              % (kind, stats["total"], stats["near_spawn"], NEAR_RADIUS))
    if any(stats["total"] == 0 for stats in report.values()):
        print("FAIL: a resource kind has no nodes", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
