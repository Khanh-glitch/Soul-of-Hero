#!/usr/bin/env python3
"""Compile the A1 native-ready two-POI vertical slice.

This does NOT regenerate the continent, edit the world plan, or implement
production gameplay. It reads the existing deterministic world plan and the
already-authored POI interaction specs, then emits exact native-readable
contracts, handoff payloads and executable adversarial vectors for:

  * poi_crown_waystation
  * poi_crown_relay_shed

The output is a contract handoff to A0/A3/A6. `native_playable` remains false
until A0 mounts a real scene, collision, activation, SaveService persistence and
A3/A6 adapters in the production game.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
WORLD = ROOT / "data/survival/world"
OUT = WORLD / "vertical_slice"
PLAN_PATH = WORLD / "world_plan.v1.json"

TILE = 16
HERO_BODY_PX = [12, 16]
HERO_OFFSET_PX = [0, -8]
MANIFEST_SCHEMA = "soh.world.vertical_slice_manifest.v1"
POI_SCHEMA = "soh.world.poi_slice.v1"
VECTORS_SCHEMA = "soh.world.slice_test_vectors.v1"
HANDOFF_SCHEMA = "soh.world.slice_handoff.v1"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def canonical(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def load_plan() -> dict:
    return json.loads(PLAN_PATH.read_text(encoding="utf-8"))


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


def cell_index(plan: dict, cell: list[int] | tuple[int, int]) -> int:
    x, y = cell
    w, h = plan["frame"]["w"], plan["frame"]["h"]
    if not (0 <= x < w and 0 <= y < h):
        raise ValueError(f"cell out of bounds: {cell}")
    return y * w + x


def bresenham(a: list[int] | tuple[int, int], b: list[int] | tuple[int, int]) -> list[list[int]]:
    x0, y0 = a
    x1, y1 = b
    cells: list[list[int]] = []
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    while True:
        cells.append([x0, y0])
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy
    return cells


def polyline_cells(points: list[list[int]]) -> list[list[int]]:
    out: list[list[int]] = []
    for a, b in zip(points, points[1:]):
        seg = bresenham(a, b)
        out.extend(seg if not out else seg[1:])
    return out


def dedupe_cells(cells: list[list[int]]) -> list[list[int]]:
    seen: set[tuple[int, int]] = set()
    out: list[list[int]] = []
    for c in cells:
        key = (c[0], c[1])
        if key not in seen:
            seen.add(key)
            out.append([c[0], c[1]])
    return out


def rect_cells(rect: list[int]) -> list[list[int]]:
    x, y, w, h = rect
    return [[cx, cy] for cy in range(y, y + h) for cx in range(x, x + w)]


def clearance_3x3(center: list[int]) -> list[list[int]]:
    x, y = center
    return [[cx, cy] for cy in range(y - 1, y + 2) for cx in range(x - 1, x + 2)]


def chunk_id_for_cell(plan: dict, cell: list[int]) -> str:
    size = plan["chunk_size"]
    cx, cy = cell[0] // size, cell[1] // size
    return f"chunk:{cx}:{cy}"


def require_clear(plan: dict, walk: list[int], hazard: list[int], cells: list[list[int]], label: str) -> None:
    for c in cells:
        i = cell_index(plan, c)
        if walk[i] != 1:
            raise ValueError(f"{label}: non-walkable required cell {c}")
        if hazard[i] != 0:
            raise ValueError(f"{label}: hazardous required cell {c}")


WAYSTATION_APPROACH = [[392, 200], [408, 200]]
WAYSTATION_RETREAT = [[408, 200], [408, 206], [392, 206], [392, 200]]
RELAY_APPROACH = [[392, 200], [424, 224], [434, 232], [436, 232], [440, 232], [440, 236]]
RELAY_RETREAT = [[440, 236], [440, 243], [424, 224]]
RELAY_RETURN_TO_JUNCTION = [[424, 224], [392, 200]]


def waystation_contract(plan: dict, plan_sha: str, spec_sha: str) -> dict:
    anchor = [408, 200]
    footprint = [403, 195, 11, 11]
    entrance = [403, 200]
    entrance_clear = clearance_3x3(entrance)
    approach = polyline_cells(WAYSTATION_APPROACH)
    retreat = polyline_cells(WAYSTATION_RETREAT)
    stand_locker = [408, 199]
    stand_ledger = [410, 202]
    stand_cache = [406, 202]
    stand_deadfall = [398, 201]
    obstacles = [
        {"obstacle_id": "obs_waystation_locker_bank", "cells": [[408, 198], [409, 198]], "kind": "static_body", "blocks_nav": True},
        {"obstacle_id": "obs_waystation_ledger_desk", "cells": [[411, 202]], "kind": "static_body", "blocks_nav": True},
        {"obstacle_id": "obs_waystation_cache_crate", "cells": [[406, 203]], "kind": "static_body", "blocks_nav": True},
        {"obstacle_id": "obs_waystation_deadfall", "cells": [[398, 202]], "kind": "static_body", "blocks_nav": True},
    ]
    required_nav = dedupe_cells(approach + retreat + entrance_clear + [stand_locker, stand_ledger, stand_cache, stand_deadfall, anchor])
    spawn_forbidden = dedupe_cells(required_nav + clearance_3x3(anchor))
    actions = [
        {
            "action_id": "pry_locker",
            "trigger_node_id": "node_waystation_locker",
            "stand_cells": [stand_locker],
            "interaction_radius_px": 24,
            "enabled": True,
            "one_time": True,
            "requires_capabilities": [],
            "consumes_items": [],
            "grants_capabilities": ["cap_salvage"],
            "reward_items": [],
            "reward_right_id": "rr_waystation_salvage_tool",
            "state_writes": {"locker_opened": True},
            "transaction_key_template": "a1slice:poi_crown_waystation:pry_locker:1",
            "cooldown_active_seconds": 0,
            "missing_prerequisite_reasons": ["NOT_DISCOVERED", "OUT_OF_RANGE", "ALREADY_APPLIED"],
        },
        {
            "action_id": "seal_ledger",
            "trigger_node_id": "node_waystation_ledger",
            "stand_cells": [stand_ledger],
            "interaction_radius_px": 24,
            "enabled": True,
            "one_time": True,
            "requires_capabilities": ["cap_salvage"],
            "consumes_items": [],
            "grants_capabilities": ["cap_seal_1"],
            "reward_items": [],
            "reward_right_id": "rr_waystation_seal_ledger",
            "state_writes": {"ledger_sealed": True},
            "transaction_key_template": "a1slice:poi_crown_waystation:seal_ledger:1",
            "cooldown_active_seconds": 0,
            "missing_prerequisite_reasons": ["NOT_DISCOVERED", "OUT_OF_RANGE", "MISSING_CAPABILITY:cap_salvage", "ALREADY_APPLIED"],
        },
        {
            "action_id": "cache_restock",
            "trigger_node_id": "node_waystation_cache",
            "stand_cells": [stand_cache],
            "interaction_radius_px": 24,
            "enabled": True,
            "one_time": False,
            "requires_capabilities": ["cap_salvage"],
            "consumes_items": [],
            "grants_capabilities": [],
            "reward_items": [
                {"item_id": "iron_scrap", "quantity": 3, "source_id": "road_scrap", "provenance": ["SYS-03", "SYS-04", "A1_SLICE_WAYSTATION_CACHE"]},
                {"item_id": "knowledge_spares", "quantity": 2, "source_id": "road_supplies", "provenance": ["SYS-03", "SYS-04", "A1_SLICE_WAYSTATION_CACHE"]},
            ],
            "reward_right_id": "rr_waystation_cache_claim",
            "state_writes": {"cache_claim_count_delta": 1, "cache_next_ready_active_tick_delta": 1800},
            "transaction_key_template": "a1slice:poi_crown_waystation:cache_restock:{claim_index}",
            "cooldown_active_seconds": 1800,
            "claim_index_field": "cache_claim_count",
            "next_ready_field": "cache_next_ready_active_tick",
            "missing_prerequisite_reasons": ["NOT_DISCOVERED", "OUT_OF_RANGE", "MISSING_CAPABILITY:cap_salvage", "COOLDOWN", "ALREADY_APPLIED"],
        },
        {
            "action_id": "gather_deadfall",
            "trigger_node_id": "node_waystation_approach_deadfall",
            "stand_cells": [stand_deadfall],
            "interaction_radius_px": 24,
            "enabled": True,
            "one_time": False,
            "requires_capabilities": [],
            "consumes_items": [],
            "grants_capabilities": [],
            "reward_items": [
                {"item_id": "oak_wood", "quantity": 2, "source_id": "live_oak_wood", "provenance": ["SYS-03", "SYS-04", "A1_SLICE_APPROACH_DEADFALL"]}
            ],
            "reward_right_id": "rr_waystation_deadfall_claim",
            "state_writes": {"deadfall_claim_count_delta": 1, "deadfall_next_ready_active_tick_delta": 300},
            "transaction_key_template": "a1slice:poi_crown_waystation:gather_deadfall:{claim_index}",
            "cooldown_active_seconds": 300,
            "claim_index_field": "deadfall_claim_count",
            "next_ready_field": "deadfall_next_ready_active_tick",
            "missing_prerequisite_reasons": ["NOT_DISCOVERED", "OUT_OF_RANGE", "COOLDOWN", "ALREADY_APPLIED"],
        },
    ]
    return {
        "schema": POI_SCHEMA,
        "poi_id": "poi_crown_waystation",
        "name": "Ashen Waystation",
        "native_playable": False,
        "integration_status": "NATIVE_READY_CONTRACT_NOT_MOUNTED",
        "world_plan_sha256": plan_sha,
        "source_spec_ref": "poi_authoring/poi_crown_waystation.v1.json",
        "source_spec_sha256": spec_sha,
        "chunk_ids": sorted({chunk_id_for_cell(plan, c) for c in rect_cells(footprint)}),
        "immutable_geography": {
            "anchor_cell": anchor,
            "footprint_rect": footprint,
            "tile_px": TILE,
            "hero_body_px": HERO_BODY_PX,
            "hero_offset_px": HERO_OFFSET_PX,
            "entrances": [{"entrance_id": "ent_waystation_west", "cell": entrance, "required": True, "clearance_cells": entrance_clear}],
            "approach_path": {"route_id": "sp_poi_crown_waystation", "polyline": WAYSTATION_APPROACH, "cells": approach, "hazard_exposure_tiles": 0},
            "retreat_path": {"route_id": "retreat_waystation_safe", "polyline": WAYSTATION_RETREAT, "cells": retreat, "hazard_exposure_tiles": 0},
            "required_nav_cells": required_nav,
            "static_obstacles": obstacles,
            "dynamic_spawns": [],
            "spawn_forbidden_cells": spawn_forbidden,
            "hero_spawn_cell": [392, 200],
            "hero_return_cell": [392, 200],
            "build_permission_delegation": "A0_SURVIVAL_BUILD_VALIDATOR",
            "hazard_rect_ids": [],
        },
        "interaction_nodes": [
            {"node_id": "node_waystation_locker", "cell": [408, 198], "stand_cells": [stand_locker], "action_ids": ["pry_locker"], "area_trigger": True},
            {"node_id": "node_waystation_ledger", "cell": [411, 202], "stand_cells": [stand_ledger], "action_ids": ["seal_ledger"], "area_trigger": True},
            {"node_id": "node_waystation_cache", "cell": [406, 203], "stand_cells": [stand_cache], "action_ids": ["cache_restock"], "area_trigger": True},
            {"node_id": "node_waystation_approach_deadfall", "cell": [398, 202], "stand_cells": [stand_deadfall], "action_ids": ["gather_deadfall"], "area_trigger": True},
        ],
        "actions": actions,
        "initial_persistent_state": {
            "discovered": False,
            "locker_opened": False,
            "ledger_sealed": False,
            "cache_claim_count": 0,
            "cache_next_ready_active_tick": 0,
            "deadfall_claim_count": 0,
            "deadfall_next_ready_active_tick": 0,
            "reward_receipts": {},
            "last_transaction_key": "",
        },
        "persistence": {
            "owner": "A0",
            "save_namespace": "world_slice",
            "save_path": ["world_slice", "pois", "poi_crown_waystation"],
            "state_schema": "soh.world.slice_state.v1",
            "transaction_key_prefix": "a1slice:poi_crown_waystation:",
            "atomic_commit": "SaveService.transact_once",
            "reward_atomicity": "A0 mutator must apply A3 item grants, capability grants, POI state writes and receipt in ONE candidate document",
            "reload_policy": "Durable state and journal survive reload; in-memory pending operations are discarded",
            "death_policy": "Death/respawn does not reset POI flags, receipts, cooldowns or reward rights",
        },
        "a6_projection": {
            "hidden_until_discovered": True,
            "map_status_values": ["HIDDEN", "DISCOVERED", "CACHE_READY", "CACHE_COOLDOWN", "COMPLETED"],
            "discovered_clues": [
                "A pry-marked locker still holds a salvage tool.",
                "The ledger desk can record a basic seal once the locker is opened.",
                "The cache restocks only while the session is active.",
            ],
            "hazard_telegraphs": [],
            "missing_prerequisite_reasons": ["MISSING_CAPABILITY:cap_salvage", "COOLDOWN", "ALREADY_APPLIED"],
        },
        "test_vector_refs": ["VS-01", "VS-04", "VS-05", "VS-06", "VS-07"],
    }


def relay_contract(plan: dict, plan_sha: str, spec_sha: str) -> dict:
    anchor = [440, 236]
    footprint = [434, 230, 13, 13]
    entrance = [434, 232]
    entrance_clear = clearance_3x3(entrance)
    approach = polyline_cells(RELAY_APPROACH)
    retreat = polyline_cells(RELAY_RETREAT + RELAY_RETURN_TO_JUNCTION)
    stand_crank = [442, 234]
    stand_breaker = [443, 236]
    obstacles = [
        {"obstacle_id": "obs_relay_crank_cabinet", "cells": [[443, 234]], "kind": "static_body", "blocks_nav": True},
        {"obstacle_id": "obs_relay_breaker_panel", "cells": [[444, 236]], "kind": "static_body", "blocks_nav": True},
        {"obstacle_id": "obs_relay_shed_wall", "cells": [[436, 230], [437, 230], [438, 230]], "kind": "static_body", "blocks_nav": True},
        {"obstacle_id": "obs_relay_cable_spool", "cells": [[435, 239], [436, 239]], "kind": "static_body", "blocks_nav": True},
    ]
    required_nav = dedupe_cells(approach + retreat + entrance_clear + [stand_crank, stand_breaker, anchor])
    spawn_forbidden = dedupe_cells(required_nav + clearance_3x3(anchor))
    actions = [
        {
            "action_id": "hand_crank_bypass",
            "trigger_node_id": "node_relay_hand_crank",
            "stand_cells": [stand_crank],
            "interaction_radius_px": 24,
            "enabled": True,
            "one_time": True,
            "requires_capabilities": ["cap_salvage"],
            "consumes_items": [
                {"item_id": "iron_scrap", "quantity": 2},
                {"item_id": "oak_wood", "quantity": 1},
            ],
            "grants_capabilities": ["cap_power_1"],
            "reward_items": [],
            "reward_right_id": "rr_relay_power_bypass",
            "state_writes": {"bypass_installed": True, "bus_powered": True, "breaker_tripped": False},
            "transaction_key_template": "a1slice:poi_crown_relay_shed:hand_crank_bypass:1",
            "cooldown_active_seconds": 0,
            "missing_prerequisite_reasons": ["NOT_DISCOVERED", "OUT_OF_RANGE", "MISSING_CAPABILITY:cap_salvage", "MISSING_ITEM:iron_scrap", "MISSING_ITEM:oak_wood", "ALREADY_APPLIED"],
        },
        {
            "action_id": "breaker_reset",
            "trigger_node_id": "node_relay_breaker",
            "stand_cells": [stand_breaker],
            "interaction_radius_px": 24,
            "enabled": True,
            "one_time": False,
            "requires_capabilities": ["cap_power_1"],
            "consumes_items": [],
            "grants_capabilities": [],
            "reward_items": [],
            "reward_right_id": "",
            "state_writes": {"breaker_tripped": False, "bus_powered": True},
            "transaction_key_template": "",
            "cooldown_active_seconds": 0,
            "missing_prerequisite_reasons": ["NOT_DISCOVERED", "OUT_OF_RANGE", "MISSING_CAPABILITY:cap_power_1"],
        },
        {
            "action_id": "copper_upgrade",
            "trigger_node_id": "node_relay_copper_panel",
            "stand_cells": [[443, 238]],
            "interaction_radius_px": 24,
            "enabled": False,
            "deferred_reason": "ITEM_NOT_IN_A3_CATALOG:copper",
            "one_time": True,
            "requires_capabilities": ["cap_power_1"],
            "consumes_items": [{"item_id": "copper", "quantity": 2}, {"item_id": "iron_scrap", "quantity": 1}],
            "grants_capabilities": ["cap_power_2"],
            "reward_items": [],
            "reward_right_id": "rr_relay_copper_upgrade",
            "state_writes": {"copper_upgraded": True},
            "transaction_key_template": "a1slice:poi_crown_relay_shed:copper_upgrade:1",
            "cooldown_active_seconds": 0,
            "missing_prerequisite_reasons": ["DEFERRED:ITEM_NOT_IN_A3_CATALOG:copper", "MISSING_CAPABILITY:cap_power_1", "MISSING_ITEM:copper", "MISSING_ITEM:iron_scrap"],
        },
    ]
    return {
        "schema": POI_SCHEMA,
        "poi_id": "poi_crown_relay_shed",
        "name": "Crown Relay Shed",
        "native_playable": False,
        "integration_status": "NATIVE_READY_CONTRACT_NOT_MOUNTED",
        "world_plan_sha256": plan_sha,
        "source_spec_ref": "poi_authoring/poi_crown_relay_shed.v1.json",
        "source_spec_sha256": spec_sha,
        "chunk_ids": sorted({chunk_id_for_cell(plan, c) for c in rect_cells(footprint)}),
        "immutable_geography": {
            "anchor_cell": anchor,
            "footprint_rect": footprint,
            "tile_px": TILE,
            "hero_body_px": HERO_BODY_PX,
            "hero_offset_px": HERO_OFFSET_PX,
            "entrances": [{"entrance_id": "ent_relay_northwest", "cell": entrance, "required": True, "clearance_cells": entrance_clear}],
            "approach_path": {"route_id": "sp_poi_crown_relay_shed", "polyline": RELAY_APPROACH, "cells": approach, "hazard_exposure_tiles": 0, "requires_capabilities": ["cap_salvage"]},
            "retreat_path": {"route_id": "retreat_relay_safe", "polyline": RELAY_RETREAT + RELAY_RETURN_TO_JUNCTION, "cells": retreat, "hazard_exposure_tiles": 0},
            "required_nav_cells": required_nav,
            "static_obstacles": obstacles,
            "dynamic_spawns": [],
            "spawn_forbidden_cells": spawn_forbidden,
            "hero_spawn_cell": [392, 200],
            "hero_return_cell": [392, 200],
            "build_permission_delegation": "A0_SURVIVAL_BUILD_VALIDATOR",
            "hazard_rect_ids": [],
            "filter_gated_shortcut": {
                "route_id": "rt_east_seam",
                "requires_capabilities": ["cap_filter"],
                "hazard_rect_ids": ["hz_crown_heat", "hz_crown_rot"],
                "required_for_slice": False,
                "unprepared_behavior": "BLOCKED_WITH_TELEGRAPH",
            },
        },
        "interaction_nodes": [
            {"node_id": "node_relay_hand_crank", "cell": [443, 234], "stand_cells": [stand_crank], "action_ids": ["hand_crank_bypass"], "area_trigger": True},
            {"node_id": "node_relay_breaker", "cell": [[444, 236]][0], "stand_cells": [stand_breaker], "action_ids": ["breaker_reset"], "area_trigger": True},
            {"node_id": "node_relay_copper_panel", "cell": [444, 238], "stand_cells": [[443, 238]], "action_ids": ["copper_upgrade"], "area_trigger": True, "enabled": False},
        ],
        "actions": actions,
        "initial_persistent_state": {
            "discovered": False,
            "bypass_installed": False,
            "breaker_tripped": False,
            "bus_powered": False,
            "copper_upgraded": False,
            "reward_receipts": {},
            "last_transaction_key": "",
        },
        "persistence": {
            "owner": "A0",
            "save_namespace": "world_slice",
            "save_path": ["world_slice", "pois", "poi_crown_relay_shed"],
            "state_schema": "soh.world.slice_state.v1",
            "transaction_key_prefix": "a1slice:poi_crown_relay_shed:",
            "atomic_commit": "SaveService.transact_once",
            "reward_atomicity": "A0 mutator must apply item consumption, capability grants, POI state writes and receipt in ONE candidate document; failure consumes nothing",
            "reload_policy": "Durable state and journal survive reload; in-memory pending operations are discarded",
            "death_policy": "Death/respawn does not reset POI flags, receipts, cooldowns or reward rights",
        },
        "a6_projection": {
            "hidden_until_discovered": True,
            "map_status_values": ["HIDDEN", "DISCOVERED", "MISSING_PREREQUISITE", "POWERED", "DEFERRED_UPGRADE"],
            "discovered_clues": [
                "The hand-crank bypass needs a salvage tool, two iron scrap and one oak wood.",
                "The breaker can be reset after power is restored.",
                "The copper upgrade panel is dark; copper is not yet a catalog item.",
            ],
            "hazard_telegraphs": [
                {"hazard_id": "hz_crown_heat", "clue": "Heat shimmer and ash drift mark the eastern seam; a filter is required.", "required_capability": "cap_filter"},
                {"hazard_id": "hz_crown_rot", "clue": "Rot spores collect in the low seam; a filter is required.", "required_capability": "cap_filter"},
            ],
            "missing_prerequisite_reasons": ["MISSING_CAPABILITY:cap_salvage", "MISSING_ITEM:iron_scrap", "MISSING_ITEM:oak_wood", "DEFERRED:ITEM_NOT_IN_A3_CATALOG:copper"],
        },
        "test_vector_refs": ["VS-01", "VS-02", "VS-03", "VS-04", "VS-05", "VS-06", "VS-07"],
    }


def handoff_contract(plan_sha: str) -> dict:
    return {
        "schema": HANDOFF_SCHEMA,
        "native_playable": False,
        "world_plan_sha256": plan_sha,
        "research_firewall": {
            "prototype_p1_core_world_interactions": "RESEARCH_ONLY_NOT_IMPLEMENTED",
            "prototype_p2_dynamic_weather": "RESEARCH_ONLY_NOT_IMPLEMENTED",
            "prototype_p3_physical_cart": "RESEARCH_ONLY_NOT_IMPLEMENTED",
            "typescript_imported": False,
            "world_regenerated": False,
            "existing_seams_documented_only": [
                "poi_crown_relay_shed bus_powered flag is a future CT-08 power-bus seam; no Core-world mechanic is implemented here",
                "hz_crown_heat / hz_crown_rot remain static authored hazard rects; no dynamic weather is implemented here",
                "rt_crown_buffer and trunk roads remain 2-tile authored roads; no physical cart or road-width change is implemented here",
            ],
        },
        "a0": {
            "owner": "A0",
            "save_service_ref": "origin/arena/dea2428e-soul-of-hero@b3722585:game/survival/save_service.gd",
            "save_service_sha256": "5748dc9f2fdaf58ca254cd8111ed4132d45409dd6934f6699f878037747a73d0",
            "survival_state_sha256": "9899b0733905e3a06d49464ee443a33f4d02659b2f8ef13276836e60cf803233",
            "proposed_save_namespace": {
                "path": ["world_slice"],
                "schema": "soh.world.slice_state.v1",
                "migration_owner": "A0",
                "note": "Top-level additive namespace; A0 must add sanitizer/migration before production use. Current SaveService preserves unknown top-level keys, but A1 does not edit A0 files.",
            },
            "reader_contract": {
                "inputs": ["vertical_slice/manifest.json", "vertical_slice/<poi_id>.slice.json", "chunks/<chunk_id>.json", "world_plan.v1.json"],
                "must_validate": ["schema", "world_plan_sha256", "chunk seam hash", "required_nav_cells walk=1 hazard=0", "static_obstacles do not intersect required_nav_cells or entrance clearance", "spawn_forbidden_cells include Hero spawn, doorway clearance and required nav"],
                "collision_layers": {"static_obstacle": 1, "hero": 2, "interaction_area_mask": 2},
                "hero_body_px": HERO_BODY_PX,
                "hero_offset_px": HERO_OFFSET_PX,
                "build_permission": "delegate every legacy build=0 cell to A0 SurvivalBuildSystem validator; build=0 is not a prohibition",
            },
            "activation_contract": {
                "request_schema": "soh.world.slice.activate.v1",
                "request_fields": ["poi_id", "hero_cell", "capabilities", "active_tick", "session_id"],
                "response_fields": ["poi_id", "discovered", "spawn_plan", "interactables", "blocked_reasons", "map_status"],
                "dynamic_spawn_policy": "NO_DYNAMIC_SPAWNS_IN_SLICE_V1; any future spawn must reject hero_cell, entrance clearance, required_nav_cells and occupied cells",
            },
            "action_contract": {
                "request_schema": "soh.world.slice.action_request.v1",
                "request_fields": ["request_id", "poi_id", "action_id", "hero_cell", "active_tick", "session_id"],
                "result_schema": "soh.world.slice.action_result.v1",
                "result_fields": ["result", "reason", "transaction_key", "state_patch", "consumed_items", "granted_capabilities", "granted_items"],
                "atomicity": "Use SaveService.transact_once for one-shot entitlements and renewable claims; failed guards consume no key/material/entitlement; pending operations are not durable",
            },
            "payload_examples": {
                "activate_request": {"schema": "soh.world.slice.activate.v1", "poi_id": "poi_crown_waystation", "hero_cell": [403, 200], "capabilities": [], "active_tick": 0, "session_id": "slice-session-1"},
                "activate_response": {"schema": "soh.world.slice.activate.v1", "poi_id": "poi_crown_waystation", "discovered": True, "spawn_plan": {"static_obstacles": 4, "dynamic_spawns": 0}, "interactables": ["node_waystation_locker", "node_waystation_ledger", "node_waystation_cache", "node_waystation_approach_deadfall"], "blocked_reasons": [], "map_status": "DISCOVERED"},
                "action_request": {"schema": "soh.world.slice.action_request.v1", "request_id": "req-0001", "poi_id": "poi_crown_relay_shed", "action_id": "hand_crank_bypass", "hero_cell": [442, 234], "active_tick": 600, "session_id": "slice-session-1"},
                "action_success": {"schema": "soh.world.slice.action_result.v1", "result": "SUCCESS", "reason": "", "transaction_key": "a1slice:poi_crown_relay_shed:hand_crank_bypass:1", "state_patch": {"bypass_installed": True, "bus_powered": True, "breaker_tripped": False}, "consumed_items": {"iron_scrap": 2, "oak_wood": 1}, "granted_capabilities": ["cap_power_1"], "granted_items": {}},
                "action_rejected": {"schema": "soh.world.slice.action_result.v1", "result": "REJECTED", "reason": "MISSING_ITEM:oak_wood", "transaction_key": "", "state_patch": {}, "consumed_items": {}, "granted_capabilities": [], "granted_items": {}},
                "save_state_example": {"schema": "soh.world.slice_state.v1", "pois": {"poi_crown_waystation": {"discovered": True, "locker_opened": True, "ledger_sealed": True, "cache_claim_count": 1, "cache_next_ready_active_tick": 1800, "deadfall_claim_count": 1, "deadfall_next_ready_active_tick": 300, "reward_receipts": {"a1slice:poi_crown_waystation:pry_locker:1": "rr_waystation_salvage_tool"}, "last_transaction_key": "a1slice:poi_crown_waystation:cache_restock:1"}, "poi_crown_relay_shed": {"discovered": True, "bypass_installed": True, "breaker_tripped": False, "bus_powered": True, "copper_upgraded": False, "reward_receipts": {"a1slice:poi_crown_relay_shed:hand_crank_bypass:1": "rr_relay_power_bypass"}, "last_transaction_key": "a1slice:poi_crown_relay_shed:hand_crank_bypass:1"}}},
            },
        },
        "a3": {
            "owner": "A3",
            "model_ref": "origin/arena/7a12b27e-soul-of-hero@08711ea7",
            "items_sha256": "0dd502bb439a11657c10074e51a55d144ae6b9eb622afa55967207380ba85a2d",
            "sources_sha256": "7c2cddcdbdb8f2dbb96564abf91fed7ff598a1c750d052302bef685bd112a602",
            "progression_model_sha256": "cfcfa6ee202158e56c1620a229f0919e6ba0e456b03cb21ed1625f439eba994f",
            "exact_item_ids": ["iron_scrap", "oak_wood", "knowledge_spares"],
            "exact_source_ids": ["road_scrap", "road_supplies", "live_oak_wood", "live_iron_scrap"],
            "source_bindings": [
                {"source_id": "road_scrap", "item_id": "iron_scrap", "slice_node_id": "node_waystation_cache", "poi_id": "poi_crown_waystation", "renewable": True, "cooldown_active_seconds": 1800, "yield_per_claim": 3, "binding_request": "REBIND_FROM_PROVISIONAL_poi:roadside_cache_TO_A1_WAYSTATION_CACHE"},
                {"source_id": "road_supplies", "item_id": "knowledge_spares", "slice_node_id": "node_waystation_cache", "poi_id": "poi_crown_waystation", "renewable": True, "cooldown_active_seconds": 1800, "yield_per_claim": 2, "binding_request": "REBIND_FROM_PROVISIONAL_poi:roadside_cache_TO_A1_WAYSTATION_CACHE"},
                {"source_id": "live_oak_wood", "item_id": "oak_wood", "slice_node_id": "node_waystation_approach_deadfall", "poi_id": "poi_crown_waystation", "renewable": True, "cooldown_active_seconds": 300, "yield_per_claim": 2, "binding_request": "A1_APPROACH_NODE_USES_EXISTING_LIVE_SOURCE"},
            ],
            "one_time_reward_rights": [
                {"reward_right_id": "rr_waystation_salvage_tool", "poi_id": "poi_crown_waystation", "action_id": "pry_locker", "grants_capabilities": ["cap_salvage"], "item_rewards": [], "transaction_key": "a1slice:poi_crown_waystation:pry_locker:1"},
                {"reward_right_id": "rr_waystation_seal_ledger", "poi_id": "poi_crown_waystation", "action_id": "seal_ledger", "grants_capabilities": ["cap_seal_1"], "item_rewards": [], "transaction_key": "a1slice:poi_crown_waystation:seal_ledger:1"},
                {"reward_right_id": "rr_relay_power_bypass", "poi_id": "poi_crown_relay_shed", "action_id": "hand_crank_bypass", "grants_capabilities": ["cap_power_1"], "item_rewards": [], "consumes_items": {"iron_scrap": 2, "oak_wood": 1}, "transaction_key": "a1slice:poi_crown_relay_shed:hand_crank_bypass:1"},
            ],
            "alias_decisions": {
                "early_roadside_salvage": "REJECT_AS_SEPARATE_POI; safe bootstrap is the Waystation approach/cache, not a new roadside POI",
                "a1_crown_salvage": "SPLIT; safe Waystation cache requires cap_salvage only; cap_filter belongs to the optional eastern-seam shortcut, not the first-hour cache",
                "specimen_ember": "DEFER_OUTSIDE_TWO_POI_SLICE",
                "specimen_frost": "DEFER_OUTSIDE_TWO_POI_SLICE",
                "specimen_venom": "DEFER_OUTSIDE_TWO_POI_SLICE",
                "catalyst_vault": "DEFER_OUTSIDE_TWO_POI_SLICE",
                "hardwood_to_oak_wood": "REJECT_ALIAS; oak_wood is the exact catalog item, hardwood is not approved",
            },
            "atomic_reward_ownership": "A0 SaveService transaction is the sole commit boundary; A3 provides item/source catalog and candidate-document helpers but must not write a side journal or grant rewards outside the A0 mutator",
            "payload_examples": {
                "reward_grant_request": {"schema": "soh.world.slice.reward_grant.v1", "transaction_key": "a1slice:poi_crown_waystation:cache_restock:1", "reward_right_id": "rr_waystation_cache_claim", "poi_id": "poi_crown_waystation", "source_bindings": [{"source_id": "road_scrap", "item_id": "iron_scrap", "quantity": 3}, {"source_id": "road_supplies", "item_id": "knowledge_spares", "quantity": 2}], "active_tick": 600, "session_id": "slice-session-1"},
                "reward_grant_success": {"schema": "soh.world.slice.reward_grant.v1", "result": "SUCCESS", "transaction_key": "a1slice:poi_crown_waystation:cache_restock:1", "granted_items": {"iron_scrap": 3, "knowledge_spares": 2}, "receipt": "rr_waystation_cache_claim"},
                "reward_grant_duplicate": {"schema": "soh.world.slice.reward_grant.v1", "result": "ALREADY_APPLIED", "transaction_key": "a1slice:poi_crown_waystation:cache_restock:1", "granted_items": {}, "receipt": "rr_waystation_cache_claim"},
            },
        },
        "a6": {
            "owner": "A6",
            "contract_ref": "origin/recovery/a6-source-only-20261029@bb71bd05:docs/survival/ux/V1_WORKSPACE_CONTRACT.md",
            "contract_sha256": "49b43b75714459e86d474d96d6d1ea985e343eb692c47fee3703e2a439a1fc37",
            "projection_schema": "soh.world.slice.a6_projection.v1",
            "rules": [
                "Undiscovered POIs expose no private action, reward, prerequisite or map metadata",
                "Discovered POIs expose clues, map status and missing-prerequisite reasons only after A0 activation",
                "Hazard telegraphs are environmental clues, not arbitrary level barriers",
                "A6 sends intents; A0 remains authoritative for action commits and save mutation",
            ],
            "payload_examples": {
                "hidden": {"schema": "soh.world.slice.a6_projection.v1", "poi_id": "poi_crown_relay_shed", "visibility": "HIDDEN", "map_status": "HIDDEN", "clues": [], "hazard_telegraphs": [], "missing_prerequisite_reasons": []},
                "discovered_missing_prereq": {"schema": "soh.world.slice.a6_projection.v1", "poi_id": "poi_crown_relay_shed", "visibility": "DISCOVERED", "map_status": "MISSING_PREREQUISITE", "clues": ["The hand-crank bypass needs a salvage tool, two iron scrap and one oak wood."], "hazard_telegraphs": [{"hazard_id": "hz_crown_heat", "clue": "Heat shimmer and ash drift mark the eastern seam; a filter is required.", "required_capability": "cap_filter"}], "missing_prerequisite_reasons": ["MISSING_ITEM:oak_wood"]},
                "powered": {"schema": "soh.world.slice.a6_projection.v1", "poi_id": "poi_crown_relay_shed", "visibility": "DISCOVERED", "map_status": "POWERED", "clues": ["The relay bus hums; the breaker can be reset."], "hazard_telegraphs": [], "missing_prerequisite_reasons": []},
            },
        },
    }


def test_vectors() -> dict:
    return {
        "schema": VECTORS_SCHEMA,
        "native_playable": False,
        "fixture_scope": "ISOLATED_CONTRACT_REDUCER_ONLY; no Hero movement, combat, damage, production SaveService or scene-tree persistence is claimed",
        "vectors": [
            {
                "vector_id": "VS-01",
                "title": "Novice first-hour both POIs and return",
                "required": True,
                "steps": [
                    {"event": "discover", "poi_id": "poi_crown_waystation", "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "pry_locker", "hero_cell": [408, 199], "expect": "SUCCESS"},
                    {"event": "commit", "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "seal_ledger", "hero_cell": [410, 202], "expect": "SUCCESS"},
                    {"event": "commit", "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "cache_restock", "hero_cell": [406, 202], "expect": "SUCCESS"},
                    {"event": "commit", "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "gather_deadfall", "hero_cell": [398, 201], "expect": "SUCCESS"},
                    {"event": "commit", "expect": "SUCCESS"},
                    {"event": "discover", "poi_id": "poi_crown_relay_shed", "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_relay_shed", "action_id": "hand_crank_bypass", "hero_cell": [442, 234], "expect": "SUCCESS"},
                    {"event": "commit", "expect": "SUCCESS"},
                    {"event": "retreat", "poi_id": "poi_crown_relay_shed", "expect": "SUCCESS"},
                    {"event": "return", "poi_id": "poi_crown_waystation", "expect": "SUCCESS"},
                ],
                "assertions": ["cap_salvage", "cap_seal_1", "cap_power_1", "iron_scrap>=1", "knowledge_spares>=2", "oak_wood>=1", "bus_powered", "hero_return_cell=[392,200]"],
            },
            {
                "vector_id": "VS-02",
                "title": "Filter-gated shortcut blocked unprepared",
                "required": True,
                "steps": [
                    {"event": "check_route", "route_id": "rt_east_seam", "capabilities": [], "expect": "BLOCKED", "reason": "MISSING_CAPABILITY:cap_filter"},
                    {"event": "check_route", "route_id": "rt_crown_safe_approach", "capabilities": [], "expect": "SUCCESS"},
                ],
                "assertions": ["shortcut_not_required", "safe_approach_zero_hazard"],
            },
            {
                "vector_id": "VS-03",
                "title": "No permanently blocked required route",
                "required": True,
                "steps": [
                    {"event": "validate_geometry", "poi_id": "poi_crown_waystation", "expect": "SUCCESS"},
                    {"event": "validate_geometry", "poi_id": "poi_crown_relay_shed", "expect": "SUCCESS"},
                    {"event": "check_route", "route_id": "retreat_waystation_safe", "capabilities": [], "expect": "SUCCESS"},
                    {"event": "check_route", "route_id": "retreat_relay_safe", "capabilities": [], "expect": "SUCCESS"},
                ],
                "assertions": ["obstacles_do_not_block_required_nav", "entrance_clearance_3x3", "retreat_zero_hazard"],
            },
            {
                "vector_id": "VS-04",
                "title": "No duplicated one-time reward after reload/re-entry",
                "required": True,
                "steps": [
                    {"event": "discover", "poi_id": "poi_crown_waystation", "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "pry_locker", "hero_cell": [408, 199], "expect": "SUCCESS"},
                    {"event": "commit", "expect": "SUCCESS"},
                    {"event": "reload", "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "pry_locker", "hero_cell": [408, 199], "expect": "ALREADY_APPLIED"},
                    {"event": "retreat", "poi_id": "poi_crown_waystation", "expect": "SUCCESS"},
                    {"event": "return", "poi_id": "poi_crown_waystation", "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "pry_locker", "hero_cell": [408, 199], "expect": "ALREADY_APPLIED"},
                ],
                "assertions": ["cap_salvage_granted_once", "receipt_survives_reload", "no_duplicate_reward"],
            },
            {
                "vector_id": "VS-05",
                "title": "Stable route/POI identity across compilation",
                "required": True,
                "steps": [
                    {"event": "validate_identity", "expect": "SUCCESS"},
                ],
                "assertions": ["poi_ids_stable", "route_ids_stable", "transaction_keys_stable", "world_plan_sha256_pinned"],
            },
            {
                "vector_id": "VS-06",
                "title": "No dynamic spawn on Hero or blocking a required doorway",
                "required": True,
                "steps": [
                    {"event": "spawn_check", "poi_id": "poi_crown_waystation", "cell": [392, 200], "hero_cell": [392, 200], "expect": "REJECTED", "reason": "SPAWN_ON_HERO"},
                    {"event": "spawn_check", "poi_id": "poi_crown_waystation", "cell": [403, 200], "hero_cell": [392, 200], "expect": "REJECTED", "reason": "SPAWN_BLOCKED_REQUIRED_DOORWAY"},
                    {"event": "spawn_check", "poi_id": "poi_crown_relay_shed", "cell": [434, 232], "hero_cell": [392, 200], "expect": "REJECTED", "reason": "SPAWN_BLOCKED_REQUIRED_DOORWAY"},
                    {"event": "spawn_check", "poi_id": "poi_crown_relay_shed", "cell": [440, 236], "hero_cell": [440, 236], "expect": "REJECTED", "reason": "SPAWN_ON_HERO"},
                ],
                "assertions": ["dynamic_spawns_empty", "spawn_forbidden_includes_doorway_and_hero"],
            },
            {
                "vector_id": "VS-07",
                "title": "Failed action consumes no key/material/entitlement",
                "required": True,
                "steps": [
                    {"event": "discover", "poi_id": "poi_crown_relay_shed", "expect": "SUCCESS"},
                    {"event": "set_inventory", "inventory": {"iron_scrap": 2, "oak_wood": 0}, "expect": "SUCCESS"},
                    {"event": "set_capabilities", "capabilities": ["cap_salvage"], "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_relay_shed", "action_id": "hand_crank_bypass", "hero_cell": [442, 234], "expect": "REJECTED", "reason": "MISSING_ITEM:oak_wood"},
                    {"event": "assert_inventory", "inventory": {"iron_scrap": 2, "oak_wood": 0}, "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_relay_shed", "action_id": "copper_upgrade", "hero_cell": [443, 238], "expect": "REJECTED", "reason": "DEFERRED:ITEM_NOT_IN_A3_CATALOG:copper"},
                    {"event": "assert_inventory", "inventory": {"iron_scrap": 2, "oak_wood": 0}, "expect": "SUCCESS"},
                ],
                "assertions": ["failed_action_no_consumption", "deferred_upgrade_no_consumption", "no_entitlement_on_failure"],
            },
            {
                "vector_id": "VS-08",
                "title": "Interrupted operation and reload during/after transition",
                "required": False,
                "steps": [
                    {"event": "discover", "poi_id": "poi_crown_waystation", "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "pry_locker", "hero_cell": [408, 199], "expect": "SUCCESS"},
                    {"event": "interrupt", "expect": "SUCCESS"},
                    {"event": "reload", "expect": "SUCCESS"},
                    {"event": "assert_flag", "poi_id": "poi_crown_waystation", "flag": "locker_opened", "value": False, "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "pry_locker", "hero_cell": [408, 199], "expect": "SUCCESS"},
                    {"event": "commit", "expect": "SUCCESS"},
                    {"event": "reload", "expect": "SUCCESS"},
                    {"event": "assert_flag", "poi_id": "poi_crown_waystation", "flag": "locker_opened", "value": True, "expect": "SUCCESS"},
                ],
                "assertions": ["pending_not_durable", "committed_state_durable"],
            },
            {
                "vector_id": "VS-09",
                "title": "Renewable cache cooldown and duplicate claim index",
                "required": False,
                "steps": [
                    {"event": "discover", "poi_id": "poi_crown_waystation", "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "pry_locker", "hero_cell": [408, 199], "expect": "SUCCESS"},
                    {"event": "commit", "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "cache_restock", "hero_cell": [406, 202], "expect": "SUCCESS"},
                    {"event": "commit", "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "cache_restock", "hero_cell": [406, 202], "expect": "COOLDOWN"},
                    {"event": "advance_tick", "active_tick": 1800, "expect": "SUCCESS"},
                    {"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "cache_restock", "hero_cell": [406, 202], "expect": "SUCCESS"},
                    {"event": "commit", "expect": "SUCCESS"},
                ],
                "assertions": ["cooldown_blocks_early_claim", "new_claim_index_after_cooldown", "active_tick_only"],
            },
            {
                "vector_id": "VS-10",
                "title": "A6 discovered-only projection",
                "required": False,
                "steps": [
                    {"event": "project_a6", "poi_id": "poi_crown_relay_shed", "expect_visibility": "HIDDEN"},
                    {"event": "discover", "poi_id": "poi_crown_relay_shed", "expect": "SUCCESS"},
                    {"event": "project_a6", "poi_id": "poi_crown_relay_shed", "expect_visibility": "DISCOVERED"},
                ],
                "assertions": ["hidden_leaks_no_private_metadata", "discovered_exposes_clues_only"],
            },
        ],
    }


def compile_all() -> dict:
    plan = load_plan()
    plan_sha = sha256_file(PLAN_PATH)
    walk = decode_layer(plan, "walk")
    hazard = decode_layer(plan, "hazard")
    spec_w = WORLD / "poi_authoring/poi_crown_waystation.v1.json"
    spec_r = WORLD / "poi_authoring/poi_crown_relay_shed.v1.json"
    way = waystation_contract(plan, plan_sha, sha256_file(spec_w))
    relay = relay_contract(plan, plan_sha, sha256_file(spec_r))
    for contract in (way, relay):
        geo = contract["immutable_geography"]
        require_clear(plan, walk, hazard, geo["required_nav_cells"], contract["poi_id"] + " required_nav")
        obstacle_cells = {tuple(c) for ob in geo["static_obstacles"] for c in ob["cells"]}
        nav = {tuple(c) for c in geo["required_nav_cells"]}
        if obstacle_cells & nav:
            raise ValueError(f"{contract['poi_id']}: obstacle intersects required nav")
        for ent in geo["entrances"]:
            require_clear(plan, walk, hazard, ent["clearance_cells"], contract["poi_id"] + " entrance")
            if obstacle_cells & {tuple(c) for c in ent["clearance_cells"]}:
                raise ValueError(f"{contract['poi_id']}: obstacle blocks entrance")
        if geo["dynamic_spawns"]:
            raise ValueError("slice v1 must not declare dynamic spawns")
    handoff = handoff_contract(plan_sha)
    vectors = test_vectors()
    files = {
        "poi_crown_waystation.slice.json": way,
        "poi_crown_relay_shed.slice.json": relay,
        "handoff_contracts.json": handoff,
        "test_vectors.json": vectors,
    }
    manifest = {
        "schema": MANIFEST_SCHEMA,
        "slice_id": "a1_crown_two_poi_native_ready_v1",
        "native_playable": False,
        "integration_status": "NATIVE_READY_CONTRACT_NOT_MOUNTED",
        "world_plan_sha256": plan_sha,
        "poi_ids": ["poi_crown_waystation", "poi_crown_relay_shed"],
        "files": {},
        "owners": {"geography_and_contracts": "A1", "native_scene_collision_save": "A0", "items_sources_reward_catalog": "A3", "ux_projection": "A6"},
        "research_firewall": handoff["research_firewall"],
    }
    OUT.mkdir(parents=True, exist_ok=True)
    for name, obj in files.items():
        write_json(OUT / name, obj)
    manifest["files"] = {name: {"sha256": sha256_file(OUT / name), "schema": obj["schema"]} for name, obj in sorted(files.items())}
    write_json(OUT / "manifest.json", manifest)
    return {"ok": True, "manifest_sha256": sha256_file(OUT / "manifest.json"), "files": sorted(files) + ["manifest.json"], "native_playable": False}


if __name__ == "__main__":
    print(json.dumps(compile_all(), sort_keys=True))
