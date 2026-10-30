#!/usr/bin/env python3
"""Compile A1's bounded first-hour roadside corridor and A8 transform review.

Read-only inputs: canonical world plan, chunk 6:3, existing two-POI slices,
inherited SOH art manifests, and A1-authored corridor/A8 review data. This does
not edit the continent, regenerate chunks, set A3 drop rates, or mount production.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from compile_slice import (
    HERO_BODY_PX, HERO_OFFSET_PX, TILE, cell_index, dedupe_cells, load_plan,
    polyline_cells, sha256_file, write_json,
)

ROOT = Path(__file__).resolve().parents[3]
WORLD = ROOT / "data/survival/world"
AUTHORING = WORLD / "authoring/corridor"
OUT = WORLD / "corridor"
CORRIDOR_SCHEMA = "soh.world.first_hour_corridor.v1"
A8_SCHEMA = "soh.world.a8_site_transform_review.v1"
SOLID_PROP_PREFIXES = (
    "lm_", "short_bridge", "short_rubble", "short_conduit", "short_valve",
    "wall_stub", "tree_dead", "tree_pine", "column", "statue", "camp_tent",
    "cart", "sarcophagus", "camp_pavilion", "camp_wagon", "camp_rack",
    "camp_cookfire", "camp_table",
)


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode_chunk_layer(chunk: dict, name: str) -> list[int]:
    total = chunk["size"][0] * chunk["size"][1]
    out: list[int] = []
    for value, count in chunk["layers"][name]:
        out.extend([int(value)] * int(count))
    if len(out) != total:
        raise ValueError(f"chunk {chunk['chunk_id']} layer {name} length mismatch")
    return out


def local_value(chunk: dict, layer: str, cell: list[int]) -> int:
    ox, oy = chunk["origin"]
    x, y = cell[0] - ox, cell[1] - oy
    if not (0 <= x < chunk["size"][0] and 0 <= y < chunk["size"][1]):
        raise ValueError(f"cell {cell} outside {chunk['chunk_id']}")
    return decode_chunk_layer(chunk, layer)[y * chunk["size"][0] + x]


def chunk_for_cell(plan: dict, cell: list[int]) -> dict:
    size = plan["chunk_size"]
    cid = f"chunk:{cell[0] // size}:{cell[1] // size}"
    entry = next(m for m in plan["chunk_manifest"] if m["chunk_id"] == cid)
    return load(WORLD / entry["path"])


def aabb(center: list[float], size: list[float]) -> tuple[float, float, float, float]:
    return (center[0] - size[0] / 2, center[1] - size[1] / 2,
            center[0] + size[0] / 2, center[1] + size[1] / 2)


def overlaps(a: tuple, b: tuple) -> bool:
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def hero_box_at(cell: list[int]) -> tuple:
    foot = [cell[0] * TILE + 8, cell[1] * TILE + 15]
    center = [foot[0] + HERO_OFFSET_PX[0], foot[1] + HERO_OFFSET_PX[1]]
    return aabb(center, HERO_BODY_PX)


def obstacle_box(cell: list[int], size: list[float], offset: list[float]) -> tuple:
    return aabb([cell[0] * TILE + 8 + offset[0], cell[1] * TILE + 8 + offset[1]], size)


def prop_blocker_box(cell: list[int], frame_meta: dict) -> tuple | None:
    w, h = float(frame_meta["w"]), float(frame_meta["h"])
    body_h = max(8.0, h * 0.42)
    body_w = max(8.0, w * 0.82)
    return aabb([cell[0] * TILE + 8, cell[1] * TILE + 16 - body_h / 2], [body_w, body_h])


def road_mask(cells: set[tuple[int, int]], cell: list[int]) -> str:
    x, y = cell
    mask = 0
    if (x, y - 1) in cells: mask |= 1
    if (x + 1, y) in cells: mask |= 2
    if (x, y + 1) in cells: mask |= 4
    if (x - 1, y) in cells: mask |= 8
    return format(mask, "x")


def slice_obstacles(slice_doc: dict) -> list[dict]:
    return list(slice_doc.get("immutable_geography", {}).get("static_obstacles", []))


def compile_corridor() -> dict:
    plan = load_plan()
    auth = load(AUTHORING / "crown_roadside_sources.v1.json")
    chunk_entry = next(m for m in plan["chunk_manifest"] if m["chunk_id"] == auth["chunk_id"])
    chunk = load(WORLD / chunk_entry["path"])
    way = load(WORLD / "vertical_slice/poi_crown_waystation.slice.json")
    relay = load(WORLD / "vertical_slice/poi_crown_relay_shed.slice.json")
    props_meta = load(ROOT / "data/overworld/overworld_props.json")["frames"]
    art_manifest = load(ROOT / "data/overworld/art_manifest.json")
    nodes = {n["node_id"]: n for n in plan["resource_nodes"]}
    pois = {p["poi_id"]: p for p in plan["pois"]}
    classes = {c["source_class_id"]: c for c in auth["source_classes"]}
    if len(classes) != len(auth["source_classes"]):
        raise ValueError("duplicate source_class_id")
    seen_instances: set[str] = set()
    instances: list[dict] = []
    blockers: list[dict] = []
    for obs in slice_obstacles(way) + slice_obstacles(relay):
        if not obs.get("blocks_nav", False):
            continue
        size = obs.get("collision_size_px", [16, 16])
        offset = obs.get("collision_offset_px", [0, 0])
        for c in obs["cells"]:
            blockers.append({"id": obs["obstacle_id"], "cell": c, "box": obstacle_box(c, size, offset), "source": "slice"})
    for raw in auth["instances"]:
        inst = dict(raw)
        iid = inst["instance_id"]
        if iid in seen_instances:
            raise ValueError(f"duplicate instance_id {iid}")
        seen_instances.add(iid)
        cls = classes[inst["source_class_id"]]
        if cls["is_poi"]:
            raise ValueError("a source class cannot be a POI")
        if inst["visual_frame"] not in props_meta:
            raise ValueError(f"unknown visual frame {inst['visual_frame']}")
        frame_license = art_manifest["sheets"]["props"]["index"][inst["visual_frame"]]["license"]
        if frame_license != "original":
            raise ValueError("corridor pilot only admits inherited original SOH frames")
        binding = inst["poi_binding"]
        if binding["kind"] == "non_poi_roadside_instance":
            if binding["canonical_poi_id"] is not None:
                raise ValueError("roadside instance must not masquerade as a canonical POI")
            node = nodes[inst["resource_node_id"]]
            if node["site_id"] != inst["site_id"] or node["region_id"] != auth["region_id"]:
                raise ValueError(f"resource node identity mismatch for {iid}")
            cell = list(node["cell"])
            if node["material_key"] != cls["a1_material_key"]:
                raise ValueError(f"material mismatch for {iid}")
            inst["cell"] = cell
            inst["resource_node_status"] = node["status"]
            inst["collision"] = {"size_px": inst["collision_size_px"], "offset_px": inst["collision_offset_px"], "blocks_nav": True}
            blockers.append({"id": iid, "cell": cell, "box": obstacle_box(cell, inst["collision_size_px"], inst["collision_offset_px"]), "source": "corridor_container"})
        elif binding["kind"] == "poi_object":
            poi = pois[binding["canonical_poi_id"]]
            if poi["region_id"] != auth["region_id"]:
                raise ValueError("POI region mismatch")
            node = next(n for n in way["interaction_nodes"] if n["node_id"] == binding["interaction_node_id"])
            action = next(a for a in way["actions"] if a["action_id"] == binding["action_id"])
            cell = list(node["cell"])
            inst["cell"] = cell
            inst["canonical_action_ref"] = {"poi_id": poi["poi_id"], "action_id": action["action_id"], "reward_right_id": action["reward_right_id"]}
            obs = next(o for o in slice_obstacles(way) if o["obstacle_id"] == "obs_waystation_cache_crate")
            inst["collision"] = {"size_px": obs.get("collision_size_px", [16, 16]), "offset_px": obs.get("collision_offset_px", [0, 0]), "blocks_nav": True, "source": "vertical_slice"}
        else:
            raise ValueError(f"unknown poi_binding kind {binding['kind']}")
        if local_value(chunk, "walk", cell) != 1 or local_value(chunk, "hazard", cell) != 0:
            raise ValueError(f"container cell not clear in authored chunk: {cell}")
        stand = inst["stand_cell"]
        if local_value(chunk, "walk", stand) != 1 or local_value(chunk, "hazard", stand) != 0:
            raise ValueError(f"stand not clear: {stand}")
        node_center = [cell[0] * TILE + 8, cell[1] * TILE + 8]
        foot = [stand[0] * TILE + 8, stand[1] * TILE + 15]
        dist = ((foot[0] - node_center[0]) ** 2 + (foot[1] - node_center[1]) ** 2) ** 0.5
        if dist > inst["interaction_radius_px"]:
            raise ValueError(f"stand out of interaction range for {iid}: {dist}")
        inst["stand_to_node_px"] = round(dist, 4)
        inst["region_id"] = auth["region_id"]
        inst["world_id"] = auth["world_id"]
        inst["chunk_id"] = auth["chunk_id"]
        inst["a3_poi_class"] = cls["a3_poi_class"]
        inst["a3_source_record_ids"] = cls["a3_source_record_ids"]
        inst["visual_meta"] = props_meta[inst["visual_frame"]]
        inst["visual_license"] = frame_license
        instances.append(inst)
    route = auth["route"]
    outbound = dedupe_cells(polyline_cells(route["outbound_waypoints"]))
    retreat = dedupe_cells(polyline_cells(route["return_waypoints"]))
    required = dedupe_cells(outbound + retreat + [i["stand_cell"] for i in instances])
    container_cells = {tuple(i["cell"]) for i in instances if i["poi_binding"]["kind"] == "non_poi_roadside_instance"}
    for c in required:
        if tuple(c) in container_cells:
            raise ValueError(f"route crosses a container body at {c}")
        if local_value(chunk, "walk", c) != 1 or local_value(chunk, "hazard", c) != 0 or local_value(chunk, "surface", c) == 9:
            raise ValueError(f"required corridor cell is not safe/walkable: {c}")
        hb = hero_box_at(c)
        for b in blockers:
            if overlaps(hb, b["box"]):
                raise ValueError(f"required cell {c} intersects blocker {b['id']}")
    decor = []
    for d in auth["decor"]:
        frame = d["frame"]
        if frame not in props_meta:
            raise ValueError(f"unknown decor frame {frame}")
        meta = props_meta[frame]
        solid = any(frame.startswith(p) for p in SOLID_PROP_PREFIXES)
        box = prop_blocker_box(d["cell"], meta) if solid else None
        if box:
            for c in required:
                if overlaps(hero_box_at(c), box):
                    raise ValueError(f"decor {frame} at {d['cell']} blocks required cell {c}")
        decor.append({**d, "x": d["cell"][0] * TILE + 8, "y": d["cell"][1] * TILE + 16,
                      "solid_lower_body": solid, "collision_box_px": list(box) if box else None,
                      "license": art_manifest["sheets"]["props"]["index"][frame]["license"]})
    path_set = {tuple(c) for c in outbound + retreat}
    detail = []
    for c in dedupe_cells(outbound + retreat):
        if local_value(chunk, "surface", c) == 20 or local_value(chunk, "road", c) != 0:
            continue
        detail.append({"cell": c, "token": route["detail_code"] + road_mask(path_set, c), "reason": "visible gravel approach/retreat"})
    for i in instances:
        if i["poi_binding"]["kind"] == "non_poi_roadside_instance":
            detail.append({"cell": i["stand_cell"], "token": route["apron_code"], "reason": "readable interaction apron"})
    corridor = {
        "schema": CORRIDOR_SCHEMA,
        "corridor_id": auth["corridor_id"],
        "status": "SOURCE_AND_ISOLATED_NATIVE_FIXTURE_SCOPE_NOT_PRODUCTION",
        "production_native_playable": False,
        "world_id": auth["world_id"], "region_id": auth["region_id"], "chunk_id": auth["chunk_id"],
        "chunk_origin": chunk["origin"], "chunk_size": chunk["size"], "tile_px": TILE,
        "source_pins": {
            "world_plan": sha(WORLD / "world_plan.v1.json"),
            "chunk_6_3": sha(WORLD / chunk_entry["path"]),
            "waystation_slice": sha(WORLD / "vertical_slice/poi_crown_waystation.slice.json"),
            "relay_slice": sha(WORLD / "vertical_slice/poi_crown_relay_shed.slice.json"),
            "authoring": sha(AUTHORING / "crown_roadside_sources.v1.json"),
            "overworld_props_meta": sha(ROOT / "data/overworld/overworld_props.json"),
            "art_manifest": sha(ROOT / "data/overworld/art_manifest.json"),
        },
        "provenance": auth["provenance"],
        "source_classes": auth["source_classes"],
        "instances": instances,
        "route": {**route, "outbound_cells": outbound, "return_cells": retreat, "required_nav_cells": required,
                  "container_body_cells": [list(c) for c in sorted(container_cells)]},
        "detail_overlay": detail,
        "decor": decor,
        "deferred_resource_nodes": auth["deferred_resource_nodes"],
        "deferred_reason": auth["deferred_reason"],
        "native_scope": auth["native_scope"],
        "counts": {"source_classes": len(classes), "physical_instances": len(instances),
                   "roadside_instances": sum(1 for i in instances if i["poi_binding"]["kind"] == "non_poi_roadside_instance"),
                   "poi_objects": sum(1 for i in instances if i["poi_binding"]["kind"] == "poi_object"),
                   "new_pois": 0, "required_nav_cells": len(required), "detail_cells": len(detail), "decor_props": len(decor)},
    }
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "crown_roadside.corridor.v1.json", corridor)
    return corridor


def compile_a8_transforms() -> dict:
    plan = load_plan()
    auth = load(AUTHORING / "a8_site_transform_authoring.v1.json")
    pois = {p["poi_id"]: p for p in plan["pois"]}
    routes = {e.get("to"): e for e in plan["route_graph"]["edges"] if e.get("kind") == "spur"}
    sites = []
    for s in auth["sites"]:
        poi = pois[s["poi_id"]]
        if list(poi["cell"]) != s["canonical_cell"]:
            raise ValueError(f"A8 canonical cell drift for {s['poi_id']}")
        chunk = chunk_for_cell(plan, s["canonical_cell"])
        anchor = [s["canonical_cell"][0] * TILE + 8, s["canonical_cell"][1] * TILE + 8]
        focus = s["local_action_socket"]
        root = [anchor[0] - focus[0], anchor[1] - focus[1]]
        bounds = [root[0], root[1], root[0] + s["local_world_bounds"][0], root[1] + s["local_world_bounds"][1]]
        radius_px = poi["footprint_radius_tiles"] * TILE
        footprint = [anchor[0] - radius_px, anchor[1] - radius_px, anchor[0] + radius_px, anchor[1] + radius_px]
        fits = bounds[0] >= footprint[0] and bounds[1] >= footprint[1] and bounds[2] <= footprint[2] and bounds[3] <= footprint[3]
        route = routes.get(s["poi_id"], {})
        caps_match = set(s["a8_outer_requires"]) == set(poi["required_capabilities"])
        sites.append({
            **s, "region_id": poi["region_id"], "chunk_id": chunk["chunk_id"],
            "canonical_anchor_px": anchor, "local_focus_px": focus,
            "transform": {"rotation_degrees": 0, "scale": [1, 1], "site_root_position_px": root,
                          "formula": "root = canonical_cell*16 + (8,8) - action_socket"},
            "implied_overworld_bounds_px": bounds,
            "authored_footprint_bounds_px": footprint,
            "fits_authored_footprint_1_to_1": fits,
            "direct_overworld_mount_decision": "ALLOW_REVIEW" if fits else "REJECT_FOOTPRINT_MISMATCH",
            "terrain_at_anchor": {"surface": local_value(chunk, "surface", s["canonical_cell"]),
                                   "walk": local_value(chunk, "walk", s["canonical_cell"]),
                                   "hazard": local_value(chunk, "hazard", s["canonical_cell"]),
                                   "biome": local_value(chunk, "biome", s["canonical_cell"])},
            "route_ref": {"route_id": route.get("route_id"), "from": route.get("from"),
                          "required_capabilities": route.get("required_capabilities", []), "risk": route.get("risk")},
            "capability_review": "MATCH" if caps_match else "MISMATCH_REVIEW",
            "a1_required_capabilities": poi["required_capabilities"],
            "inside_current_connector_annex": 384 <= s["canonical_cell"][0] < 448 and 192 <= s["canonical_cell"][1] < 256,
        })
    doc = {"schema": A8_SCHEMA, "status": auth["status"], "a8_pr": auth["a8_pr"], "a8_head": auth["a8_head"],
           "a8_base": auth["a8_base"], "authority_rule": auth["authority_rule"], "transform_rule": auth["transform_rule"],
           "source_plan_sha256": sha(WORLD / "world_plan.v1.json"),
           "authoring_sha256": sha(AUTHORING / "a8_site_transform_authoring.v1.json"),
           "sites": sites, "required_owner_decisions": auth["required_owner_decisions"],
           "production_mounted": False}
    write_json(OUT / "a8_site_transforms.v1.json", doc)
    return doc


def compile_all() -> dict:
    corridor = compile_corridor()
    a8 = compile_a8_transforms()
    return {"ok": True, "corridor": corridor["counts"], "a8_sites": len(a8["sites"]),
            "corridor_sha256": sha(OUT / "crown_roadside.corridor.v1.json"),
            "a8_transforms_sha256": sha(OUT / "a8_site_transforms.v1.json"),
            "production_native_playable": False}


if __name__ == "__main__":
    print(json.dumps(compile_all(), sort_keys=True))
