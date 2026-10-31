#!/usr/bin/env python3
"""Compile bounded, deterministic, source-driven R13 continent decor.

Macro geography remains the authored 1024x768 plan. Meso composition comes from
roads, water, resource/POI clearances and explicit Quarry/Orchard clusters.
Micro props are selected only inside eligible ecological/route clusters. This
is not random full-map filler and not a claim of hand-painted 192-chunk art.
"""
from __future__ import annotations

from collections import Counter, deque
import hashlib
import json
from pathlib import Path

import compile_world_art as cwa
from asset_exploitation import SPECS

ROOT = cwa.ROOT
WORLD = cwa.WORLD
ART = cwa.ART
OUT = ART / "continent_decor.v1.json"
SCHEMA = "soh.world.continent_decor.v1"
TILE = 16


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def h01(*values: int) -> float:
    return cwa.h01(*values)


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _spawn_cells() -> set[tuple[int, int]]:
    doc = load(WORLD / "a1_round12_spawn_index.v1.json")
    cells = set()
    for chunk in doc["chunks"]:
        cx, cy = (int(v) for v in chunk["chunk_id"].split(":")[1:])
        ox, oy = cx * 64, cy * 64
        for local in chunk["cells"]:
            cells.add((ox + local % 64, oy + local // 64))
    return cells


def _base_presentations_hash() -> str:
    index = load(ART / "presentations.v1.json")
    for key in ("continent_decor", "asset_exploitation", "live_coverage"):
        index.pop(key, None)
    return hashlib.sha256((json.dumps(index, indent=2, sort_keys=True) + "\n").encode()).hexdigest()


def _curated_windows() -> list[tuple[int, int, int, int]]:
    index = load(ART / "presentations.v1.json")
    windows = []
    for entry in index["presentations"]:
        doc = load(ROOT / entry["path"])
        (ox, oy), (w, h) = doc["window"]["origin_cell"], doc["window"]["size_cells"]
        windows.append((ox, oy, w, h))
    return windows


def _in_windows(cell: tuple[int, int], windows: list[tuple[int, int, int, int]]) -> bool:
    x, y = cell
    return any(ox <= x < ox + w and oy <= y < oy + h for ox, oy, w, h in windows)


def _road_distances(roads: set[tuple[int, int]], origin: tuple[int, int]) -> dict[tuple[int, int], int]:
    ox, oy = origin
    distances = {cell: 0 for cell in roads}
    queue = deque(roads)
    while queue:
        x, y = queue.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if not (ox <= n[0] < ox + 64 and oy <= n[1] < oy + 64) or n in distances:
                continue
            distances[n] = distances[(x, y)] + 1
            queue.append(n)
    return distances


def compile_all() -> dict:
    plan = cwa.load_plan()
    layers = cwa.Layers(plan)
    atlas = load(ART / "atlas.v1.json")
    windows = _curated_windows()
    spawn_cells = _spawn_cells()
    resource_cells = {tuple(n["cell"]) for n in plan["resource_nodes"]}
    runtime = load(WORLD / "a1_round12_runtime_contract.v1.json")
    shell_sites = []
    shell_pins = {}
    for site_key, category, approach, retreat in (
            ("quarry", "p0_quarry_shell_transition", (30, 283), (30, 289)),
            ("orchard", "p0_orchard_shell_transition", (140, 363), (140, 369))):
        pin = runtime["source_pins"][f"a8_{site_key}"]
        spec_path = ROOT / pin["path"]
        spec = load(spec_path)
        shell = spec["overworld_shell"]
        canonical = tuple(shell["canonical_cell"])
        origin_px = [canonical[i] * 16 + 8 - shell["action_socket"][i] for i in (0, 1)]
        base = tuple(origin_px[i] // 16 for i in (0, 1))
        door = shell["visual_layout"]["doorway_clear_rect_px"]
        door_world = [origin_px[0] + door[0], origin_px[1] + door[1], door[2], door[3]]
        door_cells = set()
        for y in range(door_world[1] // 16 - 1, (door_world[1] + door_world[3]) // 16 + 2):
            for x in range(door_world[0] // 16 - 1, (door_world[0] + door_world[2]) // 16 + 2):
                door_cells.add((x, y))
        shell_sites.append({"category": category, "canonical": canonical, "base": base,
                            "core": {canonical, approach, retreat}, "door_cells": door_cells})
        shell_pins[f"a8_{site_key}"] = {"path": pin["path"], "sha256": sha(spec_path)}
    poi_cells = set()
    for poi in plan["pois"]:
        x, y = poi["cell"]
        radius = int(poi["footprint_radius_tiles"]) + 2
        for yy in range(y - radius, y + radius + 1):
            for xx in range(x - radius, x + radius + 1):
                poi_cells.add((xx, yy))
    spawn_cells_sha256 = hashlib.sha256(json.dumps(sorted([list(cell) for cell in spawn_cells]), separators=(",", ":")).encode()).hexdigest()
    chunks: dict[str, list[dict]] = {}
    category_counts: Counter[str] = Counter()
    frame_counts: Counter[str] = Counter()
    p0_counts: Counter[str] = Counter()
    occupied = set()

    def eligible(cell: tuple[int, int], allow_poi_margin: bool = False) -> bool:
        return cell not in occupied and cell not in spawn_cells and (allow_poi_margin or cell not in poi_cells) \
            and cell not in resource_cells and not _in_windows(cell, windows)

    def add(rows: list[dict], frame: str, cell: tuple[int, int], category: str, role: str = "background_scenery",
            allow_poi_margin: bool = False) -> bool:
        if frame not in atlas["props"] or not eligible(cell, allow_poi_margin):
            return False
        x, y = cell
        rows.append({"id": f"continent:{category}:{x},{y}:{frame}", "frame": frame, "cell": [x, y],
                     "role": role, "source": category, "collision_change": False})
        occupied.add(cell)
        category_counts[category] += 1
        frame_counts[frame] += 1
        if category.startswith("p0_"):
            p0_counts[category] += 1
        return True

    for manifest in plan["chunk_manifest"]:
        cid = manifest["chunk_id"]
        ox, oy = manifest["origin"]
        chunk = layers.chunk([ox, oy])
        values = chunk["_layers"]
        legends = chunk.get("legend", {})
        rows: list[dict] = []
        chunks[cid] = rows
        roads: set[tuple[int, int]] = set()
        infos: dict[tuple[int, int], dict] = {}
        for y in range(oy, oy + 64):
            for x in range(ox, ox + 64):
                local = (y - oy) * 64 + x - ox
                cell = (x, y)
                if values["preserved"][local] or _in_windows(cell, windows):
                    continue

                def named(layer: str) -> str:
                    value = values[layer][local]
                    legend = legends.get(layer, [])
                    return str(legend[value - 1]) if 1 <= value <= len(legend) else ""

                info = {"surface": named("surface"), "biome": named("biome"),
                        "walk": values["walk"][local], "road": values["road"][local],
                        "hazard": values["hazard"][local], "build": values["build_permission"][local]}
                infos[cell] = info
                if info["road"]:
                    roads.add(cell)
        road_distance = _road_distances(roads, (ox, oy))

        def distant_enough(cell: tuple[int, int], distance: int, selected: list[tuple[int, int]]) -> bool:
            return all(abs(cell[0] - other[0]) + abs(cell[1] - other[1]) >= distance for other in selected)

        # Ecological clusters on off-route forest land. Tall art never sits on a
        # road/spawn/POI/resource cell and remains visual-only, like curated trees.
        trees = []
        tree_candidates = []
        for cell, info in infos.items():
            x, y = cell
            forest = info["surface"] in {"forest", "jungle", "mangrove"} or "forest" in info["biome"]
            scenery_land = info["surface"] != "water" and not info["road"] and not info["hazard"]
            if scenery_land and forest and road_distance.get(cell, 99) >= 3 \
                    and h01(x // 6, y // 6, 301) > 0.28:
                score = h01(x, y, 302) + min(road_distance.get(cell, 12), 12) * 0.015
                tree_candidates.append((score, cell, info))
        for _, cell, info in sorted(tree_candidates, reverse=True):
            if len(trees) >= 4 or not distant_enough(cell, 7, trees):
                continue
            ocean = info["surface"] == "mangrove" or info["biome"] in {"mangrove", "freshwater_marsh", "peat_bog"}
            prefix = "ocean" if ocean else "cainos"
            size = ("large", "medium", "small", "medium")[len(trees)]
            if add(rows, f"{prefix}_tree_{size}", cell, "source_forest_mass"):
                trees.append(cell)

        # Stone/ruin mass is read from blocked source cells. Broken masonry is
        # restricted to actual ruin/stone contexts, never scattered on grass.
        rocks = []
        rock_candidates = []
        for cell, info in infos.items():
            x, y = cell
            stony = info["surface"] in {"gravel", "basalt", "ash", "badland", "karst", "tundra"} \
                or info["biome"] in {"ruin_field", "volcanic_steppe"}
            scenery_land = info["surface"] != "water" and not info["road"] and not info["hazard"]
            if scenery_land and stony and h01(x // 5, y // 5, 311) > 0.32:
                rock_candidates.append((h01(x, y, 312), cell, info))
        for _, cell, info in sorted(rock_candidates, reverse=True):
            if len(rocks) >= 3 or not distant_enough(cell, 5, rocks):
                continue
            if info["biome"] == "ruin_field":
                frame = ("cainos_column_broken", "cainos_ruin_block", "cainos_column_tall")[len(rocks)]
                role = "restricted_access"
            else:
                frame = ("cainos_boulder", "cainos_stone_large", "cainos_stone_medium")[len(rocks)]
                role = "background_scenery"
            if add(rows, frame, cell, "source_stone_ruin_mass", role):
                rocks.append(cell)

        # Route-margin and ecological micro clusters. One prop per 4x4 sector
        # prevents confetti; low-frequency cluster gates leave deliberate calm.
        micro = []
        sectors = set()
        micro_candidates = []
        for cell, info in infos.items():
            x, y = cell
            if info["walk"] != 1 or info["road"] or info["hazard"] or not eligible(cell):
                continue
            if info["surface"] not in {"grass", "forest", "moor", "orchard", "marsh", "mangrove", "mud",
                                       "bog", "gravel", "sand", "soil", "ash", "badland", "karst"}:
                continue
            distance = road_distance.get(cell, 99)
            route_margin = 2 <= distance <= 6
            cluster = h01(x // 5, y // 5, 321) > (0.35 if route_margin else 0.58)
            if not cluster:
                continue
            score = h01(x, y, 322) + (0.35 if route_margin else 0.0)
            micro_candidates.append((score, cell, info))
        for _, cell, info in sorted(micro_candidates, reverse=True):
            sector = (cell[0] // 4, cell[1] // 4)
            if len(micro) >= 12 or sector in sectors or not distant_enough(cell, 2, micro):
                continue
            x, y = cell
            ocean = info["surface"] in {"marsh", "mangrove", "mud", "bog"} \
                or info["biome"] in {"freshwater_marsh", "peat_bog", "mangrove"}
            if info["surface"] in {"gravel", "ash", "badland", "karst"}:
                frame = ("cainos_stone_small", "cainos_stone_medium", "cainos_stone_large")[int(h01(x, y, 323) * 3) % 3]
            elif ocean:
                frame = ("ocean_tuft_0", "ocean_tuft_1", "ocean_tuft_2", "ocean_bush_wide")[int(h01(x, y, 324) * 4) % 4]
            else:
                frame = ("cainos_tuft_0", "cainos_tuft_1", "cainos_tuft_2", "cainos_tuft_3", "cainos_bush_wide")[int(h01(x, y, 325) * 5) % 5]
            # Bushes are reserved for blocked mass; walkable margins get only
            # low ground cover/stone so buildable/route cells do not look solid.
            if frame in {"cainos_bush_wide", "ocean_bush_wide"}:
                frame = "ocean_tuft_0" if ocean else "cainos_tuft_0"
            if add(rows, frame, cell, "route_ecology_micro"):
                micro.append(cell)
                sectors.add(sector)

        # Existing road junctions may earn one unlabelled source signpost on a
        # clear off-road cell. No new destination, POI, interaction or reward.
        junctions = []
        for x, y in roads:
            neighbours = sum((x + dx, y + dy) in roads for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if neighbours >= 3:
                junctions.append((h01(x, y, 331), (x, y)))
        if junctions:
            _, (jx, jy) = max(junctions)
            candidates = []
            for dy in range(-3, 4):
                for dx in range(-3, 4):
                    cell = (jx + dx, jy + dy)
                    info = infos.get(cell)
                    if info and info["walk"] == 1 and not info["road"] and not info["hazard"] and eligible(cell):
                        candidates.append((abs(dx) + abs(dy), h01(cell[0], cell[1], 332), cell))
            for _, _, cell in sorted(candidates):
                if add(rows, "cainos_signpost", cell, "source_road_junction", "return_route"):
                    break

        # Explicit P0 compositions. These are bounded geographic clusters, not
        # a global density multiplier, and preserve all canonical sockets.
        for category, focus, mode in (("p0_quarry_approach", (30, 283), "quarry"),
                                      ("p0_orchard_approach", (140, 363), "orchard")):
            if not (ox <= focus[0] < ox + 64 and oy <= focus[1] < oy + 64):
                continue
            candidates = []
            for cell, info in infos.items():
                distance = abs(cell[0] - focus[0]) + abs(cell[1] - focus[1])
                if not 8 <= distance <= 18 or not eligible(cell):
                    continue
                candidates.append((distance, h01(cell[0], cell[1], 341 if mode == "quarry" else 342), cell, info))
            selected = []
            quotas = {"columns": 4, "trees": 3, "micro": 10}
            counts = Counter()
            for _, _, cell, info in sorted(candidates, key=lambda row: (row[1], row[0])):
                x, y = cell
                scenery_land = info["surface"] != "water" and not info["road"] and not info["hazard"]
                if mode == "quarry" and scenery_land and counts["columns"] < quotas["columns"] \
                        and distant_enough(cell, 4, selected):
                    frame = ("cainos_column_broken", "cainos_ruin_block", "cainos_column_tall", "cainos_boulder")[counts["columns"]]
                    role = "restricted_access" if frame != "cainos_boulder" else "background_scenery"
                    if add(rows, frame, cell, category, role):
                        counts["columns"] += 1
                        selected.append(cell)
                elif mode == "orchard" and scenery_land and counts["trees"] < quotas["trees"] \
                        and distant_enough(cell, 6, selected):
                    frame = ("cainos_tree_medium", "cainos_tree_small", "cainos_bush_round")[counts["trees"]]
                    if add(rows, frame, cell, category):
                        counts["trees"] += 1
                        selected.append(cell)
                elif info["walk"] == 1 and not info["road"] and not info["hazard"] and counts["micro"] < quotas["micro"] \
                        and distant_enough(cell, 2, selected):
                    if mode == "quarry":
                        frame = ("cainos_stone_small", "cainos_stone_medium", "cainos_stone_large")[counts["micro"] % 3]
                    else:
                        frame = ("cainos_tuft_0", "cainos_tuft_1", "cainos_tuft_2", "cainos_tuft_3")[counts["micro"] % 4]
                    if add(rows, frame, cell, category):
                        counts["micro"] += 1
                        selected.append(cell)

        # Low exterior shell-edge detail softens the real A8 128x128 ground
        # perimeter without editing A8 or entering its public doorway/approach.
        offsets = [(1, -1), (4, -1), (7, -1), (-1, 2), (-1, 5),
                   (8, 2), (8, 5), (0, 8), (7, 8)]
        for site in shell_sites:
            bx, by = site["base"]
            if not (ox <= site["canonical"][0] < ox + 64 and oy <= site["canonical"][1] < oy + 64):
                continue
            for index, (dx, dy) in enumerate(offsets):
                cell = (bx + dx, by + dy)
                info = infos.get(cell)
                if not info or info["walk"] != 1 or info["road"] or info["hazard"] \
                        or cell in site["core"] or cell in site["door_cells"] or not eligible(cell, True):
                    continue
                if site["category"].startswith("p0_quarry"):
                    frame = ("cainos_stone_small", "cainos_tuft_0", "cainos_stone_medium")[index % 3]
                else:
                    frame = ("cainos_tuft_0", "cainos_tuft_1", "cainos_tuft_2", "cainos_tuft_3")[index % 4]
                add(rows, frame, cell, site["category"], allow_poi_margin=True)
        rows.sort(key=lambda row: (row["cell"][1], row["cell"][0], row["frame"]))

    doc = {
        "schema": SCHEMA, "owner": "A1",
        "status": "BOUNDED_SOURCE_DRIVEN_VISUAL_LAYER_NOT_HAND_PAINTED_192_CHUNK_PRODUCTION_ART",
        "authority": "VISUAL_ONLY_ZERO_COLLISION_BUILD_GEOGRAPHY_POI_REWARD_SAVE_CHANGE",
        "world_id": "world:soh_continent_v1", "world_cells": [1024, 768], "chunk_cells": [64, 64],
        "chunk_count": 192, "chunks": chunks,
        "pins": {"world_plan_sha256": sha(WORLD / "world_plan.v1.json"),
                 "spawn_candidate_cells": len(spawn_cells), "spawn_candidate_cells_sha256": spawn_cells_sha256,
                 "atlas_sha256": sha(ART / "atlas.v1.json"),
                 "asset_exploitation_sha256": sha(ART / "asset_exploitation.v1.json"),
                 "a8_shell_sources": shell_pins,
                 "presentations_sha256_before_decor_binding": _base_presentations_hash()},
        "rules": {
            "ground": "runtime source surface/biome mapping on every non-curated rendered cell; 11 curated windows remain authoritative benchmarks",
            "macro": "authored coast/river/region/chunk silhouettes unchanged",
            "meso": "road margins, source junctions, blocked forest/stone mass, resource/POI/spawn clearances and explicit Quarry/Orchard clusters",
            "micro": "low ground cover and stone on eligible walkable cells; tall scenery only on off-route cells outside spawn/POI/resource clearances; visual-only with no collision/build data; one micro prop per 4x4 sector",
            "a8_shell_edges": "public 128x128 transform derives low exterior tufts/stones only; canonical, approach, retreat, road, spawn, resource and doorway-clear cells remain empty",
            "randomization": "stable hash ranking inside causal eligible clusters only; no per-chunk uniform decoration fill",
        },
        "counts": {"chunk_records": len(chunks), "nonempty_chunks": sum(bool(rows) for rows in chunks.values()),
                   "props": sum(category_counts.values()), "categories": dict(sorted(category_counts.items())),
                   "frames": dict(sorted(frame_counts.items())), "p0": dict(sorted(p0_counts.items())),
                   "curated_windows_preserved": len(windows), "spawn_cells_kept_clear": len(spawn_cells),
                   "poi_core_doorway_and_approach_cells_kept_clear": len(plan["pois"]),
                   "poi_margin_rule": "no props except explicitly derived low A8 shell-edge tufts/stones outside core/door/approach",
                   "resource_nodes_kept_clear": len(resource_cells)},
        "collision_change": False, "build_eligibility_change": False, "geography_change": False,
        "new_poi_count": 0, "reward_items_granted": 0,
    }
    write(OUT, doc)
    index_path = ART / "presentations.v1.json"
    index = load(index_path)
    index["continent_decor"] = {"path": str(OUT.relative_to(ROOT)), "sha256": sha(OUT), "schema": SCHEMA}
    index["asset_exploitation"] = {"path": "data/survival/world/art/asset_exploitation.v1.json",
                                    "sha256": sha(ART / "asset_exploitation.v1.json")}
    index["live_coverage"] = {"chunk_records": 192, "authored_visual_windows": 11,
                              "status": "BOUNDED_SOURCE_DRIVEN_STREAM_COVERAGE_NOT_HAND_PAINTED_PRODUCTION_COMPLETE"}
    write(index_path, index)
    return {"ok": True, "chunks": len(chunks), "props": doc["counts"]["props"],
            "nonempty_chunks": doc["counts"]["nonempty_chunks"], "p0": doc["counts"]["p0"]}


if __name__ == "__main__":
    print(json.dumps(compile_all(), sort_keys=True))
