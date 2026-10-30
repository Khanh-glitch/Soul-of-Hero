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
    "lm_waystation": "major_waystation", "whetstone": "major_waystation", "log_pile": "major_waystation",
    "tarp_shelter": "background_scenery", "fence_h": "background_scenery", "fence_v": "background_scenery",
    "tree_amber": "background_scenery", "tree_orchard": "ordinary_harvestable", "tree_frost": "background_scenery",
    "tree_frost_small": "background_scenery", "fern": "background_scenery", "reeds": "background_scenery",
    "herb_moonleaf": "ordinary_harvestable", "ore_skarn": "ordinary_harvestable", "cairn": "background_scenery",
    "lm_amber_apothecary": "authored_landmark", "lm_amber_watch": "authored_landmark", "lm_frost_shrine": "authored_landmark",
    "mill_wheel": "authored_landmark", "deadfall": "ordinary_harvestable", "stump": "ordinary_harvestable",
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


def in_rect(cell: list[int], r: list[int]) -> bool:
    return r[0] <= cell[0] < r[0] + r[2] and r[1] <= cell[1] < r[1] + r[3]


def compile_ground(src: dict, layers: Layers, atlas: dict, corridor: dict | None) -> tuple[dict, list[dict], set[tuple[int, int]]]:
    ox, oy = src["window"]["origin_cell"]
    w, h = src["window"]["size_cells"]
    rules = src["ground_rules"]
    profile = src["biome_profile"]
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
    mats: dict[tuple[int, int], str] = {}
    for y in range(oy, oy + h):
        for x in range(ox, ox + w):
            c = (x, y)
            surf = layers.value([x, y], "surface")
            mat = SURFACE_MATERIAL.get(surf, "moor")
            # Biome identity is authored, not a generic recolor: the same source
            # surface reads as ash in the Crown and snow in the Frost Crown.
            if profile == "ashen_crown" and mat in ("moor", "grass", "forest"):
                mat = "ash" if h01(x // 6, y // 6, 11) < 0.78 else "moor"
            elif profile == "amberwood" and mat in ("moor", "grass"):
                mat = "forest" if h01(x // 6, y // 6, 17) < 0.35 else "grass"
            elif profile == "frost_crown":
                if mat in ("forest", "grass", "moor"):
                    mat = "snow" if h01(x // 5, y // 5, 13) < 0.72 else "tundra"
                elif mat == "ash":
                    mat = "basalt"
            for key in ("court_rects", "layby_rects", "garden_rects", "shrine_court_rects"):
                for rr in rules.get(key, []):
                    if in_rect([x, y], rr["rect"]):
                        mat = {"stone_court": "court"}.get(rr["material"], rr["material"])
            if c in road_cells:
                mat = "road"
            mats[c] = mat
    radius = int(rules.get("blend_radius_cells", 0))
    if radius:
        for c, mat in list(mats.items()):
            if mat in ("road", "court", "water"):
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
            if mat == "road":
                frame = f"road_{'stone' if stone else 'dirt'}_{road_mask(road_cells, c)}"
            elif mat == "court":
                frame = f"court_{v}"
            else:
                frame = f"{mat}_{v if mat not in ('water', 'ice') else v % 3}"
                # corner blend toward a supported neighbouring material
                neighbours = [mats.get((x + dx, y + dy), mat) for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
                counts: dict[str, int] = {}
                for n in neighbours:
                    if n != mat and n not in ("road", "court"):
                        counts[n] = counts.get(n, 0) + 1
                if counts:
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
                        overlays.append({"frame": f"bank_{land}", "cell": [x, y]})
            if frame not in atlas["terrain"]:
                raise ValueError(f"missing terrain frame {frame}")
            row.append(frame)
        rows.append(row)
    return {"origin_cell": [ox, oy], "size_cells": [w, h], "rows": rows}, overlays, road_cells


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
                if n["cell"] != raw["cell"] or n["site_id"] != anchor.get("resource_site_id") or n["region_id"] != src["region_id"]:
                    raise ValueError(f"harvestable visual does not match canonical node: {raw['node_id']}")
            if frame.startswith("lm_") and anchor.get("poi_id"):
                p = pois[anchor["poi_id"]]
                if p["cell"] != raw["cell"] or p["region_id"] != src["region_id"]:
                    raise ValueError(f"landmark visual does not match canonical POI anchor: {frame}")
            props.append({"id": f"study:{raw['cell'][0]},{raw['cell'][1]}:{frame}", "frame": frame, "cell": raw["cell"],
                          "role": role, "source": "biome_study", "collision_change": False,
                          **({"node_id": raw["node_id"]} if "node_id" in raw else {}),
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
    ground, overlays, road_cells = compile_ground(src, layers, atlas, corridor)
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
        "props": props, "lights": lights, "capture_views": src["capture_views"],
        "ambient_day": profile["ambient_day"], "ambient_night": profile["ambient_night"],
        "counts": {"ground_cells": ground["size_cells"][0] * ground["size_cells"][1], "props": len(props),
                   "lights": len(lights), "overlays": len(overlays), "road_cells": len(road_cells)},
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
