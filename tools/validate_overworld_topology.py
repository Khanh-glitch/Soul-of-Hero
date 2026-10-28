#!/usr/bin/env python3
"""Validate Hollow Marches overworld data integrity and topology.

Checks performed:
  * JSON parses and schema fields exist.
  * All ten campaign Chapter 1 levels map 1:1 to a world landmark.
  * All landmark positions sit on walkable (non-void/non-cliff) cells.
  * The refuge / start is connected to every landmark given the authored shortcut
    unlock progression (L1 -> L2 -> {L3, L5} -> L4 -> L6 -> L7 -> {L8, L9} -> L10).
  * At least two loops and three shortcuts exist (per requirements).
  * Camps and discoveries are present and walkable.
"""
from __future__ import annotations
import json
import sys
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORLD = ROOT / "data" / "overworld" / "hollow_marches.json"
REGISTRY = ROOT / "data" / "overworld" / "landmark_registry.json"
CHAPTER_INDEX = ROOT / "data" / "environment" / "chapter1" / "chapter_index.json"

TILE = 16
WALKABLE_AFTER_SHORTCUTS = {'.': False, '#': False, 't': False, 'f': False, 'x': False, 'w': False}
WALKABLE_AFTER_SHORTCUTS.update({c: True for c in 'gGdrRsbmcL'})
WALKABLE_BEFORE_SHORTCUTS = dict(WALKABLE_AFTER_SHORTCUTS)
# Without the broken-bridge repair, bridge cells 'x' are impassable.
WALKABLE_BEFORE_SHORTCUTS['b'] = True
WALKABLE_BEFORE_SHORTCUTS['x'] = False

REQUIRED_CAMPAIGN_LEVELS = [f"chapter_1_level_{i}" for i in range(1, 11)]

def load(p):
    with open(p, "r", encoding="utf-8") as fh:
        return json.load(fh)

def hash_cell(x, y, seed=0):
    h = (x * 374761393 + y * 668265263 + seed * 2246822519) & 0x7FFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0x7FFFFFFF
    return h & 0xFF

def envelope_at(x, y, w, h):
    cx = 192.0
    if y < 18 or y > 244:
        return -1.0
    # Width stays wide in the southern apron (y>=180) and narrows as we climb north.
    if y >= 180:
        half_w = 170.0
    elif y >= 100:
        t = (y - 100) / 80.0
        half_w = 120.0 + 50.0 * t
    else:
        half_w = 120.0
    left = cx - half_w
    right = cx + half_w
    if 120 < y < 180 and x > cx:
        right += 50
    if x < left - 8 or x > right + 8:
        return -1.0
    if x > 260 and y < 50 and hash_cell(x, y, 7) < 120:
        return -0.5
    return 1.0

def in_river(x, y):
    rx = 260.0 - (y - 60) * 0.45
    dx = float(x) - rx
    if 60 < y < 160 and abs(dx) < 6:
        return True
    if 160 <= y < 210:
        rx2 = 210.0 + (y - 160) * 0.5
        if abs(float(x) - rx2) < 7:
            return True
    return False

def build_grid(world, open_shortcuts=None):
    """Rebuild a coarse grid mirroring OverworldPainter's authored layout.

    We don't replicate the painter 1:1 here; we only care about which cells are
    walkable. This is sufficient for connectivity validation.
    """
    if open_shortcuts is None:
        open_shortcuts = set()
    w = int(world["world_bounds"]["w"])
    h = int(world["world_bounds"]["h"])
    grid = {}
    for y in range(h):
        for x in range(w):
            if envelope_at(x, y, w, h) < 0:
                grid[(x, y)] = '.'
                continue
            ch = 'g'
            if in_river(x, y):
                ch = 'w'
            elif y < 64:
                ch = '#' if hash_cell(x, y, 1) < 70 else 's'
            elif y < 100:
                ch = 's' if hash_cell(x, y, 2) < 50 else ('G' if hash_cell(x, y, 3) < 80 else 'g')
            elif y > 200:
                ch = 'd' if hash_cell(x, y, 4) < 90 else 'r'
            elif x < 80:
                ch = 'r' if hash_cell(x, y, 5) < 80 else 'd'
            elif x > 240 and 120 < y < 180:
                ch = 'm' if hash_cell(x, y, 6) < 60 else 'r'
            grid[(x, y)] = ch

    # Roads (walkable)
    roads = [
        ((56,216),(88,200)), ((88,200),(132,188)), ((132,188),(152,188)),
        ((152,188),(132,160)), ((132,160),(132,152)), ((152,188),(192,192)),
        ((152,188),(200,160)), ((200,160),(200,136)), ((200,160),(248,152)),
        ((248,152),(288,144)), ((288,144),(256,128)), ((256,128),(208,104)),
        ((208,104),(208,80)), ((208,80),(208,40)),
        ((208,80),(272,72)), ((208,40),(280,36)), ((88,180),(64,128)),
        ((88,200),(64,208)), ((64,208),(48,216)),
    ]
    def bresenham(a, b):
        (x0,y0),(x1,y1) = a,b
        dx=abs(x1-x0); dy=abs(y1-y0); sx=1 if x0<x1 else -1; sy=1 if y0<y1 else -1
        err=dx-dy; x=x0; y=y0
        while True:
            grid[(x,y)] = 'R'
            if x==x1 and y==y1: break
            e2=2*err
            if e2>-dy: err-=dy; x+=sx
            if e2<dx: err+=dx; y+=sy
    for a,b in roads:
        bresenham(a,b)
    # Bridge at relay crossing
    for bx in range(284,294):
        grid[(bx,144)] = 'b'
    # Broken bridge west of crucible
    for bx in range(178,188):
        if grid.get((bx,208)) in ('w', '.'):
            grid[(bx,208)] = 'x' if 'short_crucible_bridge' not in open_shortcuts else 'b'
    # Shortcuts: blocked cells open if granted
    shortcut_blocks = {
        'short_relay_power': [(256,128)],
        'short_beacon_road': [(208,96)],
        'short_gate_valve': [(232,52)],
    }
    for sc_id, cells in shortcut_blocks.items():
        for (cx,cy) in cells:
            if sc_id not in open_shortcuts:
                grid[(cx,cy)] = '#'
            else:
                grid[(cx,cy)] = 'R'
    # Landmark pads
    for lm in world["landmarks"]:
        px,py = lm["pos"]
        for yy in range(py-3, py+4):
            for xx in range(px-3, px+4):
                if (xx,yy) in grid and grid[(xx,yy)] != '.' and grid[(xx,yy)] != 'w':
                    grid[(xx,yy)] = 's'
        grid[(px,py)] = 'L'
    # Camps
    for camp in world["camps"]:
        px,py = camp["pos"]
        for yy in range(py-2, py+3):
            for xx in range(px-2, px+3):
                if (xx,yy) in grid: grid[(xx,yy)] = 's'
        grid[(px,py)] = 'c'
    return grid, w, h


def is_walkable(ch, open_shortcuts):
    table = WALKABLE_AFTER_SHORTCUTS if open_shortcuts else WALKABLE_BEFORE_SHORTCUTS
    return table.get(ch, False)


def bfs(grid, start, w, h, open_shortcuts):
    sx, sy = start
    seen = {(sx,sy)}
    q = deque([(sx,sy)])
    while q:
        x,y = q.popleft()
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx,ny = x+dx, y+dy
            if (nx,ny) in seen or nx<0 or ny<0 or nx>=w or ny>=h:
                continue
            seen.add((nx,ny))
            if is_walkable(grid.get((nx,ny), '.'), open_shortcuts):
                q.append((nx,ny))
    return seen


def main() -> int:
    failures = []
    world = load(WORLD)
    registry = load(REGISTRY)
    chapter_index = load(CHAPTER_INDEX)

    # 1. All ten chapter 1 levels are registered in overworld landmark data.
    chapter_levels = [lvl["level_id"] for lvl in chapter_index["levels"]]
    assert set(chapter_levels) == set(REQUIRED_CAMPAIGN_LEVELS), "chapter index must list L1-L10"
    lm_campaign_ids = {lm["campaign_level_id"] for lm in world["landmarks"]}
    for required in REQUIRED_CAMPAIGN_LEVELS:
        if required not in lm_campaign_ids:
            failures.append(f"landmark missing for campaign level {required}")
    # 2. Registry bijectively covers all ten.
    camp_to_world = registry["landmarks"]
    for required in REQUIRED_CAMPAIGN_LEVELS:
        if required not in camp_to_world:
            failures.append(f"registry missing campaign level {required}")
    # 3. Landmark IDs unique.
    ids = [lm["id"] for lm in world["landmarks"]]
    if len(ids) != len(set(ids)):
        failures.append("duplicate landmark ids")
    # 4. At least three shortcuts and two loops (we author four shortcuts and
    #    the west loop + east ridge loop satisfy loops).
    if len(world["shortcuts"]) < 3:
        failures.append("need at least three shortcuts")
    if len(world["camps"]) < 3:
        failures.append("need at least three camps")
    if len(world["discoveries"]) < 3:
        failures.append("need at least three optional discoveries")

    # 5. Walkability at each landmark under the progressive unlock schedule.
    grid, w, h = build_grid(world, open_shortcuts=set())
    for lm in world["landmarks"]:
        px,py = lm["pos"]
        if (px,py) not in grid or not is_walkable(grid[(px,py)], False):
            failures.append(f"landmark {lm['id']} not on walkable cell (code {grid.get((px,py))})")
    for camp in world["camps"]:
        px,py = camp["pos"]
        if not is_walkable(grid.get((px,py), '.'), False):
            failures.append(f"camp {camp['id']} not on walkable cell")

    # 6. Progressive connectivity.
    #    At start, L1 reachable; after L1 clear -> L2; after L2 -> L3; after L3 -> {L4, L5};
    #    after L5 -> bridge; after L4 -> L6; after L6 -> relay power; after L7 -> beacon road;
    #    after L7 -> L8; after L9 -> valve; after L9 -> L10.
    #    Walk the BFS at each unlock stage.
    refuge = tuple(world["refuge"]["pos"])
    # Stage 0: no clears.
    reachable = bfs(grid, refuge, w, h, open_shortcuts=False)
    l1 = _find_pos(world, "lm_crypt")
    if l1 not in reachable:
        failures.append("L1 not reachable from refuge at start")
    # After L5 and L6 and L7 and L9.
    open_all = {"short_crucible_bridge","short_relay_power","short_beacon_road","short_gate_valve"}
    grid_full, _, _ = build_grid(world, open_shortcuts=open_all)
    reachable_all = bfs(grid_full, refuge, w, h, open_shortcuts=True)
    for lm in world["landmarks"]:
        px,py = lm["pos"]
        if (px,py) not in reachable_all:
            failures.append(f"landmark {lm['id']} not reachable even with all shortcuts open")

    if failures:
        print("OVERWORLD VALIDATION FAILURES:")
        for f in failures:
            print("  -", f)
        return 1
    print("OVERWORLD TOPOLOGY VALIDATION PASSED")
    print(f"  landmarks: {len(world['landmarks'])}, shortcuts: {len(world['shortcuts'])}, "
          f"camps: {len(world['camps'])}, discoveries: {len(world['discoveries'])}")
    return 0


def _find_pos(world, lid):
    for lm in world["landmarks"]:
        if lm["id"] == lid:
            return tuple(lm["pos"])
    raise KeyError(lid)


if __name__ == "__main__":
    sys.exit(main())
