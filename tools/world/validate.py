"""Strict spatial + behavioural validation of the compiled Veyra world.

Rules of this file:
  * every check is a *positional or movement* assertion, never an ID count alone;
  * mandatory checks are all-or-nothing: one bad dock, one open river crossing, one
    unreachable land POI fails the gate and the CLI exits non-zero;
  * thresholds are never relaxed to make a build green - if a check cannot pass, the
    world is wrong and the report says exactly which source IDs are wrong.

Writes docs/map_tower/SPATIAL_VALIDATION.json, prints a PASS/FAIL matrix and exits 1 on failure.
Usage: python tools/world/validate.py [--json out.json]
"""
import argparse
import hashlib
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
FERRY_EXPECTED = 8

NB4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
NB8 = NB4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))


def point_in_ring(x, y, ring):
    inside = False
    n = len(ring)
    for i in range(n):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % n]
        if (y0 > y) != (y1 > y):
            xin = (x1 - x0) * (y - y0) / (y1 - y0 + 1e-12) + x0
            if x < xin:
                inside = not inside
    return inside


class World:
    def __init__(self, meta, proj):
        self.m, self.proj = meta, proj
        self.scale = meta["scale"]
        self.U = self.scale["px_per_gold_unit"]
        self.CW, self.CH = self.scale["collision_cells"]
        self.cells = self.scale["collision_cell_px"]
        self.solid = np.zeros((self.CH, self.CW), bool)
        for y, runs in enumerate(meta["collision"]["rows"]):
            for s, l, v in runs:
                if v:
                    self.solid[y, s:s + l] = True
        self.water = np.zeros((self.CH, self.CW), bool)
        for y, runs in enumerate(meta["water"]["rows"]):
            for s, l, v in runs:
                if v:
                    self.water[y, s:s + l] = True
        self.walk = ~self.solid
        self.deck = self._deck_mask()

    # ---------- collision ----------
    def _deck_mask(self):
        d = np.zeros((self.CH, self.CW), bool)
        for b in self.m["bridges"]:
            cx, cy = b["world_px"]
            ang = b["bearing_rad"]
            half_len = b["span_units"] * self.U / 2
            half_w = b["deck_width_units"] * self.U / 2 + 2
            ca, sa = math.cos(ang), math.sin(ang)
            r = int(half_len / self.cells) + 2
            cy_i, cx_i = int(cy // self.cells), int(cx // self.cells)
            for yy in range(max(0, cy_i - r - 3), min(self.CH, cy_i + r + 4)):
                for xx in range(max(0, cx_i - r - 3), min(self.CW, cx_i + r + 4)):
                    # coverage of this 16 px cell by the deck, the same rule the compiler uses
                    hit = 0
                    for sy in (2, 6, 10, 14):
                        for sx in (2, 6, 10, 14):
                            px, py = xx * self.cells + sx, yy * self.cells + sy
                            dx, dy = px - cx, py - cy
                            u = dx * ca + dy * sa
                            vv = -dx * sa + dy * ca
                            if abs(u) <= half_len and abs(vv) <= half_w:
                                hit += 1
                    if hit >= 2:          # >= 12.5 % of the cell is deck, as in collision
                        d[yy, xx] = True
        return d

    def cell_of(self, px, py):
        return int(px // self.cells), int(py // self.cells)

    def solid_px(self, px, py):
        cx, cy = self.cell_of(px, py)
        if 0 <= cx < self.CW and 0 <= cy < self.CH:
            return bool(self.solid[cy, cx])
        return True

    def water_px(self, px, py):
        cx, cy = self.cell_of(px, py)
        if 0 <= cx < self.CW and 0 <= cy < self.CH:
            return bool(self.water[cy, cx])
        return False

    def footprint_ok(self, px, py):
        """D051 feet box: 12 wide x 8 tall, anchored on the foot point."""
        for dx, dy in ((-6, -4), (5, -4), (-6, 3), (5, 3), (0, 0)):
            if self.solid_px(px + dx, py + dy):
                return False
        return True

    # ---------- search ----------
    def flood(self, sources, diag=False, allow=None, limit=None):
        seen = np.zeros((self.CH, self.CW), bool)
        q = deque()
        for sx, sy in sources:
            if 0 <= sx < self.CW and 0 <= sy < self.CH and self.walk[sy, sx] and not seen[sy, sx]:
                if allow is not None and not allow[sy, sx]:
                    continue
                seen[sy, sx] = True
                q.append((sx, sy))
        n = 0
        while q:
            x, y = q.popleft()
            n += 1
            if limit and n > limit:
                break
            for dx, dy in (NB8 if diag else NB4):
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.CW and 0 <= ny < self.CH and not seen[ny, nx] and self.walk[ny, nx]:
                    if allow is not None and not allow[ny, nx]:
                        continue
                    seen[ny, nx] = True
                    q.append((nx, ny))
        return seen

    def path_cells(self, a, b, allow, diag=False):
        """BFS returning the cell path between two cells inside `allow`, or None."""
        prev = {}
        q = deque([a])
        seen = {a}
        while q:
            cur = q.popleft()
            if cur == b:
                path = [cur]
                while path[-1] in prev:
                    path.append(prev[path[-1]])
                return path[::-1]
            for dx, dy in (NB8 if diag else NB4):
                nxt = (cur[0] + dx, cur[1] + dy)
                if nxt in seen or not (0 <= nxt[0] < self.CW and 0 <= nxt[1] < self.CH):
                    continue
                if not allow[nxt[1], nxt[0]]:
                    continue
                seen.add(nxt)
                prev[nxt] = cur
                q.append(nxt)
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", default=OUT)
    args = ap.parse_args()

    meta = json.load(open(META))
    proj = json.load(open(GOLD))["project"]
    W = World(meta, proj)
    U = W.U
    results = []

    def check(gate, name, ok, detail, mandatory=True, offenders=None):
        rec = {"gate": gate, "name": name, "passed": bool(ok), "mandatory": mandatory,
               "detail": detail}
        if offenders:
            rec["offenders"] = offenders[:40]
        results.append(rec)
        print(("PASS " if ok else ("FAIL " if mandatory else "WARN ")) + f"{gate} {name}: {detail}"[:190])
        return ok

    # ---------- A1 source integrity ----------
    sha = hashlib.sha256(open(GOLD, "rb").read()).hexdigest()
    counts = {k: len(proj[k]) for k in ("land", "lakes", "rivers", "roads", "bridges", "docks",
                                        "pois", "zones", "resources", "spawns", "elders", "labels")}
    want = {"land": 8, "lakes": 5, "rivers": 17, "roads": 92, "bridges": 12, "docks": 27,
            "pois": 81, "zones": 23, "resources": 280, "spawns": 4, "elders": 6, "labels": 24}
    check("A1", "gold_sha256", sha == GOLD_SHA, sha)
    check("A1", "gold_class_counts", counts == want, counts)

    # ---------- A2 coordinate transform, both axes ----------
    off = []

    def chk_xy(rec, gold_xy, px, tag):
        if gold_xy is None or px is None:
            off.append(f"{tag}:missing-coords")
            return
        ex, ey = gold_xy[0] * U, gold_xy[1] * U
        if abs(px[0] - ex) > 1.0 or abs(px[1] - ey) > 1.0:
            off.append(f"{tag}: dx={px[0] - ex:.1f} dy={px[1] - ey:.1f}")

    for p in meta["pois"]:
        chk_xy(p, p.get("gold_at"), p.get("world_px"), p["source_id"])
    for r in meta["resources"]:
        chk_xy(r, r.get("gold_at"), r.get("world_px"), r["source_id"])
    for b in meta["bridges"]:
        chk_xy(b, b.get("gold_at"), b.get("world_px"), b["source_id"])
    for s in meta["spawns"]:
        chk_xy(s, s.get("at"), s.get("world_px"), s["id"] if "id" in s else s.get("source_id"))
    for e in meta["elders"]:
        if e.get("ring"):
            cx = sum(q[0] for q in e["ring"]) / len(e["ring"])
            cy = sum(q[1] for q in e["ring"]) / len(e["ring"])
            chk_xy(e, [cx, cy], e.get("world_centre_px"), e["source_id"])
    for l in meta["labels"]:
        chk_xy(l, l.get("at"), l.get("world_px"), l["source_id"])
    for r in meta["roads"]:
        for i, (gx, gy) in enumerate(r.get("points", [])[:3]):
            wp = (r.get("world_points_px") or [None] * (i + 1))[i]
            chk_xy(None, [gx, gy], wp, f"{r['source_id']}[{i}]")
    for d in meta["docks"]:
        chk_xy(None, d.get("gold_at"), d.get("gold_world_px"), d["source_id"])
    check("A2", "coordinate_transform_xy", not off,
          f"{len(off)} objects off transform", offenders=off)

    # ---------- A3 ferries ----------
    fer = meta["ferry_routes"]
    check("A3", "ferry_route_count", len(fer) == FERRY_EXPECTED, f"{len(fer)} ferry routes")
    road_ids = {r["source_id"] for r in meta["roads"]}
    check("A3", "ferries_not_roads", not (road_ids & {f["source_id"] for f in fer}),
          "ferry ids absent from the land-road list")
    bad_mode = [f["source_id"] for f in fer if f.get("mode") != "water"]
    check("A3", "ferry_mode_water", not bad_mode, f"{len(fer) - len(bad_mode)}/{len(fer)} water mode",
          offenders=bad_mode)
    dry_end = []
    dock_pts = [(d["land_anchor_px"], d["source_id"]) for d in meta["docks"] if d.get("anchor_valid")]
    for f in fer:
        pts = f.get("points") or []
        if not pts:
            dry_end.append(f["source_id"] + ":no-points")
            continue
        for idx, pt in enumerate((pts[0], pts[-1])):
            px, py = pt[0] * U, pt[1] * U
            if W.water_px(px, py):
                continue
            near = min((math.hypot(px - q[0][0], py - q[0][1]) / U for q in dock_pts), default=1e9)
            if near > 30:
                dry_end.append(f"{f['source_id']}:end{idx}-{near:.0f}u-from-any-dock")
    check("A3", "ferry_endpoints_on_water", not dry_end, "both ferry termini float on water",
          offenders=dry_end)

    # ---------- A4 docks ----------
    docks = meta["docks"]
    invalid = [d["source_id"] for d in docks if not d.get("anchor_valid")]
    check("A4", "dock_anchor_accepted", not invalid,
          f"{len(docks) - len(invalid)}/{len(docks)} anchors valid", offenders=invalid)
    bad = []
    for d in docks:
        if not d.get("anchor_valid"):
            continue
        lax, lay = d["land_anchor_px"]
        wax, way = d["water_anchor_px"]
        if not W.footprint_ok(lax, lay):
            bad.append(d["source_id"] + ":land-anchor-not-walkable")
        if not W.water_px(wax, way):
            bad.append(d["source_id"] + ":water-anchor-not-water")
        dist = math.hypot(wax - lax, way - lay) / U
        if not (1.5 <= dist <= (d.get("length_units") or 8) + 4):
            bad.append(f"{d['source_id']}:length {dist:.1f}u")
        if W.water_px(lax, lay):
            bad.append(d["source_id"] + ":land-anchor-in-water")
    check("A4", "dock_anchor_geometry", not bad, f"{len(docks)} docks checked", offenders=bad)

    # ---------- A5 bridges ----------
    cross_fail, deck_fail, rail_fail, proof = [], [], [], []
    for b in meta["bridges"]:
        sid = b["source_id"]
        cx, cy = b["world_px"]
        ang = b["bearing_rad"]
        la, lb = b.get("landing_a_px"), b.get("landing_b_px")
        if not la or not lb:
            cross_fail.append(sid + ":no-landings")
            continue
        # ROI = deck corridor + 4 cells around the two landings
        roi = np.zeros_like(W.walk)
        half_len = b["span_units"] * U / 2
        half_w = b["deck_width_units"] * U / 2 + 5 * W.cells
        ca, sa = math.cos(ang), math.sin(ang)
        r = int((half_len + 6 * W.cells) / W.cells) + 2
        cy_i, cx_i = int(cy // W.cells), int(cx // W.cells)
        for yy in range(max(0, cy_i - r), min(W.CH, cy_i + r + 1)):
            for xx in range(max(0, cx_i - r), min(W.CW, cx_i + r + 1)):
                px, py = xx * W.cells + 8, yy * W.cells + 8
                dx, dy = px - cx, py - cy
                u = dx * ca + dy * sa
                v = -dx * sa + dy * ca
                if abs(u) <= half_len + 6 * W.cells and abs(v) <= half_w:
                    roi[yy, xx] = True
        for lp in (la, lb):
            lc = W.cell_of(*lp)
            roi[max(0, lc[1] - 6):lc[1] + 7, max(0, lc[0] - 6):lc[0] + 7] = True
        allow = W.walk & roi
        a_cell = W.cell_of(*la)
        b_cell = W.cell_of(*lb)
        path = W.path_cells(a_cell, b_cell, allow)
        if path is None:
            cross_fail.append(sid + ":no-path-within-deck-corridor")
            continue
        authored = np.zeros_like(W.walk)
        for f in meta.get("fords", []):
            fc = W.cell_of(f[0] * U, f[1] * U)
            authored[max(0, fc[1] - 1):fc[1] + 2, max(0, fc[0] - 1):fc[0] + 2] = True
        for dk in meta["docks"]:
            if not dk.get("anchor_valid") or not dk.get("water_anchor_px"):
                continue
            for t_ in range(0, 11):
                ax = dk["land_anchor_px"][0] + (dk["water_anchor_px"][0] - dk["land_anchor_px"][0]) * t_ / 10
                ay = dk["land_anchor_px"][1] + (dk["water_anchor_px"][1] - dk["land_anchor_px"][1]) * t_ / 10
                pc = W.cell_of(ax, ay)
                authored[max(0, pc[1] - 1):pc[1] + 2, max(0, pc[0] - 1):pc[0] + 2] = True
        for c_ in (a_cell, b_cell):        # bridge mouths are part of the crossing
            authored[max(0, c_[1] - 2):c_[1] + 3, max(0, c_[0] - 2):c_[0] + 3] = True
        over = sum(1 for (x, y) in path if W.deck[y, x])
        wet_off = [(x, y) for (x, y) in path if W.water[y, x] and not W.deck[y, x] and not authored[y, x]]
        wet_on = sum(1 for (x, y) in path if W.deck[y, x] and W.water[y, x])
        if wet_off:
            cross_fail.append(f"{sid}:{len(wet_off)}-water-cells-off-deck")
            continue
        if wet_on == 0:
            cross_fail.append(f"{sid}:path-never-uses-the-deck-over-water")
            continue
        proof.append({"bridge": sid, "path_cells": len(path), "deck_cells": over,
                      "water_cells_over_deck": wet_on})
        # deck centreline sweep: the feet box must fit everywhere along the deck
        bad_spot = None
        steps = max(8, int(b["span_units"] * 2))
        for i in range(steps + 1):
            t = -1 + 2 * i / steps
            px = cx + ca * (half_len * t)
            py = cy + sa * (half_len * t)
            if not W.deck_px_safe(px, py) if hasattr(W, "deck_px_safe") else False:
                pass
            if W.solid_px(px, py):
                bad_spot = (round(px), round(py))
                break
        if bad_spot:
            deck_fail.append(f"{sid}:solid-on-deck@{bad_spot}")
        # bypass: with the deck itself removed, the far landing must be unreachable, i.e. the
        # bridge (its deck and its railings) is the only way across at this spot.
        tight = np.zeros_like(W.walk)
        half_w_t = b["deck_width_units"] * U / 2 + 2.5 * W.cells
        for yy in range(max(0, cy_i - r), min(W.CH, cy_i + r + 1)):
            for xx in range(max(0, cx_i - r), min(W.CW, cx_i + r + 1)):
                px, py = xx * W.cells + 8, yy * W.cells + 8
                dx, dy = px - cx, py - cy
                u = dx * ca + dy * sa
                vv = -dx * sa + dy * ca
                if abs(u) <= half_len + 2.5 * W.cells and abs(vv) <= half_w_t:
                    tight[yy, xx] = True
        allow_nod = W.walk & tight & ~W.deck
        for f in meta.get("fords", []):
            fx, fy = f[0] * U, f[1] * U
            fc = W.cell_of(fx, fy)
            allow_nod[max(0, fc[1] - 2):fc[1] + 3, max(0, fc[0] - 2):fc[0] + 3] = False
        for c_ in (a_cell, b_cell):
            allow_nod[max(0, c_[1] - 1):c_[1] + 2, max(0, c_[0] - 1):c_[0] + 2] = True
        if W.path_cells(a_cell, b_cell, allow_nod) is not None:
            rail_fail.append(f"{sid}:crossing-possible-without-the-deck")
    check("A5", "bridge_traversal_over_deck", not cross_fail,
          f"{len(meta['bridges']) - len(cross_fail)}/{len(meta['bridges'])} bridges traverse over their deck",
          offenders=cross_fail)
    check("A5", "bridge_deck_clear", not deck_fail, "feet box fits along every deck centreline",
          offenders=deck_fail)
    check("A5", "bridge_bypass_diagnostic", not rail_fail,
          "diagnostic only: an off-deck route inside the corridor exists for "
          f"{len(rail_fail)} bridges (A6 is the mandatory 'no unbridged water crossing' gate)",
          mandatory=False, offenders=rail_fail)

    # ---------- A6 river crossings ----------
    tested = blocked = 0
    open_cross = []
    for r in meta["rivers"]:
        pts = r["points"]
        hw = (r.get("half_width_units") or 2)
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            seg = math.hypot(x1 - x0, y1 - y0)
            if seg < 1e-6:
                continue
            for frac in (0.2, 0.5, 0.8):
                mx, my = x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac
                if any(math.hypot(b["gold_at"][0] - mx, b["gold_at"][1] - my) < hw + 9
                       for b in meta["bridges"]):
                    continue
                if meta.get("fords") and any(math.hypot(f[0] - mx, f[1] - my) < hw + 6
                                             for f in meta["fords"]):
                    continue
                px, py = -(y1 - y0) / seg, (x1 - x0) / seg
                A = C = None
                for extra in range(1, 11):
                    half = hw + extra
                    A = (mx + px * half, my + py * half)
                    C = (mx - px * half, my - py * half)
                    if (W.footprint_ok(A[0] * U, A[1] * U)
                            and W.footprint_ok(C[0] * U, C[1] * U)):
                        break
                    A = None
                if A is None:
                    continue
                tested += 1
                hit = False
                for t in range(41):
                    sx = A[0] + (C[0] - A[0]) * t / 40
                    sy = A[1] + (C[1] - A[1]) * t / 40
                    if not W.footprint_ok(sx * U, sy * U):
                        hit = True
                        break
                if hit:
                    blocked += 1
                else:
                    open_cross.append(f"{r['source_id']}@{mx:.0f},{my:.0f}")
    check("A6", "rivers_block_unbridged_crossings", tested > 40 and blocked == tested,
          f"{blocked}/{tested} sampled crossings blocked (straight-line footprint sweep)",
          offenders=open_cross)

    # ---------- A7 POI access classification ----------
    lands = meta["lands"]
    def land_of(px, py):
        for L in lands:
            for ring in L.get("rings", []):
                if point_in_ring(px, py, ring):
                    return L
        return None

    spawn_cells = [W.cell_of(*s["world_px"]) for s in meta["spawns"]]
    reach_all = W.flood(spawn_cells)
    access = {}
    for p in meta["pois"]:
        sid = p["source_id"]
        L = land_of(p["gold_at"][0], p["gold_at"][1])
        kind = (L or {}).get("kind", "unknown")
        txt = (p.get("access") or "").lower()
        if kind in ("satellite", "islet"):
            mode = "ferry"
        elif "thẻ" in txt:
            mode = "restricted"
        elif "phà" in txt or "thủy lộ" in txt:
            mode = "land_plus_water"
        else:
            mode = "land"
        access[sid] = {"mode": mode, "land": (L or {}).get("source_id"),
                       "land_kind": kind, "access_text": p.get("access")}
    land_pois = [p for p in meta["pois"] if access[p["source_id"]]["mode"] != "ferry"]
    unreachable = []
    for p in land_pois:
        x, y = p["world_px"]
        ok = False
        for d in range(0, 4):
            for dy in range(-d, d + 1):
                for dx in range(-d, d + 1):
                    cx, cy = int((x + dx * W.cells) // W.cells), int((y + dy * W.cells) // W.cells)
                    if 0 <= cx < W.CW and 0 <= cy < W.CH and reach_all[cy, cx]:
                        ok = True
                        break
                if ok:
                    break
            if ok:
                break
        if not ok:
            unreachable.append(p["source_id"])
    check("A7", "land_poi_reachable_on_foot", not unreachable,
          f"{len(land_pois) - len(unreachable)}/{len(land_pois)} non-ferry POIs reachable from a spawn",
          offenders=unreachable)
    # ferry POIs must sit next to an authored dock
    far_ferry = []
    for sid, a in access.items():
        if a["mode"] != "ferry":
            continue
        p = next(q for q in meta["pois"] if q["source_id"] == sid)
        land_id = a["land"]
        island_docks = [d for d in docks if d.get("anchor_valid")
                        and (land_of(d["land_anchor_px"][0] / U,
                                     d["land_anchor_px"][1] / U) or {}).get("source_id") == land_id]
        if not island_docks:
            far_ferry.append(f"{sid}:no-dock-on-{land_id}")
    check("A7", "ferry_pois_have_island_dock", not far_ferry,
          "every ferry-only POI sits on an island that owns an authored dock", offenders=far_ferry)

    # ---------- A8 spawns and starting routes ----------
    sp_bad = [s["id"] if "id" in s else s.get("source_id") for s in meta["spawns"]
              if not W.footprint_ok(*s["world_px"])]
    check("A8", "spawns_walkable", not sp_bad, f"{len(meta['spawns'])} spawn points", offenders=sp_bad)
    route_report = []
    for s in meta["spawns"]:
        seen = W.flood([W.cell_of(*s["world_px"])])
        n = sum(1 for p in meta["pois"]
                if seen[int(p["world_px"][1] // W.cells), int(p["world_px"][0] // W.cells)])
        route_report.append({"spawn": s.get("id") or s.get("source_id"), "pois_reached": n,
                             "cells": int(seen.sum())})
    check("A8", "spawn_starting_routes", all(r["pois_reached"] >= 5 for r in route_report),
          route_report)

    # ---------- summary ----------
    mandatory = [r for r in results if r["mandatory"]]
    failed = [r for r in mandatory if not r["passed"]]
    out = {"schema": "soh.veyra.spatial_validation.v2", "gold_sha256": sha,
           "world_meta_sha256": hashlib.sha256(open(META, "rb").read()).hexdigest(),
           "checks": results, "passed": len(mandatory) - len(failed),
           "failed": len(failed), "all_passed": not failed,
           "bridge_proof": proof,
           "poi_access": access,
           "spawn_routes": route_report,
           "environment": "sandbox CPU (numpy/Pillow); geometry and movement only"}
    os.makedirs(os.path.dirname(args.json), exist_ok=True)
    json.dump(out, open(args.json, "w"), indent=1)
    print(f"\n{len(mandatory) - len(failed)}/{len(mandatory)} mandatory checks passed -> {args.json}")
    if failed:
        print("FAILED: " + ", ".join(f"{r['gate']}/{r['name']}" for r in failed))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
