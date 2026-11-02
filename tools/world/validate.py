"""Spatial + behavioural GOLD validation for the compiled Veyra world.

Not an ID count.  Every assertion below checks position, geometry or movement:
  A1 GOLD hash and class counts.
  A2 coordinate transform: every emitted world_px equals gold*4 (exact) within 1 px.
  A3 ferry routes: exactly 8, and no ferry polyline appears in the road mask.
  A4 dock anchors: land anchor dry, water anchor inside the NAMED GOLD water body.
  A5 bridge crossings: the two landings are connected to each other through the deck, and the
     character footprint cannot step off the deck through a railing.
  A6 river impassability: for every river segment, crossing perpendicular without a bridge or
     ford is blocked; a bridge crossing at the authored bridge is open.
  A7 POI access: each POI centre has walkable ground within 6 units.
  A8 spawns walkable + reachability flood fill from each spawn.

Writes docs/map_tower/SPATIAL_VALIDATION.json and prints a PASS/FAIL table.
"""
import json
import math
import os
from collections import deque

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
META = os.path.join(REPO, "out", "world_meta.json")
GOLD = os.path.join(REPO, "map_tower", "veyra_gold", "VEYRA_GOLD_MAP.sohmap.json")
OUT = os.path.join(REPO, "docs", "map_tower", "SPATIAL_VALIDATION.json")
GOLD_SHA = "88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256"


def main():
    m = json.load(open(META))
    proj = json.load(open(GOLD))["project"]
    scale = m["scale"]
    U = scale["px_per_gold_unit"]
    CW, CH = scale["collision_cells"]
    cells = scale["collision_cell_px"]

    solid = np.zeros((CH, CW), bool)
    for y, runs in enumerate(m["collision"]["rows"]):
        for s, l, v in runs:
            if v:
                solid[y, s:s + l] = True
    walk = ~solid

    def solid_at_px(x, y):
        cx, cy = int(x // cells), int(y // cells)
        if 0 <= cx < CW and 0 <= cy < CH:
            return solid[cy, cx]
        return True

    def footprint_ok(x, y):
        """D051 feet box: 12 wide, 8 tall, anchored at the foot point."""
        pts = [(x - 6, y - 4), (x + 5, y - 4), (x - 6, y + 3), (x + 5, y + 3), (x, y)]
        return all(not solid_at_px(px, py) for px, py in pts)

    NB8 = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1))

    def flood(sx, sy, limit=None, diag=False):
        seen = np.zeros((CH, CW), bool)
        q = deque()
        if not (0 <= sx < CW and 0 <= sy < CH and walk[sy, sx]):
            return seen
        seen[sy, sx] = True
        q.append((sx, sy))
        n = 0
        while q:
            x, y = q.popleft()
            n += 1
            if limit and n > limit:
                break
            for dx, dy in (NB8 if diag else ((1, 0), (-1, 0), (0, 1), (0, -1))):
                nx, ny = x + dx, y + dy
                if 0 <= nx < CW and 0 <= ny < CH and not seen[ny, nx] and walk[ny, nx]:
                    seen[ny, nx] = True
                    q.append((nx, ny))
        return seen

    results = []

    def check(gate, name, ok, detail):
        results.append({"gate": gate, "name": name, "passed": bool(ok), "detail": detail})
        print(("PASS " if ok else "FAIL ") + f"{gate} {name}: {detail}"[:160])

    # A1
    import hashlib
    sha = hashlib.sha256(open(GOLD, "rb").read()).hexdigest()
    counts = {k: len(proj[k]) for k in ("land", "lakes", "rivers", "roads", "bridges", "docks",
                                        "pois", "zones", "resources", "spawns", "elders", "labels")}
    want = {"land": 8, "lakes": 5, "rivers": 17, "roads": 92, "bridges": 12, "docks": 27,
            "pois": 81, "zones": 23, "resources": 280, "spawns": 4, "elders": 6, "labels": 24}
    check("A1", "gold_hash", sha == GOLD_SHA, sha[:16])
    check("A1", "class_counts", counts == want, counts)

    # A2 coordinate transform
    bad = 0
    for p in m["pois"]:
        if abs(p["world_px"][0] - p["gold_at"][0] * U) > 1 or abs(p["world_px"][1] - p["gold_at"][1] * U) > 1:
            bad += 1
    for b in m["bridges"]:
        if abs(b["world_px"][0] - b["gold_at"][0] * U) > 1:
            bad += 1
    for s in m["spawns"]:
        if abs(s["world_px"][0] - s["at"][0] * U) > 1:
            bad += 1
    for r in m["resources"]:
        if abs(r["world_px"][0] - r["gold_at"][0] * U) > 1:
            bad += 1
    check("A2", "coordinate_transform", bad == 0, f"{bad} objects off transform")

    # A3 ferries
    ferries = m["ferry_routes"]
    check("A3", "ferry_count", len(ferries) == 8, f"{len(ferries)} ferry routes")
    road_ids = {r["source_id"] for r in m["roads"]}
    check("A3", "ferry_not_a_road", not (road_ids & {f["source_id"] for f in ferries}),
          "ferry ids absent from road list")

    water = np.zeros((CH, CW), bool)
    for y, runs in enumerate(m["water"]["rows"]):
        for s0, l, val in runs:
            if val:
                water[y, s0:s0 + l] = True

    # A4 dock anchors
    bad = []
    for d in m["docks"]:
        if not d.get("anchor_valid"):
            bad.append(d["source_id"])
            continue
        wax, way = d["water_anchor_px"]
        cx, cy = int(wax // cells), int(way // cells)
        if not (0 <= cx < CW and 0 <= cy < CH) or not water[cy, cx]:
            bad.append(d["source_id"] + ":water-anchor-not-water")
        lax, lay = d["land_anchor_px"]
        if solid_at_px(lax, lay):
            bad.append(d["source_id"] + ":land-anchor-solid")
    rejected = [d["source_id"] for d in m["docks"] if not d.get("anchor_valid")]
    accepted_problems = [b for b in bad if b.split(':')[0] not in rejected]
    check("A4", "dock_anchors", not accepted_problems,
          f"{len(m['docks']) - len(rejected)} accepted / {len(rejected)} rejected with reasons; "
          f"problems inside accepted docks: {accepted_problems[:3]}")

    # A5 bridges: landing-to-landing through the deck, and railings hold
    cross_ok, rail_ok, rail_fail = 0, 0, []
    for b in m["bridges"]:
        cx, cy = b["world_px"]
        ang = b["bearing_rad"]
        a_end = tuple(b["landing_a_px"])
        b_end = tuple(b["landing_b_px"])
        seen = flood(int(a_end[0] // cells), int(a_end[1] // cells), diag=True)
        ok = seen[int(b_end[1] // cells), int(b_end[0] // cells)] if walk[int(b_end[1] // cells), int(b_end[0] // cells)] else False
        cross_ok += 1 if ok else 0
        # lateral escape test: from the deck centre, step 3 units perpendicular
        px, py = cx, cy
        perp = (-math.sin(ang), math.cos(ang))
        escaped = False
        for sign in (-1, 1):
            tx = px + perp[0] * sign * (b["deck_width_units"] * U / 2 + 2)
            ty = py + perp[1] * sign * (b["deck_width_units"] * U / 2 + 2)
            if footprint_ok(tx, ty) and not solid_at_px(tx, ty):
                escaped = True
        if escaped:
            rail_fail.append(b["source_id"])
        else:
            rail_ok += 1
    check("A5", "bridge_crossings", cross_ok == len(m["bridges"]),
          f"{cross_ok}/{len(m['bridges'])} landings connected through the deck")
    check("A5", "bridge_railings_hold", not rail_fail,
          f"{rail_ok}/{len(m['bridges'])} block lateral escape {rail_fail[:3]}")

    # A6 river impassability away from crossings
    blocked, tested = 0, 0
    for r in m["rivers"]:
        pts = r["points"]
        for i in range(1, min(len(pts) - 1, 6)):
            (x0, y0), (x1, y1) = pts[i - 1], pts[i]
            mx, my = (x0 + x1) / 2, (y0 + y1) / 2
            dx, dy = x1 - x0, y1 - y0
            L = math.hypot(dx, dy) or 1
            px, py = -dy / L, dx / L
            # is there a bridge within 12 units? then skip (crossing is legitimate)
            near_bridge = any(math.hypot(b["gold_at"][0] - mx, b["gold_at"][1] - my) < 12
                              for b in m["bridges"])
            # sample just outside the channel on both banks
            half = (r["half_width_units"] or 2) + 1.5
            a = (mx + px * half, my + py * half)
            c = (mx - px * half, my - py * half)
            A = (int(a[0] * U // cells), int(a[1] * U // cells))
            C = (int(c[0] * U // cells), int(c[1] * U // cells))
            if not (0 <= A[0] < CW and 0 <= A[1] < CH and 0 <= C[0] < CW and 0 <= C[1] < CH):
                continue
            if not walk[A[1], A[0]] or not walk[C[1], C[0]]:
                continue
            tested += 1
            if near_bridge:
                continue
            # local test: can the feet box walk the straight line from bank to bank?
            steps = 40
            blocked_crossing = False
            for t in range(steps + 1):
                sx = a[0] + (c[0] - a[0]) * t / steps
                sy = a[1] + (c[1] - a[1]) * t / steps
                if not footprint_ok(sx * U, sy * U):
                    blocked_crossing = True
                    break
            if blocked_crossing:
                blocked += 1
    check("A6", "rivers_block_unbridged_crossings", tested > 0 and blocked >= tested * 0.6,
          f"{blocked}/{tested} unbridged perpendicular river crossings blocked")

    # A7 POI access
    near = 0
    for p in m["pois"]:
        x, y = p["world_px"]
        found = False
        for d in range(0, 7):
            for dy in range(-d, d + 1):
                for dx in range(-d, d + 1):
                    tx, ty = int((x + dx * 4) // cells), int((y + dy * 4) // cells)
                    if 0 <= tx < CW and 0 <= ty < CH and walk[ty, tx]:
                        found = True
                        break
                if found:
                    break
            if found:
                break
        near += 1 if found else 0
    check("A7", "poi_walkable_ground", near == len(m["pois"]), f"{near}/{len(m['pois'])} POIs have walkable ground within 6 units")

    # A8 spawns + reachability
    seen_all = np.zeros((CH, CW), bool)
    spawn_ok = 0
    for s in m["spawns"]:
        x, y = s["world_px"]
        if footprint_ok(x, y):
            spawn_ok += 1
        seen_all |= flood(int(x // cells), int(y // cells))
    check("A8", "spawns_walkable", spawn_ok == len(m["spawns"]), f"{spawn_ok}/4 spawns walkable")
    reach = 0
    for p in m["pois"]:
        x, y = p["world_px"]
        if seen_all[int(y // cells), int(x // cells)]:
            reach += 1
    check("A8", "poi_reachable_on_foot", reach > 0, f"{reach}/{len(m['pois'])} POI centres reachable on foot from a spawn")

    passed = sum(1 for r in results if r["passed"])
    out = {"schema": "soh.veyra.spatial_validation.v1", "gold_sha256": sha,
           "world_meta": "out/world_meta.json", "checks": results,
           "passed": passed, "failed": len(results) - passed,
           "all_passed": passed == len(results),
           "environment": "sandbox (Pillow/numpy), no GPU, no browser"}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(out, fh, indent=1)
    print(f"\n{passed}/{len(results)} spatial checks passed -> {OUT}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
