#!/usr/bin/env python3
"""Independent source gate for the A1 first-hour corridor and A8 transform review."""
from __future__ import annotations

import json
from pathlib import Path

from compile_corridor import (
    A8_SCHEMA, CORRIDOR_SCHEMA, ROOT, WORLD, SOLID_PROP_PREFIXES, aabb,
    hero_box_at, load, obstacle_box, overlaps, prop_blocker_box, sha,
)
from compile_slice import TILE, polyline_cells, dedupe_cells

FORBIDDEN_ECONOMY_KEYS = {"drop_rate", "weight", "chance", "loot_table_id", "yield_per_claim", "replenishment_seconds"}


def _err(errors: list[str], ok: bool, message: str) -> None:
    if not ok:
        errors.append(message)


def validate_corridor(doc: dict) -> list[str]:
    errors: list[str] = []
    _err(errors, doc.get("schema") == CORRIDOR_SCHEMA, "corridor schema mismatch")
    _err(errors, doc.get("production_native_playable") is False, "corridor must not claim production playability")
    plan = load(WORLD / "world_plan.v1.json")
    auth = load(WORLD / "authoring/corridor/crown_roadside_sources.v1.json")
    chunk_entry = next(m for m in plan["chunk_manifest"] if m["chunk_id"] == doc.get("chunk_id"))
    chunk = load(WORLD / chunk_entry["path"])
    way = load(WORLD / "vertical_slice/poi_crown_waystation.slice.json")
    relay = load(WORLD / "vertical_slice/poi_crown_relay_shed.slice.json")
    props_meta = load(ROOT / "data/overworld/overworld_props.json")["frames"]
    tiles_meta = load(ROOT / "data/overworld/overworld_tiles.json")
    art = load(ROOT / "data/overworld/art_manifest.json")["sheets"]["props"]["index"]
    pins = doc.get("source_pins", {})
    expected_pins = {
        "world_plan": WORLD / "world_plan.v1.json",
        "chunk_6_3": WORLD / chunk_entry["path"],
        "waystation_slice": WORLD / "vertical_slice/poi_crown_waystation.slice.json",
        "relay_slice": WORLD / "vertical_slice/poi_crown_relay_shed.slice.json",
        "authoring": WORLD / "authoring/corridor/crown_roadside_sources.v1.json",
        "overworld_props_meta": ROOT / "data/overworld/overworld_props.json",
        "art_manifest": ROOT / "data/overworld/art_manifest.json",
    }
    for key, path in expected_pins.items():
        _err(errors, pins.get(key) == sha(path), f"source pin mismatch: {key}")
    nodes = {n["node_id"]: n for n in plan["resource_nodes"]}
    pois = {p["poi_id"]: p for p in plan["pois"]}
    classes = {c["source_class_id"]: c for c in doc.get("source_classes", [])}
    _err(errors, len(classes) == len(doc.get("source_classes", [])), "duplicate source class")
    _err(errors, all(not c.get("is_poi", False) for c in classes.values()), "source class marked as POI")
    instances = doc.get("instances", [])
    ids = [i["instance_id"] for i in instances]
    _err(errors, len(ids) == len(set(ids)), "duplicate physical instance id")
    roadside = [i for i in instances if i["poi_binding"]["kind"] == "non_poi_roadside_instance"]
    _err(errors, len(roadside) >= 2, "roadside class must have multiple physical instances")
    _err(errors, doc.get("counts", {}).get("new_pois") == 0, "corridor inflated POI count")
    _err(errors, sum(not p.get("preserved_legacy", False) for p in pois.values()) == 108 and len(pois) == 118, "canonical authored/legacy POI count changed")
    blockers = []
    for slice_doc in (way, relay):
        for obs in slice_doc.get("immutable_geography", {}).get("static_obstacles", []):
            if obs.get("blocks_nav"):
                for c in obs["cells"]:
                    blockers.append(obstacle_box(c, obs.get("collision_size_px", [16, 16]), obs.get("collision_offset_px", [0, 0])))
    def lv(layer: str, cell: list[int]) -> int:
        ox, oy = chunk["origin"]
        x, y = cell[0] - ox, cell[1] - oy
        vals = [v for val, count in chunk["layers"][layer] for v in [val] * count]
        return vals[y * chunk["size"][0] + x]
    for inst in instances:
        iid = inst["instance_id"]
        cls = classes.get(inst["source_class_id"])
        _err(errors, cls is not None, f"{iid}: unknown class")
        _err(errors, inst.get("region_id") == doc["region_id"] == auth["region_id"], f"{iid}: region drift")
        _err(errors, inst.get("visual_frame") in props_meta, f"{iid}: unknown visual frame")
        _err(errors, art.get(inst.get("visual_frame"), {}).get("license") == "original", f"{iid}: non-original art in pilot")
        binding = inst["poi_binding"]
        if binding["kind"] == "non_poi_roadside_instance":
            _err(errors, binding["canonical_poi_id"] is None, f"{iid}: roadside instance has a POI identity")
            node = nodes.get(inst.get("resource_node_id"))
            _err(errors, node is not None and list(node["cell"]) == inst["cell"], f"{iid}: resource node cell drift")
            _err(errors, node is not None and node["site_id"] == inst["site_id"], f"{iid}: site drift")
            econ = inst.get("economy_binding", {})
            _err(errors, econ.get("status") == "PENDING_A3_INSTANCE_BINDING", f"{iid}: A3 binding not honestly pending")
            for k in ("reward_items", "replenishment_seconds", "yield_per_claim"):
                _err(errors, econ.get(k) is None, f"{iid}: A1 authored economy field {k}")
            _err(errors, not (FORBIDDEN_ECONOMY_KEYS & set(inst.keys())), f"{iid}: forbidden A1 economy key")
            col = inst.get("collision", {})
            blockers.append(obstacle_box(inst["cell"], col.get("size_px", [16, 16]), col.get("offset_px", [0, 0])))
        else:
            _err(errors, binding["canonical_poi_id"] in pois, f"{iid}: unknown canonical POI")
            _err(errors, inst.get("economy_binding", {}).get("status") == "CANONICAL_SLICE_LOCKED", f"{iid}: canonical cache not locked")
        _err(errors, lv("walk", inst["cell"]) == 1 and lv("hazard", inst["cell"]) == 0, f"{iid}: container cell blocked/hazardous")
        _err(errors, lv("walk", inst["stand_cell"]) == 1 and lv("hazard", inst["stand_cell"]) == 0, f"{iid}: stand blocked/hazardous")
        center = [inst["cell"][0] * TILE + 8, inst["cell"][1] * TILE + 8]
        foot = [inst["stand_cell"][0] * TILE + 8, inst["stand_cell"][1] * TILE + 15]
        dist = ((foot[0] - center[0]) ** 2 + (foot[1] - center[1]) ** 2) ** 0.5
        _err(errors, dist <= inst["interaction_radius_px"], f"{iid}: stand outside interaction radius")
        _err(errors, not overlaps(hero_box_at(inst["stand_cell"]), obstacle_box(inst["cell"], inst.get("collision", {}).get("size_px", [16, 16]), inst.get("collision", {}).get("offset_px", [0, 0]))), f"{iid}: live-shape stand overlap")
    route = doc.get("route", {})
    outbound = dedupe_cells(polyline_cells(route.get("outbound_waypoints", [])))
    retreat = dedupe_cells(polyline_cells(route.get("return_waypoints", [])))
    _err(errors, outbound == route.get("outbound_cells"), "outbound route cells not reproducible")
    _err(errors, retreat == route.get("return_cells"), "return route cells not reproducible")
    required = dedupe_cells(outbound + retreat + [i["stand_cell"] for i in instances])
    _err(errors, required == route.get("required_nav_cells"), "required nav cells drift")
    bodies = {tuple(i["cell"]) for i in roadside}
    for c in required:
        _err(errors, tuple(c) not in bodies, f"route crosses container body {c}")
        _err(errors, lv("walk", c) == 1 and lv("hazard", c) == 0 and lv("surface", c) != 9, f"required cell unsafe {c}")
        _err(errors, not any(overlaps(hero_box_at(c), b) for b in blockers), f"required cell intersects static blocker {c}")
    _err(errors, retreat[0] == route.get("start_cell") or retreat[-1] == route.get("start_cell"), "retreat does not return to postern")
    detail_codes = tiles_meta.get("codes", {}).get("detail", {})
    for patch in doc.get("detail_overlay", []):
        token = patch["token"]
        code = token[:1]
        _err(errors, code in detail_codes, f"unknown detail code {token}")
        if detail_codes.get(code, {}).get("masked"):
            _err(errors, len(token) == 2 and token[1] in "0123456789abcdef", f"bad detail mask {token}")
        _err(errors, lv("walk", patch["cell"]) == 1, f"detail on blocked cell {patch['cell']}")
    for d in doc.get("decor", []):
        frame = d["frame"]
        _err(errors, frame in props_meta, f"unknown decor frame {frame}")
        _err(errors, art.get(frame, {}).get("license") == "original", f"non-original decor {frame}")
        solid = any(frame.startswith(p) for p in SOLID_PROP_PREFIXES)
        _err(errors, d.get("solid_lower_body") == solid, f"decor collision flag drift {frame}")
        if solid:
            box = prop_blocker_box(d["cell"], props_meta[frame])
            _err(errors, not any(overlaps(hero_box_at(c), box) for c in required), f"decor blocks route {frame}")
    for nid in doc.get("deferred_resource_nodes", []):
        _err(errors, nid in nodes, f"deferred node deleted from plan {nid}")
    return errors


def validate_a8(doc: dict) -> list[str]:
    errors: list[str] = []
    _err(errors, doc.get("schema") == A8_SCHEMA, "A8 schema mismatch")
    _err(errors, doc.get("production_mounted") is False, "A8 review must not claim production mount")
    plan = load(WORLD / "world_plan.v1.json")
    pois = {p["poi_id"]: p for p in plan["pois"]}
    _err(errors, doc.get("source_plan_sha256") == sha(WORLD / "world_plan.v1.json"), "A8 plan pin mismatch")
    for s in doc.get("sites", []):
        poi = pois.get(s["poi_id"])
        _err(errors, poi is not None and list(poi["cell"]) == s["canonical_cell"], f"{s['poi_id']}: canonical cell drift")
        anchor = [s["canonical_cell"][0] * TILE + 8, s["canonical_cell"][1] * TILE + 8]
        root = [anchor[0] - s["local_action_socket"][0], anchor[1] - s["local_action_socket"][1]]
        _err(errors, s["canonical_anchor_px"] == anchor, f"{s['poi_id']}: anchor formula drift")
        _err(errors, s["transform"]["site_root_position_px"] == root, f"{s['poi_id']}: root transform drift")
        bounds = [root[0], root[1], root[0] + s["local_world_bounds"][0], root[1] + s["local_world_bounds"][1]]
        _err(errors, s["implied_overworld_bounds_px"] == bounds, f"{s['poi_id']}: bounds drift")
        radius = poi["footprint_radius_tiles"] * TILE
        fits = (bounds[0] >= anchor[0] - radius and bounds[1] >= anchor[1] - radius and
                bounds[2] <= anchor[0] + radius and bounds[3] <= anchor[1] + radius)
        _err(errors, s["fits_authored_footprint_1_to_1"] == fits, f"{s['poi_id']}: footprint fit drift")
        _err(errors, s["direct_overworld_mount_decision"] == ("ALLOW_REVIEW" if fits else "REJECT_FOOTPRINT_MISMATCH"), f"{s['poi_id']}: wrong mount decision")
        _err(errors, set(s["a8_outer_requires"]) == set(poi["required_capabilities"]), f"{s['poi_id']}: capability mismatch")
        _err(errors, s["capability_review"] == "MATCH", f"{s['poi_id']}: capability review not match")
    return errors


def main() -> int:
    corridor = load(WORLD / "corridor/crown_roadside.corridor.v1.json")
    a8 = load(WORLD / "corridor/a8_site_transforms.v1.json")
    errors = validate_corridor(corridor) + validate_a8(a8)
    report = {"ok": not errors, "errors": errors, "corridor_counts": corridor.get("counts"),
              "a8_sites": len(a8.get("sites", [])), "production_native_playable": False,
              "status": "SOURCE_VERIFIED_NOT_PRODUCTION_NATIVE"}
    print(json.dumps(report, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
