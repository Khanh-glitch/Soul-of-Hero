#!/usr/bin/env python3
"""Compile A1 visual-only world art treatments into runtime presentation data.

Inputs are the accepted corridor/chunk/plan plus A1 art grammar/atlas/treatments.
Output never contains collision, stand, reward, save or interaction authority.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from compile_slice import TILE, load_plan, write_json

ROOT = Path(__file__).resolve().parents[3]
WORLD = ROOT / "data/survival/world"
ART = WORLD / "art"
OUT = ART / "compiled"
SCHEMA = "soh.world.art_presentation.v1"

SURFACE_MATERIAL = {
    0: "grass", 1: "moor", 2: "gravel", 3: "basalt", 4: "snow", 5: "forest",
    6: "tundra", 7: "soil", 8: "water", 9: "ash", 10: "basalt", 11: "snow",
    12: "grass", 13: "basalt", 14: "moor", 15: "forest", 16: "soil",
    17: "grass", 18: "moor", 19: "soil", 20: "gravel", 21: "moor",
}
FRAME_ROLE = {
    "signpost": "return_route", "handcart": "return_route", "banner": "return_route", "lamp": "major_waystation",
    "wall_stub": "restricted_access", "column_broken": "restricted_access", "cairn_warning": "physical_danger",
    "tree_dead": "background_scenery", "tree_pine": "background_scenery", "bush": "background_scenery",
    "rock_a": "background_scenery", "rock_c": "background_scenery", "rock_e": "physical_danger",
    "cache_closed": "supply_cache", "cache_open": "supply_cache", "cache_spent": "supply_cache",
    "cache_notes": "supply_cache", "cache_notes_open": "supply_cache",
    "lm_waystation": "major_waystation", "whetstone": "major_waystation", "log_pile": "major_waystation",
    "tarp_shelter": "background_scenery", "fence_h": "background_scenery", "fence_v": "background_scenery",
    "tree_amber": "background_scenery", "tree_orchard": "ordinary_harvestable", "tree_frost": "background_scenery",
    "tree_frost_small": "background_scenery", "fern": "background_scenery", "reeds": "background_scenery",
    "herb_moonleaf": "ordinary_harvestable", "ore_skarn": "ordinary_harvestable", "cairn": "background_scenery",
    "lm_amber_apothecary": "authored_landmark", "lm_amber_watch": "authored_landmark", "lm_frost_shrine": "authored_landmark",
    "mill_wheel": "authored_landmark", "deadfall": "ordinary_harvestable", "stump": "ordinary_harvestable",
    "lm_quarry_workface": "authored_landmark", "lm_orchard_shed": "authored_landmark", "lm_mill_house": "authored_landmark",
    "drying_rack": "background_scenery", "beehive": "ordinary_harvestable", "snow_drift": "background_scenery",
    "split_rail": "background_scenery",
    "mangrove_tree": "background_scenery", "reed_bed": "background_scenery", "dock_small": "return_route",
    "ferry_boat": "return_route", "fish_trap": "background_scenery", "forge_slag_heap": "background_scenery",
    "pipe_run": "background_scenery", "vent_stack": "physical_danger", "cooling_trough": "background_scenery",
    "canopy_tree": "background_scenery", "understory_fern": "background_scenery", "root_arch": "background_scenery",
    "liana_curtain": "background_scenery", "karst_boulder": "background_scenery", "salt_heap": "background_scenery",
    "shade_sail": "background_scenery", "keeper_shed": "background_scenery", "storm_glass_cluster": "background_scenery",
    "driftwood_pile": "background_scenery", "cenote_steps": "return_route", "orchard_wall": "background_scenery",
    "lantern_post": "return_route", "pier_rail": "return_route", "warning_stakes": "physical_danger",
    "tide_gauge_large": "physical_danger", "pump_tank": "background_scenery", "spore_mushroom": "physical_danger",
}


def load(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def h01(*vals: int) -> float:
    h = 2166136261
    for v in vals:
        h ^= int(v) & 0xFFFFFFFF
        h = (h * 16777619) & 0xFFFFFFFF
    h ^= h >> 16; h = (h * 0x85EBCA6B) & 0xFFFFFFFF; h ^= h >> 13
    return (h & 0xFFFFFF) / 0xFFFFFF


class Layers:
    def __init__(self, plan: dict):
        self.plan = plan
        self.size = plan["chunk_size"]
        self.manifest = {m["chunk_id"]: m for m in plan["chunk_manifest"]}
        self.cache: dict[str, dict] = {}

    def chunk(self, cell: list[int]) -> dict:
        cid = f"chunk:{cell[0] // self.size}:{cell[1] // self.size}"
        if cid not in self.cache:
            c = load(WORLD / self.manifest[cid]["path"])
            layers = {}
            for name, runs in c["layers"].items():
                vals: list[int] = []
                for v, n in runs:
                    vals.extend([int(v)] * int(n))
                layers[name] = vals
            c["_layers"] = layers
            self.cache[cid] = c
        return self.cache[cid]

    def surface_name(self, cell: list[int]) -> str:
        c = self.chunk(cell)
        v = self.value(cell, "surface")
        legend = c.get("legend", {}).get("surface", [])
        return legend[v - 1] if 1 <= v <= len(legend) else "legacy"

    def value(self, cell: list[int], layer: str) -> int:
        c = self.chunk(cell)
        ox, oy = c["origin"]
        x, y = cell[0] - ox, cell[1] - oy
        if not (0 <= x < c["size"][0] and 0 <= y < c["size"][1]):
            raise ValueError(f"cell {cell} outside chunk {c['chunk_id']}")
        return c["_layers"][layer][y * c["size"][0] + x]


def road_mask(cells: set[tuple[int, int]], cell: tuple[int, int]) -> int:
    x, y = cell
    m = 0
    if (x, y - 1) in cells: m |= 1
    if (x + 1, y) in cells: m |= 2
    if (x, y + 1) in cells: m |= 4
    if (x - 1, y) in cells: m |= 8
    return m


def spine_cells(rules: dict, road_cells: set[tuple[int, int]]) -> set[tuple[int, int]]:
    """Rasterize authored orthogonal pier/causeway spines inside source roads."""
    cells: set[tuple[int, int]] = set()
    for path in rules.get("pier_spines", []):
        pts = path.get("points", [])
        if len(pts) < 2:
            raise ValueError(f"pier spine {path.get('id')} needs at least two points")
        for a, b in zip(pts, pts[1:]):
            x, y = a
            x2, y2 = b
            if x != x2 and y != y2:
                raise ValueError(f"pier spine {path.get('id')} must be orthogonal: {a}->{b}")
            dx = (x2 > x) - (x2 < x)
            dy = (y2 > y) - (y2 < y)
            while True:
                c = (x, y)
                if c not in road_cells:
                    raise ValueError(f"pier spine {path.get('id')} leaves source road at {c}")
                cells.add(c)
                if (x, y) == (x2, y2):
                    break
                x += dx; y += dy
    return cells


def in_rect(cell: list[int], r: list[int]) -> bool:
    return r[0] <= cell[0] < r[0] + r[2] and r[1] <= cell[1] < r[1] + r[3]


def in_shape(cell: tuple[int, int], shape: dict) -> bool:
    """Authored macro-terrain footprint. No noise decides material boundaries."""
    x, y = cell
    kind = shape["type"]
    if kind == "rect":
        return in_rect([x, y], shape["rect"])
    if kind == "ellipse":
        cx, cy = shape["center"]
        rx, ry = shape["radii"]
        if rx <= 0 or ry <= 0:
            return False
        return ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0
    if kind == "polygon":
        pts = shape["points"]
        inside = False
        j = len(pts) - 1
        for i in range(len(pts)):
            xi, yi = pts[i]
            xj, yj = pts[j]
            if (yi > y + 0.5) != (yj > y + 0.5):
                slope = (xj - xi) * (y + 0.5 - yi) / (yj - yi) + xi
                if x + 0.5 < slope:
                    inside = not inside
            j = i
        return inside
    raise ValueError(f"unknown landform shape {kind}")


def base_material(profile: str, surf: int) -> str:
    mat = SURFACE_MATERIAL.get(surf, "moor")
    if profile == "ashen_crown":
        return "ash" if mat in ("moor", "grass", "forest") else mat
    if profile == "amberwood":
        return "grass" if mat == "moor" else mat
    if profile == "frost_crown":
        if mat in ("forest", "grass", "moor"):
            return "snow"
        if mat == "ash":
            return "basalt"
    return mat


def compile_ground(src: dict, layers: Layers, atlas: dict, corridor: dict | None) -> tuple[dict, list[dict], set[tuple[int, int]], list[dict]]:
    ox, oy = src["window"]["origin_cell"]
    w, h = src["window"]["size_cells"]
    rules = src["ground_rules"]
    profile = src["biome_profile"]
    landforms = rules.get("landforms", [])
    if not landforms:
        raise ValueError(f"{src.get('treatment_id', src.get('study_id'))} has no causal landforms")
    road_cells: set[tuple[int, int]] = set()
    if corridor is not None:
        for d in corridor["detail_overlay"]:
            if d["token"].startswith(rules.get("road_from_corridor_detail", "=")):
                road_cells.add(tuple(d["cell"]))
    elif rules.get("road_from_source_road"):
        for y in range(oy, oy + h):
            for x in range(ox, ox + w):
                if layers.value([x, y], "road") != 0:
                    road_cells.add((x, y))
    maintained = spine_cells(rules, road_cells)
    mats: dict[tuple[int, int], str] = {}
    bio_names = sorted(layers.plan["biomes"])
    biome_mat = rules.get("biome_materials", {})
    for y in range(oy, oy + h):
        for x in range(ox, ox + w):
            surf = layers.value([x, y], "surface")
            if rules.get("use_source_legend"):
                sname = layers.surface_name([x, y])
                mat = {"grass": "grass", "moor": "moor", "gravel": "gravel", "floor": "silt",
                       "snow": "snow", "forest": "forest", "tundra": "tundra", "sand": "dune",
                       "water": rules.get("water_material", "lake"), "ash": "ash", "badland": "cinder", "salt": "salt",
                       "jungle": "jungle", "karst": "karst", "marsh": "reedpeat", "mangrove": "mangrove",
                       "mud": "mud", "orchard": "soil", "bog": "fen", "road": "soil",
                       "bridge": "gravel", "legacy": "gravel"}.get(sname, "gravel")
            else:
                mat = base_material(profile, surf)
            if biome_mat and not (rules.get("use_source_legend") and layers.surface_name([x, y]) == "water"):
                bi = layers.value([x, y], "biome")
                if 1 <= bi <= len(bio_names):
                    mat = biome_mat.get(bio_names[bi - 1], mat)
            mats[(x, y)] = mat
    # Causal macro-terrain: each patch is an authored landform with a reason and
    # source reference (caldera fan, drainage, terrace, cirque, skarn, court...).
    report: list[dict] = []
    for lf in landforms:
        mat = {"stone_court": "court"}.get(lf["material"], lf["material"])
        count = 0
        for y in range(oy, oy + h):
            for x in range(ox, ox + w):
                if in_shape((x, y), lf["shape"]):
                    if rules.get("preserve_source_water") and layers.surface_name([x, y]) == "water":
                        continue
                    mats[(x, y)] = mat
                    count += 1
        if count == 0:
            raise ValueError(f"landform {lf['id']} paints no cells in window")
        report.append({"id": lf["id"], "material": mat, "cells": count,
                       "reason": lf["reason"], "source_refs": lf.get("source_refs", [])})
    # Legacy rect rules remain supported, but are now just explicit landforms.
    for key in ("court_rects", "layby_rects", "garden_rects", "shrine_court_rects"):
        for rr in rules.get(key, []):
            mat = {"stone_court": "court"}.get(rr["material"], rr["material"])
            count = 0
            for y in range(oy, oy + h):
                for x in range(ox, ox + w):
                    if in_rect([x, y], rr["rect"]):
                        mats[(x, y)] = mat
                        count += 1
            report.append({"id": f"{key}:{rr['rect']}", "material": mat, "cells": count,
                           "reason": "authored maintained surface", "source_refs": []})
    # Impassable source mass reads as rock, never as a new invisible wall.
    mass = rules.get("impassable_mass_material")
    if mass:
        for y in range(oy, oy + h):
            for x in range(ox, ox + w):
                if layers.value([x, y], "walk") == 0 and mats[(x, y)] != "water":
                    mats[(x, y)] = mass
    radius = int(rules.get("blend_radius_cells", 0))
    if radius:
        for c, mat in list(mats.items()):
            if mat in ("court", "water"):
                continue
            near = any(abs(c[0] - r[0]) <= radius and abs(c[1] - r[1]) <= radius for r in road_cells)
            if near and mat not in ("snow", "basalt", "ice"):
                mats[c] = "soil"
    blends = {}
    for name in atlas["terrain"]:
        if name.startswith("blend_"):
            parts = name.split("_")
            blends[(parts[1], parts[2])] = True
    rows: list[list[str]] = []
    overlays: list[dict] = []
    stone = profile == "frost_crown"
    for y in range(oy, oy + h):
        row = []
        for x in range(ox, ox + w):
            c = (x, y)
            mat = mats[c]
            v = int(h01(x, y, 7) * 4) % 4
            if c in road_cells:
                # Source road/walk cells stay authoritative. New regional scenes
                # draw narrow maintained spines; the remaining broad road cells
                # get transparent wear, never an opaque plank/crosshatch carpet.
                if rules.get("use_source_legend"):
                    road_style = rules.get("road_style", "dirt")
                    sname = layers.surface_name([x, y])
                    over_water = sname in ("water", "bridge")
                    rm = road_mask(road_cells, c)
                    on_spine = c in maintained
                    base_mat = mats.get(c, "soil")
                    if over_water:
                        frame = f"{rules.get('water_material', 'lake')}_{v}" if sname == "water" else f"gravel_{v}"
                    else:
                        frame = f"{base_mat}_{v}"
                    if road_style in ("boardwalk", "pier"):
                        if over_water or on_spine:
                            orient = "ns" if rm in (1, 4, 5) else "ew" if rm in (2, 8, 10) else "junction"
                            if rm == 1: orient = "end_s"
                            elif rm == 4: orient = "end_n"
                            elif rm == 2: orient = "end_w"
                            elif rm == 8: orient = "end_e"
                            bf = f"pier_{orient}_{int(h01(x, y, 31) * 3) % 3}"
                            overlays.append({"frame": bf, "cell": [x, y], "layer": "boardwalk"})
                        else:
                            overlays.append({"frame": f"track_dirt_{rm}", "cell": [x, y], "layer": "road"})
                    elif road_style == "causeway":
                        if over_water or on_spine:
                            orient = "ns" if rm in (1, 4, 5) else "ew" if rm in (2, 8, 10) else "ns"
                            cf = f"causeway_{orient}_{int(h01(x, y, 37) * 4) % 4}"
                            overlays.append({"frame": cf, "cell": [x, y], "layer": "causeway"})
                        else:
                            overlays.append({"frame": f"track_stone_{rm}", "cell": [x, y], "layer": "road"})
                    else:
                        overlays.append({"frame": f"track_{'stone' if road_style == 'stone' else 'dirt'}_{rm}",
                                         "cell": [x, y], "layer": "road"})
                else:
                    base = "gravel" if stone else "soil"
                    frame = f"{base}_{v}"
                    overlays.append({"frame": f"road_{'stone' if stone else 'dirt'}_{road_mask(road_cells, c)}",
                                     "cell": [x, y], "layer": "road"})
            elif mat == "court":
                frame = f"court_{v}"
            else:
                frame = f"{mat}_{v if mat not in ('water', 'ice') else v % 3}"
                if rules.get("use_region_mix"):
                    cmask = 0
                    others: dict[str, int] = {}
                    for (dx, dy), bit in (((0, -1), 1), ((1, 0), 2), ((0, 1), 4), ((-1, 0), 8)):
                        n = mats.get((x + dx, y + dy), mat)
                        if n != mat:
                            cmask |= bit
                            others[n] = others.get(n, 0) + 1
                    if cmask and others:
                        other = max(others, key=lambda k: others[k])
                        if mat in ("lake", "river", "tidal", "cenote", "water") and other not in ("lake", "river", "tidal", "cenote", "water"):
                            cf = f"coast_{other}_{mat}_{cmask}"
                            if cf in atlas["terrain"]:
                                frame = cf
                        else:
                            mf = f"mix_{mat}_{other}_{cmask}"
                            if mf in atlas["terrain"]:
                                frame = mf
                # Cardinal feathered shore first: a single differing cardinal
                # neighbour gets a clean 3px edge band instead of a blocky step.
                cardinal = [((0, -1), 1), ((1, 0), 2), ((0, 1), 4), ((-1, 0), 8)]
                diffs = []
                for (dx, dy), bit in cardinal:
                    n = mats.get((x + dx, y + dy), mat)
                    if n != mat and n != "court":
                        diffs.append((bit, n))
                applied_shore = False
                if len(diffs) == 1:
                    bit, other = diffs[0]
                    sf = f"shore_{mat}_{other}_{bit}"
                    if sf in atlas["terrain"]:
                        frame = sf
                        applied_shore = True
                neighbours = [mats.get((x + dx, y + dy), mat) for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
                counts: dict[str, int] = {}
                for n in neighbours:
                    if n != mat and n not in ("court",):
                        counts[n] = counts.get(n, 0) + 1
                if counts and not applied_shore:
                    other = max(counts, key=lambda k: counts[k])
                    if (mat, other) in blends:
                        mask = sum(1 << i for i, n in enumerate(neighbours) if n == other)
                        frame = f"blend_{mat}_{other}_{mask}"
                if mat == "water":
                    land = 0
                    if layers.value([x, y - 1], "surface") != 8: land |= 1
                    if layers.value([x + 1, y], "surface") != 8: land |= 2
                    if layers.value([x, y + 1], "surface") != 8: land |= 4
                    if layers.value([x - 1, y], "surface") != 8: land |= 8
                    if land:
                        overlays.append({"frame": f"bank_{land}", "cell": [x, y], "layer": "bank"})
            if frame not in atlas["terrain"]:
                raise ValueError(f"missing terrain frame {frame}")
            row.append(frame)
        rows.append(row)
    # Authored ecological micro-detail clusters: transparent decals inside causal
    # material patches, not noise-driven biome boundaries or reward objects.
    detail: list[dict] = []
    for cluster in rules.get("detail_clusters", []):
        kind = cluster["kind"]
        allowed = set(cluster.get("materials", []))
        density = float(cluster.get("density", 0.18))
        seed = int(cluster.get("seed", 101))
        for y in range(oy, oy + h):
            for x in range(ox, ox + w):
                c = (x, y)
                if not in_shape(c, cluster["shape"]):
                    continue
                if allowed and mats.get(c) not in allowed:
                    continue
                if h01(x, y, seed) >= density:
                    continue
                frame = f"detail_{kind}_{int(h01(x, y, seed + 1) * 3) % 3}"
                if frame not in atlas["terrain"]:
                    raise ValueError(f"missing detail frame {frame}")
                detail.append({"frame": frame, "cell": [x, y], "layer": "detail", "cluster": cluster["id"]})
    return {"origin_cell": [ox, oy], "size_cells": [w, h], "rows": rows}, detail + overlays, road_cells, report


def frame_role(frame: str, grammar: dict) -> str:
    role = FRAME_ROLE.get(frame)
    if role is None:
        raise ValueError(f"no semantic role for frame {frame}")
    if frame not in grammar["semantic_roles"][role]["frames"]:
        raise ValueError(f"frame {frame} not admitted by role {role}")
    return role


def compile_props(src: dict, atlas: dict, grammar: dict, layers: Layers, corridor: dict | None, plan: dict) -> list[dict]:
    props: list[dict] = []
    ox, oy = src["window"]["origin_cell"]
    w, h = src["window"]["size_cells"]

    def check_cell(cell: list[int]) -> None:
        if not (ox <= cell[0] < ox + w and oy <= cell[1] < oy + h):
            raise ValueError(f"prop cell {cell} outside treatment window")

    if corridor is not None:
        repl = src.get("replace_corridor_decor", {})
        seen = set()
        for d in corridor["decor"]:
            key = f"{d['cell'][0]},{d['cell'][1]}"
            frame = repl.get(key, d["frame"])
            seen.add(key)
            if frame not in atlas["props"]:
                raise ValueError(f"replacement frame {frame} missing from atlas")
            check_cell(d["cell"])
            props.append({"id": f"decor:{key}", "frame": frame, "cell": d["cell"], "role": frame_role(frame, grammar),
                          "source": "corridor_decor", "replaces": d["frame"], "collision_change": False})
        if set(repl) != seen:
            raise ValueError(f"replace_corridor_decor targets non-decor cells: {sorted(set(repl) - seen)}")
        inst_cells = {i["instance_id"]: i["cell"] for i in corridor["instances"]}
        required = {tuple(c) for c in corridor["route"]["required_nav_cells"]}
        for raw in src.get("add_props", []):
            frame = raw["frame"]
            if frame not in atlas["props"]:
                raise ValueError(f"unknown prop frame {frame}")
            role = raw.get("role") or frame_role(frame, grammar)
            if frame not in grammar["semantic_roles"][role]["frames"]:
                raise ValueError(f"frame {frame} not admitted by role {role}")
            check_cell(raw["cell"])
            if tuple(raw["cell"]) in required and role != "supply_cache":
                raise ValueError(f"visual prop {frame} sits on required nav cell {raw['cell']}")
            if "instance_id" in raw:
                if inst_cells.get(raw["instance_id"]) != raw["cell"]:
                    raise ValueError(f"cache visual does not match canonical instance cell: {raw['instance_id']}")
            props.append({"id": f"add:{raw['cell'][0]},{raw['cell'][1]}:{frame}", "frame": frame, "cell": raw["cell"],
                          "role": role, "source": "treatment", "collision_change": False,
                          **({"instance_id": raw["instance_id"]} if "instance_id" in raw else {}),
                          **({"light": raw["light"]} if "light" in raw else {})})
    else:
        nodes = {n["node_id"]: n for n in plan["resource_nodes"]}
        pois = {p["poi_id"]: p for p in plan["pois"]}
        anchor = src.get("canonical_anchors", {})
        for raw in src.get("add_props", []):
            frame = raw["frame"]
            if frame not in atlas["props"]:
                raise ValueError(f"unknown prop frame {frame}")
            role = raw.get("role") or frame_role(frame, grammar)
            if frame not in grammar["semantic_roles"][role]["frames"]:
                raise ValueError(f"frame {frame} not admitted by role {role}")
            check_cell(raw["cell"])
            if "node_id" in raw:
                n = nodes[raw["node_id"]]
                site = raw.get("site_id") or anchor.get("resource_site_id")
                if n["cell"] != raw["cell"] or n["site_id"] != site or n["region_id"] != src["region_id"]:
                    raise ValueError(f"harvestable visual does not match canonical node: {raw['node_id']}")
            poi_id = raw.get("poi_id") or (anchor.get("poi_id") if frame.startswith("lm_") else None)
            if poi_id:
                p = pois[poi_id]
                if p["cell"] != raw["cell"] or p["region_id"] != src["region_id"]:
                    raise ValueError(f"landmark visual does not match canonical POI anchor: {frame}")
            props.append({"id": f"study:{raw['cell'][0]},{raw['cell'][1]}:{frame}", "frame": frame, "cell": raw["cell"],
                          "role": role, "source": "biome_study", "collision_change": False,
                          **({"node_id": raw["node_id"]} if "node_id" in raw else {}),
                          **({"poi_id": raw["poi_id"]} if "poi_id" in raw else {}),
                          **({"site_id": raw["site_id"]} if "site_id" in raw else {}),
                          **({"light": raw["light"]} if "light" in raw else {})})
    for p in props:
        p["world_px"] = [p["cell"][0] * TILE + 8, p["cell"][1] * TILE + 16]
    return props


def compile_one(src: dict, kind: str, plan: dict, layers: Layers, atlas: dict, grammar: dict) -> dict:
    corridor = None
    pins = {"source_sha256": sha(ART / ("crown_roadside.treatment.v1.json" if kind == "corridor" else "biome_studies.v1.json")),
            "atlas_sha256": sha(ART / "atlas.v1.json"), "grammar_sha256": sha(ART / "world_art_grammar.v1.json")}
    if kind == "corridor":
        cp = WORLD / "corridor/crown_roadside.corridor.v1.json"
        corridor = load(cp)
        if sha(cp) != src["pins"]["corridor_source_sha256"]:
            raise ValueError("corridor pin mismatch; visual treatment must be rebased on accepted corridor")
        if corridor["chunk_id"] != src["pins"]["chunk_id"]:
            raise ValueError("corridor chunk mismatch")
        pins["corridor_sha256"] = sha(cp)
    ground, overlays, road_cells, landform_report = compile_ground(src, layers, atlas, corridor)
    props = compile_props(src, atlas, grammar, layers, corridor, plan)
    lights = []
    profile = grammar["lighting_profiles"][src["lighting_profile"]]
    for p in props:
        if p.get("light") == "warm":
            lights.append({"cell": p["cell"], "world_px": [p["cell"][0] * TILE + 8, p["cell"][1] * TILE + 4],
                           "kind": "warm", "energy": profile["warm_lamp_energy"]})
    tid = src.get("treatment_id") or src["study_id"]
    return {
        "schema": SCHEMA, "treatment_id": tid, "owner": "A1", "kind": kind,
        "status": "VISUAL_ONLY_ISOLATED_PRESENTATION_NOT_PRODUCTION_MOUNT",
        "production_native_playable": False, "tile_px": TILE,
        "region_id": src.get("region_id") or (corridor["region_id"] if corridor else None),
        "biome_profile": src["biome_profile"], "lighting_profile": src["lighting_profile"],
        "authority": src.get("authority", "VISUAL_ONLY_NO_COLLISION_STAND_ECONOMY_CHANGE"),
        "pins": pins, "window": src["window"], "ground": ground, "overlays": overlays,
        "landforms": landform_report, "terrain_method": "AUTHORED_LANDFORMS_ON_SOURCE_SURFACES_NO_NOISE_BOUNDARIES",
        "props": props, "lights": lights, "capture_views": src["capture_views"],
        "ambient_day": profile["ambient_day"], "ambient_night": profile["ambient_night"],
        "counts": {"ground_cells": ground["size_cells"][0] * ground["size_cells"][1], "props": len(props),
                   "lights": len(lights), "overlays": len(overlays), "road_cells": len(road_cells),
                   "road_overlays": sum(1 for o in overlays if o.get("layer") in ("road", "boardwalk", "causeway")),
                   "bank_overlays": sum(1 for o in overlays if o.get("layer") == "bank"),
                   "detail_overlays": sum(1 for o in overlays if o.get("layer") == "detail"),
                   "pier_cells": sum(1 for o in overlays if o.get("layer") == "boardwalk"),
                   "causeway_cells": sum(1 for o in overlays if o.get("layer") == "causeway"),
                   "track_cells": sum(1 for o in overlays if o.get("layer") == "road" and o["frame"].startswith("track_"))},
        "collision_change": False, "stand_change": False, "economy_change": False, "new_poi_count": 0,
    }


def compile_all() -> dict:
    plan = load_plan()
    layers = Layers(plan)
    atlas = load(ART / "atlas.v1.json")
    grammar = load(ART / "world_art_grammar.v1.json")
    OUT.mkdir(parents=True, exist_ok=True)
    outputs = []
    treatment = load(ART / "crown_roadside.treatment.v1.json")
    doc = compile_one(treatment, "corridor", plan, layers, atlas, grammar)
    path = OUT / f"{doc['treatment_id']}.presentation.v1.json"
    write_json(path, doc)
    outputs.append({"treatment_id": doc["treatment_id"], "path": str(path.relative_to(ROOT)), "sha256": sha(path), "counts": doc["counts"]})
    studies = load(ART / "biome_studies.v1.json")
    for study in studies["studies"]:
        doc = compile_one(study, "biome_study", plan, layers, atlas, grammar)
        path = OUT / f"{doc['treatment_id']}.presentation.v1.json"
        write_json(path, doc)
        outputs.append({"treatment_id": doc["treatment_id"], "path": str(path.relative_to(ROOT)), "sha256": sha(path), "counts": doc["counts"]})
    index = {"schema": "soh.world.art_presentations_index.v1", "owner": "A1", "presentations": outputs,
             "atlas_sha256": sha(ART / "atlas.v1.json"), "grammar_sha256": sha(ART / "world_art_grammar.v1.json")}
    write_json(ART / "presentations.v1.json", index)
    return {"ok": True, "presentations": len(outputs), "index": str(ART / "presentations.v1.json")}


if __name__ == "__main__":
    print(json.dumps(compile_all(), sort_keys=True))
