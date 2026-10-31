#!/usr/bin/env python3
"""Compile the R13 production-consumable continent interface manifest.

This reads the accepted masterplan, Round 12 runtime/spawn contracts and pinned
A8 site definitions. It never rewrites geography, routes, art or spawn data.
The output contains stable consumer descriptors and source-reachability
summaries, not native/production acceptance or fixture journey packets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compile_round12_runtime import (  # noqa: E402
    CONTRACT,
    ROOT,
    SPAWN_INDEX,
    WORLD,
    RuntimeBuilder,
    canon,
    json_bytes,
    load,
    sha_file,
)

OUTPUT = WORLD / "a1_continent_interface.v1.json"
SCHEMA = "soh.world.a1_continent_interface.v1"
MOVEMENT_INPUTS = ["move_left", "move_right", "move_up", "move_down"]
REQUIRED_INPUTS = MOVEMENT_INPUTS + ["interact"]
BODY_SIZE = [12, 16]
BODY_OFFSET = [0, -8]

# NativePoiShell._build_physics() at the reviewed A8 contract. These rectangles
# are descriptive clearance evidence only. Consumers mount the A8 scene once;
# they must not create a second set of bodies from this manifest.
SHELL_BOUNDARIES = (
    ("north", [0, 0, 128, 8]),
    ("west", [0, 0, 8, 120]),
    ("east", [120, 0, 8, 120]),
    ("south_west", [0, 120, 44, 8]),
    ("south_east", [84, 120, 44, 8]),
)


def _actor_clear(point: list[float], bodies: list[dict]) -> bool:
    center = [point[0] + BODY_OFFSET[0], point[1] + BODY_OFFSET[1]]
    for body in bodies:
        rect = body["rect_px"]
        other = {
            "center_px": [rect[0] + rect[2] * 0.5, rect[1] + rect[3] * 0.5],
            "size_px": [rect[2], rect[3]],
        }
        if (abs(center[0] - other["center_px"][0]) < (BODY_SIZE[0] + rect[2]) * 0.5 and
                abs(center[1] - other["center_px"][1]) < (BODY_SIZE[1] + rect[3]) * 0.5):
            return False
    return True


def _world_body(site: dict, body_id: str, local_rect: list[int], kind: str) -> dict:
    origin = site["shell_origin_world_px"]
    rect = [origin[0] + local_rect[0], origin[1] + local_rect[1], local_rect[2], local_rect[3]]
    return {
        "id": body_id,
        "kind": kind,
        "rect_px": rect,
        "center_px": [rect[0] + rect[2] * 0.5, rect[1] + rect[3] * 0.5],
        "size_px": [rect[2], rect[3]],
        "authority": "A8_SCENE_ALREADY_OWNS_BODY_DO_NOT_DUPLICATE",
    }


def _path_evidence(path: list[list[int]]) -> dict:
    return {
        "cell_count": len(path),
        "sha256": hashlib.sha256(canon(path).encode("utf-8")).hexdigest(),
        "cells_published": False,
    }


def build() -> dict:
    builder = RuntimeBuilder(CONTRACT)
    builder.validate_sources()
    builder.build_component()
    spawn = load(SPAWN_INDEX)
    if spawn["world_plan_sha256"] != sha_file(WORLD / "world_plan.v1.json"):
        raise ValueError("spawn index is stale against the authored plan")
    if spawn["runtime_contract_sha256"] != sha_file(CONTRACT):
        raise ValueError("spawn index is stale against the runtime contract")
    component_bytes = bytearray(builder.w * builder.h)
    for x, y in builder.component:
        component_bytes[y * builder.w + x] = 1
    component_hash = hashlib.sha256(component_bytes).hexdigest()
    if component_hash != spawn["connected_component_sha256"]:
        raise ValueError("safe source component drift")

    # Add the actual A8 boundary clearance before computing any physical path.
    # Round 12's site obstacles and roadside bodies are already present.
    boundaries: dict[str, list[dict]] = {}
    for key, site in builder.sites.items():
        rows = [_world_body(site, f"a8:{key}:boundary:{name}", rect, "shell_boundary")
                for name, rect in SHELL_BOUNDARIES]
        boundaries[key] = rows
        builder.physical_bodies.extend(rows)

    sites: dict[str, dict] = {}
    home = list(builder.contract["spawn_policy"]["home_cell"])
    for key in sorted(builder.sites):
        site = builder.sites[key]
        source = load(ROOT / site["source_path"])
        shell = source["overworld_shell"]
        transition = source["local_transition"]
        approach = list(site["approach_cell"])
        retreat = [approach[0], approach[1] + 6]
        retreat_foot = [retreat[0] * 16 + 8.0, retreat[1] * 16 + 15.0]
        exclusions = boundaries[key] + [
            {
                "id": body["id"],
                "kind": "authored_obstacle",
                "rect_px": body["rect_px"],
                "authority": "A8_SCENE_ALREADY_OWNS_BODY_DO_NOT_DUPLICATE",
            }
            for body in site["obstacles"]
        ]
        home_path = builder.path(home, approach)
        retreat_path = builder.path(approach, retreat)
        if not home_path or not retreat_path:
            raise ValueError(f"A8 approach/retreat is not physically reachable: {key}")
        if not builder.source_clear(tuple(approach)) or not builder.source_clear(tuple(retreat)):
            raise ValueError(f"A8 approach/retreat lacks source/body clearance: {key}")
        if not _actor_clear(site["entry_portal_world_px"], exclusions):
            raise ValueError(f"A8 door target intersects a shell body: {key}")
        if not _actor_clear(site["approach_foot_world_px"], exclusions):
            raise ValueError(f"A8 approach target intersects a shell body: {key}")
        if not _actor_clear(retreat_foot, exclusions):
            raise ValueError(f"A8 retreat target intersects a shell body: {key}")
        poi = builder.pois[site["poi_id"]]
        site_instance_id = f"{builder.plan['world_id']}/site:{site['site_id']}"
        sites[key] = {
            "site_key": key,
            "instance_identity": {
                "site_instance_id": site_instance_id,
                "world_id": builder.plan["world_id"],
                "site_id": site["site_id"],
                "poi_id": site["poi_id"],
                "region_id": poi["region_id"],
                "run_local_identity_owner": "A0",
                "run_id": None,
            },
            "canonical_cell": site["canonical_cell"],
            "anchor_world_px": site["anchor_world_px"],
            "shell": {
                "scene": shell["scene"],
                "origin_world_px": site["shell_origin_world_px"],
                "bounds_px": shell["bounds_px"],
                "rotation_degrees": shell["rotation_degrees"],
                "scale": shell["scale"],
                "mount_authority": "A0",
                "scene_authority": "A8",
            },
            "physical_approach": {
                "cell": approach,
                "actor_origin_px": site["approach_foot_world_px"],
                "actor_anchor": "CELL_BOTTOM_CENTER_MINUS_ONE_Y",
                "tolerance_px": 4.5,
            },
            "door_target": {
                "world_px": site["entry_portal_world_px"],
                "shell_local_position": shell["entry_portal"],
                "area_radius_px": 22.0,
                "facing": [0, -1],
                "consumer_call": "NativePoiShell.try_enter(actor) after A0 run-phase projection",
                "transition_contract_id": transition["contract_id"],
                "transition_contract_version": transition["contract_version"],
            },
            "retreat_target": {
                "cell": retreat,
                "actor_origin_px": retreat_foot,
                "actor_anchor": "CELL_BOTTOM_CENTER_MINUS_ONE_Y",
                "tolerance_px": 4.5,
            },
            "return_anchor": {
                "shell_local_position": transition["return_anchor"]["shell_local_position"],
                "canonical_cell": transition["return_anchor"]["canonical_cell"],
                "world_target_px": site["return_anchor_world_px"],
            },
            "required_inputs": REQUIRED_INPUTS,
            "required_capabilities": {
                "outer": source["access"]["outer_requires"],
                "inner": source["access"]["inner_requires"],
                "grant_or_interaction_authority": "A0_WITH_A3_BINDINGS_NOT_A1",
            },
            "collision": {
                "body_size_px": BODY_SIZE,
                "body_offset_px": BODY_OFFSET,
                "doorway_clear_world_rect_px": site["doorway_clear_world_rect_px"],
                "exclusions": exclusions,
                "approach_body_clear": True,
                "door_body_clear": True,
                "retreat_body_clear": True,
                "source_walk_required": True,
                "usage": "CLEARANCE_EVIDENCE_ONLY; instantiate the A8 shell once, never duplicate these bodies",
            },
            "reachability": {
                "kind": "SOURCE_ASTAR_WITH_12x16_BODY_AND_A8_EXCLUSIONS_NOT_NATIVE_OR_PRODUCTION",
                "from_home_cell": home,
                "to_approach_cell": approach,
                "home_to_approach": _path_evidence(home_path),
                "approach_to_retreat": _path_evidence(retreat_path),
                "safe_source_component_cells": len(builder.component),
                "safe_source_component_sha256": component_hash,
                "native_evidence": "PENDING_EXACT_HEAD_R13_NATIVE_REPORT",
            },
            "source_reference": {
                "path": site["source_path"],
                "sha256": site["source_sha256"],
                "commit": site["source_commit"],
            },
            "production_scene_mounted": False,
            "interior_or_loot_accepted": False,
        }

    runtime = builder.contract["runtime_interfaces"]
    player = runtime["player"]
    source_pins = {
        "world_plan": dict(builder.contract["source_pins"]["world_plan"]),
        "runtime_contract": {
            "path": str(CONTRACT.relative_to(ROOT)),
            "sha256": sha_file(CONTRACT),
        },
        "spawn_index": {
            "path": str(SPAWN_INDEX.relative_to(ROOT)),
            "sha256": sha_file(SPAWN_INDEX),
        },
        "a8_quarry": dict(builder.contract["source_pins"]["a8_quarry"]),
        "a8_orchard": dict(builder.contract["source_pins"]["a8_orchard"]),
        "a8_mill": dict(builder.contract["source_pins"]["a8_mill"]),
    }
    return {
        "schema": SCHEMA,
        "interface_version": 1,
        "status": "SOURCE_READY_NOT_PRODUCTION_MOUNTED",
        "world": {
            "world_id": builder.plan["world_id"],
            "geography_instance_id": "continent:soh_continent_v1",
            "cell_size_px": [16, 16],
            "cell_origin_px": [0, 0],
            "world_origin_cell": [0, 0],
            "world_size_cells": [builder.w, builder.h],
            "world_size_px": [builder.w * 16, builder.h * 16],
            "chunk_cells": [64, 64],
            "chunk_size_px": [1024, 1024],
            "chunk_grid": [16, 12],
            "chunk_count": 192,
            "axes": {"x": "EAST_RIGHT", "y": "SOUTH_DOWN"},
            "cell_bounds": "HALF_OPEN [cell*16,(cell+1)*16); negative and right/bottom edges reject",
            "actor_origin": "CELL_BOTTOM_CENTER_MINUS_ONE_Y = [x*16+8,y*16+15]",
            "world_pixel_units": "UNSCALED_WORLD_PIXELS; camera zoom is A0-owned and remains 1x in R13 evidence",
        },
        "runtime": {
            "interface_script": "res://game/survival/world/a1_continent_interface.gd",
            "consumer_sample": "res://game/survival/world/a1_continent_consumer_sample.gd",
            "reader_script": "res://game/survival/world/a1_authored_world_reader.gd",
            "stream_script": "res://game/survival/world/a1_authored_world_stream.gd",
            "player_scene": "res://" + player["scene"],
            "input_bootstrap": "res://game/autoload/input_bootstrap.gd",
            "movement_input_actions": MOVEMENT_INPUTS,
            "required_input_actions": REQUIRED_INPUTS,
            "input_initialization": "InputBootstrap autoload must enter the tree before input/body diagnosis",
            "body_shape_node": player["body_shape_node"],
            "body_size_px": player["body_shape_size_px"],
            "body_offset_px": player["body_shape_offset_px"],
            "camera_node": player["camera_node"],
            "camera_offset_px": player["camera_offset_px"],
            "logical_viewport_px": builder.contract["visual"]["logical_viewport"],
            "required_collision_layer": player["required_collision_layer"],
            "required_collision_mask": player["required_collision_mask"],
            "mutable_runtime_policy": "SEMANTIC_INTERFACE_ONLY; no A0/A6/Knight byte pins",
        },
        "chunk_stream": {
            "acquire": "acquire_for_actor(actor_origin_px, camera_world_rect)",
            "release": "release_chunks()",
            "query": "physics_sample_cell(cell) refuses CHUNK_NOT_ACQUIRED",
            "rect_units": "world pixels; non-empty and contains actor origin",
            "source_queries_remain_available_while_unmounted": True,
        },
        "spawn": {
            "algorithm": spawn["algorithm"],
            "criteria": spawn["criteria"],
            "candidate_cells": spawn["candidate_cells"],
            "candidate_chunks": spawn["candidate_chunks"],
            "region_counts": spawn["region_counts"],
            "selection": "choose_safe_spawn(run_seed)",
            "persisted_validation": "validate_spawn_cell(cell)",
            "dynamic_occupancy_authority": "A0_REQUIRED_ON_LOAD",
            "production_spawn_approval": False,
        },
        "movement": {
            "base_speed_px_s": builder.contract["traversal"]["base_speed_px_s"],
            "surface_profiles": builder.contract["traversal"]["surface_profiles"],
            "rules": builder.contract["traversal"]["rules"],
            "application_status": builder.contract["traversal"]["status"],
            "river_bank_road": "sample_cell().environment exposes source water/river/bank-transition/road/bridge IDs without inventing new terrain",
        },
        "sites": sites,
        "source_pins": source_pins,
        "authority": {
            "A1": "world identity, source geography, transforms, source reachability and candidate semantics",
            "A0": "GameRoot, run/save identity, camera, dynamic occupancy, final build permission, production mounting and movement adoption",
            "A6": "D051 presentation over the semantically validated physical controller",
            "A8": "local POI scenes, shell/interior transitions and local collision bodies",
            "A3": "items, loot, costs and yields",
        },
        "production": {
            "production_mounted": False,
            "player_playable": False,
            "visually_accepted": False,
            "a8_interior_or_loot_accepted": False,
            "d051_visual_accepted": False,
            "save_mutation_authorized": False,
            "reward_items_granted": 0,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=OUTPUT)
    parser.add_argument("--check", action="store_true", help="fail if the committed manifest is stale; do not write")
    args = parser.parse_args()
    value = build()
    payload = json_bytes(value)
    if args.check:
        if not args.out.is_file() or args.out.read_bytes() != payload:
            raise ValueError("committed R13 continent interface is stale; run compile_r13_continent_interface.py")
    else:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_bytes(payload)
    print(json.dumps({
        "ok": True,
        "out": str(args.out),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "world_id": value["world"]["world_id"],
        "chunks": value["world"]["chunk_count"],
        "spawn_candidates": value["spawn"]["candidate_cells"],
        "sites": {key: {
            "canonical_cell": site["canonical_cell"],
            "approach": site["physical_approach"]["cell"],
            "retreat": site["retreat_target"]["cell"],
            "home_path_cells": site["reachability"]["home_to_approach"]["cell_count"],
        } for key, site in value["sites"].items()},
        "production_mounted": False,
    }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
