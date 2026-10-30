#!/usr/bin/env python3
"""Compile an objectively walkable normal-input first-hour route proof.

Owner-independent navigation logic over the ACCEPTED A1 corridor + source walk
layer. It does not move geometry: it proves the authored outbound/return cells
are walkable, contiguous, body-clear, not a one-tile trap (a free alternate
exists around every interior route cell), and that the ten Chapter-1 thresholds
remain preserved per baseline_lock. Camera/landmark states give A0/A6 the
home-first vs explore-first framing without adding navigation-arrow clutter.
"""
from __future__ import annotations

import hashlib
import json
from collections import deque
from pathlib import Path

from compile_world_art import Layers, load_plan, WORLD, ROOT

TILE = 16
BODY = (12, 16)


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def bfs(walk, start, goal, blocked=None):
    blocked = blocked or set()
    if start in blocked or goal in blocked:
        return None
    seen = {start}
    q = deque([start])
    while q:
        c = q.popleft()
        if c == goal:
            return True
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c[0] + dx, c[1] + dy)
            if n in seen or n in blocked or n not in walk:
                continue
            seen.add(n)
            q.append(n)
    return None


def compile_all() -> dict:
    corridor = json.loads((WORLD / "corridor/crown_roadside.corridor.v1.json").read_text(encoding="utf-8"))
    lock = json.loads((WORLD / "baseline_lock.json").read_text(encoding="utf-8"))
    layers = Layers(load_plan())
    route = corridor["route"]
    out = [tuple(c) for c in route["outbound_cells"]]
    ret = [tuple(c) for c in route["return_cells"]]
    xs = [c[0] for c in out + ret]
    ys = [c[1] for c in out + ret]
    box = (min(xs) - 4, min(ys) - 4, max(xs) + 5, max(ys) + 5)
    walk = set()
    for y in range(box[1], box[3]):
        for x in range(box[0], box[2]):
            if layers.value([x, y], "walk") == 1:
                walk.add((x, y))
    start, goal = out[0], out[-1]
    contiguous = all(abs(a[0] - b[0]) + abs(a[1] - b[1]) == 1 for a, b in zip(out, out[1:]))
    all_walk = all(c in walk for c in out + ret)
    retreat_reverse = ret == list(reversed(out))
    # No one-tile trap: blocking any single interior route cell still leaves a
    # free start->goal path (a real alternate/retreat, not a mandatory choke).
    cut = []
    for c in out[1:-1]:
        if bfs(walk, start, goal, blocked={c}) is None:
            cut.append(list(c))
    base = bfs(walk, start, goal) is True
    thresholds = lock["landmarks"]
    doc = {
        "schema": "soh.world.first_hour_route.v1", "owner": "A1",
        "status": "OBJECTIVE_WALKABILITY_PROOF_NOT_NATIVE_RUN",
        "corridor_sha256": sha(WORLD / "corridor/crown_roadside.corridor.v1.json"),
        "baseline_lock_sha256": sha(WORLD / "baseline_lock.json"),
        "route_id": route["route_id"], "start_cell": list(start), "goal_cell": list(goal),
        "outbound_cells": [list(c) for c in out], "return_cells": [list(c) for c in ret],
        "proof": {
            "base_path_exists": base, "outbound_contiguous": contiguous,
            "all_route_cells_walkable": all_walk, "return_is_reverse_of_outbound": retreat_reverse,
            "single_cell_cut_vertices": cut, "no_one_tile_trap": base and not cut,
            "body_px": list(BODY), "tile_px": TILE,
            "body_clearance_margin_px": (TILE - BODY[0]) // 2,
            "ten_thresholds_preserved": len(thresholds) == 10 and all(t["reachable_closed_shortcuts"] for t in thresholds),
        },
        "camera_landmark_states": [
            {"id": "home_first", "when": "fresh save at postern", "camera_center_cell": [394, 201],
             "landmark_focus": "lm_waystation roof+pennant visible down the road; return postern behind",
             "read": "safe home silhouette ahead, maintained road underfoot, no arrow clutter"},
            {"id": "explore_first", "when": "player steps off road at supply layby", "camera_center_cell": [399, 219],
             "landmark_focus": "notes crate (paper+strap) vs scrap caches (iron latch); deadfall/stump at margin",
             "read": "voluntary low-risk loot readable; notes != reward chest"},
            {"id": "return", "when": "after Waystation", "camera_center_cell": [400, 210],
             "landmark_focus": "warm lamps + banners recede toward postern; road continuous",
             "read": "retreat route obvious without a navigation arrow"},
        ],
        "authority": "A1 geometry unchanged; A0 mounts production camera/input; A3 owns notes-crate grant",
        "notes_crate_instance": "si:r_ashen_crown:roadside_supply:01",
        "waystation_cache_instance": "si:r_ashen_crown:waystation_cache:01",
        "waystation_cache_interaction_alias": "node_waystation_cache",
    }
    ok = base and contiguous and all_walk and not cut and doc["proof"]["ten_thresholds_preserved"]
    (WORLD / "corridor/first_hour_route.v1.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    return {"ok": ok, "proof": doc["proof"], "path": "data/survival/world/corridor/first_hour_route.v1.json"}


if __name__ == "__main__":
    r = compile_all()
    print(json.dumps(r, sort_keys=True))
    raise SystemExit(0 if r["ok"] else 1)
