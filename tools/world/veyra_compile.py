"""Veyra compiler (v3) — GOLD → world. Git-only art, sub-tile hydrology, real crossings.

What changed in v3 (R3 corrective round)
---------------------------------------
* Bridge railings are collidable (the R2 `& False` bug is gone) and are tested against the
  character footprint by `tools/world/validate.py`.
* Dock piers are only built when the GOLD `water` reference actually touches the dock: the
  named water body (sea / lake id / river id) is rasterised separately and the land anchor must
  sit within 6 units of it and the water anchor inside it.  Invalid docks are rejected, not
  relocated by a nearest-water search.
* The 8 `kind=ferry` GOLD routes are exported as maritime routes and never become roads.
* Narrow rivers block movement: collision cells are solid when a cell is >= 30 % water, and
  only fords (road crossing a short wet run) or bridge decks can punch through.
* Ground family per cell now comes from GOLD (elevation, biome, zone soil) and from the elder
  region: Surtur gets the derived ash ramp, Anubis the derived dry ramp, with region props.
* Chapter-1 environment sheets supply necropolis, forge, archive, relay, brazier and facade
  vocabulary, so a site is composed from meaningful pieces instead of a lone statue.
* Derived families (DV-01 ash, DV-02 dry, DV-03 water) are palette remaps of admitted art and
  are labelled as derived in the art manifest; authored water is still an open art gap.

Run: python3 tools/world/veyra_compile.py [--out out]
"""
import argparse
import base64
import hashlib
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw

import art_registry as ART
import kit as KIT
import network as NET

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
GOLD = os.path.join(REPO, "map_tower", "veyra_gold", "VEYPRA_TMP".replace("VEYPRA_TMP",
                                                                          "VEYRA_GOLD_MAP.sohmap.json"))

U = 4
UW, UH = 2000, 1400
PW, PH = UW * U, UH * U
ART_TILE = 32
COLL = 16
GW, GH = PW // ART_TILE, PH // ART_TILE
CW, CH = PW // COLL, PH // COLL

ROAD_HALF = {k: v["render"] for k, v in NET.ROAD_WIDTH.items()}   # measured contract, see network.py
WATER_OCCLUSION = 0.12      # a collision cell is water if >= 30% of it is wet


def h32(*parts):
    s = "|".join(str(p) for p in parts).encode()
    return int.from_bytes(hashlib.blake2b(s, digest_size=4).digest(), "big")


# ---------------------------------------------------------------- raster ops
def fill_polygon(mask, ring, value=1):
    pts = [(float(x), float(y)) for x, y in ring]
    if len(pts) < 3:
        return
    ys = [p[1] for p in pts]
    for y in range(max(0, int(min(ys))), min(UH - 1, int(max(ys)) + 1) + 1):
        yc = y + 0.5
        xs = []
        n = len(pts)
        for i in range(n):
            xa, ya = pts[i]
            xb, yb = pts[(i + 1) % n]
            if (ya <= yc < yb) or (yb <= yc < ya):
                xs.append(xa + (yc - ya) / (yb - ya) * (xb - xa))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            a = max(0, int(math.ceil(xs[i] - 0.5)))
            b = min(UW - 1, int(math.floor(xs[i + 1] - 0.5)))
            if b >= a:
                mask[y, a:b + 1] = value


def _disc(mask, cx, cy, r, value=1):
    x0, x1 = max(0, int(cx - r)), min(UW - 1, int(cx + r) + 1)
    y0, y1 = max(0, int(cy - r)), min(UH - 1, int(cy + r) + 1)
    if x1 <= x0 or y1 <= y0:
        return
    yy, xx = np.ogrid[y0:y1, x0:x1]
    sub = mask[y0:y1, x0:x1]
    sub[((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2) <= r * r] = value


def stroke_polyline(mask, pts, half, value=1):
    if half <= 0:
        return
    pts = [(float(x), float(y)) for x, y in pts]
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        L = math.hypot(x1 - x0, y1 - y0) or 1e-6
        steps = max(1, int(L * 2))
        for s in range(steps + 1):
            t = s / steps
            _disc(mask, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, half, value)
    for p in (pts[0], pts[-1]):
        _disc(mask, p[0], p[1], half, value)


def fill_poly_px(rings):
    """Fill polygon rings at world-pixel resolution (PIL, so no unit-grid clamp)."""
    im = Image.new("1", (PW, PH), 0)
    d = ImageDraw.Draw(im)
    for ring in rings:
        if ring and len(ring) >= 3:
            d.polygon([(float(q[0]) * U, float(q[1]) * U) for q in ring], fill=1)
    return np.array(im, bool)


def stroke_px(mask, pts, half_px):
    """Stamp a polyline at pixel resolution with round caps (smooth rivers, no 16 px steps)."""
    r = max(1.0, float(half_px))
    H, W = mask.shape
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        L = math.hypot(x1 - x0, y1 - y0)
        steps = max(1, int(L / max(1.0, r * 0.5)))
        for k in range(steps + 1):
            t = k / steps
            cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            xa, xb = int(cx - r - 1), int(cx + r + 2)
            ya, yb = int(cy - r - 1), int(cy + r + 2)
            if xb <= 0 or yb <= 0 or xa >= W or ya >= H:
                continue
            xa, ya = max(0, xa), max(0, ya)
            xb, yb = min(W, xb), min(H, yb)
            yy, xx = np.ogrid[ya:yb, xa:xb]
            mask[ya:yb, xa:xb] |= ((xx - cx) ** 2 + (yy - cy) ** 2) <= r * r


def rect_rot(mask, cx, cy, ang, half_len, half_wid, value=1):
    ca, sa = math.cos(ang), math.sin(ang)
    r = math.hypot(half_len, half_wid) + 2
    x0, x1 = max(0, int(cx - r)), min(UW - 1, int(cx + r))
    y0, y1 = max(0, int(cy - r)), min(UH - 1, int(cy + r))
    if x1 < x0 or y1 < y0:
        return
    yy, xx = np.mgrid[y0:y1 + 1, x0:x1 + 1]
    dx, dy = xx + 0.5 - cx, yy + 0.5 - cy
    u = dx * ca + dy * sa
    v = -dx * sa + dy * ca
    mask[y0:y1 + 1, x0:x1 + 1][(np.abs(u) <= half_len) & (np.abs(v) <= half_wid)] = value


def erode(m, r):
    e = m.copy()
    for _ in range(r):
        n = e.copy()
        n[1:] &= e[:-1]; n[:-1] &= e[1:]
        n[:, 1:] &= e[:, :-1]; n[:, :-1] &= e[:, 1:]
        e = n
    return e


def grow(m, r):
    e = m.copy()
    for _ in range(r):
        n = e.copy()
        n[1:] |= e[:-1]; n[:-1] |= e[1:]
        n[:, 1:] |= e[:, :-1]; n[:, :-1] |= e[:, 1:]
        e = n
    return e


def up(mask_u, target=(PW, PH)):
    return np.array(Image.fromarray((mask_u * 255).astype(np.uint8), "L")
                    .resize(target, Image.NEAREST)) > 0


def down(mask_px, cell, thresh):
    h, w = mask_px.shape
    return mask_px.reshape(h // cell, cell, w // cell, cell).mean(axis=(1, 3)) >= thresh


# ---------------------------------------------------------------- main
def _rle_v(grid):
    rows = []
    for y in range(grid.shape[0]):
        row, x, runs = grid[y], 0, []
        while x < grid.shape[1]:
            if not row[x]:
                x += 1
                continue
            s0, val = x, int(row[x])
            while x < grid.shape[1] and row[x] == val:
                x += 1
            runs.append([int(s0), int(x - s0), val])
        rows.append(runs)
    return rows


def _rle(grid):
    rows = []
    for y in range(grid.shape[0]):
        row, x, runs = grid[y], 0, []
        while x < grid.shape[1]:
            if not row[x]:
                x += 1
                continue
            s0 = x
            while x < grid.shape[1] and row[x]:
                x += 1
            runs.append([s0, x - s0, 1])
        rows.append(runs)
    return rows


def main(out_dir):
    gold = json.load(open(GOLD))
    proj = gold["project"]
    os.makedirs(out_dir, exist_ok=True)
    fams, manifest = ART.load()

    # ---------------- GOLD masks on the 4 px/unit raster ----------------
    land = np.zeros((UH, UW), np.uint8)
    for l in proj["land"]:
        for ring in l["rings"]:
            fill_polygon(land, ring, 1)

    def body_mask(kind, ref):
        """Rasterise one named water body (sea | lake id | river id)."""
        m = np.zeros((UH, UW), np.uint8)
        if kind == "sea":
            m[land == 0] = 1
        elif ref:
            for lk in proj["lakes"]:
                if lk["id"] == ref:
                    for ring in lk.get("rings") or [lk.get("ring")]:
                        if ring:
                            fill_polygon(m, ring, 1)
            for r in proj["rivers"]:
                if r["id"] == ref:
                    stroke_polyline(m, r["points"], max(0.35, (r.get("width") or 3) / 2), 1)
        return m

    lakes = np.zeros((UH, UW), np.uint8)
    for lk in proj["lakes"]:
        for ring in lk.get("rings") or [lk.get("ring")]:
            if ring:
                fill_polygon(lakes, ring, 1)
    rivers = np.zeros((UH, UW), np.uint8)
    for r in proj["rivers"]:
        stroke_polyline(rivers, r["points"], max(0.35, (r.get("width") or 3) / 2), 1)
    sea = (land == 0).astype(np.uint8)
    water = ((sea | lakes | (rivers & land)) > 0).astype(np.uint8)

    # ---- bank realignment -------------------------------------------------------
    # A GOLD road that runs inside a channel it is not meant to wade is a drafting overlap,
    # not a crossing.  The polyline is densified to 0.75 u and every wet point is moved to the
    # nearest dry bank within 2 u, except the authored crossing itself (a `ford: true` road keeps
    # its single channel crossing, and a bridge landing keeps its approach).  Every delta is
    # recorded per road so nothing is silently changed and GOLD itself is untouched.
    def _densify(pts, step=0.75):
        out = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            n = max(1, int(L / step))
            for k in range(1, n + 1):
                t = k / n
                out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
        return out

    _river_lines = [[(float(q[0]), float(q[1])) for q in r["points"]] for r in proj["rivers"]]
    _bridge_u = [(float(b["at"][0]), float(b["at"][1])) for b in proj["bridges"]]
    road_offsets = []
    for rd in proj["roads"]:
        if rd.get("kind") == "ferry":
            continue
        pts = [(float(q[0]), float(q[1])) for q in rd["points"]]
        dense = _densify(pts)
        water_margin = water.copy()
        for _ in range(1):                     # 1 u dry margin around every channel
            water_margin = np.maximum(water_margin, np.roll(water_margin, 1, 0))
            water_margin = np.maximum(water_margin, np.roll(water_margin, -1, 0))
            water_margin = np.maximum(water_margin, np.roll(water_margin, 1, 1))
            water_margin = np.maximum(water_margin, np.roll(water_margin, -1, 1))
        wet_idx = []
        for i, (x, y) in enumerate(dense):
            xi, yi = int(x), int(y)
            if 0 <= xi < UW and 0 <= yi < UH and water_margin[yi, xi]:
                wet_idx.append(i)
        if not wet_idx:
            continue
        # authored crossings this road may legitimately keep wet
        keep = []
        if rd.get("ford"):
            for P, Q in zip(pts, pts[1:]):
                for RL in _river_lines:
                    for a, b in zip(RL, RL[1:]):
                        hit = NET._seg_intersect(P, Q, a, b)
                        if hit:
                            keep.append(hit)
        for i in wet_idx:
            x, y = dense[i]
            if any(math.hypot(x - kx, y - ky) <= 1.2 for kx, ky in keep):
                continue
            if min(math.hypot(x - bx, y - by) for bx, by in _bridge_u) <= 8:
                continue
            best = None
            xi, yi = int(x), int(y)
            for dy in range(-8, 9):
                for dx in range(-8, 9):
                    ax, ay = xi + dx, yi + dy
                    if not (0 <= ax < UW and 0 <= ay < UH) or water_margin[ay, ax]:
                        continue
                    d = math.hypot(dx, dy)
                    if d <= 2.0 and (best is None or d < best[0]):
                        best = (d, ax + 0.5, ay + 0.5)
            if best:
                dense[i] = (best[1], best[2])
                road_offsets.append({"source_id": rd["id"], "kind": rd.get("kind"),
                                     "from": [round(x, 2), round(y, 2)],
                                     "to": [round(best[1], 2), round(best[2], 2)],
                                     "delta_units": round(best[0], 2)})
        rd["points"] = [[round(q[0], 3), round(q[1], 3)] for q in dense]
    print("bank realignments", len(road_offsets))

    # ---------------- roads (ferry routes are NOT roads) ----------------
    roads = np.zeros((UH, UW), np.uint8)
    road_out, ferry_out = [], []
    for rd in proj["roads"]:
        kind = rd.get("kind", "trail")
        if kind == "ferry":
            ferry_out.append({"source_id": rd["id"], "name": rd.get("name"), "kind": "ferry",
                              "mode": "water", "points": rd["points"],
                              "endpoints_units": [rd["points"][0], rd["points"][-1]],
                              "implementation_status": "FUNCTIONAL_BLOCKED",
                              "note": "maritime route; boat movement unimplemented"})
            continue
        half = ROAD_HALF.get(kind, NET.ROAD_WIDTH["trail"]["render"])
        stroke_polyline(roads, rd["points"], half, 1)
        road_out.append({"source_id": rd["id"], "name": rd.get("name"), "kind": kind,
                         "mode": "land", "points": rd["points"], "half_width_units": half,
                         "world_points_px": [[q[0] * U, q[1] * U] for q in rd["points"]]})
    bridge_pts = [(float(b["at"][0]), float(b["at"][1])) for b in proj["bridges"]]
    if len(ferry_out) != 8:
        raise SystemExit(f"expected 8 ferry routes in GOLD, found {len(ferry_out)}")

    # fords: a road crossing a short wet run is wadeable; long wet runs are not
    ford_pts = []
    wet_road = (roads > 0) & (water > 0)
    ford = np.zeros((UH, UW), np.uint8)
    seen = np.zeros((UH, UW), bool)
    from collections import deque
    for sy in range(UH):
        for sx in range(UW):
            if not wet_road[sy, sx] or seen[sy, sx]:
                continue
            comp, q = [], deque([(sx, sy)])
            seen[sy, sx] = True
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < UW and 0 <= ny < UH and wet_road[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((nx, ny))
            cx_c = sum(c[0] for c in comp) / len(comp)
            cy_c = sum(c[1] for c in comp) / len(comp)
            near_bridge = any(math.hypot(bx - cx_c, by - cy_c) < 16 for bx, by in bridge_pts)
            if len(comp) <= 60 and not near_bridge:
                for x, y in comp:
                    ford[y, x] = 1
                ford_pts.append((sum(c[0] for c in comp) / len(comp),
                                 sum(c[1] for c in comp) / len(comp)))
    # ---- documented brook passes -------------------------------------------------
    # An authored trail may cross a brook (<= 2.5 GOLD units wide) with no bridge within 14 units.
    # These are recorded individually with their evidence and painted as a stepped stone passage;
    # they are never generated silently and never applied to navigable or wide water.
    brook_passes = []
    _bridge_at = [(float(b["at"][0]), float(b["at"][1])) for b in proj["bridges"]]
    for rd in proj["roads"]:
        if rd.get("kind") not in ("trail", "foot", "riverside"):
            continue
        P = [(float(q[0]), float(q[1])) for q in rd["points"]]
        for rv in proj["rivers"]:
            w = rv.get("width") or 3
            if w > 2.5:
                continue
            Q = [(float(q[0]), float(q[1])) for q in rv["points"]]
            for i in range(len(P) - 1):
                for j in range(len(Q) - 1):
                    hit = NET._seg_intersect(P[i], P[i + 1], Q[j], Q[j + 1])
                    if not hit:
                        continue
                    db = min(math.hypot(hit[0] - bx, hit[1] - by) for bx, by in _bridge_at)
                    if db <= 14:
                        continue
                    _disc(ford, hit[0], hit[1], 1.6, 1)
                    brook_passes.append({"road": rd["id"], "river": rv["id"],
                                         "river_width_units": w,
                                         "nearest_bridge_units": round(db, 1),
                                         "at": [round(hit[0], 2), round(hit[1], 2)],
                                         "evidence": "trail/foot crossing of a <=2.5-unit brook, "
                                                     "no authored bridge within 14 units",
                                         "render": "stepped stone passage"})
    # authored fords: GOLD marks `ford: true` on roads that are meant to wade a channel.
    authored_fords = []
    for rd in proj["roads"]:
        if not rd.get("ford") or rd.get("kind") == "ferry":
            continue
        rm = np.zeros((UH, UW), np.uint8)
        stroke_polyline(rm, rd["points"], 1.6, 1)
        wet = (rm > 0) & (water > 0)
        n = int(wet.sum())
        if not n:
            authored_fords.append({"road": rd["id"], "wet_cells": 0,
                                   "decision": "no water crossed at unit resolution"})
            continue
        ys, xs = np.nonzero(wet)
        extent = max(xs.max() - xs.min(), ys.max() - ys.min())
        if extent > 6:
            authored_fords.append({"road": rd["id"], "wet_cells": n, "extent_units": int(extent),
                                   "decision": "SOURCE_AMBIGUITY_BLOCKED: road runs inside the "
                                               "channel for more than 6 u, not a single crossing"})
            continue
        ford[wet] = 1
        # widen the wade to the full road corridor so both banks and the whole strip are one
        # continuous passage (the crossing itself is authored, the width is the road width)
        ford = np.maximum(ford, grow(wet.astype(np.uint8),
                                     int(math.ceil((NET.ROAD_WIDTH.get(rd.get("kind"), {}).get("render", 1.8)) + 1.0))))
        ford_pts.append((float(xs.mean()), float(ys.mean())))
        authored_fords.append({"road": rd["id"], "wet_cells": n, "extent_units": int(extent),
                               "at": [round(float(xs.mean()), 2), round(float(ys.mean()), 2)],
                               "evidence": "GOLD road carries `ford: true`; single channel "
                                           "crossing of <= 6 u with no bridge",
                               "decision": "AUTHORED_FORD"})
    print("authored fords", [f.get("decision") for f in authored_fords])
    print("documented brook passes", len(brook_passes))
    roads = (roads & ~ford).astype(np.uint8)

    # ---------------- bridges ----------------
    deck = np.zeros((UH, UW), np.uint8)
    rail = np.zeros((UH, UW), np.uint8)
    bridges = []
    for br in proj["bridges"]:
        cx, cy = float(br["at"][0]), float(br["at"][1])
        ang = float(br.get("ang") or 0.0)
        load = br.get("load", "foot")
        half_w = 6.0 if load == "cart" else 5.0
        wet = lambda x, y: (0 <= int(x) < UW and 0 <= int(y) < UH and water[int(y), int(x)])

        def reach(sign):
            for d in range(1, 120):
                if not wet(cx + math.cos(ang) * d * sign, cy + math.sin(ang) * d * sign):
                    return d
            return 120
        a, b = reach(-1), reach(1)
        a += 2.5; b += 2.5                       # approach apron so the deck meets the road
        half_len = (a + b) / 2.0
        m = (b - a) / 2.0
        mx, my = cx + math.cos(ang) * m, cy + math.sin(ang) * m
        rect_rot(deck, mx, my, ang, half_len, half_w, 1)
        rect_rot(rail, mx, my, ang, half_len, half_w + 0.8, 1)
        rail[deck > 0] = 0

        def landing(sign, dist):
            """Land at the deck end, then walk outward until the point is dry land so the
            landing is always a real, walkable place rather than a point in the river."""
            for extra in range(0, 9):
                d = dist + extra
                x = cx + math.cos(ang) * d * sign
                y = cy + math.sin(ang) * d * sign
                if 0 <= int(y) < UH and 0 <= int(x) < UW and land[int(y), int(x)] and not water[int(y), int(x)]:
                    return (x, y, extra)
            return (cx + math.cos(ang) * dist * sign, cy + math.sin(ang) * dist * sign, None)

        la_x, la_y, la_extra = landing(-1, a)
        lb_x, lb_y, lb_extra = landing(1, b)
        bridges.append({"source_id": br["id"], "name": br.get("name"), "load": load,
                        "gold_at": [cx, cy], "bearing_rad": ang,
                        "world_px": [cx * U, cy * U], "deck_px": [mx * U, my * U],
                        "span_units": round(a + b, 2),
                        "landing_a_px": [la_x * U, la_y * U],
                        "landing_b_px": [lb_x * U, lb_y * U],
                        "landing_snap_units": [la_extra, lb_extra],
                        "deck_width_units": round(half_w * 2, 2),
                        "rail_width_units": 1.6,
                        "collision": "deck walkable (everything else, including the water beside it, solid)",
                        "deviation": "deck/rail width derived from load class; GOLD stores no width"})

    # ---------------- docks with validated anchors ----------------
    piers = np.zeros((UH, UW), np.uint8)
    docks = []

    def dry_cell(x, y, pad=4):
        """A 16 px collision cell around (x, y) that is completely free of water."""
        x0, x1 = int(x - pad), int(x + pad)
        y0, y1 = int(y - pad), int(y + pad)
        if x0 < 0 or y0 < 0 or x1 >= UW or y1 >= UH:
            return False
        return (not water[y0:y1 + 1, x0:x1 + 1].any()) and land[y0:y1 + 1, x0:x1 + 1].mean() > 0.5

    def solve_dock(ax, ay, named):
        """Find a dry land anchor and a pier direction that ends inside the NAMED water body.
        Searches outward from the GOLD marker; returns None when the shore really does not
        offer a usable pair (the dock is then rejected, never silently defaulted)."""
        best = None
        for r in range(0, 21):
            for k in range(24 if r else 1):
                a = k * math.pi / 12
                x, y = ax + math.cos(a) * r, ay + math.sin(a) * r
                if not (0 <= int(y) < UH and 0 <= int(x) < UW) or not dry_cell(x, y):
                    continue
                dirn = None
                for j in range(24):
                    b = j * math.pi / 12
                    for d in range(1, 13):
                        xi, yi = int(x + math.cos(b) * d), int(y + math.sin(b) * d)
                        if 0 <= xi < UW and 0 <= yi < UH and named[yi, xi]:
                            if dirn is None or d < dirn[1]:
                                dirn = (b, d)
                            break
                if dirn is None:
                    continue
                b, d = dirn
                length = float(max(6.0, d + 3.0))
                tip, ok_tip = None, False
                for back in range(0, int(length) + 4):
                    tx = x + math.cos(b) * (length - back)
                    ty = y + math.sin(b) * (length - back)
                    if 0 <= int(ty) < UH and 0 <= int(tx) < UW and named[int(ty), int(tx)]:
                        tip, ok_tip = (tx, ty), True
                        break
                if not ok_tip:
                    continue
                score = r + 0.1 * d
                if best is None or score < best[0]:
                    best = (score, x, y, b, length, tip, d, r)
            if best is not None:
                break
        return best

    for dk in proj["docks"]:
        ax, ay = float(dk["at"][0]), float(dk["at"][1])
        kind = dk.get("kind")
        wref = dk.get("water") or "sea"
        named_water = body_mask("sea", wref) if wref == "sea" else body_mask("body", wref)
        rec = {"source_id": dk["id"], "name": dk.get("name"), "kind": kind,
               "gold_at": [ax, ay], "gold_world_px": [ax * U, ay * U]}
        sol = solve_dock(ax, ay, named_water)
        if sol is None:
            rec.update({"land_anchor_px": [ax * U, ay * U], "water_anchor_px": None,
                        "anchor_valid": False, "implementation_status": "FAILED",
                        "rejection": f"no dry land anchor within 21 units whose pier reaches "
                                     f"the named body '{wref}'"})
            docks.append(rec)
            continue
        _score, x, y, ang, length, tip, d, r = sol
        cx = x + math.cos(ang) * length / 2
        cy = y + math.sin(ang) * length / 2
        rect_rot(piers, cx, cy, ang, length / 2 + 0.8, 2.0, 1)
        rec.update({"land_anchor_px": [x * U, y * U], "water_anchor_px": [tip[0] * U, tip[1] * U],
                    "anchor_valid": True, "distance_to_named_water_units": d,
                    "snap_from_gold_units": round(r, 2),
                    "bearing_rad": round(ang, 4), "length_units": round(length, 2),
                    "implementation_status": "GEOMETRY_ONLY",
                    "boat_logic": "UNIMPLEMENTED"})
        docks.append(rec)

    print("docks valid %d / %d" % (sum(1 for d in docks if d["anchor_valid"]), len(docks)))

    # ---------------- elder + zone regions (for ground families) ----------------
    elev = np.frombuffer(base64.b64decode(proj["terrain"]["elev"]), np.uint8).reshape(175, 250).astype(np.float32)
    biome = np.frombuffer(base64.b64decode(proj["terrain"]["biome"]), np.uint8).reshape(175, 250)

    def ring_mask(ring):
        m = np.zeros((UH, UW), np.uint8)
        fill_polygon(m, ring, 1)
        return m > 0

    elder_regions = {}
    for e in proj["elders"]:
        ring = e.get("outer") or []
        if ring:
            elder_regions[e["elder"]] = {"ring": ring, "mask": ring_mask(ring),
                                         "source_id": e["id"], "name": e.get("name")}
    ash_region = np.zeros((UH, UW), bool)
    dry_region = np.zeros((UH, UW), bool)
    for name, key in (("surtur", ash_region), ("anubis", dry_region)):
        if name in elder_regions:
            key |= elder_regions[name]["mask"]
    # volcanic ash also follows the GOLD zone soil vocabulary (xỉ / tro)
    ash_zone = np.zeros((UH, UW), bool)
    dry_zone = np.zeros((UH, UW), bool)
    for z in proj["zones"]:
        soil = (z.get("soil") or "").lower()
        tags = set(z.get("tags") or [])
        m = ring_mask(z["ring"])
        if "xỉ" in soil or "tro" in soil:
            ash_zone |= m
        if "cát cứng" in soil or "khô" in soil or "hoang" in tags:
            dry_zone |= m
    ash_region |= ash_zone
    dry_region |= dry_zone
    print("ash region %.1f%%  dry region %.1f%%" % (100 * ash_region.mean(), 100 * dry_region.mean()))

    kit = KIT.load_kit()
    fams["sand"] = [kit.sand_tile(v) for v in range(3)]
    fams["beach"] = [kit.sand_tile(v) for v in range(3)]
    fams["gravel"] = [im.convert("RGBA") for im in kit.soil_tiles(4)]   # riverbanks are earth, not paving
    # rock ground comes from the rock modules themselves; the flat cainos platform plates and
    # any wall-sheet fragment are removed from every ground pool (they are structure art).
    fams_raw_stone = list(fams["stone"])[:2]
    _gt = kit.geology_tiles()
    fams["stone"] = [im.convert("RGBA") for im in _gt["grey"]]
    fams["rubble"] = [im.convert("RGBA") for im in _gt["grey"][2:]] +                      [im.convert("RGBA") for im in _gt["brown"][:2]]
    fams["sand"] = [kit.sand_tile(v) for v in range(3)]
    fams["beach"] = fams["sand"]

    # ---------------- ground grid ----------------
    canvas = Image.new("RGBA", (PW, PH))
    _mt = [im.convert("RGBA") for im in fams["meadow"]]
    for ty in range(PH // ART_TILE + 1):
        for tx in range(PW // ART_TILE + 1):
            canvas.paste(_mt[(tx * 5 + ty * 9) % len(_mt)], (tx * ART_TILE, ty * ART_TILE))
    land_elev = elev[elev > 0] if (elev > 0).any() else elev
    q_stone, q_rock = np.percentile(land_elev, [78, 93]) if land_elev.size else (95, 150)

    def wet_frac(gx, gy):
        y0, x0 = gy * 8, gx * 8
        return water[y0:y0 + 8, x0:x0 + 8].mean()

    ground = np.empty((GH, GW), dtype=object)
    for gy in range(GH):
        for gx in range(GW):
            if wet_frac(gx, gy) > 0.5:
                ground[gy, gx] = "water"
                continue
            uy, ux = min(UH - 1, gy * 8 + 4), min(UW - 1, gx * 8 + 4)
            e = elev[gy, gx] + (h32("g", gx, gy) % 1000) / 1000.0 * 14 - 7
            if ash_region[uy, ux]:
                ground[gy, gx] = "ash" if e < q_stone * 0.6 else "stone"
            elif dry_region[uy, ux]:
                ground[gy, gx] = "stone" if e >= q_stone * 0.92 else "sand"
            elif e >= q_rock:
                ground[gy, gx] = "stone"
            elif e >= q_stone:
                ground[gy, gx] = "rubble" if (h32("r", gx, gy) % 5 == 0) else "stone"
            else:
                box = np.s_[max(0, uy - 20):uy + 20, max(0, ux - 20):ux + 20]
                near_coast = (sea | lakes)[box].mean() > 0.04
                near_river = (rivers & land)[box].mean() > 0.04
                ground[gy, gx] = "beach" if near_coast else "meadow"

    cliff_cells = np.zeros((GH, GW), bool)
    for gy in range(GH):
        for gx in range(GW):
            if ground[gy, gx] == "water":
                continue
            nb = elev[max(0, gy - 1):gy + 2, max(0, gx - 1):gx + 2]
            if elev[gy, gx] - nb.min() >= 45:
                cliff_cells[gy, gx] = True

    # --- biome transitions: a cell that touches a different family takes its material from a
    # blended pool, so meadow/stone/sand/ash meet through a dithered seam instead of a hard line.
    def _pool_for(fam):
        return fams.get(fam) or fams["meadow"]

    edge_cells = 0
    for gy in range(GH):
        for gx in range(GW):
            fam = ground[gy, gx]
            if fam == "water":
                continue
            neigh = set()
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ry, rx = gy + dy, gx + dx
                if 0 <= ry < GH and 0 <= rx < GW:
                    neigh.add(ground[ry, rx])
            neigh.discard("water")
            pool = _pool_for(fam)
            if len(neigh) > 1:
                edge_cells += 1
                other = sorted(n for n in neigh if n != fam)
                blend = _pool_for(other[0])
                # 2x2 ordered dither: the seam is a woven band, never a straight cut
                blend_here = ((gx % 2) * 2 + (gy % 2)) < (1 + (h32("e", gx, gy) % 2))
                pool = blend + pool if blend_here else pool + blend
            canvas.paste(pool[h32("t", gx, gy) % len(pool)], (gx * ART_TILE, gy * ART_TILE))
    print("biome edge cells dithered", edge_cells)
    print("ground:", {k: int(sum(1 for g in ground.flat if g == k))
                      for k in ("meadow", "stone", "rubble", "sand", "ash", "water")})

    # ---------------- geology: layered rock, not wall tiles ----------------
    # A cliff cell gets a real outcrop sprite whose base sits on the cell and whose lit top face
    # rises above it; the cell behind stays walkable stone.  Rubble collects at the foot of every
    # face, and a cave mouth appears where a high slope meets a dead-end corner.
    geo = Image.new("RGBA", (PW, PH))
    rock_grey = KIT.load_kit().geology("rock_grey")
    rock_brown = KIT.load_kit().geology("rock_brown")
    cave_grey = KIT.load_kit().geology("cave_grey")
    cave_brown = KIT.load_kit().geology("cave_brown")
    rock_out = []
    for gy in range(GH):
        for gx in range(GW):
            stone_here = ground[gy, gx] in ("stone", "rubble")
            if ground[gy, gx] == "water":
                continue
            if not cliff_cells[gy, gx] and not (stone_here and h32("msf", gx, gy) % 19 == 0):
                continue
            hh = h32("geo", gx, gy)
            brown = bool(ash_region[min(UH - 1, gy * 8 + 4), min(UW - 1, gx * 8 + 4)]) or (hh % 7 == 0)
            base_y = gy * ART_TILE + ART_TILE
            if hh % 23 == 5:                      # occasional cave mouth instead of a face
                img = cave_brown if brown else cave_grey
                geo.alpha_composite(img, (gx * ART_TILE, base_y - img.height))
                rock_out.append({"type": "cave", "at": [gx * ART_TILE, base_y - img.height]})
            else:
                img = rock_brown if brown else rock_grey
                geo.alpha_composite(img, (gx * ART_TILE, base_y - img.height))
                rock_out.append({"type": "outcrop", "at": [gx * ART_TILE, base_y - img.height]})
            # rubble apron in front of the face
            for k in range(2):
                ry = base_y + k * 6
                if ry < PH:
                    geo.alpha_composite(fams["rubble"][(gx + k) % len(fams["rubble"])].crop((0, 0, 32, 8)),
                                        (gx * ART_TILE, ry))
    print("geology outcrops", len(rock_out))

    # ---------------- sub-tile overlays ----------------
    out = np.array(canvas)
    water_px = up(water)
    shore_outer = water_px & ~erode(water_px, 4)
    shelf = water_px & ~erode(water_px, 14)
    # ---------------- width-aware water (pixel-resolution geometry) ----------------
    all_land = []
    for L in proj["land"]:
        all_land += [r for r in (L.get("rings") or [L.get("ring")]) if r]
    land_px = fill_poly_px(all_land)
    sea_px = ~land_px
    lake_rings = []
    for lk in proj["lakes"]:
        lake_rings += [r for r in (lk.get("rings") or [lk.get("ring")]) if r]
    lakes_px = fill_poly_px(lake_rings)
    river_px_mask = np.zeros((PH, PW), np.uint8)
    for r in proj["rivers"]:
        stroke_px(river_px_mask, [(q[0] * U, q[1] * U) for q in r["points"]],
                  max(1.0, (r.get("width") or 3) / 2.0 * U))
    river_px = river_px_mask.astype(bool) & land_px
    water_px = sea_px | lakes_px | river_px
    # ---- mouth closure: a river end that stops short of the water it names is extended along its
    # own last bearing until it meets that water (<= 8 GOLD units), so no distributary dangles in
    # the sand.  Every extension is recorded; no new connection is invented.
    river_extensions = []
    for r in proj["rivers"]:
        pts = r["points"]
        for which, end_i, ref_i in (("source", 0, 1), ("mouth", -1, -2)):
            ex_, ey_ = float(pts[end_i][0]), float(pts[end_i][1])
            xi_, yi_ = int(ex_ * U), int(ey_ * U)
            _big = sea_px | lakes_px
            if 0 <= xi_ < PW and 0 <= yi_ < PH and _big[yi_, xi_]:
                continue
            ox, oy = float(pts[ref_i][0]), float(pts[ref_i][1])
            dx, dy = ex_ - ox, ey_ - oy
            L = math.hypot(dx, dy) or 1.0
            ux_, uy_ = dx / L, dy / L
            for k in range(1, 17):
                nx, ny = ex_ + ux_ * 0.5 * k, ey_ + uy_ * 0.5 * k
                xn, yn = int(nx * U), int(ny * U)
                if not (0 <= xn < PW and 0 <= yn < PH):
                    break
                if _big[yn, xn]:
                    if which == "source":
                        pts.insert(0, [nx, ny])
                    else:
                        pts.append([nx, ny])
                    river_extensions.append({"river": r["id"], "end": which,
                                             "from": [round(ex_, 2), round(ey_, 2)],
                                             "to": [round(nx, 2), round(ny, 2)],
                                             "length_units": round(0.5 * k, 2),
                                             "reason": "authored end stopped short of the named "
                                                       "water; closed along its own bearing"})
                    break
    if river_extensions:
        river_px_mask = np.zeros((PH, PW), np.uint8)
        for r in proj["rivers"]:
            stroke_px(river_px_mask, [(q[0] * U, q[1] * U) for q in r["points"]],
                      max(1.0, (r.get("width") or 3) / 2.0 * U))
        river_px = river_px_mask.astype(bool) & land_px
        water_px = sea_px | lakes_px | river_px
    print("river mouth closures", len(river_extensions))
    # depth measured in GOLD units from the bank (4 erosions cover every authored channel)
    depth_px = np.zeros((PH, PW), np.uint8)
    m = water_px.copy()
    for level in range(1, 9):
        m = erode(m, 1)
        depth_px[m] = level * 4
    is_river = river_px
    is_big = water_px & ~is_river          # sea + lakes
    _big16 = is_big.copy()
    for _ in range(16):
        _big16 = _big16 | np.roll(_big16, 1, 0) | np.roll(_big16, -1, 0) | \
                 np.roll(_big16, 1, 1) | np.roll(_big16, -1, 1)
    is_big_shore = _big16 & ~water_px
    is_river_shore = water_px & is_river          # bank band used for river sediment
    def C(r, g, b):
        return np.array([r, g, b, 255], np.uint8)
    c_deep, c_mid, c_shal = C(22, 64, 104), C(30, 86, 126), C(46, 112, 152)
    c_bank = C(74, 104, 112)               # wet gravel, rivers only
    out[water_px] = c_deep
    out[water_px & (depth_px >= 2)] = c_mid
    out[water_px & (depth_px >= 3)] = c_mid
    out[water_px & (depth_px <= 1)] = c_shal
    # rivers: a one-unit wet bank line, no foam, no crests - the channel stays readable
    river_ring = is_river & (depth_px <= 1)
    out[river_ring] = c_bank
    # open water: foam only where the coast is genuinely wide
    coast_ring = is_big & (depth_px <= 1)
    out[coast_ring] = C(214, 236, 242)
    wide = is_big & (depth_px >= 3)
    yy = np.arange(PH)[:, None]
    xx = np.arange(PW)[None, :]
    crest = wide & (((xx * 7 + yy * 13) % 61) < 3)
    out[crest] = C(122, 178, 202)
    world_water = Image.fromarray(out, "RGBA")
    bank_shadow = water_px & ~erode(water_px, 3)
    out[bank_shadow & is_river] = C(58, 92, 104)

    # beach: a pixel-resolution sand margin on sea and lake shores only.  The old 16 px shore
    # tiles stepped across the coastline in visible slabs, so the band is now built from the
    # distance to the water surface: 5 px of dry sand and a 2 px wet line, with sparse speckles.
    out = np.array(world_water)
    sand_dry = np.array([224, 208, 162, 255], np.uint8)
    sand_wet = np.array([196, 176, 132, 255], np.uint8)
    sand_deep = np.array([176, 158, 118, 255], np.uint8)
    band = erode(~water_px, 5) & ~erode(~water_px, 11)
    band &= is_big_shore
    wetline = erode(~water_px, 2) & ~erode(~water_px, 5) & is_big_shore
    deepband = erode(~water_px, 11) & ~erode(~water_px, 15) & is_big_shore
    out[band] = sand_dry
    out[wetline] = sand_wet
    out[deepband] = sand_deep
    speck_y = np.arange(PH)[:, None]
    speck_x = np.arange(PW)[None, :]
    speck = band & (((speck_x * 5 + speck_y * 11) % 37) < 2)
    out[speck] = C(210, 192, 146)
    print("beach band px", int(band.sum()), "wet line px", int(wetline.sum()))

    # ---------------- continuous road material (per class) ----------------
    # Roads are painted as one uninterrupted strip per material class:
    #   earth  = freight (cart) and footpaths, from the committed fields soil tiles
    #   stone  = maintained trails and riverside routes, from the cainos paving tiles
    # Nothing is eroded or dithered away: the corridor never becomes intermittent.
    raw_roads = roads.copy()
    roads[water > 0] = 0
    earth = np.zeros((UH, UW), np.uint8)
    stone_r = np.zeros((UH, UW), np.uint8)
    for rd in proj["roads"]:
        k = rd.get("kind", "trail")
        if k == "ferry":
            continue
        tgt = earth if k in ("cart", "foot") else stone_r
        stroke_polyline(tgt, rd["points"], ROAD_HALF.get(k, 1.8), 1)
    earth[water > 0] = 0
    stone_r[water > 0] = 0

    def tile_sheet(tiles):
        tex = Image.new("RGBA", (PW, PH))
        for ty in range(PH // 32 + 1):
            for tx in range(PW // 32 + 1):
                tex.paste(tiles[(tx * 7 + ty * 13) % len(tiles)], (tx * 32, ty * 32))
        return np.array(tex)

    if os.environ.get("VEYRA_RENDER_PASSES", "1") == "1":
        Image.fromarray(out, "RGBA").save(os.path.join(out_dir, "render_pass_pre_roads.png"),
                                          compress_level=1)
    soil = KIT.load_kit().soil_tiles(4)
    pav = [im.convert("RGBA").resize((32, 32), Image.NEAREST) for im in fams.get("path", fams["stone"])]
    for mask, tiles in ((earth, soil), (stone_r, pav)):
        if not mask.any():
            continue
        base = tile_sheet(tiles)
        core = tile_sheet(tiles[::-1])
        m = up(mask)
        mc = up(erode(mask, 1))
        verge = (base.astype(np.float32) * 0.78).astype(np.uint8)
        verge[:, :, 3] = 255
        out[m] = verge[m]
        out[mc] = core[mc]
    # ---- road hierarchy: the same corridor, four different surfaces ----
    # cart   : compacted soil, two wheel ruts, gravel shoulders
    # trail  : packed earth with grass intruding at both edges
    # foot   : narrow trodden line, vegetation closing in
    # riverside: gravel and pebbles from the bank it follows
    _rng = np.random.RandomState(20261102)
    _img = Image.fromarray(out, "RGBA")
    _dr = ImageDraw.Draw(_img)
    for rd in proj["roads"]:
        kind = rd.get("kind", "trail")
        if kind == "ferry":
            continue
        pts = [(float(q[0]) * U, float(q[1]) * U) for q in rd["points"]]
        if len(pts) < 2:
            continue
        half = NET.ROAD_WIDTH.get(kind, NET.ROAD_WIDTH["trail"])["render"] * U
        if kind == "cart":
            for off in (-half * 0.42, half * 0.42):
                _dr.line([(x, y + off) for x, y in pts], fill=(118, 96, 74, 255), width=2)
            for i in range(len(pts) - 1):
                (x0, y0), (x1, y1) = pts[i], pts[i + 1]
                L = math.hypot(x1 - x0, y1 - y0)
                steps = max(1, int(L / 6))
                for k in range(steps):
                    tt = k / steps
                    x, y = x0 + (x1 - x0) * tt, y0 + (y1 - y0) * tt
                    if h32("sh", int(x), int(y)) % 3 == 0:
                        _dr.point((x + half * (1 if h32("sx", int(x), 0) % 2 else -1), y),
                                  fill=(150, 138, 116, 255))
        elif kind in ("trail", "foot"):
            # vegetation creeps back over the outer 3 px of the corridor
            band = 3 if kind == "trail" else 5
            for i in range(len(pts) - 1):
                (x0, y0), (x1, y1) = pts[i], pts[i + 1]
                L = math.hypot(x1 - x0, y1 - y0)
                steps = max(1, int(L / 4))
                for k in range(steps):
                    tt = k / steps
                    x, y = x0 + (x1 - x0) * tt, y0 + (y1 - y0) * tt
                    if h32("veg", int(x), int(y)) % 4 == 0:
                        col = (86, 118, 62, 255) if h32("vg", int(x), int(y)) % 2 else (74, 102, 54, 255)
                        side = 1 if h32("vs", int(x), int(y)) % 2 else -1
                        _dr.line([(x, y + side * (half - band)), (x, y + side * half)], fill=col, width=1)
        else:   # riverside
            for i in range(0, len(pts) - 1):
                (x0, y0), (x1, y1) = pts[i], pts[i + 1]
                L = math.hypot(x1 - x0, y1 - y0)
                for k in range(max(1, int(L / 5))):
                    tt = k / max(1, int(L / 5))
                    x, y = x0 + (x1 - x0) * tt, y0 + (y1 - y0) * tt
                    if h32("peb", int(x), int(y)) % 3 == 0:
                        _dr.point((x + _rng.randint(-2, 3), y + _rng.randint(-2, 3)),
                                  fill=(176, 168, 146, 255))
    out = np.array(_img)
    print("road surfaces differentiated", sum(1 for r in proj["roads"] if r.get("kind") != "ferry"))

    # ---- river banks: sediment line and reeds, width-aware ----
    sed = erode(~water_px, 1) & ~erode(~water_px, 4) & is_river_shore
    out[sed] = C(126, 118, 96)
    reed_img = Image.fromarray(out, "RGBA")
    _rng2 = np.random.RandomState(77)
    for rv in proj["rivers"]:
        w = (rv.get("width") or 3) * U
        pts = [(float(q[0]) * U, float(q[1]) * U) for q in rv["points"]]
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            L = math.hypot(x1 - x0, y1 - y0)
            if L < 1:
                continue
            ux, uy = (x1 - x0) / L, (y1 - y0) / L
            steps = max(1, int(L / 18))
            for k in range(steps):
                if h32("reed", int(x0), int(y0) * 7 + k) % 3:
                    continue
                tt = k / steps
                x, y = x0 + (x1 - x0) * tt, y0 + (y1 - y0) * tt
                side = 1 if h32("rs", k, int(x)) % 2 else -1
                rx = x - uy * side * (w / 2 + 4)
                ry = y + ux * side * (w / 2 + 4)
                if 0 <= rx < PW - 8 and 0 <= ry < PH - 8 and not water_px[int(min(PH - 1, ry)), int(min(PW - 1, rx))]:
                    tuft = fams.get("tuft") or fams["bush"]
                    reed_img.alpha_composite(tuft[h32("rt", int(rx), int(ry)) % len(tuft)], (int(rx), int(ry)))
    out = np.array(reed_img)

    for br in bridges:
        for lp in (br.get("landing_a_px"), br.get("landing_b_px")):
            if lp:
                _disc(earth, lp[0] / U, lp[1] / U, ROAD_HALF.get(br["load"], 1.8) + 0.6, 1)
    earth[water > 0] = 0
    road_mask = up(earth | stone_r)
    road_core = up(erode(earth | stone_r, 1))

    # junctions: one disc of the dominant local material so joins read as a surface
    _landmarks = ([{"kind": "bridge", "id": b["id"], "at": [float(b["at"][0]), float(b["at"][1])]}
                   for b in proj["bridges"]] +
                  [{"kind": "dock", "id": d["id"], "at": [float(d["at"][0]), float(d["at"][1])]}
                   for d in proj["docks"]] +
                  [{"kind": "poi", "id": p["id"], "at": [float(p["at"][0]), float(p["at"][1])]}
                   for p in proj["pois"]])
    RG = NET.build_road_graph(proj, landmarks=_landmarks)
    _nm_classes = {}
    for _n in RG["near_miss"]:
        _nm_classes.setdefault(_n["class"], 0)
        _nm_classes[_n["class"]] += 1
    print("endpoint classes", _nm_classes)
    junction_pts = [n["at"] for n in RG["nodes"] if n["degree"] >= 3]
    junction_pts += [c["at"] for c in RG["crossings"]]
    jmask = np.zeros((UH, UW), np.uint8)
    for jx, jy in junction_pts:
        _disc(jmask, jx, jy, 3.0, 1)
    jmask[water > 0] = 0
    jm = up(jmask) & ~road_mask
    jfill = tile_sheet(soil + pav)
    out[jm] = jfill[jm]
    print("road junctions", len(junction_pts), "painted", int(jm.sum()))

    if os.environ.get("VEYRA_RENDER_PASSES", "1") == "1":
        Image.fromarray(out, "RGBA").save(os.path.join(out_dir, "render_pass_post_roads.png"),
                                          compress_level=1)
    deck_mask, rail_mask, pier_mask = up(deck), up(rail), up(piers)
    world = Image.fromarray(out, "RGBA")
    world.alpha_composite(geo)
    # ---- real bridge / pier sprites (committed 668008-bridges pack) ----
    for br in bridges:
        kind = "arch" if (br["load"] == "cart" and br["span_units"] > 16) else (
            "stone" if br["load"] == "cart" else ("wood" if br["span_units"] <= 12 else "rope"))
        span_px = int(round(br["span_units"] * U * 1.02))
        wid_px = int(round(br["deck_width_units"] * U * 1.25))
        strip = kit.bridge_strip(kind, span_px, max(14, wid_px))
        deg = -math.degrees(br["bearing_rad"])
        rot = strip.rotate(deg, expand=True, resample=Image.NEAREST)
        cx, cy = br["deck_px"]          # deck centre = midpoint of a/b, not the GOLD marker
        world.alpha_composite(rot, (int(cx - rot.width / 2), int(cy - rot.height / 2)))
        br["render"] = {"module": kind, "deck_px": [rot.width, rot.height], "rotation_deg": round(deg, 1)}
    for dk in [d for d in docks if d.get("anchor_valid") and d.get("water_anchor_px")]:
        ang = math.atan2(dk["water_anchor_px"][1] - dk["land_anchor_px"][1],
                         dk["water_anchor_px"][0] - dk["land_anchor_px"][0])
        length = math.hypot(dk["water_anchor_px"][0] - dk["land_anchor_px"][0],
                            dk["water_anchor_px"][1] - dk["land_anchor_px"][1]) * 1.05
        strip = kit.pier_strip(int(length), max(12, int(dk.get("pier_width_px", 18))))
        rot = strip.rotate(-math.degrees(ang), expand=True, resample=Image.NEAREST)
        world.alpha_composite(rot, (int(dk["land_anchor_px"][0] + math.cos(ang) * length / 2 - rot.width / 2),
                                    int(dk["land_anchor_px"][1] + math.sin(ang) * length / 2 - rot.height / 2)))
        dk["render"] = {"module": "plank_wide", "rotation_deg": round(-math.degrees(ang), 1)}

    # ---------------- objects ----------------
    placements = []
    ALIAS = {"wall": "struct_wall", "arch": "struct_arch", "stairs": "struct_stairs",
             "crate": "props_crate", "barrel": "props_barrel", "sign": "props_sign",
             "grave": "props_grave", "statue": "props_statue", "well": "props_well",
             "rock": "props_rock", "boulder": "props_boulder", "door": "crypt_door"}

    DOCK_KEEPOUT = [(d["land_anchor_px"][0], d["land_anchor_px"][1]) for d in docks
                    if d.get("anchor_valid")]
    deck_keepout = down(deck_mask, COLL, 0.10)
    # route corridors: trunks may not stand on a road or in the water margin, but canopies above
    # them are allowed because only the trunk point is tested here.
    road_corridor = grow((roads > 0).astype(np.uint8), 3)
    bank_corridor = np.maximum(grow(water, 1), down(water_px, U, 0.10))

    def place(fam, wx, wy, key, collider=True, tag=None, span_cells=2):
        ux, uy = int(wx // U), int(wy // U)
        if not (0 <= ux < UW and 0 <= uy < UH):
            return None
        # a sprite has extent: test its whole footprint, not just the anchor cell, so a
        # multi-tile building can never be dropped across a road, a channel or a bridge deck
        for oy in range(uy - span_cells, uy + span_cells + 1):
            for ox in range(ux - span_cells, ux + span_cells + 1):
                if not (0 <= ox < UW and 0 <= oy < UH):
                    continue
                if road_corridor[oy, ox] or bank_corridor[oy, ox]:
                    return None                  # protects the authored route corridor
        dcx, dcy = int(wx // COLL), int(wy // COLL)
        for cy_ in range(dcy - span_cells, dcy + span_cells + 1):
            for cx_ in range(dcx - span_cells, dcx + span_cells + 1):
                if 0 <= cx_ < CW and 0 <= cy_ < CH and deck_keepout[cy_, cx_]:
                    return None                  # never stack props on a bridge deck
        if True:
            for dx, dy in DOCK_KEEPOUT:
                if abs(wx - dx) < 24 and abs(wy - dy) < 24:
                    return None
        fam = ALIAS.get(fam, fam)
        pool = fams.get(fam)
        if not pool:
            return None
        img = pool[h32(key, fam) % len(pool)]
        rec = {"fam": fam, "x": int(round(wx)), "y": int(round(wy)), "img": img,
               "collider": collider, "tag": tag}
        placements.append(rec)
        return rec

    # cliffs: rocky outcrops on the cliff cells (the wall sheet's blocks contain black
    # interiors that read as holes at 1:1, so they are not used as ground sprites)
    for gy in range(GH):
        for gx in range(GW):
            if cliff_cells[gy, gx] and h32("cl", gx, gy) % 3 == 0:
                place("props_boulder", gx * ART_TILE + 16, gy * ART_TILE + 30,
                      f"cl{gx},{gy}", True)

    # vegetation / scree
    for gy in range(GH):
        for gx in range(GW):
            fam = ground[gy, gx]
            if fam == "water":
                continue
            b = int(biome[gy, gx])
            h = h32("veg", gx, gy)
            r = (h % 10000) / 10000.0
            wx, wy = gx * ART_TILE + 16, gy * ART_TILE + 30
            if fam == "ash":
                if r < 0.03:
                    place("rock", wx, wy, f"ar{gx},{gy}", True)
                elif r < 0.05:
                    place("brazier", wx, wy, f"ab{gx},{gy}", False)
                continue
            if fam == "sand":
                if r < 0.015:
                    place("props_rock", wx, wy, f"dr{gx},{gy}", True)
                elif r < 0.03:
                    place("niche", wx, wy, f"dn{gx},{gy}", True)
                continue
            if fam in ("stone", "rubble"):
                if r < 0.02:
                    place("props_boulder", wx, wy, f"sr{gx},{gy}", True)
                elif r < 0.03:
                    place("props_rock", wx, wy, f"ss{gx},{gy}", False)
                continue
            forest = b in (1, 6) or r < 0.05
            if forest and r < 0.075:
                place("tree", wx, wy, f"tr{gx},{gy}", True)
            elif r < 0.10:
                place("bush", wx, wy, f"bu{gx},{gy}", False)
            elif r < 0.14:
                place("tuft", wx, wy, f"tu{gx},{gy}", False)

    # POI sites — archetype vocabulary drawn from the chapter-1 environment sheets
    SITE = {
        "village":     ["struct_wall", "struct_wall", "crypt_door", "well", "banner", "crate",
                        "barrel", "bush"],
        "hamlet":      ["struct_wall", "crypt_door", "well", "barrel", "sign", "bush"],
        "port":        ["crate", "crate", "barrel", "sign", "banner", "props_ruin"],
        "pier":        ["crate", "barrel", "sign", "brazier"],
        "roadstop":    ["sign", "barrel", "crate", "brazier"],
        "quarry":      ["props_boulder", "props_boulder", "stairs", "crate", "props_rock"],
        "mine":        ["props_boulder", "crypt_door", "crate", "stairs", "props_rock"],
        "smelter":     ["forge", "forge", "brazier", "props_workbench", "crate"],
        "filter":      ["forge", "brazier", "props_workbench", "crate"],
        "powerplant":  ["pylon", "forge", "brazier", "struct_wall"],
        "relay":       ["pylon", "pylon", "brazier", "struct_wall"],
        "ruins":       ["props_ruin", "struct_wall", "struct_arch", "props_rock"],
        "elder_site":  ["niche", "sarcophagus", "statue", "struct_arch", "brazier"],
        "observatory": ["pylon", "shelf", "pillar", "struct_arch"],
        "research":    ["shelf", "shelf", "pillar", "props_pedestal", "struct_wall"],
        "facility":    ["struct_wall", "struct_wall", "crypt_door", "banner", "crate"],
        "warehouse":   ["crate", "crate", "crate", "barrel", "struct_wall"],
        "mill":        ["crate", "barrel", "struct_wall", "sign"],
        "sawmill":     ["crate", "crate", "barrel", "props_workbench"],
        "grove":       ["tree", "tree", "bush", "bush", "tuft"],
        "gate":        ["struct_arch", "struct_wall", "struct_wall", "brazier"],
        "tomb":        ["niche", "sarcophagus", "grave", "crypt_door", "brazier"],
        "necropolis":  ["niche", "niche", "sarcophagus", "grave", "statue", "struct_wall"],
        "evac":        ["crate", "sign", "brazier", "struct_wall"],
        "ragnarok_cache": ["crate", "crate", "brazier", "props_ruin"],
        "chest_vendor": ["crate", "barrel", "sign", "banner"],
    }
    DEFAULT_SITE = ["sign", "props_rock", "bush"]

    poi_out = []
    for p in proj["pois"]:
        ax, ay = float(p["at"][0]), float(p["at"][1])
        foot = p.get("foot") or []
        arche = p.get("arche", "site")
        setlist = SITE.get(arche, DEFAULT_SITE)
        n = len(setlist)
        for i, fam in enumerate(setlist):
            if foot:
                fx, fy = foot[int(i * len(foot) / max(1, n)) % len(foot)]
                px, py = ax + (fx - ax) * 0.66, ay + (fy - ay) * 0.66
            else:
                a = 2 * math.pi * i / max(1, n)
                px, py = ax + math.cos(a) * 4, ay + math.sin(a) * 4
            place(fam, px * U, py * U, f"{p['id']}:{i}", fam not in ("bush", "tuft", "brazier"),
                  tag=p["id"])
        poi_out.append({"source_id": p["id"], "name": p.get("name"), "arche": arche,
                        "gold_at": [ax, ay], "world_px": [ax * U, ay * U],
                        "foot_polygon": foot, "access": p.get("access"),
                        "role": p.get("role"), "elder": p.get("elder"),
                        "site_set": setlist,
                        "site_class": "necropolis" if arche in ("tomb", "necropolis", "elder_site")
                        else "industrial" if arche in ("smelter", "filter", "powerplant", "relay",
                                                       "quarry", "mine")
                        else "inhabited" if arche in ("village", "hamlet", "facility", "port",
                                                      "warehouse", "mill", "sawmill")
                        else "landmark"})

    # three reference areas get an explicit detail pass (no new geography)
    def nearest_poi(pred):
        best = None
        for p in poi_out:
            if pred(p):
                d = 0
                if best is None or True:
                    best = p
                    break
        return best

    village_poi = next((p for p in poi_out if p["arche"] == "village"), None)
    port_poi = next((p for p in poi_out if p["arche"] == "port"), None)
    quarry_poi = next((p for p in poi_out if p["arche"] == "quarry"), None)
    ref_areas = []
    if village_poi:
        ax, ay = village_poi["gold_at"]
        for i, fam in enumerate(["struct_wall", "struct_wall", "crypt_door", "banner", "well",
                                 "crate", "barrel", "brazier", "struct_wall", "bush", "bush",
                                 "sign"]):
            a = 2 * math.pi * i / 12
            place(fam, (ax + math.cos(a) * 7.5) * U, (ay + math.sin(a) * 7.5) * U,
                  f"ref:village:{i}", fam not in ("bush", "brazier"), tag=village_poi["source_id"])
        ref_areas.append({"kind": "river_village", "poi": village_poi["source_id"],
                          "world_px": village_poi["world_px"]})
    if quarry_poi:
        ax, ay = quarry_poi["gold_at"]
        for i, fam in enumerate(["props_boulder", "props_boulder", "stairs", "crate",
                                 "props_workbench", "props_rock", "props_rock", "brazier"]):
            a = 2 * math.pi * i / 8
            place(fam, (ax + math.cos(a) * 8) * U, (ay + math.sin(a) * 8) * U,
                  f"ref:quarry:{i}", True, tag=quarry_poi["source_id"])
        ref_areas.append({"kind": "bridge_quarry_corridor", "poi": quarry_poi["source_id"],
                          "world_px": quarry_poi["world_px"]})
    if port_poi:
        ax, ay = port_poi["gold_at"]
        for i, fam in enumerate(["crate", "crate", "barrel", "barrel", "sign", "brazier",
                                 "struct_wall", "banner"]):
            a = 2 * math.pi * i / 8
            place(fam, (ax + math.cos(a) * 8) * U, (ay + math.sin(a) * 8) * U,
                  f"ref:port:{i}", True, tag=port_poi["source_id"])
        ref_areas.append({"kind": "maritime_landing", "poi": port_poi["source_id"],
                          "world_px": port_poi["world_px"]})

    # ---- composed sites: inhabited settlement, necropolis field, volcanic field ----
    def ground_family_at(wx, wy):
        gx, gy = int(wx // ART_TILE), int(wy // ART_TILE)
        if 0 <= gx < GW and 0 <= gy < GH:
            return ground[gy, gx]
        return None

    def smoke(wx, wy, h=26):
        """Chimney smoke: a soft dithered plume drawn as an effect, never as stand-in art."""
        for i in range(3):
            r = 5 + i * 4
            cx, cy = wx + i * 2, wy - h - i * 7
            col = (206, 206, 206, 60 - i * 14)
            ImageDraw.Draw(world).ellipse([cx - r, cy - r * 0.7, cx + r, cy + r * 0.7], fill=col)

    def compose_settlement(poi, name):
        """Greywater: three stone houses around a lane, fenced yards, market cluster, gate.
        Built from committed sprites only - no invented roofs."""
        ax, ay = poi["gold_at"]
        placed_n = 0
        houses = [(0, -9), (11, -2), (-10, 4)]
        for hx, hy in houses:
            bx, by = (ax + hx) * U, (ay + hy) * U
            for i in range(5):                      # back wall run
                if place("struct_wall", bx + (i - 2) * 16, by - 16, f"house:{name}:{hx}:{hy}:w{i}"):
                    placed_n += 1
            for side in (-1, 1):                     # two side walls
                for j in range(3):
                    place("struct_wall", bx + side * 34, by - 16 + j * 16,
                          f"house:{name}:{hx}:{hy}:s{side}{j}")
            place("crypt_door", bx, by, f"house:{name}:{hx}:{hy}:door", True)
            place("banner", bx + 26, by - 24, f"house:{name}:{hx}:{hy}:banner")
            smoke(bx, by - 20)
        for i in range(8):                          # fenced yards behind the lane
            a = 2 * math.pi * i / 8
            place("props_crate" if i % 3 else "props_barrel",
                  (ax + math.cos(a) * 16) * U, (ay + math.sin(a) * 16) * U,
                  f"market:{name}:{i}", True)
        place("props_well", (ax - 4) * U, (ay + 12) * U, f"well:{name}", True)
        for i in range(5):                          # entrance gate posts + sign
            place("struct_wall", (ax - 22) * U, (ay - 2 + i * 2) * U, f"gate:{name}:{i}", True)
        place("props_sign", (ax - 20) * U, (ay + 6) * U, f"sign:{name}", True)
        return placed_n

    def compose_necropolis(elder):
        """Anubis: tomb rows on a canonical grid, obelisks and a processional causeway."""
        if not elder.get("world_centre_px"):
            return 0
        cx = elder["world_centre_px"][0] / U
        cy = elder["world_centre_px"][1] / U
        n = 0
        for row in range(-3, 4):
            for col in range(-3, 4):
                if abs(row) < 1 and abs(col) < 1:
                    continue
                gx, gy = cx + col * 6, cy + row * 5      # elder ring coords are world units
                if not (2 < gx < UW - 2 and 2 < gy < UH - 2):
                    continue
                if water[int(gy), int(gx)]:
                    continue          # tombs never stand in water
                fam = ("pylon" if (row + col) % 5 == 0 else "struct_wall")
                n += 1 if place(fam, gx * U, gy * U, f"tomb:{elder['source_id']}:{row}:{col}",
                                True, tag=elder["source_id"]) else 0
        for i in (-1, 1):                      # two obelisks flanking the axis
            place("pylon", (cx + i * 9) * U, (cy + 14) * U, f"obelisk:{elder['source_id']}:{i}", True)
        return n

    def compose_volcanic(elder):
        """Surtur: basalt columns, fractured ground vents and cinder cones."""
        ring = elder.get("ring") or []
        if not ring:
            return 0
        cx = sum(q[0] for q in ring) / len(ring)
        cy = sum(q[1] for q in ring) / len(ring)
        n = 0
        for i in range(26):
            a = (i * 2.399) % (2 * math.pi)
            r = 6 + (i % 7) * 3.2
            gx, gy = cx + math.cos(a) * r, cy + math.sin(a) * r
            fam = ("forge" if i % 9 == 0 else "props_rock" if i % 3 == 0 else "props_boulder")
            n += 1 if place(fam, gx * U, gy * U, f"volc:{elder['source_id']}:{i}", True,
                            tag=elder["source_id"]) else 0
        for i in range(6):                     # lava vents along a fracture
            place("brazier", (cx - 18 + i * 7) * U, (cy + 20 + (i % 2) * 3) * U,
                  f"vent:{elder['source_id']}:{i}", True, tag=elder["source_id"])
        return n

    # resources
    RES_FAM = {"wood": "tree", "stone": "props_boulder", "ore": "props_boulder",
               "obsidian": "props_rock", "sulfur": "props_rock", "clay": "props_rock",
               "salt": "props_rock", "herbs": "bush", "food": "bush"}
    res_out = []
    for r in proj["resources"]:
        ax, ay = float(r["at"][0]), float(r["at"][1])
        fam = RES_FAM.get(r.get("kind"))
        placed = place(fam, ax * U, ay * U, f"res:{r['id']}", True, tag=r["id"]) if fam else None
        res_out.append({"source_id": r["id"], "name": r.get("name"), "kind": r.get("kind"),
                        "gold_at": [ax, ay], "world_px": [ax * U, ay * U],
                        "radius_units": r.get("r"), "density": r.get("dens"),
                        "gate": r.get("gate"), "render_family": fam,
                        "interaction": "ANCHOR_ONLY" if placed else "FUNCTIONAL_BLOCKED"})

    # elders
    ELDER_SET = {
        "aion":    ["tree", "tree", "tree", "bush", "bush", "tuft"],
        "typhon":  ["props_boulder", "props_boulder", "props_rock", "props_rock", "struct_wall"],
        "surtur":  ["forge", "forge", "brazier", "brazier", "props_boulder", "struct_wall"],
        "atlas":   ["struct_arch", "props_pedestal", "brazier", "banner"],
        "argus":   ["shelf", "shelf", "pillar", "pylon", "struct_arch"],
        "anubis":  ["sarcophagus", "niche", "niche", "grave", "statue", "brazier"],
    }
    elder_out = []
    for e in proj["elders"]:
        ring = e.get("outer") or []
        cx = sum(q[0] for q in ring) / len(ring) if ring else 0
        cy = sum(q[1] for q in ring) / len(ring) if ring else 0
        setlist = ELDER_SET.get(e.get("elder"), ["props_rock"])
        for i, fam in enumerate(setlist):
            a = 2 * math.pi * i / len(setlist)
            place(fam, (cx + math.cos(a) * 11) * U, (cy + math.sin(a) * 11) * U,
                  f"{e['id']}:{i}", True, tag=e["id"])
        elder_out.append({"source_id": e["id"], "name": e.get("name"), "elder": e.get("elder"),
                          "ring": ring, "world_centre_px": [cx * U, cy * U],
                          "site_set": setlist,
                          "ground_family": "ash" if e.get("elder") == "surtur"
                          else "sand" if e.get("elder") == "anubis" else "meadow"})

    for p in poi_out:
        if p["arche"] == "village":
            print("settlement parts", compose_settlement(p, "greywater"))
    for e in elder_out:
        if e.get("elder") == "anubis":
            print("tombs placed", compose_necropolis(e))
        elif e.get("elder") == "surtur":
            print("volcanic props", compose_volcanic(e))

    print("objects placed", len(placements))
    placements.sort(key=lambda r: (r["y"], r["x"]))
    for rec in placements:
        img = rec["img"]
        world.alpha_composite(img, (rec["x"] - img.width // 2, rec["y"] - img.height))
    world_rgb = world.convert("RGB")
    world_rgb.save(os.path.join(out_dir, "world.png"))
    print("world saved", world_rgb.size)

    # ---------------- collision ----------------
    solid = down(water_px, COLL, WATER_OCCLUSION)
    solid &= ~down(deck_mask, COLL, 0.10)          # any deck coverage is walkable
    solid &= ~down(pier_mask, COLL, 0.10)
    solid &= ~down(up(ford), COLL, 0.25)
    rail_cells = down(rail_mask, COLL, 0.10)       # railings are solid, deck winning above
    deck_core = down(deck_mask, COLL, 0.10)
    deck_cells = deck_core.copy()
    # the walkable centreline is guaranteed: sample the deck axis and clear those cells too
    for br in bridges:
        cxp, cyp = br["deck_px"]
        angb = br["bearing_rad"]
        hl = br["span_units"] * U / 2
        for i in range(int(hl * 2 / (COLL / 2)) + 1):
            t = -hl + i * (COLL / 2)
            cxl = int((cxp + math.cos(angb) * t) // COLL)
            cyl = int((cyp + math.sin(angb) * t) // COLL)
            if 0 <= cxl < CW and 0 <= cyl < CH:
                deck_cells[max(0, cyl - 1):cyl + 2, max(0, cxl - 1):cxl + 2] = True
    rail_cells &= ~deck_cells                  # a railing may not block its own deck
    rail_cells &= ~down(water_px, COLL, 0.10)  # over water the water is the barrier
    solid |= rail_cells
    # POI clearings are applied at the very end of the collision pass (see below) so a later
    # placement, cliff or channel closure cannot re-seal an authored site entrance.
    for gy in range(GH):
        if cliff_cells[gy].any():
            solid[gy * 2:gy * 2 + 2, :] |= np.repeat(cliff_cells[gy], 2)[:CW]
    for rec in placements:
        if not rec["collider"]:
            continue
        cx, cy = rec["x"] // COLL, (rec["y"] - 4) // COLL
        if 0 <= cx < CW and 0 <= cy < CH:
            solid[cy, cx] = True

    # ---- final dock anchor gate (reject, never silently repair) ----
    water_cells = down(water_px, COLL, 0.10)
    for d in docks:
        if not d.get("anchor_valid"):
            continue
        lax, lay = d["land_anchor_px"]
        wax, way = d["water_anchor_px"]
        lcx, lcy = int(lax // COLL), int(lay // COLL)
        wcx, wcy = int(wax // COLL), int(way // COLL)
        land_ok = (0 <= lcx < CW and 0 <= lcy < CH and not solid[lcy, lcx])
        water_ok = (0 <= wcx < CW and 0 <= wcy < CH and water_cells[wcy, wcx])
        if not (land_ok and water_ok):
            d["anchor_valid"] = False
            d["water_anchor_px"] = None
            d["implementation_status"] = "FAILED"
            d["rejection"] = ("land anchor cell is solid" if not land_ok
                              else "water anchor cell is not in the named water body")
    print("dock anchors accepted %d / %d" % (sum(1 for d in docks if d["anchor_valid"]), len(docks)))

    # channel closure: any cell with even a trace of water becomes solid unless it is an
    # authored crossing (deck, pier, ford).  Without this a 1-cell gap could be waded.
    trace = down(water_px, COLL, 0.02)
    solid |= trace & ~deck_core & ~down(pier_mask, COLL, 0.05) & ~down(up(ford), COLL, 0.10)
    # railing barrier: water immediately flanking a deck is solid, so nobody can sidestep a
    # bridge through a 1-cell wet gap.  The deck itself stays walkable.
    flank = np.zeros_like(deck_cells)
    flank[1:, :] |= deck_cells[:-1, :]
    flank[:-1, :] |= deck_cells[1:, :]
    flank[:, 1:] |= deck_cells[:, :-1]
    flank[:, :-1] |= deck_cells[:, 1:]
    solid |= flank & trace & ~deck_cells
    # authored roads are guaranteed walkable: clear their cells unless the cell is mostly water
    # collision corridor is slightly wider than the painted road: the 12 px feet box must fit
    # even where a narrow path runs diagonally across 16 px cells (standard forgiving movement).
    # clear exactly the painted corridor (>=30% of the cell carries road material), never a
    # dilated halo: a halo would punch walkable cells through the water beside a bridge mouth.
    road_clear_cells = down(up(earth | stone_r), COLL, 0.30)
    deep_water_cells = down(water_px, COLL, 0.5)
    _mid = COLL // 2                          # never clear a cell whose centre is open water
    deep_water_cells |= water_px[_mid::COLL, _mid::COLL][:CH, :CW]
    solid &= ~(road_clear_cells & ~deep_water_cells)
    solid &= ~deck_core                       # a real deck cell is always walkable
    solid &= ~(deck_cells & ~trace)           # centreline dilation only over dry ground
    # ---- functional road traversal: constrained pathfinding inside each authored corridor ----
    passable = ~solid
    extra = set()
    for y in range(CH):
        for x in np.nonzero(deck_cells[y])[0]:
            extra.add((int(x), int(y)))
    for y in range(CH):
        for x in np.nonzero(down(pier_mask, COLL, 0.10)[y])[0]:
            extra.add((int(x), int(y)))
    for p in poi_out:
        cx0, cy0 = int(p["world_px"][0] // COLL), int(p["world_px"][1] // COLL)
        for ay in range(cy0 - 2, cy0 + 3):
            for ax in range(cx0 - 2, cx0 + 3):
                extra.add((ax, ay))
    road_reach = []
    wf = down(water_px, COLL, 0.25)
    for rr in RG["roads"]:
        res = NET.corridor_reach(rr, passable, COLL, extra)
        for bx, by in res["blocked_samples"]:
            cx, cy = int(bx * U // COLL), int(by * U // COLL)
            if 0 <= cx < CW and 0 <= cy < CH:
                res.setdefault("causes_px", []).append(
                    "water" if wf[cy, cx] else ("prop_or_cliff" if solid[cy, cx] else "open"))
        road_reach.append({"source_id": rr["id"], "kind": rr["kind"], **res})
    print("functional roads reachable %d / %d" %
          (sum(1 for r in road_reach if r["reachable"]), len(road_reach)))
    for r in road_reach:
        if not r["reachable"]:
            print("  unreachable", r["source_id"], r["kind"], r["blocked_count"],
                  r.get("causes_px", [])[:3], r["blocked_samples"][:2])
    # ---- final POI clearings: an authored site must keep a 2-cell maintained clearing ----
    water_major = down(water_px, COLL, 0.5)
    cleared = 0
    for p in poi_out:
        px, py = p["world_px"]
        cx0, cy0 = int(px // COLL), int(py // COLL)
        for ay in range(cy0 - 2, cy0 + 3):
            for ax in range(cx0 - 2, cx0 + 3):
                if not (0 <= ax < CW and 0 <= ay < CH):
                    continue
                if (ax - cx0) ** 2 + (ay - cy0) ** 2 > 5:
                    continue
                if water_major[ay, ax] or deck_core[ay, ax]:
                    continue
                if solid[ay, ax]:
                    cleared += 1
                solid[ay, ax] = False
    print("poi clearings", cleared, "cells")

    # exported walkable structures so the validator measures the same geometry the compiler built
    def _rle_arr(arr):
        rows_x = []
        for y in range(arr.shape[0]):
            row, x, runs = arr[y], 0, []
            while x < arr.shape[1]:
                if not row[x]:
                    x += 1
                    continue
                s = x
                while x < arr.shape[1] and row[x]:
                    x += 1
                runs.append([s, x - s, 1])
            rows_x.append(runs)
        return {"encoding": "rle-[start,len,value]-per-row", "cell_px": COLL, "rows": rows_x}

    walk_deck = _rle_arr(deck_cells | deck_core)
    walk_pier = _rle_arr(down(pier_mask, COLL, 0.05))
    walk_ford = _rle_arr(down(up(ford), COLL, 0.10))
    walk_poi = _rle_arr(np.zeros((CH, CW), bool))

    rows = []
    for y in range(CH):
        row, x, runs = solid[y], 0, []
        while x < CW:
            if not row[x]:
                x += 1
                continue
            s = x
            while x < CW and row[x]:
                x += 1
            runs.append([s, x - s, 1])
        rows.append(runs)

    # ---------------- semantic class map + network report ----------------
    cls = np.zeros((UH, UW), np.uint8)
    cls[roads > 0] = 1
    cls[erode(roads, 1) > 0] = 2
    cls[water > 0] = 3
    cls[deck > 0] = 4
    cls[piers > 0] = 5
    cls[ford > 0] = 6

    def material_at(x, y):
        xi, yi = int(x), int(y)
        if not (0 <= xi < UW and 0 <= yi < UH):
            return False
        return cls[yi, xi] in (1, 2, 4, 5, 6)   # pier decks carry dock access roads

    def water_at(x, y):
        xi, yi = int(x), int(y)
        if not (0 <= xi < UW and 0 <= yi < UH):
            return False
        return cls[yi, xi] in (3, 4, 5, 6)

    cov = NET.coverage(RG["roads"], material_at)
    water_conflicts = []
    for r in RG["roads"]:
        pts = r["points"]
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            L = math.hypot(x1 - x0, y1 - y0)
            n = max(1, int(L))
            for k in range(n + 1):
                t = k / n
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                xi, yi = int(x), int(y)
                if 0 <= xi < UW and 0 <= yi < UH and cls[yi, xi] == 3:
                    water_conflicts.append({"road": r["id"], "at": [round(x, 1), round(y, 1)]})
    hydro = NET.hydro_relation_report(proj, water_at)
    # exact pixel-component proof of every authored source/mouth relation
    _sy, _sx = np.nonzero(sea > 0)
    _body_points = [{"key": "sea", "at": (float(_sx[0]), float(_sy[0]))}]
    for lk in proj["lakes"]:
        ring = (lk.get("rings") or [lk.get("ring")])[0]
        if not ring:
            continue
        cx = sum(q[0] for q in ring) / len(ring)
        cy = sum(q[1] for q in ring) / len(ring)
        _body_points.append({"key": lk["id"], "at": (cx, cy)})
    for rv in proj["rivers"]:
        pts = [(float(q[0]), float(q[1])) for q in rv["points"]]
        mid = pts[len(pts) // 2]
        _body_points.append({"key": rv["id"], "at": mid})
    water_pixels = NET.hydro_pixel_components(proj, water_px, _body_points)
    water_pixels["adjacency"] = NET.hydro_body_adjacency(proj)
    _adj_bad = [a for a in water_pixels["adjacency"] if a.get("connected") is False]
    print("hydrology body adjacency: %d/%d relations meet their named body exactly"
          % (sum(1 for a in water_pixels["adjacency"] if a.get("connected")),
             sum(1 for a in water_pixels["adjacency"] if a.get("connected") is not None)))
    for a in _adj_bad:
        print("  adjacency mismatch", a["river"], a["end"], a["kind"], a["ref"],
              a.get("named_distance_units"), a.get("nearest_other"),
              a.get("nearest_other_distance"))
    _bad = [w for w in water_pixels["relations"] if w.get("connected") is False]
    print("hydrology pixel components: %d components, %d/%d relations share water"
          % (water_pixels["components"],
             sum(1 for w in water_pixels["relations"] if w.get("connected") is True),
             sum(1 for w in water_pixels["relations"] if w.get("connected") is not None)))
    for w in _bad:
        print("  hydro mismatch", w["river"], w["end"], w["kind"], w["ref"], w["end_components"],
              w["body_components"])
    water_cov = NET.coverage([dict(points=[(float(q[0]), float(q[1])) for q in r["points"]],
                                   id=r["id"], kind=r.get("kind"), half=0.5, px=1)
                              for r in proj["rivers"]], water_at)
    bad_road = [c for c in cov if c["coverage"] < 0.995]
    bad_water = [c for c in water_cov if c["coverage"] < 0.98]
    print("road coverage: %d/%d segments >=99.5%%, worst %.3f"
          % (len(cov) - len(bad_road), len(cov), min(c["coverage"] for c in cov)))
    print("water coverage: %d/%d rivers >=98%%, worst %.3f"
          % (len(water_cov) - len(bad_water), len(water_cov), min(c["coverage"] for c in water_cov)))

    # diagnostic overlays (explicitly diagnostics, never a substitute for gameplay captures)
    ov = world_rgb.copy()
    drw = ImageDraw.Draw(ov)
    for r in RG["roads"]:
        drw.line([tuple(p * U for p in q) for q in r["points"]], fill=(210, 60, 60), width=2)
    for r in proj["rivers"]:
        drw.line([tuple(p * U for p in q) for q in r["points"]], fill=(60, 190, 230), width=2)
    for n in RG["nodes"]:
        x, y = n["at"][0] * U, n["at"][1] * U
        col = (255, 210, 60) if n["degree"] >= 3 else (250, 250, 250)
        drw.ellipse([x - 5, y - 5, x + 5, y + 5], outline=col, width=2)
    ov.resize((1600, 1120), Image.LANCZOS).save(os.path.join(out_dir, "network_overlay.png"))
    dia = Image.new("RGB", (2000, 1400), (250, 249, 246))
    dd = ImageDraw.Draw(dia)
    for r in RG["roads"]:
        col = {"cart": (170, 90, 40), "trail": (120, 130, 60), "foot": (80, 90, 110),
               "riverside": (20, 120, 120)}.get(r["kind"], (100, 100, 100))
        dd.line([(q[0], q[1]) for q in r["points"]], fill=col, width=2)
    for r in proj["rivers"]:
        dd.line([(q[0], q[1]) for q in r["points"]],
                fill=(40, 120, 200), width=max(1, int((r.get("width") or 3) / 2)))
    for n in RG["nodes"]:
        dd.ellipse([n["at"][0] - 3, n["at"][1] - 3, n["at"][0] + 3, n["at"][1] + 3],
                   fill=(200, 40, 40) if n["degree"] >= 3 else (60, 60, 60))
    dia.save(os.path.join(out_dir, "network_diagram.png"))
    network = {
        "schema": "soh.veyra.network.v1",
        "road_contract": NET.ROAD_WIDTH, "vehicle": NET.VEHICLE_PROVISIONAL,
        "brook_passes": brook_passes,
        "water_verification": water_pixels,
        "river_extensions": river_extensions,
        "water_open": _rle_v(down(water_px, COLL, 0.5).astype(np.uint8)),
        "walk_deck": walk_deck,
        "walk_pier": walk_pier,
        "walk_ford": walk_ford,
        "authored_fords": authored_fords,
        "road_offsets": road_offsets,
        "road_traversal": road_reach,
        "water_conflicts": water_conflicts[:200],
        "water_conflict_roads": sorted({c["road"] for c in water_conflicts}),
        "roads": {"count": len(RG["roads"]), "nodes": len(RG["nodes"]),
                  "junctions": sum(1 for n in RG["nodes"] if n["degree"] >= 3),
                  "crossings": len(RG["crossings"]), "near_miss": RG["near_miss"],
                  "coverage": cov,
                  "segments_below_99_5": [c["source_id"] for c in bad_road]},
        "water": {"rivers": len(proj["rivers"]), "lakes": len(proj["lakes"]),
                  "coverage": water_cov,
                  "segments_below_98": [c["source_id"] for c in bad_water],
                  "relations": hydro},
        "class_map": {"encoding": "rle-[start,len,value]-per-row", "cell_px": U,
                      "legend": {"1": "road base", "2": "road centre", "3": "water",
                                 "4": "bridge deck", "5": "pier", "6": "ford"},
                      "rows": _rle_v(cls)},
    }
    with open(os.path.join(out_dir, "network.json"), "w") as fh:
        json.dump(network, fh, indent=1)

    meta = {
        "network": {k: v for k, v in network.items() if k != "class_map"},
        "class_map": network["class_map"],
        "schema": "soh.veyra.world.v3",
        "source": {"gold": "map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json",
                   "gold_sha256": hashlib.sha256(open(GOLD, "rb").read()).hexdigest(),
                   "art_manifest": "map_tower/assets/VEYRA_ART_MANIFEST.json",
                   "art_sources": {k: v["sha256"] for k, v in manifest["sources"].items()},
                   "derived_families": manifest["derived"]},
        "scale": {"gold_cell_units": 8, "art_tile_px": ART_TILE, "cells": [GW, GH],
                  "pixels": [PW, PH], "px_per_gold_unit": U, "collision_cell_px": COLL,
                  "collision_cells": [CW, CH], "water_occlusion_threshold": WATER_OCCLUSION},
        "spawns": [{"id": s["id"], "name": s.get("name"), "at": s["at"],
                    "world_px": [s["at"][0] * U, s["at"][1] * U], "region": s.get("region")}
                   for s in proj["spawns"]],
        "pois": poi_out, "resources": res_out,
        "zones": [{"source_id": z["id"], "name": z.get("name"), "ring": z["ring"],
                   "soil": z.get("soil"), "tags": z.get("tags")} for z in proj["zones"]],
        "lakes": [{"source_id": lk["id"], "name": lk.get("name"), "kind": lk.get("kind"),
                   "rings": lk.get("rings") or [lk.get("ring")]} for lk in proj["lakes"]],
        "rivers": [{"source_id": r["id"], "name": r.get("name"), "kind": r.get("kind"),
                    "width": r.get("width"), "nav": r.get("nav"), "feats": r.get("feats"),
                    "points": r["points"],
                    "half_width_units": round(max(0.35, (r.get("width") or 3) / 2.0), 2)}
                   for r in proj["rivers"]],
        "roads": road_out, "ferry_routes": ferry_out,
        "ferry_count": len(ferry_out), "bridges": bridges, "docks": docks,
        "elders": elder_out, "reference_areas": ref_areas,
        "labels": [{"source_id": l["id"], "text": l.get("text"), "at": l["at"],
                    "world_px": [l["at"][0] * U, l["at"][1] * U],
                    "rot": l.get("rot"), "size": l.get("size"), "style": l.get("style")}
                   for l in proj["labels"]],
        "lands": [{"source_id": l["id"], "name": l.get("name"), "kind": l.get("kind"),
                   "rings": l.get("rings") or [l.get("ring")]} for l in proj["land"]],
        "water_verification": water_pixels,
        "river_extensions": river_extensions,
        "water_open": _rle_v(down(water_px, COLL, 0.5).astype(np.uint8)),
        "walk_deck": walk_deck,
        "walk_pier": walk_pier,
        "walk_ford": walk_ford,
        "fords": [[float(f[0]), float(f[1])] for f in ford_pts],
        "collision": {"encoding": "rle-[start,len,value]-per-row", "cell_px": COLL,
                      "rows": rows},
        "water": {"encoding": "rle-[start,len,value]-per-row", "cell_px": COLL,
                  "rows": _rle(down(water_px, COLL, 0.10))},
        "derived_water_coverage": {"cell_share": round(float(down(water_px, COLL, 0.10).mean()), 4)},
        "art_gaps": manifest["open_gaps"],
    }
    with open(os.path.join(out_dir, "world_meta.json"), "w") as fh:
        json.dump(meta, fh, indent=1)
    np.save(os.path.join(out_dir, "solid.npy"), solid)
    world_rgb.resize((500, 350), Image.LANCZOS).save(os.path.join(out_dir, "minimap.png"))
    print("solid cells", int(solid.sum()), "/", solid.size)
    return meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(REPO, "out"))
    main(ap.parse_args().out)
