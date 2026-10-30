#!/usr/bin/env python3
"""Validate the A1 two-POI native-ready vertical-slice handoff.

This is a contract/geometry validator, not a native gameplay claim. It checks
schemas, pinned world identity, required navigation clearance, obstacle/doorway
safety, exact A3 item/source IDs, reward ownership, research firewall and the
presence of all required adversarial vectors.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parents[3]
WORLD = ROOT / "data/survival/world"
SLICE = WORLD / "vertical_slice"
SCHEMAS = WORLD / "schemas"

REQUIRED_VECTORS = {"VS-01", "VS-02", "VS-03", "VS-04", "VS-05", "VS-06", "VS-07"}
A3_ITEMS = {"iron_scrap", "oak_wood", "knowledge_spares"}
A3_SOURCES = {"road_scrap", "road_supplies", "live_oak_wood", "live_iron_scrap"}


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def decode_layer(plan: dict, layer: str) -> list[int]:
    w, h = plan["frame"]["w"], plan["frame"]["h"]
    grid = [0] * (w * h)
    for m in plan["chunk_manifest"]:
        c = json.loads((WORLD / m["path"]).read_text(encoding="utf-8"))
        ox, oy = c["origin"]
        cw, ch = c["size"]
        vals: list[int] = []
        for value, count in c["layers"][layer]:
            vals.extend([value] * count)
        if len(vals) != cw * ch:
            raise ValueError(f"chunk {c['chunk_id']} layer {layer} length mismatch")
        for y in range(ch):
            for x in range(cw):
                grid[(oy + y) * w + ox + x] = vals[y * cw + x]
    return grid


def cell_set(cells: list[list[int]]) -> set[tuple[int, int]]:
    return {(int(c[0]), int(c[1])) for c in cells}


def validate() -> dict:
    errors: list[str] = []
    warnings: list[str] = []
    plan = load(WORLD / "world_plan.v1.json")
    manifest = load(SLICE / "manifest.json")
    handoff = load(SLICE / "handoff_contracts.json")
    vectors = load(SLICE / "test_vectors.json")
    contracts = [load(SLICE / "poi_crown_waystation.slice.json"), load(SLICE / "poi_crown_relay_shed.slice.json")]

    schema_pairs = [
        (manifest, "vertical_slice_manifest"),
        (handoff, "slice_handoff"),
        (vectors, "slice_test_vectors"),
        *[(c, "poi_slice") for c in contracts],
    ]
    for obj, name in schema_pairs:
        schema = load(SCHEMAS / f"{name}.schema.json")
        try:
            jsonschema.validate(obj, schema)
        except jsonschema.ValidationError as exc:
            errors.append(f"schema:{name}:{exc.message}")

    if manifest.get("native_playable") is not False:
        errors.append("manifest must not claim native_playable")
    if manifest.get("world_plan_sha256") != __import__("hashlib").sha256((WORLD / "world_plan.v1.json").read_bytes()).hexdigest():
        errors.append("manifest world_plan_sha256 mismatch")
    if set(manifest.get("poi_ids", [])) != {c["poi_id"] for c in contracts}:
        errors.append("manifest poi_ids mismatch")
    for name, meta in manifest.get("files", {}).items():
        path = SLICE / name
        if not path.exists():
            errors.append(f"missing slice file {name}")
            continue
        import hashlib
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != meta["sha256"]:
            errors.append(f"slice file hash mismatch {name}")

    walk = decode_layer(plan, "walk")
    hazard = decode_layer(plan, "hazard")
    w = plan["frame"]["w"]
    route_ids = {r["route_id"] for r in plan["route_graph"]["edges"]}
    poi_ids = {p["poi_id"] for p in plan["pois"]}

    for c in contracts:
        pid = c["poi_id"]
        if pid not in poi_ids:
            errors.append(f"{pid}: not in world plan")
        if c["world_plan_sha256"] != manifest["world_plan_sha256"]:
            errors.append(f"{pid}: plan hash mismatch")
        geo = c["immutable_geography"]
        nav = cell_set(geo["required_nav_cells"])
        obstacles = cell_set([cell for ob in geo["static_obstacles"] for cell in ob["cells"]])
        forbidden = cell_set(geo["spawn_forbidden_cells"])
        if obstacles & nav:
            errors.append(f"{pid}: obstacle intersects required nav")
        if geo["dynamic_spawns"]:
            errors.append(f"{pid}: slice v1 must not declare dynamic spawns")
        if not nav <= forbidden:
            errors.append(f"{pid}: spawn_forbidden_cells must include required nav")
        if tuple(geo["hero_spawn_cell"]) not in forbidden:
            errors.append(f"{pid}: hero spawn not forbidden for dynamic spawn")
        for ent in geo["entrances"]:
            clear = cell_set(ent["clearance_cells"])
            if obstacles & clear:
                errors.append(f"{pid}: obstacle blocks entrance {ent['entrance_id']}")
            if not clear <= forbidden:
                errors.append(f"{pid}: entrance clearance not spawn-forbidden")
            if not clear <= nav:
                errors.append(f"{pid}: entrance clearance not in required nav")
        for cell in nav:
            x, y = cell
            if not (0 <= x < plan["frame"]["w"] and 0 <= y < plan["frame"]["h"]):
                errors.append(f"{pid}: nav cell out of bounds {cell}")
                continue
            i = y * w + x
            if walk[i] != 1:
                errors.append(f"{pid}: required nav not walkable {cell}")
            if hazard[i] != 0:
                errors.append(f"{pid}: required nav hazardous {cell}")
        for path_key in ("approach_path", "retreat_path"):
            path = geo[path_key]
            if path.get("hazard_exposure_tiles") != 0:
                errors.append(f"{pid}: {path_key} must be zero-hazard")
            if not cell_set(path["cells"]) <= nav:
                errors.append(f"{pid}: {path_key} cells not in required nav")
        if geo["approach_path"]["route_id"] not in route_ids and not geo["approach_path"]["route_id"].startswith("sp_"):
            errors.append(f"{pid}: unknown approach route")
        action_ids = {a["action_id"] for a in c["actions"]}
        node_ids = {n["node_id"] for n in c["interaction_nodes"]}
        for a in c["actions"]:
            if a["trigger_node_id"] not in node_ids:
                errors.append(f"{pid}:{a['action_id']}: unknown trigger node")
            for item in a["consumes_items"] + a["reward_items"]:
                if item["item_id"] not in A3_ITEMS and item["item_id"] != "copper":
                    errors.append(f"{pid}:{a['action_id']}: non-catalog item {item['item_id']}")
                if item["item_id"] == "copper" and a["enabled"]:
                    errors.append(f"{pid}:{a['action_id']}: copper must remain deferred")
            for item in a["reward_items"]:
                if item["source_id"] not in A3_SOURCES:
                    errors.append(f"{pid}:{a['action_id']}: non-catalog source {item['source_id']}")
            if a["one_time"] and not a["transaction_key_template"]:
                errors.append(f"{pid}:{a['action_id']}: one-time action needs transaction key")
            if a["one_time"] and not a["reward_right_id"]:
                errors.append(f"{pid}:{a['action_id']}: one-time action needs reward right")
        # Owner-specific live-shape arithmetic gate: every contract stand must fit
        # the real Hero body against the obstacle collision footprint (not just the
        # tile-center nav grid) and remain inside the authored interaction radius.
        tile = float(geo.get("tile_px", 16))
        body = geo.get("hero_body_px", [12, 16])
        offset = geo.get("hero_offset_px", [0, -8])
        nodes = {n["node_id"]: n for n in c["interaction_nodes"]}
        for a in c["actions"]:
            node = nodes.get(a["trigger_node_id"])
            radius = float(a.get("interaction_radius_px", 0))
            for stand in a["stand_cells"]:
                sx, sy = float(stand[0]), float(stand[1])
                foot_x = sx * tile + tile / 2.0
                foot_y = sy * tile + tile - 1.0
                if node is not None:
                    nx = float(node["cell"][0]) * tile + tile / 2.0
                    ny = float(node["cell"][1]) * tile + tile / 2.0
                    if math.hypot(foot_x - nx, foot_y - ny) > radius:
                        errors.append(f"{pid}:{a['action_id']}: stand {stand} outside interaction radius {radius}")
                hx = foot_x + float(offset[0])
                hy = foot_y + float(offset[1])
                hhx, hhy = float(body[0]) / 2.0, float(body[1]) / 2.0
                for ob in geo["static_obstacles"]:
                    size = ob.get("collision_size_px", [tile, tile])
                    ooff = ob.get("collision_offset_px", [0, 0])
                    ohx, ohy = float(size[0]) / 2.0, float(size[1]) / 2.0
                    for oc in ob["cells"]:
                        ox = float(oc[0]) * tile + tile / 2.0 + float(ooff[0])
                        oy = float(oc[1]) * tile + tile / 2.0 + float(ooff[1])
                        if abs(hx - ox) < hhx + ohx and abs(hy - oy) < hhy + ohy:
                            errors.append(f"{pid}:{a['action_id']}: stand {stand} Hero body intersects obstacle {ob['obstacle_id']} cell {oc}")
        if c["persistence"]["owner"] != "A0":
            errors.append(f"{pid}: persistence owner must be A0")
        if c["persistence"]["atomic_commit"] != "SaveService.transact_once":
            errors.append(f"{pid}: atomic commit must be SaveService.transact_once")
        if not c["a6_projection"]["hidden_until_discovered"]:
            errors.append(f"{pid}: A6 projection must hide until discovered")
        if not set(c["test_vector_refs"]) <= {v["vector_id"] for v in vectors["vectors"]}:
            errors.append(f"{pid}: unknown test vector ref")

    ids = [v["vector_id"] for v in vectors["vectors"]]
    if len(ids) != len(set(ids)):
        errors.append("duplicate vector ids")
    if not REQUIRED_VECTORS <= set(ids):
        errors.append("missing required adversarial vectors")
    for v in vectors["vectors"]:
        if not v["steps"] or not v["assertions"]:
            errors.append(f"{v['vector_id']}: empty steps/assertions")

    a3 = handoff["a3"]
    if set(a3["exact_item_ids"]) != A3_ITEMS:
        errors.append("handoff exact_item_ids mismatch")
    if not set(a3["exact_source_ids"]) <= A3_SOURCES:
        errors.append("handoff exact_source_ids mismatch")
    for binding in a3["source_bindings"]:
        if binding["source_id"] not in A3_SOURCES or binding["item_id"] not in A3_ITEMS:
            errors.append("handoff source binding uses non-catalog id")
    if a3["alias_decisions"].get("early_roadside_salvage", "").startswith("APPROVE"):
        errors.append("must not approve disputed early_roadside_salvage alias")
    if handoff["research_firewall"]["typescript_imported"] or handoff["research_firewall"]["world_regenerated"]:
        errors.append("research firewall violated")
    for key in ("prototype_p1_core_world_interactions", "prototype_p2_dynamic_weather", "prototype_p3_physical_cart"):
        if handoff["research_firewall"][key] != "RESEARCH_ONLY_NOT_IMPLEMENTED":
            errors.append(f"research firewall {key} must remain research-only")

    return {"ok": not errors, "errors": errors, "warnings": warnings, "schemas_checked": len(schema_pairs), "vectors": len(ids), "native_playable": False}


if __name__ == "__main__":
    result = validate()
    print(json.dumps(result, sort_keys=True))
    raise SystemExit(0 if result["ok"] else 1)
