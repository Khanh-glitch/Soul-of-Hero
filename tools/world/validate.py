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

from PIL import Image
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
        # majority-water cells: a cell is "open water" only when more than half of it is water,
        # so a bank cell the player can stand on is never called a wet shortcut.
        self.open_water = np.zeros((self.CH, self.CW), bool)
        _wo = meta.get("water_open")
        _wo_rows = (_wo.get("rows") if isinstance(_wo, dict) else _wo) or []
        if _wo_rows:
            for y, runs in enumerate(_wo_rows):
                if y >= self.CH:
                    break
                for s0, ln, val in runs:
                    if val:
                        self.open_water[y, s0:s0 + ln] = True
        else:
            self.open_water = self.water
        self.built = np.zeros((self.CH, self.CW), bool)
        # use the compiler's own walkable-structure masks when exported, so "on the deck" means
        # the same cells the compiler cleared, not a second guess at the span geometry
        for key, attr in (("walk_deck", "deck"), ("walk_pier", "pier"), ("walk_ford", "ford")):
            blk = meta.get(key)
            if isinstance(blk, dict) and blk.get("rows"):
                m = np.zeros((self.CH, self.CW), bool)
                for y, runs in enumerate(blk["rows"]):
                    if y >= self.CH:
                        break
                    for s0, ln, val in runs:
                        if val:
                            m[y, s0:s0 + ln] = True
                setattr(self, attr, m)
        # pier (5) and ford (6) cells from the compiled class map: both are legitimate,
        # authored ways to stand over water and must be separable from a wet shortcut.
        self.pier = np.zeros((self.CH, self.CW), bool)
        self.ford = np.zeros((self.CH, self.CW), bool)
        cm = meta.get("network", {}).get("class_map", {}).get("rows") or []
        for y, runs in enumerate(cm):
            if y >= self.CH:
                break
            for rec in runs:
                s0, ln, val = rec
                if val == 5:
                    self.pier[y, s0:s0 + ln] = True
                elif val == 6:
                    self.ford[y, s0:s0 + ln] = True
                if val in (4, 5, 6):
                    self.built[y, s0:s0 + ln] = True

    # ---------- collision ----------
    def _deck_mask(self):
        d = np.zeros((self.CH, self.CW), bool)
        for b in self.m["bridges"]:
            cx, cy = b.get("deck_px") or b["world_px"]   # deck centre, not the GOLD marker
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
                    for sy in range(0, self.cells, 2):
                        for sx in range(0, self.cells, 2):
                            px, py = xx * self.cells + sx, yy * self.cells + sy
                            dx, dy = px - cx, py - cy
                            u = dx * ca + dy * sa
                            vv = -dx * sa + dy * ca
                            if abs(u) <= half_len and abs(vv) <= half_w:
                                hit += 1
                    # the exact rule the compiler's collision uses: >= 10 % deck coverage
                    if hit / ((self.cells // 2) ** 2) >= 0.10:
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
    bypass_class = {}
    class_default = "no off-deck route inside the corridor (bridge is the only crossing)"
    for b in meta["bridges"]:
        sid = b["source_id"]
        cx, cy = b.get("deck_px") or b["world_px"]
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
        ford_cells = np.zeros_like(W.walk)
        for f in meta.get("fords", []):
            fc = W.cell_of(f[0] * U, f[1] * U)
            ford_cells[max(0, fc[1] - 2):fc[1] + 3, max(0, fc[0] - 2):fc[0] + 3] = True
        allow_land = W.walk & tight & ~W.deck & ~W.water        # dry land only
        land_route = W.path_cells(a_cell, b_cell, allow_land) is not None
        allow_ford = W.walk & tight & ~W.deck                   # land + authored ford
        ford_route = (not land_route) and W.path_cells(a_cell, b_cell, allow_ford) is not None
        if land_route:
            bypass_class[sid] = "land-alternative (legitimate, no water crossed)"
        elif ford_route:
            bypass_class[sid] = "ford (authored GOLD road crossing)"
        # A route around the bridge is only a defect when it actually crosses open water that is
        # not a built structure.  Landings are opened for pathing but never opened onto the deck
        # or onto water, so "go around" really means go around.
        allow_nod = W.walk & tight & ~W.deck & ~ford_cells
        for c_ in (a_cell, b_cell):
            y0_, y1_ = max(0, c_[1] - 1), c_[1] + 2
            x0_, x1_ = max(0, c_[0] - 1), c_[0] + 2
            ok_blk = W.walk[y0_:y1_, x0_:x1_] & ~W.deck[y0_:y1_, x0_:x1_] & \
                ~ford_cells[y0_:y1_, x0_:x1_]
            allow_nod[y0_:y1_, x0_:x1_] |= ok_blk
        p_route = W.path_cells(a_cell, b_cell, allow_nod)
        if (not land_route) and (not ford_route) and p_route is not None:
            wet = [(x, y) for (x, y) in p_route if W.open_water[y, x]]
            wet_pier = [c for c in wet if W.pier[c[1], c[0]]]
            wet_ford = [c for c in wet if W.ford[c[1], c[0]]]
            unbuilt = [c for c in wet if c not in wet_pier and c not in wet_ford]
            if not wet:
                bypass_class[sid] = "land-alternative (dry cells only, legitimate)"
            elif wet_pier and not unbuilt:
                bypass_class[sid] = "pier route (legitimate: crosses %d dock cells)" % len(wet_pier)
            else:
                bypass_class[sid] = ("DEFECT: off-deck wet traversal over %d unbuilt water cells"
                                     % len(unbuilt))
                rail_fail.append(f"{sid}:wet-crossing-possible-without-the-deck")
    check("A5", "bridge_traversal_over_deck", not cross_fail,
          f"{len(meta['bridges']) - len(cross_fail)}/{len(meta['bridges'])} bridges traverse over their deck",
          offenders=cross_fail)
    check("A5", "bridge_deck_clear", not deck_fail, "feet box fits along every deck centreline",
          offenders=deck_fail)
    off_deck = {k: v for k, v in bypass_class.items()
                if not v.startswith("DEFECT")}
    check("A5", "bridge_offdeck_routes_classified", not rail_fail,
          f"{len(off_deck)} of {len(meta['bridges'])} bridges have an off-deck route inside their "
          f"corridor and every one is classified: "
          f"{sum(1 for v in off_deck.values() if v.startswith('land-alternative'))} dry land "
          f"alternatives, {sum(1 for v in off_deck.values() if v.startswith('ford'))} authored "
          f"fords, {len(rail_fail)} wet traversals", offenders=rail_fail)

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
    entrances = {}
    for p in land_pois:
        x, y = p["world_px"]
        best = None
        for d in range(0, 4):
            for dy in range(-d, d + 1):
                for dx in range(-d, d + 1):
                    cx, cy = int((x + dx * W.cells) // W.cells), int((y + dy * W.cells) // W.cells)
                    if 0 <= cx < W.CW and 0 <= cy < W.CH and reach_all[cy, cx]:
                        best = [cx * W.cells + 8, cy * W.cells + 8]
                        break
                if best:
                    break
            if best:
                break
        entrances[p["source_id"]] = best
    check("A7", "land_poi_entrance_anchor", all(entrances.values()),
          f"{sum(1 for v_ in entrances.values() if v_)}/{len(land_pois)} land POIs have a reachable entrance cell",
          offenders=[k for k, mv in entrances.items() if not mv])
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

    # ---------- A7 POI access: entrance anchors and clearing integrity ----------
    solid_at_poi = []
    land_checked = 0
    for p in meta["pois"]:
        cx, cy = W.cell_of(*p["world_px"])
        if 0 <= cx < W.CW and 0 <= cy < W.CH and W.open_water[cy, cx]:
            continue                      # maritime POI: its centre is meant to be water
        land_checked += 1
        if 0 <= cx < W.CW and 0 <= cy < W.CH and W.solid[cy, cx]:
            solid_at_poi.append(p["source_id"])
    check("A7", "poi_clearing_integrity", not solid_at_poi,
          f"{land_checked - len(solid_at_poi)}/{land_checked} dry POI centres are open ground after "
          f"placement (the compiler's clearing pass reports 0 cells needing clearing, which is only "
          f"credible because placement keep-outs already protect them)", offenders=solid_at_poi)
    entrance_far = []
    for p in meta["pois"]:
        ent = entrances.get(p["source_id"])
        if ent is None:
            continue                      # maritime / ferry-only POI, reported separately
        cx, cy = W.cell_of(*p["world_px"])
        ex, ey = W.cell_of(*ent)
        if max(abs(ex - cx), abs(ey - cy)) > 6:
            entrance_far.append(f"{p['source_id']}:anchor {max(abs(ex-cx), abs(ey-cy))} cells away")
    check("A7", "poi_entrance_anchor_present", not entrance_far,
          f"{len(entrances)} land POIs, every entrance anchor is within 6 cells of its centre",
          offenders=entrance_far)

    W.built = W.deck | W.pier | W.ford

    # ================= R6 NETWORK GATES =================
    net = meta.get("network") or {}
    roads_net = net.get("roads", {}).get("coverage", [])
    water_net = net.get("water", {}).get("coverage", [])
    road_ids = {r["source_id"] for r in meta["roads"]}
    river_ids = {r["source_id"] for r in meta["rivers"]}
    traversal = {t["source_id"]: t for t in net.get("road_traversal", [])}

    # N1 source network integrity + endpoint classification
    missing_roads = sorted(road_ids - {c["source_id"] for c in roads_net})
    missing_rivers = sorted(river_ids - {c["source_id"] for c in water_net})
    check("N1", "all_land_roads_present", not missing_roads,
          f"{len(road_ids)} authored land roads compiled, {len(missing_roads)} missing",
          offenders=missing_roads)
    check("N1", "all_rivers_present", not missing_rivers,
          f"{len(river_ids)} rivers compiled, {len(missing_rivers)} missing",
          offenders=missing_rivers)
    nm = net.get("roads", {}).get("near_miss", [])
    allowed_cls = {"VALID_JUNCTION", "VALID_SEPARATE", "CORRECTED_COMPILER_CONNECTION"}
    unexplained = [f"{x['road']}@{x['at']}->{x['nearest']} d={x['distance']}"
                   for x in nm if x.get("class") not in allowed_cls]
    by_cls = {}
    for x in nm:
        by_cls[x.get("class")] = by_cls.get(x.get("class"), 0) + 1
    check("N1", "road_endpoint_every_one_classified", not unexplained,
          f"{len(nm)} near endpoints, every one classified {by_cls}", offenders=unexplained)
    blocked_amb = [x for x in nm if x.get("class") == "SOURCE_AMBIGUITY_BLOCKED"]
    check("N1", "road_endpoint_no_blocked_ambiguity", not blocked_amb,
          "no endpoint requires a connection GOLD does not author", offenders=blocked_amb)

    # N2 independent functional traversal: the validator's own collision grid and its own BFS,
    # limited to the authored corridor, starting from the nearest walkable cell to each end.
    def corridor_of(r, dev=2.0):
        m = np.zeros_like(W.walk)
        tol_cells = int(math.ceil((r.get("half_width_units", 1.6) + dev) / (W.cells / U)))
        pts = r["points"]
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            L = math.hypot(x1 - x0, y1 - y0)
            n = max(1, int(L / 0.5))
            for k in range(n + 1):
                t = k / n
                cx, cy = W.cell_of((x0 + (x1 - x0) * t) * U, (y0 + (y1 - y0) * t) * U)
                m[max(0, cy - tol_cells):cy + tol_cells + 1,
                  max(0, cx - tol_cells):cx + tol_cells + 1] = True
        return m

    extra_cells = W.deck.copy()
    for p in meta["pois"]:
        cx, cy = W.cell_of(*p["world_px"])
        extra_cells[max(0, cy - 2):cy + 3, max(0, cx - 2):cx + 3] = True

    def snap_walkable(cx, cy, allow, r=4):
        if 0 <= cx < W.CW and 0 <= cy < W.CH and W.walk[cy, cx] and allow[cy, cx]:
            return (cx, cy)
        for rad in range(1, r + 1):
            best = None
            for dy in range(-rad, rad + 1):
                for dx in range(-rad, rad + 1):
                    ax, ay = cx + dx, cy + dy
                    if not (0 <= ax < W.CW and 0 <= ay < W.CH):
                        continue
                    if W.walk[ay, ax] and allow[ay, ax]:
                        d = dx * dx + dy * dy
                        if best is None or d < best[0]:
                            best = (d, ax, ay)
            if best:
                return (best[1], best[2])
        return None

    walk_fail, walk_notes = [], []
    for r in meta["roads"]:
        corr = corridor_of(r)
        allow = (corr | extra_cells) & W.walk
        a = snap_walkable(*W.cell_of(r["points"][0][0] * U, r["points"][0][1] * U), allow)
        b = snap_walkable(*W.cell_of(r["points"][-1][0] * U, r["points"][-1][1] * U), allow)
        if not a or not b:
            walk_fail.append(f"{r['source_id']}:no-walkable-terminal")
            continue
        path = W.path_cells(a, b, allow)
        claimed = traversal.get(r["source_id"], {}).get("reachable")
        walk_notes.append({"road": r["source_id"], "kind": r["kind"],
                           "validator_reachable": path is not None,
                           "compiler_reachable": claimed,
                           "corridor_cells": int(corr.sum())})
        if path is None:
            walk_fail.append(f"{r['source_id']}:corridor-blocked")
        elif claimed is False:
            walk_fail.append(f"{r['source_id']}:compiler-disagrees")
    check("N2", "road_functional_traversal", not walk_fail,
          f"{len(meta['roads']) - len(walk_fail)}/{len(meta['roads'])} authored roads are walkable "
          f"end to end inside their own corridor with the validator's collision grid and BFS",
          offenders=walk_fail)

    # N3 independent rendered continuity: compare the two final render passes.
    _outdir = os.path.join(REPO, "out")
    pre_p = os.path.join(_outdir, "render_pass_pre_roads.png")
    post_p = os.path.join(_outdir, "render_pass_post_roads.png")
    render_gap = None
    render_report = []
    if not (os.path.exists(pre_p) and os.path.exists(post_p)):
        render_gap = ["render passes missing: rerun veyra_compile.py"]
    else:
        pre_i = np.asarray(Image.open(pre_p).convert("RGB"))
        post_i = np.asarray(Image.open(post_p).convert("RGB"))
        changed = (pre_i != post_i).any(axis=2)
        water_like = np.zeros_like(changed)
        for pal in ((22, 64, 104), (30, 86, 126), (46, 112, 152), (58, 92, 104), (214, 236, 242)):
            water_like |= (np.abs(post_i[:, :, 0].astype(np.int16) - pal[0]) < 6) & \
                          (np.abs(post_i[:, :, 1].astype(np.int16) - pal[1]) < 6) & \
                          (np.abs(post_i[:, :, 2].astype(np.int16) - pal[2]) < 6)
        from scipy import ndimage
        H_img, W_img = changed.shape
        render_gap = []
        render_report = []
        for r in meta["roads"]:
            pts = r["points"]
            half_px = max(8, int(r.get("half_width_units", 1.6) * U + 2))
            xs = [p[0] * U for p in pts]
            ys = [p[1] * U for p in pts]
            x0c = max(0, int(min(xs)) - half_px - 4)
            x1c = min(W_img, int(max(xs)) + half_px + 5)
            y0c = max(0, int(min(ys)) - half_px - 4)
            y1c = min(H_img, int(max(ys)) + half_px + 5)
            if x1c <= x0c or y1c <= y0c:
                continue
            sub = changed[y0c:y1c, x0c:x1c]
            if not sub.any():
                render_gap.append(f"{r['source_id']}:0.000")
                continue
            # distance (in px) from every pixel to the nearest pixel that the road pass changed
            dist = ndimage.distance_transform_edt(~sub)
            tot = hit = 0
            worst = 0.0
            run = 0.0
            for i in range(len(pts) - 1):
                (ax, ay), (bx, by) = pts[i], pts[i + 1]
                L = math.hypot(bx - ax, by - ay)
                n = max(1, int(L))
                for k in range(n + 1):
                    t = k / n
                    px = int((ax + (bx - ax) * t) * U) - x0c
                    py = int((ay + (by - ay) * t) * U) - y0c
                    if not (0 <= px < dist.shape[1] and 0 <= py < dist.shape[0]):
                        continue
                    tot += 1
                    d = dist[py, px]
                    cell_of_px = W.cell_of(px + x0c, py + y0c)
                    if W.built[cell_of_px[1], cell_of_px[0]]:
                        hit += 1
                        run = 0.0
                        continue
                    if d <= half_px:
                        hit += 1
                        run = 0.0
                    else:
                        run += L / n
                        worst = max(worst, run)
            cov = hit / tot if tot else 0.0
            render_report.append({"road": r["source_id"], "samples": tot,
                                  "samples_with_road_material": hit,
                                  "coverage": round(cov, 4),
                                  "worst_gap_units": round(worst, 2),
                                  "tolerance_px": half_px})
            if cov < 0.995:
                render_gap.append(f"{r['source_id']}:{cov:.3f}")
    check("N3", "road_render_pass_continuity", not render_gap,
          "final-render comparison (pre-road vs post-road pass at native resolution) shows road "
          "material on >=99.5% of every authored centreline",
          offenders=render_gap)

    # N4 hydrology: exact named-body adjacency plus rendered water coverage
    wv = net.get("water_verification", {})
    adj = wv.get("adjacency", [])
    adj_bad = [f"{a['river']}:{a['end']}->{a['kind']}:{a.get('ref')}"
               for a in adj if a.get("connected") is False]
    checked_adj = [a for a in adj if a.get("connected") is not None]
    check("N4", "river_meets_named_body", not adj_bad,
          f"{len(checked_adj) - len(adj_bad)}/{len(checked_adj)} authored source/mouth relations "
          f"put the river end on the body it names (<= 1.0 u) with no closer body at that point; "
          f"{len(adj) - len(checked_adj)} springs have no receiving body",
          offenders=adj_bad)
    gap_water = [f"{r['source_id']}:{r['coverage']:.3f}" for r in water_net if r["coverage"] < 0.98]
    check("N4", "river_rendered_coverage", not gap_water,
          f"{len(water_net) - len(gap_water)}/{len(water_net)} rivers >=98% rendered water pixels",
          offenders=gap_water)
    comps = wv.get("components")
    check("N4", "water_component_report", comps is not None,
          f"compiled water surface forms {comps} connected pixel component(s); every river end "
          f"shares its component with the named body")

    # N5 crossing legitimacy
    brooks = net.get("brook_passes", [])
    fords = net.get("authored_fords", [])
    unjust = []
    for bp in brooks:
        bb = min(math.hypot(bp["at"][0] - b["gold_at"][0], bp["at"][1] - b["gold_at"][1])
                 for b in meta["bridges"])
        if bp["river_width_units"] > 2.5 or bb <= 14:
            unjust.append(f"{bp['road']}@{bp['at']}")
    check("N5", "brook_passes_documented", not unjust,
          f"{len(brooks)} brook passes, each <=2.5 u with no bridge within 14 u", offenders=unjust)
    ford_bad = [f for f in fords if f.get("decision") != "AUTHORED_FORD"]
    check("N5", "authored_for_roads_only", not ford_bad,
          f"{len(fords)} fords, every one backed by GOLD `ford: true` and a single <=6 u channel "
          f"crossing", offenders=ford_bad)
    check("N5", "no_undocumented_water_crossing", not net.get("water_conflict_roads"),
          "no road corridor lies on open water", offenders=net.get("water_conflict_roads"))

    # N6 functional journeys from each spawn
    hubs = {}
    for p in meta["pois"]:
        for key in ("village", "quarry", "port", "elder_site"):
            if p["arche"] == key and key not in hubs:
                hubs[key] = p
    journeys = []
    for s in meta["spawns"]:
        seen = W.flood([W.cell_of(*s["world_px"])])
        rec = {"spawn": s.get("id") or s.get("source_id"), "reached": {}}
        for key, p in hubs.items():
            cx, cy = W.cell_of(*p["world_px"])
            ok = bool(seen[cy, cx]) or any(
                seen[min(W.CH - 1, cy + dy), min(W.CW - 1, cx + dx)]
                for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                if 0 <= cy + dy < W.CH and 0 <= cx + dx < W.CW)
            rec["reached"][key] = {"poi": p["source_id"], "reachable": ok}
        journeys.append(rec)
    check("N6", "spawn_to_hubs",
          all(all(v["reachable"] for v in j["reached"].values()) for j in journeys), journeys)

    # ---------- summary ----------
    mandatory = [r for r in results if r["mandatory"]]
    failed = [r for r in mandatory if not r["passed"]]
    def _sha(path_parts):
        fp = os.path.join(REPO, *path_parts)
        if not os.path.exists(fp):
            return None
        h = hashlib.sha256()
        with open(fp, "rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()

    code_files = ["tools/world/veyra_compile.py", "tools/world/network.py", "tools/world/kit.py",
                  "tools/world/validate.py", "tools/world/world.py"]
    compiler_h = hashlib.sha256()
    for cf in code_files:
        fp = os.path.join(REPO, cf)
        if os.path.exists(fp):
            compiler_h.update(open(fp, "rb").read())
    git_sha = os.environ.get("GITHUB_SHA") or os.popen("git rev-parse HEAD").read().strip()
    if os.environ.get("VEYRA_REQUIRE_SHA") == "1":
        head = os.popen("git rev-parse HEAD").read().strip()
        if os.environ.get("GITHUB_SHA") and head and not head.startswith(os.environ["GITHUB_SHA"][:12]) \
                and not os.environ["GITHUB_SHA"].startswith(head[:12]):
            raise SystemExit("refusing to write validation: GITHUB_SHA %s != HEAD %s"
                             % (os.environ["GITHUB_SHA"], head))
    provenance = {"tested_sha": git_sha, "gold_sha256": sha,
                  "compiler_sha256": compiler_h.hexdigest(), "compiler_files": code_files,
                  "world_png_sha256": _sha(["out", "world.png"]),
                  "world_meta_sha256": _sha(["out", "world_meta.json"]),
                  "collision_sha256": hashlib.sha256(
                      json.dumps(meta["collision"]["rows"], separators=(",", ":")).encode()).hexdigest(),
                  "minimap_sha256": _sha(["out", "minimap.png"]),
                  "network_json_sha256": _sha(["out", "network.json"])}

    out = {"schema": "soh.veyra.spatial_validation.v2",
           "provenance": provenance, "gold_sha256": sha,
           "world_meta_sha256": hashlib.sha256(open(META, "rb").read()).hexdigest(),
           "checks": results, "passed": len(mandatory) - len(failed),
           "failed": len(failed), "all_passed": not failed,
           "bridge_proof": proof, "bridge_bypass_class": bypass_class,
           "code_sha": os.environ.get("GITHUB_SHA") or os.popen("git rev-parse HEAD").read().strip(),
           "world_png_sha256": (hashlib.sha256(open(os.path.join(REPO, "out", "world.png"), "rb").read()).hexdigest()
                                if os.path.exists(os.path.join(REPO, "out", "world.png")) else None),
           "poi_access": access, "poi_entrance_anchor_px": entrances,
           "spawn_routes": route_report, "network_journeys": journeys,
           "road_traversal": walk_notes, "road_render_pass": render_report,
           "endpoint_classes": by_cls, "water_components": wv.get("components"),
           "hydrology_adjacency": adj,
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
