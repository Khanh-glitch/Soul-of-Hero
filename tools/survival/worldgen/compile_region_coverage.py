#!/usr/bin/env python3
"""Source-to-scene coverage + window navigation audit for the regional art bundle.

Machine-readable matrix tying every planned region/biome/resource/hazard family
to a compiled visual window, canonical anchors and observable player decisions.
Also runs a data-level BFS inside each window (approach -> landmark -> retreat)
and checks water cells are not walkable. This is NOT Godot physical acceptance;
A0 must still verify CharacterBody2D collision, chunk seams and streaming.
"""
from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from compile_world_art import Layers, load_plan, ROOT, WORLD, ART, load, sha

DECISIONS = {
    "r_ashen_crown": ["read notes crate vs scrap cache", "return to Waystation before dark"],
    "r_amberwood": ["tended garden vs wild herb margin", "orchard rows mark safe foraging"],
    "r_frost_crown": "cold ridge vs sheltered shrine court; skarn ore rewards thermal prep".split("; "),
    "r_mirrormere": ["boardwalk/causeway vs open water", "reed/clay shallows vs ferry shortcut"],
    "r_glasswind_coast": ["sheltered dune approach vs exposed cliff", "silica placer after storm"],
    "r_ember_steppe": ["lee road vs fumarole gas", "forge salvage requires filter/power"],
    "r_saffron_coast": ["shade/well route vs open salt glare", "dry-wind salt harvest timing"],
    "r_verdant_fold": ["canopy terrace vs spore hollow", "climb/filter before temple vault"],
    "r_pearl_mangroves": ["stilt walk vs tidal channel", "tide gauge before boat-dependent customs"],
    "r_sunken_orchard": ["karst terrace vs cenote rim", "surface orchard vs deepward conduit"],
    "r_ashwater_fen": ["boardwalk vs toxic pool", "pump station requires filter; bleached reeds warn"],
}


def bfs(walk, start, goal):
    if start not in walk or goal not in walk:
        return None
    q = deque([start])
    seen = {start: None}
    while q:
        c = q.popleft()
        if c == goal:
            path = []
            while c is not None:
                path.append(c)
                c = seen[c]
            return list(reversed(path))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c[0] + dx, c[1] + dy)
            if n in walk and n not in seen:
                seen[n] = c
                q.append(n)
    return None


def main() -> dict:
    plan = load_plan()
    layers = Layers(plan)
    index = load(ART / "presentations.v1.json")
    docs = {load(ROOT / e["path"])["region_id"]: load(ROOT / e["path"]) for e in index["presentations"]}
    rows = []
    errors = []
    for r in plan["regions"]:
        rid = r["region_id"]
        doc = docs.get(rid)
        sites = [s for s in plan["resource_sites"] if s["region_id"] == rid]
        hazards = [h for h in plan["hazards"] if h["region_id"] == rid]
        pois = [p for p in plan["pois"] if p["region_id"] == rid]
        row = {
            "region_id": rid, "name": r["name"], "band": r["band"],
            "biomes": r["primary_biomes"], "entry_capabilities": r["entry_capabilities"],
            "resource_sites": [s["site_id"] for s in sites],
            "resource_node_count": sum(1 for n in plan["resource_nodes"] if n["region_id"] == rid),
            "hazards": [{"id": h["hazard_id"], "kind": h["kind"], "clue": h["clue"], "requires": h["requires"]} for h in hazards],
            "poi_count": len(pois),
            "presentation": doc["treatment_id"] if doc else None,
            "presentation_sha256": sha(ROOT / "data/survival/world/art/compiled" / f"{doc['treatment_id']}.presentation.v1.json") if doc else None,
            "player_decisions": DECISIONS.get(rid, []),
            "status": "VISUAL_WINDOW_AUTHORED_NOT_192_CHUNK_FILL" if doc else "MISSING_VISUAL_WINDOW",
        }
        if doc is None:
            errors.append(f"missing visual window for {rid}")
        else:
            ox, oy = doc["window"]["origin_cell"]
            w, h = doc["window"]["size_cells"]
            walk = set()
            water_walkable = 0
            for y in range(oy, oy + h):
                for x in range(ox, ox + w):
                    if layers.value([x, y], "walk") == 1:
                        walk.add((x, y))
                    if layers.surface_name([x, y]) == "water" and layers.value([x, y], "walk") == 1:
                        water_walkable += 1
            lm = next((p for p in doc["props"] if p.get("poi_id")), None)
            nav = {"water_walkable_cells": water_walkable}
            def nearest_walk(c, radius=6):
                c = tuple(c)
                if c in walk:
                    return c
                best = None
                for dy in range(-radius, radius + 1):
                    for dx in range(-radius, radius + 1):
                        n = (c[0] + dx, c[1] + dy)
                        if n in walk:
                            d = abs(dx) + abs(dy)
                            if best is None or d < best[0]:
                                best = (d, n)
                return best[1] if best else None
            if lm:
                goal = nearest_walk(lm["cell"])
                view = nearest_walk(doc["capture_views"][0]["center_cell"])
                path = bfs(walk, view, goal) if view and goal else None
                nav["approach_to_landmark_cells"] = len(path) if path else None
                # retreat: nearest window-edge walkable cell reachable from landmark
                edge = [c for c in walk if c[0] in (ox, ox + w - 1) or c[1] in (oy, oy + h - 1)]
                best = None
                for e in edge:
                    pth = bfs(walk, goal, e) if goal else None
                    if pth and (best is None or len(pth) < best):
                        best = len(pth)
                nav["landmark_to_retreat_cells"] = best
                nav["approach_reachable"] = path is not None
                nav["retreat_reachable"] = best is not None
                if path is None or best is None:
                    errors.append(f"window navigation broken {rid}")
            if water_walkable:
                errors.append(f"walkable source water in {rid}; visual water would mislead")
            row["window_navigation"] = nav
        rows.append(row)
    out = {"schema": "soh.world.region_coverage_matrix.v1", "owner": "A1",
           "status": "SOURCE_TO_SCENE_DATA_AUDIT_NOT_NATIVE", "regions": rows,
           "coverage": {"planned_regions": len(plan["regions"]), "visual_windows": len(docs),
                        "biome_ids": len(plan["biomes"]), "chunk_fill_claimed": False},
           "errors": errors, "ok": not errors}
    (ART / "region_coverage_matrix.v1.json").write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    return {"ok": out["ok"], "regions": len(rows), "errors": errors,
            "path": "data/survival/world/art/region_coverage_matrix.v1.json"}


if __name__ == "__main__":
    r = main()
    print(json.dumps(r, sort_keys=True))
    raise SystemExit(0 if r["ok"] else 1)
