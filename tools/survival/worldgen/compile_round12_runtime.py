#!/usr/bin/env python3
"""Compile A1 Round 12 derived runtime indices and exact native inputs.

The authored masterplan/chunks remain the only geography authority. This tool
never rewrites them. It derives a broad safe-spawn index, source-constrained
routes, exact A8 shell transforms, and adversarial dynamic-overlay fixtures.
"""
from __future__ import annotations

import argparse
from collections import Counter, deque
import hashlib
import heapq
import json
import math
from pathlib import Path
import sys
from typing import Iterable

sys.path.insert(0, str(Path(__file__).resolve().parent))
import compile_world_art as cwa
from baseline import Baseline
from validate_world import reconstruct

ROOT = cwa.ROOT
WORLD = ROOT / "data/survival/world"
CONTRACT = WORLD / "a1_round12_runtime_contract.v1.json"
SPAWN_INDEX = WORLD / "a1_round12_spawn_index.v1.json"
TILE = 16
DIRECTIONS = ((1, 0), (-1, 0), (0, 1), (0, -1))
RUNTIME_INTERFACE_SCHEMA = "soh.world.a1_runtime_interfaces.v1"


def sha_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canon(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def json_bytes(value) -> bytes:
    """The sole whole-file JSON serialization/hash domain for derived packets."""
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode("utf-8")


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def foot(cell: Iterable[int]) -> tuple[float, float]:
    x, y = cell
    return (int(x) * TILE + 8.0, int(y) * TILE + 15.0)


def chunk_id(cell: Iterable[int]) -> str:
    x, y = cell
    return f"chunk:{int(x) // 64}:{int(y) // 64}"


def validate_pin(contract: dict, key: str) -> dict:
    pin = contract["source_pins"][key]
    path = ROOT / pin["path"]
    if not path.is_file() or sha_file(path) != pin["sha256"]:
        raise ValueError(f"source pin mismatch: {key}")
    return pin


def _contains_runtime_hash(value) -> bool:
    if isinstance(value, dict):
        return any(key == "sha256" or key.endswith("_sha256") or _contains_runtime_hash(entry)
                   for key, entry in value.items())
    if isinstance(value, list):
        return any(_contains_runtime_hash(entry) for entry in value)
    return False


def validate_runtime_interface_contract(contract: dict) -> dict:
    """Validate the semantic contract shape, never mutable source bytes."""
    runtime = contract.get("runtime_interfaces")
    if not isinstance(runtime, dict) or runtime.get("schema") != RUNTIME_INTERFACE_SCHEMA:
        raise ValueError("runtime interface contract schema missing")
    if _contains_runtime_hash(runtime):
        raise ValueError("mutable runtime interfaces cannot contain byte pins")
    observed = runtime.get("observed_paths")
    player = runtime.get("player")
    scripts = runtime.get("scripts")
    if not isinstance(observed, dict) or not isinstance(player, dict) or not isinstance(scripts, dict):
        raise ValueError("runtime interface observations/player/scripts are required")
    if not observed or not all(isinstance(key, str) and isinstance(path, str) and path
                               for key, path in observed.items()):
        raise ValueError("runtime interface observed paths must be named relative resources")
    pinned_paths = {pin.get("path") for pin in contract.get("source_pins", {}).values()
                    if isinstance(pin, dict)}
    overlap = pinned_paths.intersection(observed.values())
    if overlap:
        raise ValueError(f"mutable runtime resources cannot remain source-pinned: {sorted(overlap)}")
    required = {"player": player.get("scene")}
    required.update({key: spec.get("path") for key, spec in scripts.items() if isinstance(spec, dict)})
    if len(required) != 4 or any(not isinstance(path, str) or not path for path in required.values()):
        raise ValueError("player plus three legacy script interfaces are required")
    if not set(required.values()).issubset(set(observed.values())):
        raise ValueError("every required runtime interface must have a named observation")
    for key, spec in scripts.items():
        if not spec.get("base_type") or not spec.get("required_methods"):
            raise ValueError(f"runtime script interface incomplete: {key}")
    if player.get("scene_role") != "DEFAULT_A0_A6_TECHNICAL_BODY_ONLY_NOT_D051_VISUAL_IDENTITY" \
            or player.get("allow_consumer_scene_override") is not True:
        raise ValueError("player scene must be an overridable physical proxy, not D051 identity")
    for forbidden in ("script", "visual", "sprite", "appearance"):
        if forbidden in player:
            raise ValueError(f"player visual/script identity is not a runtime interface: {forbidden}")
    for field in ("body_shape_node", "body_shape_size_px", "body_shape_offset_px", "camera_node",
                  "camera_offset_px", "require_position_smoothing", "minimum_position_smoothing_speed",
                  "required_collision_mask", "required_collision_layer", "numeric_properties", "required_input_actions"):
        if field not in player:
            raise ValueError(f"player runtime interface incomplete: {field}")
    for path in required.values():
        if not (ROOT / path).is_file():
            raise ValueError(f"runtime interface resource missing: {path}")
    return runtime


def named_value(layers: cwa.Layers, cell: list[int], layer: str) -> str:
    chunk = layers.chunk(cell)
    value = layers.value(cell, layer)
    legend = chunk.get("legend", {}).get(layer, [])
    return str(legend[value - 1]) if 1 <= value <= len(legend) else ""


def sample(layers: cwa.Layers, cell: list[int]) -> dict:
    hazard_value = layers.value(cell, "hazard")
    return {
        "cell": list(cell), "chunk_id": chunk_id(cell),
        "region_id": named_value(layers, cell, "region"),
        "biome_id": named_value(layers, cell, "biome"),
        "surface_id": layers.surface_name(cell),
        "hazard_id": named_value(layers, cell, "hazard") if hazard_value else None,
        "walk": layers.value(cell, "walk"), "hazard": hazard_value,
        "road": layers.value(cell, "road"),
        "preserved": layers.value(cell, "preserved"),
        "build_permission": layers.value(cell, "build_permission"),
    }


def aabb_overlap(a_center: tuple[float, float], a_size: Iterable[int],
                 b_center: tuple[float, float], b_size: Iterable[int]) -> bool:
    return (abs(a_center[0] - b_center[0]) < (a_size[0] + b_size[0]) * 0.5 and
            abs(a_center[1] - b_center[1]) < (a_size[1] + b_size[1]) * 0.5)


def hero_clear_of_body(cell: list[int], body: dict, hero_size=(12, 16)) -> bool:
    fx, fy = foot(cell)
    return not aabb_overlap((fx, fy - 8.0), hero_size, tuple(body["center_px"]), body["size_px"])


class RuntimeBuilder:
    def __init__(self, contract_path: Path = CONTRACT):
        self.contract_path = contract_path
        self.contract = load(contract_path)
        self.plan = cwa.load_plan()
        self.layers = cwa.Layers(self.plan)
        self.w = int(self.plan["frame"]["w"])
        self.h = int(self.plan["frame"]["h"])
        self.n = self.w * self.h
        self.values = {key: reconstruct(self.plan, key) for key in
                       ("walk", "hazard", "region", "preserved", "road", "build_permission")}
        self.regions = {r["region_id"]: r for r in self.plan["regions"]}
        self.region_names = [r["region_id"] for r in self.plan["regions"]]
        self.pois = {p["poi_id"]: p for p in self.plan["pois"]}
        self.base = Baseline()
        self.seam_cells: set[tuple[int, int]] = set()
        for seam in self.plan["legacy_seam_carves"]:
            x0, y0, x1, y1 = seam["carve"]
            self.seam_cells.update((x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1))
        self.physical_bodies: list[dict] = []
        self.sites: dict[str, dict] = {}
        self.roadside_sources: list[dict] = []
        self.component: set[tuple[int, int]] = set()
        self.road_distance = [10**6] * self.n
        self.road_parent: dict[tuple[int, int], tuple[int, int] | None] = {}
        self.spawn_chunks: list[dict] = []
        self.spawn_lookup: dict[tuple[int, int], dict] = {}

    def validate_sources(self) -> None:
        c = self.contract
        runtime_interfaces = validate_runtime_interface_contract(c)
        observed_paths = set(runtime_interfaces["observed_paths"].values())
        for key, pin in c["source_pins"].items():
            if isinstance(pin, dict) and "path" in pin and "sha256" in pin:
                validate_pin(c, key)
        if self.plan["world_id"] != c["source_pins"]["world_id"]:
            raise ValueError("world identity drift")
        if [self.w, self.h] != c["reader_api"]["frame"] or len(self.plan["chunk_manifest"]) != 192:
            raise ValueError("authored frame/chunk scope drift")
        if self.plan["legacy_inset"]["w"] != 384 or self.plan["legacy_inset"]["h"] != 256:
            raise ValueError("legacy inset drift")
        if c["new_poi_count"] or c["new_region_count"] or c["reward_items_granted"] or c["save_mutation"]:
            raise ValueError("Round 12 contract exceeds authority")
        baseline_lock = load(WORLD / "baseline_lock.json")
        for relative, expected in baseline_lock["files"].items():
            # The historical lock mixes immutable world data with owner-managed
            # scripts/project settings. Only the former remain byte identity.
            if relative in observed_paths:
                continue
            if sha_file(ROOT / relative) != expected:
                raise ValueError(f"legacy baseline hash drift: {relative}")
        atlas = load(ROOT / c["source_pins"]["atlas"]["path"])
        for material, frame in c["visual"]["material_frames"].items():
            if material not in self.plan["materials"] or frame not in atlas["props"]:
                raise ValueError(f"invalid material visual binding {material}->{frame}")
        if set(c["visual"]["material_frames"]) != set(self.plan["materials"]):
            raise ValueError("not every source material has an explicit visual binding")
        for poi_id, frame in c["visual"]["poi_landmark_frames"].items():
            if poi_id not in self.pois or frame not in atlas["props"]:
                raise ValueError(f"invalid POI visual binding {poi_id}->{frame}")
        if c["visual"]["unbound_poi_frame"] not in atlas["props"]:
            raise ValueError("unbound survey marker missing")
        placement = load(ROOT / c["source_pins"]["placement"]["path"])
        if len(placement["territory_reviews"]) != 6 or len(placement["endpoint_reviews"]) != 4:
            raise ValueError("accepted six/four placement scope changed")
        self._compile_sites()
        self._compile_roadside()

    def runtime_observations(self) -> dict:
        """Current mutable bytes for diagnostics; deliberately not acceptance pins."""
        observed = {}
        for key, relative in self.contract["runtime_interfaces"]["observed_paths"].items():
            path = ROOT / relative
            if path.is_file():
                observed[key] = {"path": relative, "sha256": sha_file(path)}
        return observed

    def _compile_roadside(self) -> None:
        source = load(ROOT / self.contract["source_pins"]["roadside_corridor"]["path"])
        for raw in source["instances"]:
            binding = raw.get("poi_binding", {})
            if binding.get("kind") != "non_poi_roadside_instance":
                continue
            instance = dict(raw)
            cell = instance["cell"]
            if instance["resource_node_status"] != "CONTRACT_NOT_SPAWNED":
                raise ValueError("roadside source node status drift")
            node = next(n for n in self.plan["resource_nodes"] if n["node_id"] == instance["resource_node_id"])
            if node["cell"] != cell or node["material_key"] != "salvage":
                raise ValueError(f"roadside source identity drift: {instance['instance_id']}")
            if instance["economy_binding"]["reward_items"] is not None:
                raise ValueError("A1 cannot authorize roadside rewards")
            size = instance["collision_size_px"]
            offset = instance["collision_offset_px"]
            center = [cell[0] * 16 + 8 + offset[0], cell[1] * 16 + 8 + offset[1]]
            body = {"id": instance["instance_id"], "site_key": "roadside",
                    "center_px": center, "size_px": size,
                    "rect_px": [center[0] - size[0] * 0.5, center[1] - size[1] * 0.5, size[0], size[1]]}
            if not hero_clear_of_body(instance["stand_cell"], body):
                raise ValueError(f"roadside stand intersects source body: {instance['instance_id']}")
            instance["material_key"] = "salvage"
            instance["body"] = body
            instance["production_economy_mounted"] = False
            self.roadside_sources.append(instance)
            self.physical_bodies.append(body)
        if len(self.roadside_sources) != 3:
            raise ValueError("exactly three existing roadside sources are required")

    def _compile_sites(self) -> None:
        for key, spec in self.contract["physical_sites"].items():
            source = load(ROOT / self.contract["source_pins"][spec["pin"]]["path"])
            shell = source["overworld_shell"]
            if source["source"]["poi_id"] != spec["poi_id"] or source["source"]["canonical_cell"] != spec["canonical_cell"]:
                raise ValueError(f"A8 canonical identity drift: {key}")
            if shell["canonical_cell"] != spec["canonical_cell"] or shell["bounds_px"] != [128, 128]:
                raise ValueError(f"A8 shell identity/bounds drift: {key}")
            if shell["scale"] != [1, 1] or shell["rotation_degrees"] != 0:
                raise ValueError(f"A8 shell transform is not unscaled: {key}")
            cell = spec["canonical_cell"]
            if self.pois[spec["poi_id"]]["cell"] != cell:
                raise ValueError(f"A1/A8 POI anchor mismatch: {key}")
            anchor = [cell[0] * 16 + 8, cell[1] * 16 + 8]
            origin = [anchor[i] - 64 for i in (0, 1)]
            entry = [origin[i] + shell["entry_portal"][i] for i in (0, 1)]
            doorway_local = shell["visual_layout"]["doorway_clear_rect_px"]
            doorway = [origin[0] + doorway_local[0], origin[1] + doorway_local[1],
                       doorway_local[2], doorway_local[3]]
            approach = [cell[0], cell[1] + 3]
            if abs(foot(approach)[0] - entry[0]) > 8 or abs(foot(approach)[1] - entry[1]) > 12:
                raise ValueError(f"A8 approach no longer meets portal: {key}")
            bodies = []
            for index, rect in enumerate(shell.get("obstacles_px", [])):
                body = {"id": f"a8:{key}:obstacle:{index:02d}", "site_key": key,
                        "rect_px": [origin[0] + rect[0], origin[1] + rect[1], rect[2], rect[3]]}
                body["center_px"] = [body["rect_px"][0] + rect[2] * 0.5,
                                     body["rect_px"][1] + rect[3] * 0.5]
                body["size_px"] = [rect[2], rect[3]]
                bodies.append(body)
            if not hero_clear_of_body(approach, {"center_px": [0, 0], "size_px": [0, 0]}):
                raise AssertionError("unreachable")
            if any(not hero_clear_of_body(approach, body) for body in bodies):
                raise ValueError(f"A8 approach intersects shell obstacle: {key}")
            transition = source["local_transition"]
            expected_return = [cell[0] * 16 + 8, cell[1] * 16 + 52]
            if entry != expected_return or transition["return_anchor"]["canonical_cell"] != cell:
                raise ValueError(f"A8 return transform drift: {key}")
            if transition["return_anchor"]["shell_local_position"] != shell["entry_portal"]:
                raise ValueError(f"A8 return/entry identity drift: {key}")
            if source["world_bounds"] != [960, 608]:
                raise ValueError(f"A8 interior was substituted for shell: {key}")
            self.sites[key] = {
                "site_key": key, "site_id": source["site_id"], "poi_id": spec["poi_id"],
                "canonical_cell": cell, "anchor_world_px": anchor, "shell_origin_world_px": origin,
                "shell_scene": shell["scene"], "interior_scene": transition["worksite_scene"],
                "interior_bounds_px": source["world_bounds"], "shell_bounds_px": shell["bounds_px"],
                "entry_portal_world_px": entry, "return_anchor_world_px": expected_return,
                "approach_cell": approach, "approach_foot_world_px": list(foot(approach)),
                "doorway_clear_world_rect_px": doorway, "obstacles": bodies,
                "outer_requires": source["access"]["outer_requires"],
                "inner_requires": source["access"]["inner_requires"],
                "action_socket_world_px": anchor,
                "source_path": self.contract["source_pins"][spec["pin"]]["path"],
                "source_sha256": self.contract["source_pins"][spec["pin"]]["sha256"],
                "source_commit": self.contract["source_pins"]["a8_commit"],
                "visual_layout": shell["visual_layout"], "shell_obstacles_local_px": shell.get("obstacles_px", []),
                "production_scene_mounted": False, "fixture_proxy_only": True,
            }
            self.physical_bodies.extend(bodies)

    def source_clear(self, cell: tuple[int, int], blocked: set[tuple[int, int]] | None = None,
                     allow_hazard=False, ignore_bodies=False) -> bool:
        x, y = cell
        if not (0 <= x < self.w and 1 <= y < self.h - 1):
            return False
        blocked = blocked or set()
        for dy in (-1, 0, 1):
            xx, yy = x, y + dy
            i = yy * self.w + xx
            if not self.values["walk"][i] or (xx, yy) in blocked:
                return False
            if not allow_hazard and self.values["hazard"][i]:
                return False
            if self.values["preserved"][i]:
                legacy_index = yy * self.base.w + xx
                if self.base.prop_blocked[legacy_index]:
                    return False
                if self.base.blocked[legacy_index] and (xx, yy) not in self.seam_cells:
                    return False
        if not ignore_bodies and any(not hero_clear_of_body(list(cell), body) for body in self.physical_bodies):
            return False
        return True

    def build_component(self) -> None:
        home = tuple(self.contract["spawn_policy"]["home_cell"])
        if not self.source_clear(home, ignore_bodies=True):
            raise ValueError("Refuge is not source/body clear")
        queue = deque([home])
        self.component = {home}
        while queue:
            x, y = queue.popleft()
            for dx, dy in DIRECTIONS:
                nxt = (x + dx, y + dy)
                if nxt not in self.component and self.source_clear(nxt, ignore_bodies=True):
                    self.component.add(nxt)
                    queue.append(nxt)
        if len(self.component) < 400000:
            raise ValueError(f"source component unexpectedly small: {len(self.component)}")

    def _road_distances(self) -> None:
        queue = deque()
        for y in range(self.h):
            for x in range(self.w):
                i = y * self.w + x
                if self.values["road"][i] and (x, y) in self.component and not self.values["hazard"][i]:
                    self.road_distance[i] = 0
                    self.road_parent[(x, y)] = None
                    queue.append((x, y))
        while queue:
            x, y = queue.popleft()
            distance = self.road_distance[y * self.w + x] + 1
            for dx, dy in DIRECTIONS:
                nxt = (x + dx, y + dy)
                xx, yy = nxt
                if not (0 <= xx < self.w and 0 <= yy < self.h) or nxt not in self.component:
                    continue
                i = yy * self.w + xx
                if self.road_distance[i] > distance:
                    self.road_distance[i] = distance
                    self.road_parent[nxt] = (x, y)
                    queue.append(nxt)

    @staticmethod
    def _integral(nodes: list[dict], material: str, w: int, h: int) -> list[list[int]]:
        a = [[0] * (w + 1) for _ in range(h + 1)]
        for node in nodes:
            if node["material_key"] == material:
                x, y = node["cell"]
                a[y + 1][x + 1] = 1
        for y in range(h):
            run = 0
            for x in range(w):
                run += a[y + 1][x + 1]
                a[y + 1][x + 1] = a[y][x + 1] + run
        return a

    @staticmethod
    def _rect_sum(a: list[list[int]], x0: int, y0: int, x1: int, y1: int, w: int, h: int) -> int:
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
        return a[y1][x1] - a[y0][x1] - a[y1][x0] + a[y0][x0]

    def build_spawn_index(self) -> dict:
        self.build_component()
        self._road_distances()
        spec = self.contract["spawn_policy"]
        basic = set(spec["basic_materials"])
        safe_nodes = []
        for node in self.plan["resource_nodes"]:
            cell = tuple(node["cell"])
            if (node["material_key"] in basic and not node["required_capabilities"] and
                    cell in self.component and not self.values["hazard"][cell[1] * self.w + cell[0]]):
                safe_nodes.append(node)
        materials = sorted({n["material_key"] for n in safe_nodes})
        integrals = {m: self._integral(safe_nodes, m, self.w, self.h) for m in materials}
        radius = spec["opportunity_radius_cells"]
        counts = Counter()
        chunks: dict[str, list[int]] = {}
        candidate_meta: dict[tuple[int, int], dict] = {}
        for y in range(2, self.h - 2):
            for x in range(2, self.w - 2):
                cell = (x, y)
                i = y * self.w + x
                if cell not in self.component or self.values["preserved"][i]:
                    continue
                if self.road_distance[i] > spec["road_max_distance_cells"]:
                    continue
                rid = self.region_names[self.values["region"][i] - 1]
                if self.regions[rid]["entry_capabilities"]:
                    continue
                if any(not self.source_clear((x + dx, y + dy), ignore_bodies=True)
                       for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1),
                                      (-1, -1), (1, -1), (-1, 1), (1, 1))):
                    continue
                if any(abs(x - p["cell"][0]) <= int(p["footprint_radius_tiles"]) + 2 and
                       abs(y - p["cell"][1]) <= int(p["footprint_radius_tiles"]) + 2
                       for p in self.plan["pois"]):
                    continue
                if any(not hero_clear_of_body([x, y], body) for body in self.physical_bodies):
                    continue
                found = [m for m in materials if self._rect_sum(
                    integrals[m], x - radius, y - radius, x + radius + 1, y + radius + 1,
                    self.w, self.h) > 0]
                if len(found) < spec["minimum_material_families"]:
                    continue
                origin = self.layers.manifest[chunk_id(cell)]["origin"]
                local = (y - origin[1]) * 64 + (x - origin[0])
                chunks.setdefault(chunk_id(cell), []).append(local)
                counts[rid] += 1
                candidate_meta[cell] = {"region_id": rid, "road_distance_cells": self.road_distance[i],
                                        "material_families": found}
        ordered = sorted(chunks, key=lambda cid: tuple(int(v) for v in cid.split(":")[1:]))
        self.spawn_chunks = []
        for cid in ordered:
            cells = sorted(chunks[cid])
            origin = self.layers.manifest[cid]["origin"]
            region_counts = Counter()
            for local in cells:
                cell = (origin[0] + local % 64, origin[1] + local // 64)
                region_counts[candidate_meta[cell]["region_id"]] += 1
            self.spawn_chunks.append({"chunk_id": cid, "cells": cells,
                                      "cells_sha256": hashlib.sha256(canon(cells).encode()).hexdigest(),
                                      "candidate_count": len(cells), "region_counts": dict(sorted(region_counts.items()))})
            for local in cells:
                cell = (origin[0] + local % 64, origin[1] + local // 64)
                self.spawn_lookup[cell] = candidate_meta[cell]
        total = sum(c["candidate_count"] for c in self.spawn_chunks)
        if (total < spec["minimum_candidate_cells"] or len(self.spawn_chunks) < spec["minimum_candidate_chunks"] or
                len(counts) < spec["minimum_regions"]):
            raise ValueError(f"safe spawn set is not broad: cells={total} chunks={len(self.spawn_chunks)} regions={counts}")
        component_bytes = bytearray(self.n)
        for x, y in self.component:
            component_bytes[y * self.w + x] = 1
        return {
            "schema": "soh.world.a1_round12_spawn_index.v1", "world_id": self.plan["world_id"],
            "world_plan_sha256": sha_file(WORLD / "world_plan.v1.json"),
            "runtime_contract_sha256": sha_file(self.contract_path),
            "algorithm": spec["algorithm"], "criteria": spec,
            "frame": [self.w, self.h], "chunk_cells": 64,
            "connected_component_cells": len(self.component),
            "connected_component_sha256": hashlib.sha256(component_bytes).hexdigest(),
            "candidate_cells": total, "candidate_chunks": len(self.spawn_chunks),
            "region_counts": dict(sorted(counts.items())), "chunks": self.spawn_chunks,
            "production_spawn_approval": False,
        }

    def select_spawn(self, seed: int) -> tuple[int, int]:
        digest = hashlib.sha256(f"{self.plan['world_id']}|{seed}|round12-spawn-v1".encode()).digest()
        chunk = self.spawn_chunks[int.from_bytes(digest[:8], "big") % len(self.spawn_chunks)]
        local = chunk["cells"][int.from_bytes(digest[8:16], "big") % len(chunk["cells"])]
        origin = self.layers.manifest[chunk["chunk_id"]]["origin"]
        return (origin[0] + local % 64, origin[1] + local // 64)

    def spawn_cases(self) -> list[dict]:
        cases = []
        for seed in self.contract["spawn_policy"]["seeds"]:
            cell = self.select_spawn(seed)
            if cell not in self.spawn_lookup:
                raise ValueError(f"selected spawn is not eligible: {seed} {cell}")
            rally = cell
            while self.road_distance[rally[1] * self.w + rally[0]] != 0:
                parent = self.road_parent.get(rally)
                if parent is None:
                    raise ValueError(f"spawn lacks safe road parent: {cell}")
                rally = parent
            path = self.path(cell, rally)
            cases.append({"seed": seed, "spawn_cell": list(cell), "rally_cell": list(rally),
                          "source": sample(self.layers, list(cell)),
                          "eligibility": self.spawn_lookup[cell], "forward_cells": path,
                          "return_cells": list(reversed(path)), "path_stats": self.path_stats(path)})
        if len({tuple(c["spawn_cell"]) for c in cases}) < self.contract["spawn_policy"]["minimum_unique_trial_cells"]:
            raise ValueError("trial seeds do not produce enough distinct cells")
        if len({chunk_id(c["spawn_cell"]) for c in cases}) < self.contract["spawn_policy"]["minimum_trial_chunks"]:
            raise ValueError("trial seeds do not cross enough chunks")
        for region in sorted({c["source"]["region_id"] for c in cases}):
            regional = sorted((c for c in cases if c["source"]["region_id"] == region),
                              key=lambda c: (-len(c["forward_cells"]), c["seed"]))
            for case in regional[:4]:
                case["native_drive"] = True
        for case in cases:
            case.setdefault("native_drive", False)
        if sum(c["native_drive"] for c in cases) != 12:
            raise ValueError("spawn native drive matrix must contain 12 cases")
        return cases

    def cell_cost(self, cell: tuple[int, int], alternate=False) -> float:
        surface = self.layers.surface_name(list(cell))
        speed = float(self.contract["traversal"]["surface_profiles"][surface])
        if self.values["road"][cell[1] * self.w + cell[0]] and self.values["walk"][cell[1] * self.w + cell[0]]:
            speed = 1.0
        if speed <= 0:
            raise ValueError(f"non-traversable cost cell {cell}")
        cost = 1.0 / speed
        if self.values["road"][cell[1] * self.w + cell[0]]:
            cost *= float(self.contract["route_policy"]["road_cost_bonus"])
            if alternate:
                cost *= float(self.contract["route_policy"]["alternative_road_penalty"])
        return cost

    def path(self, start: Iterable[int], goal: Iterable[int], blocked: set[tuple[int, int]] | None = None,
             allow_hazard=False, alternate=False) -> list[list[int]]:
        start_t, goal_t = tuple(start), tuple(goal)
        blocked = blocked or set()
        if not self.source_clear(start_t, blocked, allow_hazard) or not self.source_clear(goal_t, blocked, allow_hazard):
            raise ValueError(f"unclear route endpoint {start_t}->{goal_t}")
        queue = [(0.0, 0.0, start_t)]
        best = {start_t: 0.0}
        previous: dict[tuple[int, int], tuple[int, int] | None] = {start_t: None}
        serial = 0
        while queue:
            _, cost, cur = heapq.heappop(queue)
            if cost > best.get(cur, math.inf) + 1e-9:
                continue
            if cur == goal_t:
                break
            for dx, dy in DIRECTIONS:
                nxt = (cur[0] + dx, cur[1] + dy)
                if nxt in best and nxt not in previous:
                    continue
                if not self.source_clear(nxt, blocked, allow_hazard):
                    continue
                next_cost = cost + self.cell_cost(nxt, alternate)
                if next_cost + 1e-9 >= best.get(nxt, math.inf):
                    continue
                best[nxt] = next_cost
                previous[nxt] = cur
                serial += 1
                heuristic = (abs(goal_t[0] - nxt[0]) + abs(goal_t[1] - nxt[1])) * 0.65
                heapq.heappush(queue, (next_cost + heuristic, next_cost, nxt))
        if goal_t not in previous:
            raise ValueError(f"no source route {start_t}->{goal_t}; blocked={len(blocked)}")
        result = []
        cur = goal_t
        while cur is not None:
            result.append(list(cur))
            cur = previous[cur]
        result.reverse()
        return result

    def path_stats(self, cells: list[list[int]]) -> dict:
        samples = [sample(self.layers, c) for c in cells]
        travel_seconds = 0.0
        effort = 0.0
        hazard_seconds = Counter()
        for s in samples:
            speed = 1.0 if s["road"] and s["walk"] else float(self.contract["traversal"]["surface_profiles"][s["surface_id"]])
            seconds = 16.0 / (96.0 * speed)
            travel_seconds += seconds
            effort += 1.0 / speed
            if s["hazard_id"]:
                hazard = next(h for h in self.plan["hazards"] if h["hazard_id"] == s["hazard_id"])
                hazard_seconds[s["hazard_id"]] += seconds
                effort += seconds * float(hazard["severity"])
        cell_set = {tuple(c) for c in cells}
        opportunities = []
        for node in self.plan["resource_nodes"]:
            x, y = node["cell"]
            if any(abs(x - c[0]) + abs(y - c[1]) <= self.contract["route_policy"]["opportunity_radius_cells"] for c in cell_set):
                opportunities.append(node)
        for poi in self.plan["pois"]:
            x, y = poi["cell"]
            if any(abs(x - c[0]) + abs(y - c[1]) <= self.contract["route_policy"]["opportunity_radius_cells"] for c in cell_set):
                for material in poi.get("material_keys", []):
                    opportunities.append({"node_id": poi["poi_id"] + "::" + material, "material_key": material})
        for source in self.roadside_sources:
            x, y = source["cell"]
            if any(abs(x - c[0]) + abs(y - c[1]) <= self.contract["route_policy"]["opportunity_radius_cells"] for c in cell_set):
                opportunities.append({"node_id": source["instance_id"], "material_key": "salvage"})
        discoveries = []
        for poi in self.plan["pois"]:
            if not poi["required_capabilities"]:
                continue
            x, y = poi["cell"]
            distances = [abs(x - c[0]) + abs(y - c[1]) for c in cell_set]
            distance = min(distances) if distances else 10**6
            if distance <= self.contract["route_policy"]["discovery_radius_cells"]:
                discoveries.append({"poi_id": poi["poi_id"], "cell": poi["cell"],
                                    "required_capabilities": poi["required_capabilities"],
                                    "minimum_distance_cells": distance})
        return {
            "cell_count": len(cells), "step_count": max(0, len(cells) - 1),
            "region_ids": sorted({s["region_id"] for s in samples}),
            "biome_ids": sorted({s["biome_id"] for s in samples}),
            "surface_ids": sorted({s["surface_id"] for s in samples}),
            "chunk_ids": sorted({s["chunk_id"] for s in samples}),
            "road_cells": sum(bool(s["road"]) for s in samples),
            "offroad_cells": sum(not bool(s["road"]) for s in samples),
            "hazard_cells": [s["cell"] for s in samples if s["hazard"]],
            "hazard_seconds": dict(sorted(hazard_seconds.items())),
            "estimated_travel_seconds_at_96": round(travel_seconds, 3),
            "planning_effort_units": round(effort, 3),
            "supply_pressure_units_not_inventory": round(effort, 3),
            "opportunity_node_ids": sorted(n["node_id"] for n in opportunities),
            "opportunity_materials": sorted({n["material_key"] for n in opportunities}),
            "opportunity_counts": dict(sorted(Counter(n["material_key"] for n in opportunities).items())),
            "locked_poi_discoveries": discoveries,
            "cells_sha256": hashlib.sha256(canon(cells).encode()).hexdigest(),
            "cost_scope": "GEOGRAPHIC_PLANNING_ONLY_NO_ITEMS_HEALTH_OR_A3_VALUE",
        }

    def waypoint_cell(self, name: str) -> list[int]:
        if name in self.sites:
            return list(self.sites[name]["approach_cell"])
        return list(self.contract["waypoints"][name])

    def compile_route(self, site_key: str, waypoint_names: list[str], alternate=False,
                      blocked: set[tuple[int, int]] | None = None) -> dict:
        cells: list[list[int]] = []
        for a, b in zip(waypoint_names, waypoint_names[1:]):
            leg = self.path(self.waypoint_cell(a), self.waypoint_cell(b), blocked=blocked, alternate=alternate)
            cells.extend(leg if not cells else leg[1:])
        stats = self.path_stats(cells)
        return {"route_id": f"route:{site_key}:{'+'.join(waypoint_names)}",
                "site_key": site_key, "poi_id": self.sites[site_key]["poi_id"],
                "waypoints": waypoint_names, "cells": cells, "return_cells": list(reversed(cells)),
                "stats": stats, "alternative": alternate}

    def compile_routes(self) -> dict:
        routes = {}
        for site_key, alternatives in self.contract["route_alternatives"].items():
            rows = [self.compile_route(site_key, names, alternate=index > 0)
                    for index, names in enumerate(alternatives)]
            if len({r["stats"]["cells_sha256"] for r in rows}) != len(rows):
                raise ValueError(f"route alternatives are identical for {site_key}")
            if any(r["stats"]["hazard_cells"] for r in rows):
                raise ValueError(f"ordinary route entered hazard for {site_key}")
            if not any(r["stats"]["opportunity_node_ids"] != rows[0]["stats"]["opportunity_node_ids"] for r in rows[1:]):
                raise ValueError(f"route alternatives have no source-opportunity difference for {site_key}")
            if not any(r["stats"]["estimated_travel_seconds_at_96"] != rows[0]["stats"]["estimated_travel_seconds_at_96"] for r in rows[1:]):
                raise ValueError(f"route alternatives have no time difference for {site_key}")
            routes[site_key] = rows
        return routes

    def compile_journey(self, journey_id: str, names: list[str], blocked: set[tuple[int, int]] | None = None) -> dict:
        legs = []
        for index, (a, b) in enumerate(zip(names, names[1:])):
            cells = self.path(self.waypoint_cell(a), self.waypoint_cell(b), blocked=blocked)
            legs.append({"leg_id": f"{journey_id}:{index:02d}:{a}_to_{b}", "from_waypoint": a,
                         "to_waypoint": b, "from_cell": self.waypoint_cell(a), "to_cell": self.waypoint_cell(b),
                         "cells": cells, "return_cells": list(reversed(cells)), "stats": self.path_stats(cells)})
        cells = []
        for leg in legs:
            cells.extend(leg["cells"] if not cells else leg["cells"][1:])
        return {"journey_id": journey_id, "waypoints": names, "home_cell": self.waypoint_cell("home"),
                "legs": legs, "cells": cells, "stats": self.path_stats(cells),
                "teleport_between_legs": False, "production_player_reachable": False}

    def compile_dynamic(self, reload_journey: dict) -> tuple[dict, dict]:
        spec = self.contract["dynamic_fixture"]
        for leg in reload_journey["legs"]:
            cells = leg["cells"]
            for index in range(4, len(cells) - 4):
                cell = tuple(cells[index])
                x, y = cell
                i = y * self.w + x
                if (self.values["preserved"][i] or self.values["build_permission"][i] != 1 or
                        self.values["road"][i] or self.values["hazard"][i]):
                    continue
                if any(abs(x - p["cell"][0]) <= int(p["footprint_radius_tiles"]) + 2 and
                       abs(y - p["cell"][1]) <= int(p["footprint_radius_tiles"]) + 2 for p in self.plan["pois"]):
                    continue
                blocked = {cell}
                try:
                    detour = self.path(leg["from_cell"], leg["to_cell"], blocked=blocked)
                except ValueError:
                    continue
                if detour == cells or len(detour) > len(cells) + 80:
                    continue
                descriptor = dict(spec)
                descriptor.update({"cell": [x, y], "layer": "walk", "value": 0, "expected_base": 1,
                                   "source_chunk_id": chunk_id(cell), "world_px": [x * 16, y * 16],
                                   "source": sample(self.layers, [x, y]),
                                   "baseline_leg_id": leg["leg_id"], "detour_leg_id": leg["leg_id"] + ":dynamic_detour",
                                   "baseline_cell_index": index})
                changed_leg = dict(leg)
                changed_leg["leg_id"] += ":dynamic_detour"
                changed_leg["cells"] = detour
                changed_leg["return_cells"] = list(reversed(detour))
                changed_leg["stats"] = self.path_stats(detour)
                changed_leg["dynamic_detour"] = True
                changed_journey = dict(reload_journey)
                changed_journey["legs"] = [changed_leg if other["leg_id"] == leg["leg_id"] else other
                                           for other in reload_journey["legs"]]
                all_cells = []
                for other in changed_journey["legs"]:
                    all_cells.extend(other["cells"] if not all_cells else other["cells"][1:])
                changed_journey["cells"] = all_cells
                changed_journey["stats"] = self.path_stats(all_cells)
                changed_journey["dynamic_structure_id"] = spec["structure_id"]
                return descriptor, changed_journey
        raise ValueError("no legal visible dynamic overlay with a real detour found")

    def compile_hazards(self) -> list[dict]:
        specs = [
            {"hazard_id": "hz_crown_heat", "safe_cell": [162, 183], "inside_cell": [162, 185]},
            {"hazard_id": "hz_crown_cold", "safe_cell": [246, 121], "inside_cell": [246, 123]},
        ]
        rows = []
        for spec in specs:
            hazard = next(h for h in self.plan["hazards"] if h["hazard_id"] == spec["hazard_id"])
            forward = self.path(spec["safe_cell"], spec["inside_cell"], allow_hazard=True)
            if forward != [spec["safe_cell"], [spec["safe_cell"][0], spec["safe_cell"][1] + 1], spec["inside_cell"]]:
                raise ValueError(f"hazard probe detoured: {spec['hazard_id']}")
            samples = [sample(self.layers, c) for c in forward]
            if samples[0]["hazard_id"] is not None or any(s["hazard_id"] != spec["hazard_id"] for s in samples[1:]):
                raise ValueError(f"hazard probe is not a real transition: {spec['hazard_id']}")
            rows.append(dict(spec, required_capability=hazard["requires"], kind=hazard["kind"],
                             severity_source_readonly=hazard["severity"], clue=hazard["clue"],
                             forward_cells=forward, return_cells=list(reversed(forward)),
                             source_samples=samples, damage_application="A0_NOT_APPLIED"))
        return rows

    def compile_visual_views(self) -> list[dict]:
        index = load(ROOT / self.contract["source_pins"]["presentations"]["path"])
        rows = []
        for entry in index["presentations"]:
            doc = load(ROOT / entry["path"])
            rid = doc.get("region_id", "")
            for view_index, view in enumerate(doc.get("capture_views", [])[:2]):
                cell = view["center_cell"]
                if not (0 <= cell[0] < self.w and 0 <= cell[1] < self.h):
                    raise ValueError("visual view exposes out-of-frame world_bounds")
                candidates = []
                for radius in range(0, 17):
                    for dy in range(-radius, radius + 1):
                        for dx in range(-radius, radius + 1):
                            if max(abs(dx), abs(dy)) != radius:
                                continue
                            stand = [cell[0] + dx, cell[1] + dy]
                            if self.source_clear(tuple(stand), allow_hazard=True):
                                candidates.append((abs(dx) + abs(dy), stand))
                    if candidates:
                        break
                if not candidates:
                    raise ValueError(f"no safe native stand near visual viewpoint {view['id']}")
                candidates.sort(key=lambda item: (item[0], item[1]))
                stand = candidates[0][1]
                rows.append({"view_id": view["id"], "treatment_source": entry["treatment_id"],
                             "region_id": rid, "center_cell": cell, "stand_cell": stand,
                             "stand_source": sample(self.layers, stand), "camera_center_px": foot(cell),
                             "stand_is_safe_spawn": sample(self.layers, stand)["hazard"] == 0,
                             "hazard_preparation_required": next((h["requires"] for h in self.plan["hazards"] if h["hazard_id"] == sample(self.layers, stand)["hazard_id"]), None),
                             "time_of_day": view.get("time_of_day", 0.35),
                             "night": view_index == 1 or float(view.get("time_of_day", 0.35)) >= 0.62,
                             "source": sample(self.layers, cell),
                             "render_source": "LIVE_STREAMED_CHUNKS_NOT_COMPILED_WINDOW",
                             "full_resolution": view_index == 0 or rid in self.contract["visual"]["full_resolution_night_regions"]})
        if len({r["region_id"] for r in rows}) != 11:
            raise ValueError("visual matrix does not cover all 11 authored regions")
        for rid in self.contract["visual"]["full_resolution_night_regions"]:
            first = next(r for r in rows if r["region_id"] == rid)
            pair = dict(first)
            pair.update({"view_id": first["view_id"] + ":night_pair", "time_of_day": 0.82,
                         "night": True, "full_resolution": True, "pair_of": first["view_id"]})
            rows.append(pair)
        return rows

    def logistics(self, routes: dict) -> list[dict]:
        rows = []
        for site_key, alternatives in routes.items():
            direct = alternatives[0]["stats"]["estimated_travel_seconds_at_96"]
            for outpost in ("south_watch", "amber_watch"):
                if outpost == "amber_watch" and site_key != "orchard":
                    continue
                path = self.compile_route(site_key, [outpost, site_key], alternate=True)
                staged = path["stats"]["estimated_travel_seconds_at_96"]
                rows.append({"site_key": site_key, "poi_id": self.sites[site_key]["poi_id"],
                             "outpost_waypoint": outpost, "outpost_cell": self.waypoint_cell(outpost),
                             "home_one_way_seconds": direct, "outpost_one_way_seconds": staged,
                             "repeat_roundtrip_seconds_saved": round(2 * (direct - staged), 3),
                             "activation_or_construction_implemented": False,
                             "interpretation": "GEOGRAPHIC_LOGISTICS_ONLY; negative means home is better"})
        return rows

    def build(self) -> tuple[dict, dict]:
        self.validate_sources()
        spawn_index = self.build_spawn_index()
        spawn_cases = self.spawn_cases()
        routes = self.compile_routes()
        primary = self.compile_journey("primary_three_site_roundtrip", self.contract["native_journeys"]["primary"])
        reload_base = self.compile_journey("reload_alternative_roundtrip", self.contract["native_journeys"]["reload"])
        dynamic, reload_journey = self.compile_dynamic(reload_base)
        inputs = {
            "schema": "soh.world.a1_round12_native_inputs.v1",
            "source_contract": str(self.contract_path.relative_to(ROOT)),
            "source_contract_sha256": sha_file(self.contract_path),
            "spawn_index_sha256": hashlib.sha256(json_bytes(spawn_index)).hexdigest(),
            "world_id": self.plan["world_id"], "world_plan_sha256": sha_file(WORLD / "world_plan.v1.json"),
            "world_extents_cells": [0, 0, self.w, self.h], "chunk_cells": 64, "tile_px": 16,
            "reader_script": self.contract["reader_api"]["script"], "stream_script": self.contract["reader_api"]["stream_script"],
            "runtime_contract_path": "res://data/survival/world/a1_round12_runtime_contract.v1.json",
            "spawn_index_path": "res://data/survival/world/a1_round12_spawn_index.v1.json",
            "atlas_path": self.contract["visual"]["atlas_path"],
            "terrain_path": "res://assets/environment/survival_world/terrain.png",
            "props_path": "res://assets/environment/survival_world/props.png",
            "hero": {"scene": "res://" + self.contract["runtime_interfaces"]["player"]["scene"],
                     "body_size_px": [12, 16], "body_offset_px": [0, -8],
                     "move_speed_px_s": 96.0, "acceleration_px_s2": 900.0,
                     "friction_px_s2": 1100.0, "technical_proxy_not_D051_identity": True},
            "runtime_interfaces": self.contract["runtime_interfaces"],
            "runtime_observed_sha256": self.runtime_observations(),
            "legacy": {"world_data": "res://data/overworld/hollow_marches.json",
                       "layers": "res://data/overworld/hollow_marches_layers.json",
                       "props": "res://data/overworld/hollow_marches_props.json",
                       "seam_carves": self.plan["legacy_seam_carves"],
                       "scope": "ISOLATED_RUNTIME_SOURCE_COMPOSITION_A0_PRODUCTION_MECHANISM_REQUIRED"},
            "spawn_safety": {"cases": spawn_cases, "candidate_cells": spawn_index["candidate_cells"],
                             "candidate_chunks": spawn_index["candidate_chunks"], "region_counts": spawn_index["region_counts"],
                             "production_spawn_approval": False},
            "physical_sites": self.sites, "roadside_sources": self.roadside_sources, "route_alternatives": routes,
            "primary_journey": primary, "reload_baseline_journey": reload_base, "reload_journey": reload_journey,
            "dynamic_fixture": dynamic, "hazard_probes": self.compile_hazards(),
            "visual_views": self.compile_visual_views(), "logistics": self.logistics(routes),
            "source_manifest": {key: value for key, value in self.contract["source_pins"].items() if isinstance(value, dict)},
            "accepted_placement": {"territories": 6, "trial_endpoints": 4,
                                   "sha256": self.contract["source_pins"]["placement"]["sha256"]},
            "journey_evaluation": self.contract["journey_evaluation"], "world_state": self.contract["world_state"],
            "production_native_playable": False, "save_mutation": False, "reward_items_granted": 0,
            "scope": "ISOLATED_NATIVE_FULL_SOURCE_READER_STREAM_FIXTURE_NOT_A0_PRODUCTION_NOT_HUMAN_ACCEPTANCE",
        }
        return spawn_index, inputs


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(json_bytes(value))


def build(contract_path: Path = CONTRACT) -> dict:
    """Test/consumer convenience: compile and return only the native input packet."""
    return RuntimeBuilder(contract_path).build()[1]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--contract", default=str(CONTRACT))
    parser.add_argument("--out", default="artifacts/a1-round12/round12_native_inputs.json")
    parser.add_argument("--spawn-out", default=str(SPAWN_INDEX))
    parser.add_argument("--check", action="store_true", help="fail if committed derived index differs; do not write it")
    args = parser.parse_args()
    builder = RuntimeBuilder(Path(args.contract))
    spawn, inputs = builder.build()
    spawn_path = Path(args.spawn_out)
    if args.check:
        if not spawn_path.is_file() or load(spawn_path) != spawn:
            raise ValueError("committed Round 12 spawn index is stale; run compile_round12_runtime.py")
    else:
        write_json(spawn_path, spawn)
    out = Path(args.out)
    write_json(out, inputs)
    print(json.dumps({"ok": True, "out": str(out), "spawn_index": str(spawn_path),
                      "candidate_cells": spawn["candidate_cells"], "candidate_chunks": spawn["candidate_chunks"],
                      "spawn_regions": spawn["region_counts"], "spawn_trials": len(inputs["spawn_safety"]["cases"]),
                      "physical_spawn_trials": sum(c["native_drive"] for c in inputs["spawn_safety"]["cases"]),
                      "primary_cells": len(inputs["primary_journey"]["cells"]),
                      "reload_cells": len(inputs["reload_journey"]["cells"]),
                      "dynamic_cell": inputs["dynamic_fixture"]["cell"],
                      "visual_views": len(inputs["visual_views"]), "production_native_playable": False}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
