"""SURV-050A pacing/scale audit. Read-only; emits estimates, not playtime claims.

Travel model: foot-equivalent 96 px/s (16 px tiles) along authored route
polylines. Resource-site links are straight-line detour estimates to the nearest
authored hub, not native pathfinding. Combat, crafting, gathering animation,
inventory management, hazard damage and day-equivalent pacing are NOT_TESTED.
Capability source POIs grant a starter capability/recipe on first visit;
material runs model sustain/repair after the grant, not a bootstrap prerequisite.
"""
from __future__ import annotations

import heapq
import json
import math
from collections import defaultdict
from pathlib import Path

from baseline import Baseline, ROOT
from validate_world import OUT, load, reconstruct

TILE_PX = 16
SPEED_PX_S = 96.0
DOC = ROOT / "docs" / "survival" / "world"


def polyline_tiles(pts):
    return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))


def seconds(tiles):
    return tiles * TILE_PX / SPEED_PX_S


def build_graph(plan):
    nodes = {n["node_id"]: n for n in plan["route_graph"]["nodes"]}
    pois = {p["poi_id"]: p for p in plan["pois"]}
    sites = {s["site_id"]: s for s in plan["resource_sites"]}
    hubs = {n["node_id"]: n["cell"] for n in nodes.values() if n["kind"] == "hub"}
    adj = defaultdict(list)
    edges = {}
    for e in plan["route_graph"]["edges"]:
        length = polyline_tiles(e["polyline"])
        edges[e["route_id"]] = dict(e, tiles=length, seconds=seconds(length))
        adj[e["from"]].append((e["to"], e["route_id"]))
        adj[e["to"]].append((e["from"], e["route_id"]))
    for sid, s in sites.items():
        nodes[sid] = {"node_id": sid, "cell": s["center"], "kind": "site"}
        hub = min(hubs, key=lambda h: math.hypot(hubs[h][0] - s["center"][0], hubs[h][1] - s["center"][1]))
        rid = "site_link_" + sid
        pts = [hubs[hub], s["center"]]
        length = polyline_tiles(pts)
        edges[rid] = {"route_id": rid, "from": hub, "to": sid, "polyline": pts,
                      "mode": "foot_estimate", "required_capabilities": s["required_capabilities"],
                      "kind": "site_detour_estimate", "tiles": length, "seconds": seconds(length)}
        adj[hub].append((sid, rid))
        adj[sid].append((hub, rid))
    return nodes, pois, sites, adj, edges


def shortest(adj, edges, start, goal, caps, skip_edge=None):
    if start == goal:
        return {"ok": True, "tiles": 0.0, "seconds": 0.0, "edges": [], "nodes": [start]}
    dist = {start: 0.0}
    prev = {}
    pq = [(0.0, start)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == goal:
            break
        if d > dist.get(u, math.inf) + 1e-9:
            continue
        for v, rid in adj[u]:
            e = edges[rid]
            if rid == skip_edge:
                continue
            if not set(e["required_capabilities"]) <= caps:
                continue
            nd = d + e["tiles"]
            if nd < dist.get(v, math.inf) - 1e-9:
                dist[v] = nd
                prev[v] = (u, rid)
                heapq.heappush(pq, (nd, v))
    if goal not in dist:
        return {"ok": False, "reason": "no_capability_safe_path", "start": start, "goal": goal}
    path_edges = []
    cur = goal
    while cur != start:
        u, rid = prev[cur]
        path_edges.append(rid)
        cur = u
    path_edges.reverse()
    return {"ok": True, "tiles": dist[goal], "seconds": seconds(dist[goal]),
            "edges": path_edges, "nodes": [start] + [prev.get(g, (None, None)) for g in []]}


def hazard_exposure(edges, path_edges, hazard_grid, hazard_ids, w):
    exposed = defaultdict(float)
    for rid in path_edges:
        pts = edges[rid]["polyline"]
        for a, b in zip(pts, pts[1:]):
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            steps = max(1, int(math.ceil(length)))
            for i in range(steps):
                t = (i + 0.5) / steps
                x = int(round(a[0] + (b[0] - a[0]) * t))
                y = int(round(a[1] + (b[1] - a[1]) * t))
                if 0 <= x < w and 0 <= y < len(hazard_grid) // w:
                    hz = hazard_grid[y * w + x]
                    if hz:
                        exposed[hazard_ids[hz - 1]] += length / steps
    return {hz: {"tiles": round(t, 2), "seconds": round(seconds(t), 2)} for hz, t in sorted(exposed.items())}


def journey(name, sequence, start_caps, nodes, pois, sites, adj, edges, hazard_grid, hazard_ids, w, caps_by_poi):
    caps = set(start_caps)
    legs = []
    total_tiles = 0.0
    total_seconds = 0.0
    direct_tiles = 0.0
    exposure = defaultdict(float)
    grants = []
    for a, b in zip(sequence, sequence[1:]):
        direct_tiles += math.hypot(nodes[b]["cell"][0] - nodes[a]["cell"][0], nodes[b]["cell"][1] - nodes[a]["cell"][1])
        path = shortest(adj, edges, a, b, caps)
        if not path["ok"]:
            return {"journey": name, "ok": False, "failed_leg": [a, b], "reason": path["reason"], "caps": sorted(caps)}
        leg_exposure = hazard_exposure(edges, path["edges"], hazard_grid, hazard_ids, w)
        for hz, v in leg_exposure.items():
            exposure[hz] += v["tiles"]
        legs.append({"from": a, "to": b, "tiles": round(path["tiles"], 2), "seconds": round(path["seconds"], 2),
                     "route_edges": path["edges"], "hazard_exposure": leg_exposure})
        total_tiles += path["tiles"]
        total_seconds += path["seconds"]
        if b in caps_by_poi:
            new = set(caps_by_poi[b]) - caps
            if new:
                grants.append({"poi": b, "grants": sorted(new)})
                caps |= new
    return {"journey": name, "ok": True, "sequence": sequence, "start_caps": sorted(start_caps),
            "end_caps": sorted(caps), "grants": grants, "legs": legs,
            "total_tiles": round(total_tiles, 2), "total_seconds": round(total_seconds, 2),
            "total_minutes": round(total_seconds / 60.0, 2),
            "direct_tiles": round(direct_tiles, 2), "detour_ratio": round(total_tiles / max(1e-9, direct_tiles), 3),
            "hazard_exposure": {hz: {"tiles": round(t, 2), "seconds": round(seconds(t), 2)} for hz, t in sorted(exposure.items())},
            "combat_crafting_gathering_seconds": "NOT_TESTED"}


def early_home_loop():
    base = Baseline()
    catalog = json.loads((ROOT / "data/survival/survival_catalog.json").read_text())
    resources = catalog["resources"]
    plan = json.loads((ROOT / "data/survival/hollow_marches_resources.json").read_text())
    sx, sy = base.origin
    # 4x4 enclosed room: 11 walls + 1 door + 4 interior floors + 1 chest.
    pieces = catalog["pieces"]
    cost = defaultdict(int)
    for _ in range(11):
        for k, v in pieces["wall_wood"]["cost"].items():
            cost[k] += v
    for piece, count in (("door_wood", 1), ("foundation_wood", 4), ("chest_wood", 1)):
        for k, v in pieces[piece]["cost"].items():
            cost[k] += v * count
    needed = dict(cost)
    nodes_by_item = defaultdict(list)
    for n in plan["nodes"]:
        kind = n["kind"]
        item = resources[kind]["item"]
        yield_per_node = resources[kind]["per_hit"] * resources[kind]["hits"]
        nodes_by_item[item].append((n["cell"], kind, yield_per_node, resources[kind]["respawn_seconds"], resources[kind]["hits"]))
    visits = []
    for item, amount in needed.items():
        candidates = sorted(nodes_by_item[item], key=lambda c: abs(c[0][0] - sx) + abs(c[0][1] - sy))
        remaining = amount
        for cell, kind, yld, respawn, hits in candidates:
            if remaining <= 0:
                break
            visits.append({"item": item, "kind": kind, "cell": cell, "yield_per_node": yld,
                           "hits": hits, "respawn_seconds": respawn,
                           "manhattan_from_spawn": abs(cell[0] - sx) + abs(cell[1] - sy)})
            remaining -= yld
    # Greedy out-and-back grid estimate, not native pathfinding.
    route = [(sx, sy)] + [v["cell"] for v in visits] + [(sx, sy)]
    tiles = sum(abs(b[0] - a[0]) + abs(b[1] - a[1]) for a, b in zip(route, route[1:]))
    return {"journey": "early_legacy_home", "ok": True, "model": "Manhattan grid estimate on preserved legacy inset; not native pathfinding",
            "shelter": "4x4 room: 11 walls + 1 door + 4 floors + 1 chest", "cost": needed,
            "node_visits": visits, "gather_hits_total": sum(v["hits"] for v in visits),
            "travel_tiles_estimate": tiles, "travel_seconds_estimate": round(seconds(tiles), 2),
            "travel_minutes_estimate": round(seconds(tiles) / 60.0, 2),
            "respawn_revisit_seconds": {item: min(v["respawn_seconds"] for v in visits if v["item"] == item) for item in needed},
            "combat_crafting_gathering_seconds": "NOT_TESTED", "a0_item_aliases": {"oak_wood": "timber", "iron_scrap": "iron/salvage"}}


def run():
    plan = load()
    w = plan["frame"]["w"]
    hazard_grid = reconstruct(plan, "hazard")
    hazard_ids = [h["hazard_id"] for h in plan["hazards"]]
    nodes, pois, sites, adj, edges = build_graph(plan)
    caps_by_poi = {p["poi_id"]: p["grants_capabilities"] for p in plan["pois"]}
    novice = {"cap_salvage", "cap_seal_1", "cap_power_1"}
    mid = novice | {"cap_thermal", "cap_filter", "cap_climb", "cap_boat", "cap_seal_2", "cap_stormward"}
    late = set(plan["capabilities"])
    journeys = [early_home_loop()]
    specs = [
        ("early_buffer_salvage_power", ["node_refuge", "poi_crown_waystation", "src_crown_salvage", "poi_crown_relay_shed", "node_refuge"], set()),
        ("mid_filter_bootstrap_and_sustain", ["node_refuge", "poi_amberwood_apothecary", "src_amber_herb", "src_crown_reed", "src_fen_venom", "node_refuge"], novice),
        ("mid_climb_bootstrap_and_sustain", ["node_refuge", "poi_ember_piton_works", "src_crown_iron", "src_crown_reed", "node_refuge"], novice | {"cap_filter"}),
        ("mid_thermal_bootstrap_and_sustain", ["node_refuge", "poi_frost_wardhouse", "src_frost_skarn", "src_frost_resin", "node_refuge"], novice | {"cap_filter", "cap_climb"}),
        ("mid_seal2_forge_run", ["node_refuge", "poi_ember_old_forge", "src_ember_copper", "src_ember_sulfur", "node_refuge"], novice | {"cap_thermal", "cap_filter", "cap_climb"}),
        ("mid_boat_bootstrap_and_sustain", ["node_refuge", "poi_saffron_drydock", "src_verdant_hardwood", "src_verdant_sap", "src_crown_reed", "node_refuge"], mid - {"cap_boat"}),
        ("late_tide_ward_run", ["node_refuge", "poi_pearl_stilt_village", "src_pearl_bed", "src_verdant_hardwood", "src_verdant_sap", "node_refuge"], mid),
        ("late_seal3_customs_run", ["node_refuge", "poi_pearl_customs", "src_pearl_abyss", "src_pearl_bed", "node_refuge"], late - {"cap_seal_3", "cap_deepward"}),
        ("late_deepward_root_lift_run", ["node_refuge", "poi_verdant_root_lift", "src_frost_vug", "src_verdant_sap", "src_frost_skarn", "node_refuge"], late - {"cap_deepward"}),
    ]
    for name, seq, caps in specs:
        journeys.append(journey(name, seq, caps, nodes, pois, sites, adj, edges, hazard_grid, hazard_ids, w, caps_by_poi))
    # Post-14d goal reachability/travel, not a day-count claim.
    goals = []
    for g in plan["long_run_goals"]:
        path = shortest(adj, edges, "node_refuge", g["poi"], late)
        goals.append({"goal_id": g["id"], "poi": g["poi"], "after_day_equivalent": g["after_day_equivalent"],
                      "reachable_with_late_caps": path["ok"],
                      "travel_tiles": round(path.get("tiles", 0), 2), "travel_minutes": round(path.get("seconds", 0) / 60.0, 2),
                      "required_capabilities": pois[g["poi"]]["required_capabilities"],
                      "day_equivalent_playtime": "NOT_TESTED"})
    # Outpost logistics: hubs as return points.
    outposts = []
    for nid, n in nodes.items():
        if n["kind"] != "hub":
            continue
        path = shortest(adj, edges, "node_refuge", nid, late)
        nearest = []
        for sid, s in sites.items():
            sp = shortest(adj, edges, nid, sid, late)
            if sp["ok"]:
                nearest.append((sp["tiles"], sid, s["material_key"]))
        nearest.sort()
        outposts.append({"hub": nid, "cell": n["cell"], "region": next((p["region_id"] for p in plan["pois"] if p["poi_id"] == nid), None),
                         "from_spawn_tiles": round(path.get("tiles", 0), 2), "from_spawn_minutes": round(path.get("seconds", 0) / 60.0, 2),
                         "nearest_sites": [{"site": sid, "material": mat, "round_trip_minutes": round(seconds(t * 2) / 60.0, 2)} for t, sid, mat in nearest[:3]]})
    # Alternate-route detours when a trunk edge is cut.
    alternates = []
    for rid, a, b in [("rt_crown_frost", "node_refuge", "node_frost"), ("rt_frost_coast", "node_frost", "node_glasswind"),
                      ("rt_ember_mere", "node_ember", "node_mirrormere"), ("rt_saffron_pearl", "node_saffron", "node_pearl")]:
        base_path = shortest(adj, edges, a, b, late)
        cut_path = shortest(adj, edges, a, b, late, skip_edge=rid)
        alternates.append({"cut_edge": rid, "from": a, "to": b, "base_minutes": round(base_path.get("seconds", 0) / 60.0, 2),
                           "alternate_minutes": round(cut_path.get("seconds", 0) / 60.0, 2) if cut_path["ok"] else None,
                           "alternate_exists": cut_path["ok"],
                           "detour_minutes": round((cut_path.get("seconds", 0) - base_path.get("seconds", 0)) / 60.0, 2) if cut_path["ok"] else None})
    renewal = defaultdict(int)
    for s in plan["resource_sites"]:
        renewal[s["material_key"]] += s["placed_count"]
    report = {
        "schema": "soh.world.pacing_analysis.v1",
        "status": "AUTHORED_ESTIMATE_NOT_PLAYTESTED",
        "travel_model": {"tile_px": TILE_PX, "speed_px_s": SPEED_PX_S,
                         "route_polylines": "authored", "site_links": "straight-line detour estimate to nearest hub",
                         "boat_speed": "NOT_AUTHORED; foot-equivalent lower bound used"},
        "capability_bootstrap_policy": "source POI grants starter capability/recipe on first visit; material sites model sustain/repair after grant",
        "playtime_claim": "NOT_TESTED", "combat_crafting_gathering_seconds": "NOT_TESTED",
        "journeys": journeys, "post_14d_goals": goals, "outpost_logistics": outposts,
        "alternate_route_detours": alternates,
        "revisit_value": {"long_run_goals": len(goals), "resource_sites": len(sites),
                          "renewal_policies": sorted({s["renewal"] if "renewal" in s else plan["materials"][s["material_key"]][4] for s in sites.values()}),
                          "poi_restock_policy": "outer caches restock; specimen vault one-time until world-state change",
                          "region_revisit_hooks": {r["region_id"]: r["revisit_hook"] for r in plan["regions"]}},
        "scale_caveat": "POI count and ideal straight crossing do not prove fourteen-day depth; these are bounded travel/preparation estimates only.",
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "pacing_analysis.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    DOC.mkdir(parents=True, exist_ok=True)
    lines = ["# SURV-050A Pacing / Scale Audit", "",
             "Status: `AUTHORED_ESTIMATE_NOT_PLAYTESTED`", "",
             "Travel is foot-equivalent at 96 px/s along authored polylines; resource-site links are straight-line detour estimates. Combat, crafting, gathering animation, inventory management and day-equivalent playtime are **NOT_TESTED**. Capability source POIs grant a starter capability/recipe on first visit; material runs model sustain/repair after the grant.", "",
             "## Concrete journeys", "",
             "| Journey | Route tiles | Travel min | Detour ratio | Hazard exposure (tiles) | Grants |",
             "|---|---:|---:|---:|---|---|"]
    for j in journeys:
        if not j.get("ok"):
            lines.append(f"| {j['journey']} | FAILED | - | - | - | {j.get('reason')} |")
            continue
        hz = ", ".join(f"{k}:{v['tiles']}" for k, v in j.get("hazard_exposure", {}).items()) or "none"
        grants = ", ".join(g["poi"] for g in j.get("grants", [])) or "-"
        lines.append(f"| {j['journey']} | {j.get('total_tiles', j.get('travel_tiles_estimate'))} | {j.get('total_minutes', j.get('travel_minutes_estimate'))} | {j.get('detour_ratio', '-')} | {hz} | {grants} |")
    lines += ["", "## Early legacy home loop", "",
              f"Shelter: {journeys[0]['shelter']}. Cost: {journeys[0]['cost']}. Node visits: {len(journeys[0]['node_visits'])}. Gather hits: {journeys[0]['gather_hits_total']}. Grid travel estimate: {journeys[0]['travel_minutes_estimate']} min. Respawn revisit: {journeys[0]['respawn_revisit_seconds']}. Gathering/crafting seconds NOT_TESTED.", "",
              "## Post-14d goals (travel only, not day-count proof)", "",
              "| Goal | POI | Reachable late | Travel min | Required caps |",
              "|---|---|---|---:|---|"]
    for g in goals:
        lines.append(f"| {g['goal_id']} | {g['poi']} | {g['reachable_with_late_caps']} | {g['travel_minutes']} | {', '.join(g['required_capabilities'])} |")
    lines += ["", "## Outpost logistics", "",
              "| Hub | From spawn min | Nearest site round-trip min |",
              "|---|---:|---|"]
    for o in outposts:
        nearest = "; ".join(f"{s['site']}:{s['round_trip_minutes']}" for s in o["nearest_sites"])
        lines.append(f"| {o['hub']} | {o['from_spawn_minutes']} | {nearest} |")
    lines += ["", "## Alternate-route detours", "",
              "| Cut edge | Base min | Alternate min | Detour min |",
              "|---|---:|---:|---:|"]
    for a in alternates:
        lines.append(f"| {a['cut_edge']} | {a['base_minutes']} | {a['alternate_minutes']} | {a['detour_minutes']} |")
    lines += ["", "## Revisit value and caveat", "",
              f"{len(goals)} post-14d goals, {len(sites)} resource sites with authored renewal policies, outer-cache restock vs one-time specimen vaults, and per-region revisit hooks are present. This does **not** prove fourteen-day playtime. Native pacing, hazard damage, recipe yields, combat and inventory friction remain separate A0/A3/A6 integration gates.", ""]
    (DOC / "PACING_ANALYSIS.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"ok": all(j.get("ok") for j in journeys), "journeys": len(journeys),
                      "failed": [j["journey"] for j in journeys if not j.get("ok")],
                      "output": str(OUT / "pacing_analysis.json")}))
    return report


if __name__ == "__main__":
    run()
