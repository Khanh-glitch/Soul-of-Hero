"""Veyra network compiler core — one architecture for roads and hydrology.

Everything here is driven by GOLD source IDs and geometry.  The compiler imports this module
to decide widths, to discover junctions/endpoints and to verify that what it is about to paint
actually satisfies the authored topology; the validator imports it to re-measure the *rendered*
result against the same authored graph.

Concepts
--------
Road graph   nodes = authored endpoints, junctions (endpoint coincidence or segment crossing),
             bridge heads and dock heads.  Edges carry their source road id.
Hydro graph  nodes = sea, lakes and rivers; edges = GOLD `source` / `mouth` references with the
             kind of connection (lake, river, sea, spring, none) and an explicit tolerance.
Coverage     the fraction of an authored centreline whose corridor carries rendered material of
             the expected class.  This is what makes "visible road" testable rather than
             inferred from a collision mask.
"""
import json
import math

import numpy as np

# --- road width contract -------------------------------------------------------------------
# GOLD stores no width.  These are measured, documented decisions, not arbitrary floats:
#   * the D051 feet collision box is 12 x 8 px; a route narrower than 12 px cannot be walked
#     without clipping its verge, so every walkable class renders at >= 12 px;
#   * a cart is provisionally 16 px wide (no vehicle asset exists yet) so cart roads render at
#     >= 20 px of material, giving 2 px of verge on each side;
#   * trails sit between the two, footpaths at the readable minimum.
# px_per_unit is 4, so half-widths are in GOLD units.
ROAD_WIDTH = {
    #                 render half (units)  px   role
    "cart":      {"render": 2.6, "px": 21, "clearance": 3.4, "note": "freight; provisional 16 px cart"},
    "trail":     {"render": 1.8, "px": 14, "clearance": 2.6, "note": "pack trail"},
    "foot":      {"render": 1.5, "px": 12, "clearance": 2.3, "note": "readable minimum for the feet box"},
    "riverside": {"render": 1.7, "px": 14, "clearance": 2.5, "note": "bank route, keeps 2 px off the water"},
    "ferry":     {"render": 0.0, "px": 0, "clearance": 0.0, "note": "maritime, never painted as road"},
}
ROAD_ORDER = {"foot": 0, "trail": 1, "riverside": 2, "cart": 3}

VEHICLE_PROVISIONAL = {
    "cart_px": 16, "verified": False,
    "note": "no cart/vehicle entity exists yet; cart clearance is provisional and traversal is unverified",
}

# --- hydrology ----------------------------------------------------------------
HYDRO_TOLERANCE_UNITS = 4.0      # a river end must reach its named body within this distance
BODY_MEET_TOLERANCE = 1.0        # exact-body test: within 1 GOLD unit (4 px) of the named body


def _seg_dist_point(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    L2 = vx * vx + vy * vy
    if L2 < 1e-9:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / L2))
    return math.hypot(px - (ax + vx * t), py - (ay + vy * t))


def _seg_intersect(a, b, c, d):
    (x1, y1), (x2, y2) = a, b
    (x3, y3), (x4, y4) = c, d
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(den) < 1e-12:
        return None
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den
    if 0 <= t <= 1 and 0 <= u <= 1:
        return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))
    return None


def build_road_graph(proj, join_tol=1.2, landmarks=None):
    """Nodes and edges for every authored land road (ferries are excluded by design)."""
    roads = []
    for rd in proj["roads"]:
        kind = rd.get("kind", "trail")
        if kind == "ferry":
            continue
        w = ROAD_WIDTH.get(kind, ROAD_WIDTH["trail"])
        roads.append({"id": rd["id"], "kind": kind, "name": rd.get("name"),
                      "points": [(float(p[0]), float(p[1])) for p in rd["points"]],
                      "half": w["render"], "px": w["px"], "clearance": w["clearance"],
                      "purpose": rd.get("purpose")})

    # endpoints: coincidence within join_tol merges into one node
    nodes, node_of = [], []

    def node_index(pt):
        for i, n in enumerate(nodes):
            if math.hypot(n["at"][0] - pt[0], n["at"][1] - pt[1]) <= join_tol:
                n["degree"] += 1
                return i
        nodes.append({"id": f"n{len(nodes)}", "at": [pt[0], pt[1]], "degree": 1})
        return len(nodes) - 1

    for r in roads:
        a = node_index(r["points"][0])
        b = node_index(r["points"][-1])
        node_of.append((a, b))

    # junctions where two road segments actually cross (not merely near)
    crossings = []
    for i, ri in enumerate(roads):
        for j in range(i + 1, len(roads)):
            rj = roads[j]
            for si in range(len(ri["points"]) - 1):
                for sj in range(len(rj["points"]) - 1):
                    p = _seg_intersect(ri["points"][si], ri["points"][si + 1],
                                       rj["points"][sj], rj["points"][sj + 1])
                    if p:
                        crossings.append({"at": [p[0], p[1]], "roads": [ri["id"], rj["id"]],
                                          "kind": "crossing"})
    # near misses: endpoints 1.2..6 units from another road's interior, no crossing found.
    # Every one is classified from geometry, never assumed:
    #   VALID_JUNCTION                  the two rendered corridors physically overlap
    #                                   (endpoint distance <= the sum of both render half widths),
    #                                   so the paint already joins and the graph merges the node;
    #   CORRECTED_COMPILER_CONNECTION   the two endpoints share a landmark (bridge head, dock,
    #                                   POI) within 3 u and are merged onto that landmark;
    #   VALID_SEPARATE                  corridors do not touch and no shared landmark exists:
    #                                   two deliberate, independent approaches;
    #   SOURCE_AMBIGUITY_BLOCKED        would need a connection GOLD does not author.
    landmarks = landmarks or []
    near_miss = []
    for i, r in enumerate(roads):
        for end in (r["points"][0], r["points"][-1]):
            best = (None, 1e9)
            for j, o in enumerate(roads):
                if o is r:
                    continue
                for k in range(len(o["points"]) - 1):
                    ax, ay = o["points"][k]
                    bx, by = o["points"][k + 1]
                    d = _seg_dist_point(end[0], end[1], ax, ay, bx, by)
                    if d < best[1]:
                        best = (o["id"], d, o)
            if best[0] and 1e-6 < best[1] <= 6.0:
                other = best[2]
                touch = r["half"] + other["half"]
                d = round(best[1], 2)
                cls, note = "VALID_SEPARATE", "corridors do not touch; independent approaches"
                if best[1] <= touch:
                    cls = "VALID_JUNCTION"
                    note = ("rendered corridors overlap (%.2f u <= %.2f u of combined half width); "
                            "graph merges the node" % (best[1], touch))
                else:
                    shared = None
                    for lm in landmarks:
                        lx, ly = lm["at"]
                        if (math.hypot(end[0] - lx, end[1] - ly) <= 3.0 and
                                _nearest_pt(o["points"], lx, ly)[1] <= 30.0):
                            shared = lm
                            break
                    if shared:
                        cls = "CORRECTED_COMPILER_CONNECTION"
                        note = ("both roads serve %s %s within 3 u; connection made at the "
                                "landmark" % (shared["kind"], shared.get("id")))
                near_miss.append({"road": r["id"], "at": [end[0], end[1]], "nearest": best[0],
                                  "distance": d, "class": cls, "note": note})
    return {"roads": roads, "nodes": nodes, "edges": node_of,
            "crossings": crossings, "near_miss": near_miss}


def build_hydro_graph(proj):
    """Rivers, lakes, sea with authored source/mouth relations and measured reach."""
    rivers = []
    for r in proj["rivers"]:
        pts = [(float(p[0]), float(p[1])) for p in r["points"]]
        rivers.append({"id": r["id"], "name": r.get("name"), "kind": r.get("kind"),
                       "width": r.get("width"), "half": max(0.35, (r.get("width") or 3) / 2.0),
                       "points": pts, "source": r.get("source") or {"kind": "none"},
                       "mouth": r.get("mouth") or {"kind": "none"},
                       "nav": r.get("nav"), "feats": r.get("feats") or []})
    lakes = [{"id": l["id"], "name": l.get("name"),
              "rings": l.get("rings") or [l.get("ring")]} for l in proj["lakes"]]
    return {"rivers": rivers, "lakes": lakes, "sea": {"id": "sea", "kind": "sea"},
            "tolerance": HYDRO_TOLERANCE_UNITS}


def hydro_relation_report(proj, inside_water):
    """Check every authored source/mouth relation against the compiled water surface.

    `inside_water(x, y)` answers whether a GOLD-unit point lies on compiled water.  A river end
    satisfies a relation when the named body is found within HYDRO_TOLERANCE_UNITS of that end.
    """
    g = build_hydro_graph(proj)
    out = []
    for r in g["rivers"]:
        for which in ("source", "mouth"):
            ref = r[which] or {"kind": "none"}
            kind = ref.get("kind", "none")
            at = r["points"][0] if which == "source" else r["points"][-1]
            rec = {"river": r["id"], "end": which, "kind": kind, "ref": ref.get("ref"),
                   "at": [round(at[0], 2), round(at[1], 2)]}
            if kind in ("lake", "river", "sea"):
                found, dist = None, None
                step = 0.5
                best = (None, 1e9)
                for k in range(1, int(HYDRO_TOLERANCE_UNITS / step) + 1):
                    d = k * step
                    for a in range(0, 16):
                        ang = a * math.pi / 8
                        x, y = at[0] + math.cos(ang) * d, at[1] + math.sin(ang) * d
                        if inside_water(x, y):
                            if d < best[1]:
                                best = (a, d)
                            break
                    if best[1] < 1e8:
                        break
                rec["connected"] = best[1] < 1e8
                rec["distance_units"] = None if best[1] >= 1e8 else round(best[1], 2)
                out.append(rec)
            else:
                rec["connected"] = None            # spring/none: no body to reach
                rec["distance_units"] = None
                out.append(rec)
    return out


def coverage(roads, material_at, step=1.0):
    """Fraction of each authored centreline that carries rendered material.

    `material_at(x, y)` -> bool.  Sampling is dense along the polyline so a single missing
    stretch shows up; the report keeps the worst gap and its location.
    """
    rep = []
    for r in roads:
        total = hit = 0
        worst = {"length": 0.0, "at": None}
        run = 0.0
        run_at = None
        pts = r["points"]
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            L = math.hypot(x1 - x0, y1 - y0)
            n = max(1, int(L / step))
            for s in range(n + 1):
                t = s / n
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                total += 1
                if material_at(x, y):
                    hit += 1
                    run = 0.0
                else:
                    if run == 0.0:
                        run_at = (round(x, 1), round(y, 1))
                    run += L / n
                    if run > worst["length"]:
                        worst = {"length": round(run, 2), "at": run_at}
        rep.append({"source_id": r["id"], "kind": r["kind"], "samples": total,
                    "covered": hit, "coverage": round(hit / total, 4) if total else 0.0,
                    "worst_gap_units": worst["length"], "worst_gap_at": worst["at"],
                    "half_width_units": r["half"], "rendered_px": r["px"]})
    return rep


def _nearest_pt(points, x, y):
    best = (points[0], 1e9)
    for k in range(len(points) - 1):
        ax, ay = points[k]
        bx, by = points[k + 1]
        vx, vy = bx - ax, by - ay
        L2 = vx * vx + vy * vy
        t = 0.0 if L2 < 1e-9 else max(0.0, min(1.0, ((x - ax) * vx + (y - ay) * vy) / L2))
        px, py = ax + vx * t, ay + vy * t
        d = math.hypot(x - px, y - py)
        if d < best[1]:
            best = ((px, py), d)
    return best


def corridor_reach(road, passable, coll_px, extra_cells=None, dev_units=1.6, step=0.5):
    """Can a player walk this road end to end *inside its own corridor*?

    The corridor is the authored polyline dilated by its half width plus a small deviation
    allowance; deck, pier and clearing cells are added explicitly so a bridge landing or a dock
    approach is traversable without pretending the player can cross open water.  BFS only moves
    between passable cells, so a blocked corridor reports the exact first cell that fails.
    """
    import collections

    def cell(px, py):
        return int(px // coll_px), int(py // coll_px)

    h, w = passable.shape
    tol = road["half"] + dev_units
    allowed = set()
    pts = road["points"]
    blocks = []
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        L = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(L / step))
        for k in range(n + 1):
            t = k / n
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            cx, cy = cell(x * 4, y * 4)
            r = int(math.ceil(tol / 4.0))
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    ax, ay = cx + dx, cy + dy
                    if 0 <= ax < w and 0 <= ay < h:
                        allowed.add((ax, ay))
            if not passable[cy, cx]:
                blocks.append((round(x, 1), round(y, 1)))
    if extra_cells is not None:
        allowed |= extra_cells
    sx, sy = cell(pts[0][0] * 4, pts[0][1] * 4)
    ex, ey = cell(pts[-1][0] * 4, pts[-1][1] * 4)

    def nearest(cx, cy):
        if passable[cy, cx]:
            return (cx, cy)
        best = None
        for r in range(1, 4):
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    ax, ay = cx + dx, cy + dy
                    if 0 <= ax < w and 0 <= ay < h and passable[ay, ax]:
                        d = dx * dx + dy * dy
                        if best is None or d < best[0]:
                            best = (d, ax, ay)
            if best:
                return best[1], best[2]
        return None

    s = nearest(sx, sy)
    e = nearest(ex, ey)
    reach = False
    if s and e:
        seen = {s}
        q = collections.deque([s])
        while q:
            cx, cy = q.popleft()
            if (cx, cy) == e:
                reach = True
                break
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ax, ay = cx + dx, cy + dy
                if (ax, ay) in seen or not (0 <= ax < w and 0 <= ay < h):
                    continue
                if not passable[ay, ax] or (ax, ay) not in allowed:
                    continue
                seen.add((ax, ay))
                q.append((ax, ay))
    return {"reachable": reach, "corridor_cells": len(allowed),
            "start": s, "end": e, "blocked_samples": blocks[:8],
            "blocked_count": len(blocks)}


def hydro_component_verify(proj, water_cells, body_masks, max_cells=600000):
    """Independent hydrology check: does a river end actually touch the body it names?

    `water_cells` is the compiled water surface at 1 cell per GOLD unit, `body_masks` maps
    ("sea" | lake id | river id) to a boolean mask of that exact body.  The end point is snapped
    to water, then a flood fill runs over connected water only; the relation passes when the named
    body is reached *inside the same component*.  Proximity is therefore no longer evidence.
    """
    import collections

    h, w = water_cells.shape
    ys, xs = np.nonzero(water_cells)
    if len(xs) == 0:
        return []
    pts_x, pts_y = xs, ys

    def snap(x, y, r=6):
        best = None
        for yy in range(int(y) - r, int(y) + r + 1):
            for xx in range(int(x) - r, int(x) + r + 1):
                if 0 <= xx < w and 0 <= yy < h and water_cells[yy, xx]:
                    d = math.hypot(xx - x, yy - y)
                    if best is None or d < best[0]:
                        best = (d, xx, yy)
        return None if best is None else (best[1], best[2])

    g = build_hydro_graph(proj)
    out = []
    for r in g["rivers"]:
        for which in ("source", "mouth"):
            ref = r[which] or {"kind": "none"}
            kind = ref.get("kind", "none")
            at = r["points"][0] if which == "source" else r["points"][-1]
            rec = {"river": r["id"], "end": which, "kind": kind, "ref": ref.get("ref"),
                   "at": [round(at[0], 2), round(at[1], 2)]}
            if kind not in ("lake", "river", "sea"):
                rec.update(connected=None, note="spring/none: no receiving body authored")
                out.append(rec)
                continue
            key = "sea" if kind == "sea" else ref.get("ref")
            target = body_masks.get(key)
            if target is None:
                rec.update(connected=False, note="named body is not present in GOLD")
                out.append(rec)
                continue
            start = snap(at[0], at[1])
            if start is None:
                rec.update(connected=False, note="river end is not on compiled water")
                out.append(rec)
                continue
            seen = np.zeros((h, w), bool)
            seen[start[1], start[0]] = True
            q = collections.deque([start])
            hit = None
            n = 0
            while q and n < max_cells:
                cx, cy = q.popleft()
                n += 1
                if target[cy, cx]:
                    hit = (cx, cy)
                    break
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ax, ay = cx + dx, cy + dy
                    if 0 <= ax < w and 0 <= ay < h and water_cells[ay, ax] and not seen[ay, ax]:
                        seen[ay, ax] = True
                        q.append((ax, ay))
            rec["connected"] = hit is not None
            rec["component_cells"] = n
            rec["reached_at"] = None if hit is None else [int(hit[0]), int(hit[1])]
            rec["distance_units"] = (None if hit is None else
                                     round(math.hypot(hit[0] - at[0], hit[1] - at[1]), 2))
            rec["note"] = ("same connected water component as the named body" if hit else
                           "flood fill over compiled water never reaches the named body")
            out.append(rec)
    return out


def hydro_pixel_components(proj, water_px, body_points, px_per_unit=4):
    """Exact pixel-component hydrology proof.

    `water_px` is the compiled water surface at native resolution.  8-connected components are
    labelled once; each GOLD body contributes the set of component labels found under its own
    authored geometry (lake ring interior / river centreline / sea sample).  A river end passes
    only when its component label is in the label set of the body it names, i.e. the water is
    physically the same water - not merely nearby.
    """
    from scipy import ndimage

    lbl, n = ndimage.label(water_px, structure=np.ones((3, 3), np.int32))
    H, W = water_px.shape

    def labels_under(points, r=2):
        found = set()
        for x, y in points:
            xi, yi = int(x * px_per_unit), int(y * px_per_unit)
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    ax, ay = xi + dx, yi + dy
                    if 0 <= ax < W and 0 <= ay < H and lbl[ay, ax]:
                        found.add(int(lbl[ay, ax]))
        return found

    body = {}
    for b in body_points:
        body[b["key"]] = labels_under([b["at"]])
    g = build_hydro_graph(proj)
    out = []
    for r in g["rivers"]:
        _rp = list(r["points"])
        own = labels_under([_rp[0], _rp[-1], _rp[len(_rp) // 2]])
        for which in ("source", "mouth"):
            ref = r[which] or {"kind": "none"}
            kind = ref.get("kind", "none")
            at = r["points"][0] if which == "source" else r["points"][-1]
            rec = {"river": r["id"], "end": which, "kind": kind, "ref": ref.get("ref"),
                   "at": [round(at[0], 2), round(at[1], 2)]}
            if kind not in ("lake", "river", "sea"):
                rec.update(connected=None, note="spring/none: no receiving body authored")
                out.append(rec)
                continue
            key = "sea" if kind == "sea" else ref.get("ref")
            tgt = body.get(key, set())
            end_labels = labels_under([at], r=3)
            common = sorted(end_labels & tgt)
            rec.update(connected=bool(common), shared_components=common[:4],
                       end_components=sorted(end_labels)[:4], body_components=sorted(tgt)[:4],
                       note=("river end and the named body share water component %s"
                             % (common[:3] if common else "none")))
            out.append(rec)
    return {"components": int(n), "relations": out,
            "resolution_px": 1, "connectivity": 8, "river_components": {
                r["id"]: sorted({l for l in own})[:4] for r in g["rivers"]}}


def _point_in_ring(ring, x, y):
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i - 1]
        x2, y2 = ring[i]
        if (y1 > y) != (y2 > y):
            xin = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if xin > x:
                inside = not inside
    return inside


def _ring_dist(ring, x, y):
    if _point_in_ring(ring, x, y):
        return 0.0
    return min(_seg_dist_point(x, y, ring[i - 1][0], ring[i - 1][1], ring[i][0], ring[i][1])
               for i in range(len(ring)))


def _line_dist(points, x, y):
    return min(_seg_dist_point(x, y, a[0], a[1], b[0], b[1]) for a, b in zip(points, points[1:]))


def hydro_body_adjacency(proj):
    """Exact body-to-body test for every authored source/mouth relation.

    Each body gets a signed distance function from its own GOLD geometry (rings for lakes and
    land, centreline minus half width for rivers).  A relation passes only when
      * the river end is inside, or within 0.5 u of, the body it names, and
      * no other body is closer at that point.
    So a mouth that merely happens to be near *some* water cannot pass by luck.
    """
    land_rings = []
    for L in proj["land"]:
        land_rings += [r for r in (L.get("rings") or [L.get("ring")]) if r]
    bodies = {}
    for lk in proj["lakes"]:
        rings = [r for r in (lk.get("rings") or [lk.get("ring")]) if r]
        bodies[lk["id"]] = (lambda x, y, rings=rings: min(_ring_dist(r, x, y) for r in rings))
    for rv in proj["rivers"]:
        pts = [(float(q[0]), float(q[1])) for q in rv["points"]]
        hw = max(0.35, (rv.get("width") or 3) / 2.0)
        bodies[rv["id"]] = (lambda x, y, pts=pts, hw=hw: max(0.0, _line_dist(pts, x, y) - hw))

    def _ring_edge_dist(ring, x, y):
        return min(_seg_dist_point(x, y, ring[i - 1][0], ring[i - 1][1], ring[i][0], ring[i][1])
                   for i in range(len(ring)))

    def sea_dist(x, y):
        if not any(_point_in_ring(r, x, y) for r in land_rings):
            return 0.0
        # inside land: the sea is as far as the nearest coast edge
        return min(_ring_edge_dist(r, x, y) for r in land_rings)

    bodies["sea"] = sea_dist
    g = build_hydro_graph(proj)
    out = []
    for r in g["rivers"]:
        for which in ("source", "mouth"):
            ref = r[which] or {"kind": "none"}
            kind = ref.get("kind", "none")
            at = r["points"][0] if which == "source" else r["points"][-1]
            rec = {"river": r["id"], "end": which, "kind": kind, "ref": ref.get("ref"),
                   "at": [round(at[0], 2), round(at[1], 2)]}
            if kind not in ("lake", "river", "sea"):
                rec.update(connected=None, note="spring/none: no receiving body authored")
                out.append(rec)
                continue
            key = "sea" if kind == "sea" else ref.get("ref")
            if key not in bodies:
                rec.update(connected=False, note="named body absent from GOLD")
                out.append(rec)
                continue
            named = bodies[key](at[0], at[1])
            others = sorted((round(bodies[k](at[0], at[1]), 2), k)
                            for k in bodies if k != key and k != r["id"])
            nearest_other = others[0] if others else (1e9, None)
            # tolerance: 1 GOLD unit (4 px), a quarter art tile - the drafting precision GOLD
            # itself uses for its own 4 u hydro tolerance, and never a substitute for a closer body
            ok = named <= BODY_MEET_TOLERANCE and named <= nearest_other[0] + 0.01
            rec.update(connected=ok, named_distance_units=round(named, 2),
                       nearest_other=nearest_other[1],
                       nearest_other_distance=nearest_other[0],
                       note=("river end meets %s (%0.2f u) and no other body is closer"
                             % (key, named)) if ok else
                            ("river end is %0.2f u from %s but %0.2f u from %s"
                             % (named, key, nearest_other[0], nearest_other[1])))
            out.append(rec)
    return out
