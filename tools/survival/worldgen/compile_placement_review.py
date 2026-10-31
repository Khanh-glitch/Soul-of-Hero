#!/usr/bin/env python3
"""Compile A1's review of A8's existing territory/endpoint proposals.

This does not create another six-territory system. It checks canonical IDs and
source walk/hazard layers, derives existing-cell forward/return paths, and emits
bounded native source windows. Production mounting remains A0-only.
"""
from __future__ import annotations

import argparse
from collections import deque
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import compile_world_art as cwa

ROOT = cwa.ROOT
CONTRACT = ROOT / "data/survival/world/a1_world_placement_contract.v1.json"
PRESENTATIONS = ROOT / "data/survival/world/art/presentations.v1.json"


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha_file(path: Path) -> str:
    return sha_bytes(path.read_bytes())


def bfs_path(layers: cwa.Layers, start: list[int], goal: list[int]) -> list[list[int]]:
    """Existing-cell BFS; conservative three-row Hero clearance, zero hazards."""
    def clear(cell: tuple[int, int]) -> bool:
        x, y = cell
        if not (1 <= x < 1023 and 1 <= y < 767):
            return False
        return all(layers.value([x, y + dy], "walk") for dy in (-1, 0, 1))

    start_t, goal_t = tuple(start), tuple(goal)
    if not clear(start_t) or not clear(goal_t):
        raise ValueError(f"unclear path endpoint {start}->{goal}")
    queue: deque[tuple[int, int]] = deque([start_t])
    previous: dict[tuple[int, int], tuple[int, int] | None] = {start_t: None}
    while queue:
        cur = queue.popleft()
        if cur == goal_t:
            break
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nxt = (cur[0] + dx, cur[1] + dy)
            if nxt in previous or not clear(nxt):
                continue
            if layers.value(list(nxt), "hazard") != 0:
                continue
            previous[nxt] = cur
            queue.append(nxt)
    if goal_t not in previous:
        raise ValueError(f"no zero-hazard Hero-clear source path {start}->{goal}")
    path: list[list[int]] = []
    cur: tuple[int, int] | None = goal_t
    while cur is not None:
        path.append(list(cur))
        cur = previous[cur]
    path.reverse()
    return path


def frame_for(layers: cwa.Layers, atlas: dict, cell: list[int]) -> str:
    surface = layers.surface_name(cell)
    if layers.value(cell, "road"):
        return "road_dirt_0"
    if surface in ("water", "lake", "river", "tidal", "ocean"):
        return "water_0"
    if surface == "brine":
        return "brine_0"
    if surface in ("snow", "alpine", "frost"):
        return "snow_0"
    if surface in ("ash", "basalt", "volcanic"):
        return "ash_0"
    if surface in ("forest", "boreal"):
        return "forest_0"
    if surface in ("grass", "orchard", "karst"):
        return "grass_0"
    if surface in ("mud", "peat", "marsh", "mangrove"):
        return "mud_0"
    if surface == "gravel":
        return "gravel_0"
    if surface == "soil":
        return "soil_0"
    return "moor_0"


def merged_collision(layers: cwa.Layers, origin: list[int], size: list[int]) -> list[dict]:
    rects: list[dict] = []
    ox, oy = origin
    w, h = size
    for y in range(oy, oy + h):
        x = ox
        while x < ox + w:
            if layers.value([x, y], "walk"):
                x += 1
                continue
            start = x
            while x + 1 < ox + w and not layers.value([x + 1, y], "walk"):
                x += 1
            width = x - start + 1
            rects.append({"cell": [start, y], "size_cells": [width, 1],
                          "world_px": [start * 16, y * 16], "size_px": [width * 16, 16]})
            x += 1
    return rects


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--contract", default=str(CONTRACT))
    parser.add_argument("--out", default="artifacts/a1-placement/placement_native_inputs.json")
    args = parser.parse_args()
    contract_path = Path(args.contract)
    contract = json.loads(contract_path.read_text())
    plan = cwa.load_plan()
    layers = cwa.Layers(plan)
    atlas = cwa.load(cwa.ART / "atlas.v1.json")
    pois = {p["poi_id"]: p for p in plan["pois"]}
    a8_territories = json.loads((ROOT / contract["source_pins"]["a8_territories"]["path"]).read_text())
    a8_endpoints = json.loads((ROOT / contract["source_pins"]["a8_endpoints"]["path"]).read_text())
    a8_t = {t["elder_id"]: t for t in a8_territories["territories"]}
    a8_e = {e["endpoint_id"]: e for e in a8_endpoints["endpoints"]}
    if len(contract["territory_reviews"]) != 6 or len(a8_t) != 6:
        raise ValueError("review must cover exactly A8's existing six territories")
    presentation_props: dict[str, list[dict]] = {}
    index = json.loads(PRESENTATIONS.read_text())
    for entry in index["presentations"]:
        doc = json.loads((ROOT / entry["path"]).read_text())
        presentation_props[doc.get("region_id", "")] = doc.get("props", [])

    reviews: list[dict] = []
    for kind, rows, id_key in (
        ("territory", contract["territory_reviews"], "elder_id"),
        ("endpoint", contract["endpoint_reviews"], "endpoint_id"),
    ):
        for row in rows:
            rid = row[id_key]
            source = a8_t[rid] if kind == "territory" else a8_e[rid]
            poi_id = source["canonical_poi_id"] if kind == "territory" else source["existing_poi_id"]
            poi = pois[poi_id]
            if kind == "territory" and row["canonical_cell"] != source["canonical_cell"]:
                raise ValueError(f"canonical cell drift for {rid}")
            if kind == "endpoint" and row["approved_socket_cell"] == row["approved_stand_cell"]:
                raise ValueError(f"socket and stand must differ for {rid}")
            start = row["approach_start_cell"]
            goal = row["ordinary_safe_threshold_cell"] if kind == "territory" else row["approved_stand_cell"]
            path = bfs_path(layers, start, goal)
            return_path = list(reversed(path))
            for cell in path:
                if layers.value(cell, "hazard") != 0:
                    raise ValueError(f"hazard exposure in ordinary path for {rid}: {cell}")
            margin = 12 if kind == "territory" else 8
            xs = [c[0] for c in path]
            ys = [c[1] for c in path]
            if kind == "endpoint":
                xs.append(row["approved_socket_cell"][0])
                ys.append(row["approved_socket_cell"][1])
            origin = [max(1, min(xs) - margin), max(1, min(ys) - margin)]
            end = [min(1022, max(xs) + margin), min(766, max(ys) + margin)]
            size = [end[0] - origin[0] + 1, end[1] - origin[1] + 1]
            ground_rows = []
            for y in range(origin[1], origin[1] + size[1]):
                ground_rows.append([frame_for(layers, atlas, [x, y]) for x in range(origin[0], origin[0] + size[0])])
            region_id = poi["region_id"]
            props = []
            for prop in presentation_props.get(region_id, []):
                cell = prop["cell"]
                if origin[0] <= cell[0] < origin[0] + size[0] and origin[1] <= cell[1] < origin[1] + size[1]:
                    props.append(prop)
            item = {
                "kind": kind, "id": rid, "poi_id": poi_id, "region_id": region_id,
                "decision": row["location_decision"] if kind == "territory" else row["placement_decision"],
                "canonical_cell": row.get("canonical_cell", poi["cell"]),
                "start_cell": start, "goal_cell": goal,
                "forward_cells": path, "return_cells": return_path,
                "path_cell_count": len(path),
                "hazard_exposure_cells": 0,
                "inner_access_status": row.get("inner_access_status", "SOCKET_ONLY"),
                "production_status": "AUTHORED_SOURCE_WINDOW_NOT_PRODUCTION_MOUNTED",
                "collision_mode": "connector_annex" if row.get("collision_mode") == "connector_annex" else "a1_source_walk",
                "window": {"origin_cell": origin, "size_cells": size},
                "ground": {"origin_cell": origin, "rows": ground_rows},
                "collision_rects": merged_collision(layers, origin, size),
                "props": props,
                "hazard_gate": poi.get("hazard_id"),
                "required_capabilities": poi.get("required_capabilities", []),
            }
            if kind == "endpoint":
                item["endpoint"] = {
                    "socket_cell": row["approved_socket_cell"],
                    "stand_cell": row["approved_stand_cell"],
                    "socket_world_px": row["socket_world_px"],
                    "stand_world_px": row["stand_world_px"],
                    "stand_offset_px": row["stand_offset_px"],
                    "collision_size_px": row["collision_size_px"],
                    "interaction_radius_px": row["interaction_radius_px"],
                    "native_marker_frame": row.get("native_marker_frame"),
                    "native_marker_is_final_art": False,
                }
            reviews.append(item)
    out = {
        "schema": "soh.world.a1_placement_native_inputs.v1",
        "source_contract": str(contract_path.relative_to(ROOT) if contract_path.is_absolute() else contract_path),
        "source_contract_sha256": sha_file(contract_path),
        "a8_commit": contract["source_pins"]["a8_commit"],
        "world_plan_sha256": sha_file(ROOT / "data/survival/world/world_plan.v1.json"),
        "atlas_path": "res://data/survival/world/art/atlas.v1.json",
        "asset_provenance_path": "res://data/survival/world/art/first_hour_asset_provenance.v1.json",
        "reviews": reviews,
        "production_native_playable": False,
        "no_rewards_or_save_or_boss_or_gold_changes": True,
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2) + "\n")
    print(json.dumps({
        "ok": True, "out": str(out_path), "reviews": len(reviews),
        "territories": sum(1 for r in reviews if r["kind"] == "territory"),
        "endpoints": sum(1 for r in reviews if r["kind"] == "endpoint"),
        "total_forward_cells": sum(r["path_cell_count"] for r in reviews),
        "production_native_playable": False,
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
