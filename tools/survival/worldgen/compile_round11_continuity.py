#!/usr/bin/env python3
"""Compile Round 11's single exact-source continuity/consumer packet.

The compiler derives routes from canonical chunks; it never edits geography,
production mounts, rewards, health, A0/A3/A8 code, or the accepted placement
contract.  Godot consumes the emitted artifact for isolated native evidence.
"""
from __future__ import annotations

import argparse
from collections import deque
import hashlib
import json
from pathlib import Path
import sys
from typing import Iterable

sys.path.insert(0, str(Path(__file__).resolve().parent))
import compile_world_art as cwa
from compile_placement_review import frame_for, merged_collision

ROOT = cwa.ROOT
WORLD = ROOT / "data/survival/world"
CONTRACT = WORLD / "a1_round11_continuity_contract.v1.json"
TILE = 16
DIRECTIONS = ((1, 0), (-1, 0), (0, 1), (0, -1))


def sha_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def foot(cell: list[int]) -> tuple[float, float]:
    return (cell[0] * TILE + 8.0, cell[1] * TILE + 15.0)


def chunk_id(cell: list[int]) -> str:
    return f"chunk:{cell[0] // 64}:{cell[1] // 64}"


def named_value(layers: cwa.Layers, cell: list[int], layer: str) -> str:
    chunk = layers.chunk(cell)
    value = layers.value(cell, layer)
    legend = chunk.get("legend", {}).get(layer, [])
    return str(legend[value - 1]) if 1 <= value <= len(legend) else ""


def sample(layers: cwa.Layers, cell: list[int]) -> dict:
    hazard_value = layers.value(cell, "hazard")
    return {
        "cell": list(cell),
        "chunk_id": chunk_id(cell),
        "region_id": named_value(layers, cell, "region"),
        "biome_id": named_value(layers, cell, "biome"),
        "surface_id": layers.surface_name(cell),
        "hazard_id": named_value(layers, cell, "hazard") if hazard_value else None,
        "walk": layers.value(cell, "walk"),
        "hazard": hazard_value,
    }


def rect_intersects(a_center: tuple[float, float], a_size: list[int],
                    b_center: tuple[float, float], b_size: list[int]) -> bool:
    return (abs(a_center[0] - b_center[0]) < (a_size[0] + b_size[0]) * 0.5 and
            abs(a_center[1] - b_center[1]) < (a_size[1] + b_size[1]) * 0.5)


def body_from_socket(socket_cell: list[int], size_px: list[int], body_id: str) -> dict:
    return {
        "id": body_id,
        "socket_cell": list(socket_cell),
        "center_px": [socket_cell[0] * TILE + 8, socket_cell[1] * TILE + 8],
        "size_px": list(size_px),
    }


def hero_clear_of_body(cell: list[int], hero_size: list[int], body: dict) -> bool:
    fx, fy = foot(cell)
    hero_center = (fx, fy - 8.0)
    return not rect_intersects(hero_center, hero_size, tuple(body["center_px"]), body["size_px"])


def inside_rect(cell: list[int], rect: list[int]) -> bool:
    return rect[0] <= cell[0] < rect[0] + rect[2] and rect[1] <= cell[1] < rect[1] + rect[3]


def bfs_path(layers: cwa.Layers, start: list[int], goal: list[int], *,
             bodies: list[dict] | None = None, hero_size: list[int] | None = None,
             allow_hazard: bool = False, bounds: list[int] | None = None) -> list[list[int]]:
    """Deterministic four-neighbour route with three-row live-body clearance."""
    bodies = bodies or []
    hero_size = hero_size or [12, 16]
    width, height = layers.plan["frame"]["w"], layers.plan["frame"]["h"]

    def clear(cell: tuple[int, int]) -> bool:
        x, y = cell
        if not (0 <= x < width and 1 <= y < height - 1):
            return False
        if bounds is not None and not inside_rect(list(cell), bounds):
            return False
        for dy in (-1, 0, 1):
            if not layers.value([x, y + dy], "walk"):
                return False
        # Source walk keeps the accepted conservative three-row margin. Mounted
        # bodies instead use the exact current-foot AABB, so a valid stand two
        # cells south of a 28x28 body is not rejected via a fictitious neighbour.
        if any(not hero_clear_of_body(list(cell), hero_size, body) for body in bodies):
            return False
        return True

    start_t, goal_t = tuple(start), tuple(goal)
    if not clear(start_t) or not clear(goal_t):
        raise ValueError(f"unclear route endpoint {start}->{goal}")
    queue: deque[tuple[int, int]] = deque([start_t])
    previous: dict[tuple[int, int], tuple[int, int] | None] = {start_t: None}
    while queue:
        cur = queue.popleft()
        if cur == goal_t:
            break
        for dx, dy in DIRECTIONS:
            nxt = (cur[0] + dx, cur[1] + dy)
            if nxt in previous or not clear(nxt):
                continue
            if not allow_hazard and layers.value(list(nxt), "hazard") != 0:
                continue
            previous[nxt] = cur
            queue.append(nxt)
    if goal_t not in previous:
        raise ValueError(f"no source path {start}->{goal}; bodies={[b['id'] for b in bodies]}")
    result: list[list[int]] = []
    cur: tuple[int, int] | None = goal_t
    while cur is not None:
        result.append(list(cur))
        cur = previous[cur]
    result.reverse()
    return result


def path_stats(layers: cwa.Layers, cells: list[list[int]]) -> dict:
    samples = [sample(layers, c) for c in cells]
    return {
        "cell_count": len(cells),
        "step_count": max(0, len(cells) - 1),
        "region_ids": sorted({s["region_id"] for s in samples if s["region_id"]}),
        "biome_ids": sorted({s["biome_id"] for s in samples if s["biome_id"]}),
        "chunk_ids": sorted({s["chunk_id"] for s in samples}),
        "hazard_cells": [s["cell"] for s in samples if s["hazard"]],
        "freshwater_marsh_cells": sum(s["biome_id"] == "freshwater_marsh" for s in samples),
    }


def compile_leg(layers: cwa.Layers, spec: dict, bodies: list[dict], hero_size: list[int]) -> dict:
    cells = bfs_path(layers, spec["from_cell"], spec["to_cell"], bodies=bodies, hero_size=hero_size)
    if cells[0] != spec["from_cell"] or cells[-1] != spec["to_cell"]:
        raise ValueError(f"route endpoints changed for {spec['leg_id']}")
    stats = path_stats(layers, cells)
    if stats["hazard_cells"]:
        raise ValueError(f"ordinary/deep route entered authored hazard: {spec['leg_id']}")
    row = dict(spec)
    row.update({"cells": cells, "return_cells": list(reversed(cells)), "stats": stats})
    return row


def validate_pin(contract: dict, key: str) -> dict:
    pin = contract["source_pins"][key]
    path = ROOT / pin["path"]
    if not path.is_file() or sha_file(path) != pin["sha256"]:
        raise ValueError(f"source pin mismatch: {key}")
    return pin


def body_set(contract: dict, ids: Iterable[str]) -> list[dict]:
    endpoint_cases = {x["endpoint_id"]: x for x in contract["trial_endpoint_stress"]["source_cases"]}
    bodies = []
    for body_id in ids:
        if body_id == contract["chest_source_proposal"]["proposal_id"]:
            chest = contract["chest_source_proposal"]
            bodies.append(body_from_socket(chest["socket_cell"], chest["collision_size_px"], body_id))
        elif body_id in endpoint_cases:
            endpoint = endpoint_cases[body_id]
            bodies.append(body_from_socket(endpoint["socket_cell"], endpoint["body_size_px"], body_id))
        else:
            raise ValueError(f"unknown mounted body {body_id}")
    return bodies


def validate_chest(contract: dict, layers: cwa.Layers, quarry: dict, shells: dict) -> None:
    chest = contract["chest_source_proposal"]
    if chest["socket_cell"] == chest["ordinary_action_socket_cell"]:
        raise ValueError("chest must not overlap A8 ordinary action socket")
    if chest["socket_cell"] != [33, 280] or chest["stand_cell"] != [33, 282]:
        raise ValueError("unreviewed chest geometry")
    expected_socket = [chest["socket_cell"][0] * 16 + 8, chest["socket_cell"][1] * 16 + 8]
    expected_stand = [chest["stand_cell"][0] * 16 + 8, chest["stand_cell"][1] * 16 + 15]
    if chest["socket_world_px"] != expected_socket or chest["stand_world_px"] != expected_stand:
        raise ValueError("chest world/stand coordinates do not match cells")
    shell = quarry["overworld_shell"]
    local_socket = shell["action_socket"]
    canonical_world = [30 * 16 + 8, 280 * 16 + 8]
    origin = [canonical_world[i] - local_socket[i] for i in (0, 1)]
    entry = [origin[i] + shell["entry_portal"][i] for i in (0, 1)]
    doorway_local = shell["visual_layout"]["doorway_clear_rect_px"]
    doorway = [origin[0] + doorway_local[0], origin[1] + doorway_local[1], doorway_local[2], doorway_local[3]]
    if chest["a8_shell_origin_world_px"] != origin or chest["a8_entry_portal_world_px"] != entry:
        raise ValueError("A8 shell transform drift")
    if chest["a8_doorway_clear_world_rect_px"] != doorway:
        raise ValueError("A8 doorway clearance drift")
    chest_center = tuple(chest["socket_world_px"])
    doorway_center = (doorway[0] + doorway[2] * 0.5, doorway[1] + doorway[3] * 0.5)
    if rect_intersects(chest_center, chest["collision_size_px"], doorway_center, doorway[2:]):
        raise ValueError("chest body obstructs A8 doorway")
    sx, sy = chest["stand_world_px"]
    if doorway[0] < sx < doorway[0] + doorway[2] and doorway[1] < sy < doorway[1] + doorway[3]:
        raise ValueError("chest stand lies in A8 doorway")
    if ((sx - expected_socket[0]) ** 2 + (sy - expected_socket[1]) ** 2) ** 0.5 > chest["interaction_radius_px"]:
        raise ValueError("chest stand outside interaction radius")
    if chest["reward_items"] or chest["drop_chance"] is not None or chest["units"] is not None or chest["prices"] is not None:
        raise ValueError("A1 chest packet cannot authorize rewards")
    if chest["interaction_enabled"] or not chest["finite_once_per_run"] or chest["max_claims_per_run_proposal"] != 1:
        raise ValueError("chest must be sealed and exactly once-per-run proposal")
    shell_skin = next(s for s in shells["sites"] if s["poi_id"] == chest["poi_id"])
    if shell_skin["action_socket_px"] != local_socket or shell_skin["entry_portal_px"] != shell["entry_portal"]:
        raise ValueError("A8 shell skin/source mismatch")
    for cell in (chest["socket_cell"], chest["stand_cell"], chest["approach_start_cell"]):
        if not layers.value(cell, "walk") or layers.value(cell, "hazard"):
            raise ValueError(f"unsafe chest source cell {cell}")


def build(contract_path: Path = CONTRACT) -> dict:
    contract = load(contract_path)
    plan = cwa.load_plan()
    layers = cwa.Layers(plan)
    atlas = cwa.load(cwa.ART / "atlas.v1.json")
    for key in ("world_plan", "route_graph", "hazard_capabilities", "hazard_damage_proposal",
                "atlas", "asset_provenance", "terrain", "props", "a8_shell_visuals",
                "a8_south_quarry", "a0_knight_scene", "fixture_knight_script"):
        validate_pin(contract, key)
    if contract["accepted_baseline"]["placement_contract"]["sha256"] != sha_file(WORLD / "a1_world_placement_contract.v1.json"):
        raise ValueError("accepted placement contract changed; Round 11 cannot silently reopen it")
    if contract["hazard_fields"]["damage_values_authored_here"] is not False:
        raise ValueError("A1 cannot approve final damage values here")
    if contract["hazard_fields"]["health_or_status_mutation_in_fixture"] is not False:
        raise ValueError("native fixture must not mutate health/status authority")

    quarry = load(ROOT / contract["source_pins"]["a8_south_quarry"]["path"])
    shells = load(ROOT / contract["source_pins"]["a8_shell_visuals"]["path"])
    validate_chest(contract, layers, quarry, shells)
    pois = {p["poi_id"]: p for p in plan["pois"]}
    for poi_id in contract["consumer_slice"]["canonical_poi_ids"]:
        if poi_id not in pois:
            raise ValueError(f"unknown canonical POI {poi_id}")
    if quarry["source"]["poi_id"] != "poi_crown_south_quarry" or quarry["source"]["canonical_cell"] != [30, 280]:
        raise ValueError("A8 quarry canonical identity drift")

    # Preserve all accepted endpoint IDs/cells rather than reauthoring them.
    placement = load(WORLD / "a1_world_placement_contract.v1.json")
    accepted_endpoints = {x["endpoint_id"]: x for x in placement["endpoint_reviews"]}
    if len(accepted_endpoints) != 4 or len(placement["territory_reviews"]) != 6:
        raise ValueError("accepted six/four placement scope changed")
    for case in contract["trial_endpoint_stress"]["source_cases"]:
        accepted = accepted_endpoints[case["endpoint_id"]]
        if case["socket_cell"] != accepted["approved_socket_cell"] or case["stand_cell"] != accepted["approved_stand_cell"]:
            raise ValueError(f"accepted endpoint cells changed for {case['endpoint_id']}")
    for endpoint_id in contract["trial_endpoint_stress"]["combined"]["endpoint_ids"]:
        if endpoint_id not in accepted_endpoints:
            raise ValueError(f"combined endpoint missing {endpoint_id}")

    hero_size = contract["consumer_slice"]["hero"]["body_size_px"]
    ordinary_bodies = body_set(contract, contract["ordinary_expedition"]["mounted_trial_bodies"])
    deep_bodies = body_set(contract, contract["last72_expedition"]["mounted_trial_bodies"])
    ordinary = dict(contract["ordinary_expedition"])
    ordinary["legs"] = [compile_leg(layers, leg, ordinary_bodies, hero_size) for leg in ordinary["legs"]]
    deep = dict(contract["last72_expedition"])
    deep["legs"] = [compile_leg(layers, leg, deep_bodies, hero_size) for leg in deep["legs"]]
    for journey in (ordinary, deep):
        legs = journey["legs"]
        if legs[0]["cells"][0] != journey["home_cell"] or legs[-1]["cells"][-1] != journey["home_cell"]:
            raise ValueError(f"journey does not physically start/end at home {journey['journey_id']}")
        for previous_leg, next_leg in zip(legs, legs[1:]):
            if previous_leg["cells"][-1] != next_leg["cells"][0]:
                raise ValueError(f"discontinuous journey seam {previous_leg['leg_id']}->{next_leg['leg_id']}")
    visited_regions = set().union(*(set(leg["stats"]["region_ids"]) for leg in ordinary["legs"]))
    if not set(ordinary["required_region_ids"]).issubset(visited_regions):
        raise ValueError(f"ordinary journey misses regions: {visited_regions}")

    # Deterministic broad spawn matrix and physical links into the same home route.
    spawn_spec = contract["spawn_safety"]
    zones_out = []
    spawn_cases = []
    for zone in spawn_spec["zones"]:
        rect = zone["rect_cells"]
        cells = [[x, y] for y in range(rect[1], rect[1] + rect[3]) for x in range(rect[0], rect[0] + rect[2])]
        for cell in cells:
            if not layers.value(cell, "walk") or layers.value(cell, "hazard"):
                raise ValueError(f"unsafe spawn zone {zone['zone_id']} at {cell}")
            # Match the native Hero's conservative vertical clearance requirement.
            bfs_path(layers, cell, cell, bounds=[rect[0] - 2, rect[1] - 2, rect[2] + 4, rect[3] + 4])
        zone_out = dict(zone)
        zone_out["safe_cell_count"] = len(cells)
        zone_out["cells_sha256"] = hashlib.sha256(json.dumps(cells, separators=(",", ":")).encode()).hexdigest()
        zones_out.append(zone_out)
    for seed in spawn_spec["seeds"]:
        zone = spawn_spec["zones"][seed % len(spawn_spec["zones"])]
        rect = zone["rect_cells"]
        cells = [[x, y] for y in range(rect[1], rect[1] + rect[3]) for x in range(rect[0], rect[0] + rect[2])]
        digest = hashlib.sha256(f"{contract['source_pins']['world_id']}|{seed}|{zone['zone_id']}".encode()).digest()
        cell = cells[int.from_bytes(digest[:8], "big") % len(cells)]
        bounds = [rect[0] - 2, rect[1] - 2, rect[2] + 4, rect[3] + 4]
        path = bfs_path(layers, cell, zone["rally_cell"], bounds=bounds)
        spawn_cases.append({
            "seed": seed, "zone_id": zone["zone_id"], "spawn_cell": cell, "rally_cell": zone["rally_cell"],
            "forward_cells": path, "return_cells": list(reversed(path)),
            "source": sample(layers, cell), "path_stats": path_stats(layers, path),
        })
    unique_cells = {tuple(case["spawn_cell"]) for case in spawn_cases}
    if len(unique_cells) < spawn_spec["minimum_unique_cells"] or len({c["zone_id"] for c in spawn_cases}) < 3:
        raise ValueError("spawn matrix is not broad enough")
    zone_links = []
    for zone in spawn_spec["zones"]:
        path = bfs_path(layers, zone["rally_cell"], zone["home_link_cell"])
        zone_links.append({"zone_id": zone["zone_id"], "forward_cells": path,
                           "return_cells": list(reversed(path)), "stats": path_stats(layers, path)})

    # Hazard readouts cross real source values; only the marsh response has a
    # numeric proposal and it is explicitly test-only, never health damage.
    hazards = {h["hazard_id"]: h for h in load(WORLD / "hazard_capability_contracts.json")["hazards"]}
    probes = []
    for spec in contract["hazard_fields"]["probes"]:
        source = hazards[spec["hazard_id"]]
        if source["rect"] != spec["expected_rect"] or source["requires"] != spec["required_capability"]:
            raise ValueError(f"hazard source drift {spec['hazard_id']}")
        cells = [spec["safe_cell"], spec["entry_cell"], spec["inside_cell"]]
        samples = [sample(layers, c) for c in cells]
        if samples[0]["hazard_id"] is not None or samples[1]["hazard_id"] != spec["hazard_id"] or samples[2]["hazard_id"] != spec["hazard_id"]:
            raise ValueError(f"hazard transition is not meaningful {spec['hazard_id']}")
        if any(not s["walk"] for s in samples):
            raise ValueError(f"hazard probe has blocked cell {spec['hazard_id']}")
        # Verify continuous physical retreat with hazards allowed only on entry.
        forward = bfs_path(layers, cells[0], cells[-1], allow_hazard=True)
        if forward != cells:
            raise ValueError(f"unexpected hazard probe detour {spec['hazard_id']}: {forward}")
        row = dict(spec)
        row.update({"forward_cells": forward, "return_cells": list(reversed(forward)),
                    "source_samples": samples, "severity_source_readonly": source["severity"],
                    "clue_source_readonly": source["clue"], "damage_application": "A0_NOT_APPLIED"})
        probes.append(row)
    marsh = dict(contract["hazard_fields"]["marsh"])
    dry = bfs_path(layers, marsh["dry_control_cells"][0], marsh["dry_control_cells"][1])
    wet = bfs_path(layers, marsh["entry_cells"][0], marsh["entry_cells"][1])
    retreat = bfs_path(layers, marsh["retreat_cells"][0], marsh["retreat_cells"][1])
    if len(dry) != 9 or len(wet) != 9 or path_stats(layers, dry)["freshwater_marsh_cells"] or path_stats(layers, wet)["freshwater_marsh_cells"] < 8:
        raise ValueError("marsh/dry eight-step controls lost their physical meaning")
    marsh.update({"dry_forward_cells": dry, "wet_forward_cells": wet, "retreat_cells_compiled": retreat,
                  "dry_stats": path_stats(layers, dry), "wet_stats": path_stats(layers, wet),
                  "retreat_stats": path_stats(layers, retreat), "damage_application": "NONE"})

    endpoint_cases = []
    for spec in contract["trial_endpoint_stress"]["source_cases"]:
        body = body_from_socket(spec["socket_cell"], spec["body_size_px"], spec["endpoint_id"])
        for key in ("approach_start_cell", "diagonal_start_cell", "stand_cell"):
            if not layers.value(spec[key], "walk") or layers.value(spec[key], "hazard"):
                raise ValueError(f"unsafe endpoint cell {spec['endpoint_id']} {key}")
        forward = bfs_path(layers, spec["approach_start_cell"], spec["stand_cell"], bodies=[body])
        diagonal = bfs_path(layers, spec["diagonal_start_cell"], spec["stand_cell"], bodies=[body])
        large = bfs_path(layers, spec["diagonal_start_cell"], spec["stand_cell"], bodies=[body], hero_size=[20, 24])
        endpoint_cases.append(dict(spec, forward_cells=forward, diagonal_cells=diagonal,
                                   large_body_cells=large, return_cells=list(reversed(forward))))

    # Whole-file migration review: no old pin is silently replaced and no crop
    # compatibility result is converted into a whole-file equivalence claim.
    migration_rows = []
    for resource, old_sha in contract["consumer_slice"]["a0_source_manifest_migration"]["old_pins"].items():
        relative = resource.removeprefix("res://")
        current = sha_file(ROOT / relative)
        migration_rows.append({"resource": resource, "path": relative, "a0_old_sha256": old_sha,
                               "a1_current_sha256": current, "whole_file_match": current == old_sha,
                               "action": "RETAIN_EXACT" if current == old_sha else "A0_REVIEW_ATOMIC_COHERENT_MIGRATION_REQUIRED"})
    migration = dict(contract["consumer_slice"]["a0_source_manifest_migration"])
    migration["files"] = migration_rows
    migration["changed_file_count"] = sum(not row["whole_file_match"] for row in migration_rows)
    if migration["changed_file_count"] == 0:
        raise ValueError("migration review is vacuous")

    # Site-specific visual references only; no generic POI catalog/repaint.
    site_visuals = []
    chest = contract["chest_source_proposal"]
    shell_skin = next(s for s in shells["sites"] if s["poi_id"] == chest["poi_id"])
    site_visuals.append({"kind": "a8_exact_shell_skin", "poi_id": chest["poi_id"],
                         "origin_px": chest["a8_shell_origin_world_px"], "skin": shell_skin,
                         "source_sha256": contract["source_pins"]["a8_shell_visuals"]["sha256"]})
    for visual in contract["site_visual_proposals"]:
        poi = pois[visual["poi_id"]]
        for placement_spec in visual["frames"]:
            if placement_spec["frame"] not in atlas["props"]:
                raise ValueError(f"unknown site visual frame {placement_spec['frame']}")
        site_visuals.append(dict(visual, kind="a1_reference_composite", canonical_cell=poi["cell"],
                                 origin_px=[poi["cell"][0] * 16 + 8, poi["cell"][1] * 16 + 8]))
    visuals = []
    for visual in contract["visual_identity_proposals"]:
        frames = [x["frame"] for x in visual["frames"]]
        if len(set(frames)) != len(frames) or any(frame not in atlas["props"] for frame in frames):
            raise ValueError(f"invalid visual reference {visual['endpoint_id']}")
        if visual["endpoint_id"] in ("endpoint.ragnarok.fixed_vendor", "endpoint.ragnarok.evacuation") and "signpost" in frames:
            raise ValueError("generic signpost remains rejected")
        if visual["endpoint_id"] == "endpoint.ragnarok.recycler" and "mill_wheel" in frames:
            raise ValueError("oversized mill-wheel recycler remains rejected")
        visuals.append(visual)

    # Collect exact required chunks plus a real one-chunk streaming halo.
    all_cells: list[list[int]] = []
    for journey in (ordinary, deep):
        for leg in journey["legs"]:
            all_cells.extend(leg["cells"])
    for case in spawn_cases:
        all_cells.extend(case["forward_cells"])
    for link in zone_links:
        all_cells.extend(link["forward_cells"])
    for probe in probes:
        all_cells.extend(probe["forward_cells"])
    for cells in (dry, wet, retreat):
        all_cells.extend(cells)
    for case in endpoint_cases:
        all_cells.extend(case["forward_cells"] + case["diagonal_cells"] + case["large_body_cells"])
    for zone in spawn_spec["zones"]:
        rect = zone["rect_cells"]
        all_cells.extend([[rect[0], rect[1]], [rect[0] + rect[2] - 1, rect[1] + rect[3] - 1]])
    for visual in site_visuals:
        if "canonical_cell" in visual:
            all_cells.append(visual["canonical_cell"])
    all_cells.append(chest["socket_cell"])
    base_chunk_ids = {chunk_id(c) for c in all_cells}
    required_chunk_ids = set(base_chunk_ids)
    for cid in list(base_chunk_ids):
        _, cx, cy = cid.split(":")
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                neighbor = f"chunk:{int(cx) + dx}:{int(cy) + dy}"
                if neighbor in layers.manifest:
                    required_chunk_ids.add(neighbor)

    site_by_chunk: dict[str, list[dict]] = {}
    for visual in site_visuals:
        if visual["kind"] == "a8_exact_shell_skin":
            cell = chest["ordinary_elder_anchor_cell_unchanged"]
        else:
            cell = visual["canonical_cell"]
        site_by_chunk.setdefault(chunk_id(cell), []).append(visual)
    chunks = []
    for cid in sorted(required_chunk_ids, key=lambda x: tuple(int(v) for v in x.split(":")[1:])):
        entry = layers.manifest[cid]
        origin = entry["origin"]
        size = entry["size"]
        chunk_path = WORLD / entry["path"]
        actual_sha = sha_file(chunk_path)
        if actual_sha != entry["sha256"]:
            raise ValueError(f"chunk hash mismatch {cid}")
        rows = [[frame_for(layers, atlas, [x, y]) for x in range(origin[0], origin[0] + size[0])]
                for y in range(origin[1], origin[1] + size[1])]
        chunks.append({"chunk_id": cid, "origin": origin, "size": size,
                       "source_path": "res://data/survival/world/" + entry["path"],
                       "source_sha256": actual_sha, "route_required": cid in base_chunk_ids,
                       "ground": {"origin_cell": origin, "rows": rows},
                       "collision_rects": merged_collision(layers, origin, size),
                       "site_visuals": site_by_chunk.get(cid, [])})

    return {
        "schema": "soh.world.a1_round11_continuity_native_inputs.v1",
        "source_contract": str(contract_path.relative_to(ROOT)) if contract_path.is_absolute() and ROOT in contract_path.parents else str(contract_path),
        "source_contract_sha256": sha_file(contract_path),
        "world_id": contract["source_pins"]["world_id"],
        "world_plan_sha256": contract["source_pins"]["world_plan"]["sha256"],
        "world_extents_cells": contract["consumer_slice"]["world_extents_cells"],
        "hero": contract["consumer_slice"]["hero"],
        "loadout": contract["loadout"],
        "atlas_path": "res://data/survival/world/art/atlas.v1.json",
        "asset_provenance_path": "res://data/survival/world/art/first_hour_asset_provenance.v1.json",
        "a0_commit": contract["source_pins"]["a0_commit"],
        "a8_commit": contract["source_pins"]["a8_commit"],
        "a3_commit": contract["source_pins"]["a3_commit"],
        "source_manifest_migration": migration,
        "chunks": chunks,
        "route_required_chunk_ids": sorted(base_chunk_ids),
        "spawn_safety": {"zones": zones_out, "cases": spawn_cases, "zone_links": zone_links,
                         "minimum_unique_cells": spawn_spec["minimum_unique_cells"],
                         "production_spawn_approval": False},
        "ordinary_expedition": ordinary,
        "last72_expedition": deep,
        "hazard_fields": {"authority": contract["hazard_fields"]["authority"], "probes": probes,
                          "marsh": marsh, "darkness_response": "NOT_TESTED",
                          "D071_weather_cargo_pets": "SEPARATE_LATER_E2_NOT_COMPLETED"},
        "trial_endpoint_stress": dict(contract["trial_endpoint_stress"], source_cases=endpoint_cases),
        "chest_source_proposal": chest,
        "visual_identity_proposals": visuals,
        "consumer_handoff": contract["consumer_handoff"],
        "r5_gates": contract["r5_gates"],
        "production_native_playable": False,
        "reward_items_granted": 0,
        "save_mutation": False,
        "native_evidence_required": "Godot 4.7 real Knight frame-stepped forward/return, streaming, hazards, sockets and 720/1440/2160 captures",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--contract", default=str(CONTRACT))
    parser.add_argument("--out", default="artifacts/a1-continuity/continuity_native_inputs.json")
    args = parser.parse_args()
    data = build(Path(args.contract))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    ordinary_cells = sum(len(x["cells"]) for x in data["ordinary_expedition"]["legs"])
    deep_cells = sum(len(x["cells"]) for x in data["last72_expedition"]["legs"])
    print(json.dumps({"ok": True, "out": str(out), "chunks": len(data["chunks"]),
                      "route_required_chunks": len(data["route_required_chunk_ids"]),
                      "ordinary_cells": ordinary_cells, "last72_cells": deep_cells,
                      "spawn_cases": len(data["spawn_safety"]["cases"]),
                      "hazard_probes": len(data["hazard_fields"]["probes"]),
                      "endpoint_source_cases": len(data["trial_endpoint_stress"]["source_cases"]),
                      "chest_proposals": 1, "production_native_playable": False}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
