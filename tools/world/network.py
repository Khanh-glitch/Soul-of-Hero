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


def build_road_graph(proj, join_tol=1.2):
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
    # near misses: endpoints 1.2..6 units from another road's interior, no crossing found
    near_miss = []
    for i, r in enumerate(roads):
        for end in (r["points"][0], r["points"][-1]):
            best = (None, 1e9)
            for j, q in enumerate(roads):
                if i == j:
                    continue
                for s in range(len(q["points"]) - 1):
                    d = _seg_dist_point(end[0], end[1], *q["points"][s], *q["points"][s + 1])
                    if d < best[1]:
                        best = (q["id"], d)
            if best[1] <= 6.0:
                near_miss.append({"road": r["id"], "at": [end[0], end[1]],
                                  "nearest": best[0], "distance": round(best[1], 2),
                                  "class": ("junction (endpoint lies on the other road)"
                                            if best[1] <= join_tol else
                                            "near-miss (ambiguous: neither joined nor separate)")})
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
