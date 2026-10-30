#!/usr/bin/env python3
"""Contract + route validator for the Level 2 audition.

Emulates, in standard-library Python, every structural rule the real Godot
suites enforce on Level 2 so a tile change can be rejected before pushing:

* ``game/levels/level_schema.gd`` field/atlas/entity validation
* ``tests/chapter_1_campaign_map_design_test.gd``
* ``tests/chapter_1_map_design_test.gd`` (camps, spacing, patrol clearance,
  spawn/checkpoint/door safety, trap fairness, density anchor, 3 components)
* ``tests/chapter_1_collision_route_test.gd`` Knight-clearance flood fill
* ``tools/design/level2_audition_audit.py`` immutable entity contract

It also reports design metrics (route lengths, room areas, silhouette delta)
used by the delivery document. Exit code 1 on any hard failure.
"""

from __future__ import annotations

import json
import math
import subprocess
import sys
from collections import Counter, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEVEL = ROOT / "data" / "levels" / "chapter_1_level_2.json"
BASE_SHA = "1c21a49c2eb3775c4b421dab86d057c7256f5964"
TILE = 16
ENEMY_TYPES = {
    "skeleton", "skeleton_reaper", "crimson_reaper", "bone_reaper_captain",
    "hooded_archer_miniboss", "vampire", "vampire_castellan", "coven_wraith",
    "venom_bound_wraith", "spirit_leech", "hexwing_familiar", "axe_soul_boss",
    "wizard_hero_boss",
}
ENTITY_TYPES = set(ENEMY_TYPES) | {
    "player", "coin", "sigil", "soul_beacon", "checkpoint", "chest",
    "reliquary_branch_seal", "gate_seal", "bow_reward", "exit_gate",
    "floor_door", "spikes", "torch",
}
OBJECTIVE_TYPES = ["sigil", "exit_gate", "checkpoint"]
CARDINAL = [(1, 0), (-1, 0), (0, 1), (0, -1)]

failures: list[str] = []
notes: list[str] = []


def fail(message: str) -> None:
    failures.append(message)


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def baseline() -> dict:
    out = subprocess.run(
        ["git", "show", f"{BASE_SHA}:data/levels/chapter_1_level_2.json"],
        cwd=ROOT, check=True, stdout=subprocess.PIPE, text=True,
    )
    return json.loads(out.stdout)


def layer(doc: dict, name: str) -> set[tuple[int, int]]:
    return {(int(c["x"]), int(c["y"])) for c in doc["layers"][name]}


def entity_cell(entity: dict) -> tuple[int, int]:
    return (entity["position"][0] // TILE, entity["position"][1] // TILE)


def world_cell(value) -> tuple[int, int]:
    return (int(value[0]) // TILE, int(value[1]) // TILE)


def schema_check(doc: dict) -> None:
    if doc.get("version") != 2:
        fail("schema: version must be 2")
    if doc.get("movement_mode") != "top_down":
        fail("schema: movement_mode must be top_down")
    if doc.get("tile_size") != TILE:
        fail("schema: tile_size must be 16")
    w, h = int(doc["width"]), int(doc["height"])
    if w <= 0 or h <= 0:
        fail("schema: invalid dimensions")
    grids = {0: (32, 32), 1: (12, 4)}
    for name in ("Backdrop", "Geometry", "Decor"):
        seen = set()
        cells = doc["layers"].get(name)
        if not isinstance(cells, list):
            fail(f"schema: layer {name} missing")
            continue
        for index, c in enumerate(cells):
            for field in ("x", "y", "source", "alternative"):
                if not isinstance(c.get(field), int):
                    fail(f"schema: {name}[{index}].{field} not int")
                    return
            x, y = c["x"], c["y"]
            if not (0 <= x < w and 0 <= y < h):
                fail(f"schema: {name}[{index}] out of bounds ({x},{y})")
            if (x, y) in seen:
                fail(f"schema: duplicate cell {name} ({x},{y})")
            seen.add((x, y))
            if c["source"] not in grids:
                fail(f"schema: {name}[{index}] unknown source {c['source']}")
            elif c["alternative"] != 0:
                fail(f"schema: {name}[{index}] alternative must be 0")
            else:
                gx, gy = grids[c["source"]]
                ax, ay = c.get("atlas", [-1, -1])
                if not (0 <= ax < gx and 0 <= ay < gy):
                    fail(f"schema: {name}[{index}] atlas out of range {c['atlas']}")

    entities = doc["entities"]
    positions = Counter(tuple(e["position"]) for e in entities)
    for position, count in positions.items():
        if count > 1:
            fail(f"schema: {count} entities share cell {position}")
    ids = Counter(e["id"] for e in entities)
    for entity_id, count in ids.items():
        if count > 1:
            fail(f"schema: duplicate entity id {entity_id}")
    for e in entities:
        if not isinstance(e["id"], str) or not e["id"].strip():
            fail("schema: empty entity id")
        if e["type"] not in ENTITY_TYPES:
            fail(f"schema: entity {e['id']} type {e['type']} not registered")
        pos = e.get("position")
        if not isinstance(pos, list) or len(pos) != 2:
            fail(f"schema: entity {e['id']} position malformed")
            continue
        if not (0 <= pos[0] < w * TILE and 0 <= pos[1] < h * TILE):
            fail(f"schema: entity {e['id']} outside pixel bounds")
    players = [e for e in entities if e["type"] == "player"]
    exits = [e for e in entities if e["type"] == "exit_gate"]
    if len(players) != 1:
        fail(f"schema: exactly one player required, found {len(players)}")
    if len(exits) != 1:
        fail(f"schema: exactly one exit_gate required, found {len(exits)}")

    metadata = doc["metadata"]
    bounds = metadata.get("camera_bounds")
    if bounds:
        if len(bounds) != 4 or bounds[2] <= bounds[0] or bounds[3] <= bounds[1]:
            fail("schema: camera_bounds invalid")
        if bounds[2] > w * TILE or bounds[3] > h * TILE:
            fail("schema: camera_bounds exceed level bounds")
    model = metadata.get("encounter_pack_model")
    camps = metadata.get("combat_camps", [])
    if model and model.get("enabled"):
        if model.get("placement") != "authored_camp_anchors":
            fail("schema: encounter_pack_model.placement")
        if model.get("authored_counts_are_anchors") is not True:
            fail("schema: encounter_pack_model.authored_counts_are_anchors")
        covered = set()
        for camp in camps:
            if not camp.get("enemy_ids"):
                fail(f"schema: camp {camp.get('id')} without enemy_ids")
            if not isinstance(camp.get("floor"), int) or not 1 <= camp["floor"] <= model["floor_count"]:
                fail(f"schema: camp {camp.get('id')} floor out of range")
            covered.add(int(camp["floor"]))
        for floor_number in range(1, model["floor_count"] + 1):
            if floor_number not in covered:
                fail(f"schema: encounter pack floor {floor_number} has no camp")
    sigils = sum(
        1 for e in entities
        if e["type"] in ("sigil", "gate_seal")
        or (e["type"] == "chest" and e.get("contains_sigil"))
    )
    if not 1 <= int(metadata.get("required_sigils", 0)) <= sigils:
        fail("schema: required_sigils invalid or exceeds authored sigils")


def geometry_check(doc: dict) -> tuple[set, set, set]:
    floor = layer(doc, "Backdrop")
    geometry = layer(doc, "Geometry")
    decor = layer(doc, "Decor")
    overlap = floor & geometry
    if overlap:
        fail(f"geometry overlaps walkable floor at {sorted(overlap)[:5]}")
    entities = doc["entities"]
    for e in entities:
        cell = entity_cell(e)
        if cell not in floor:
            fail(f"entity {e['id']} at {cell} is not on walkable floor")
        if cell in geometry:
            fail(f"entity {e['id']} sits inside solid geometry")
        if e["position"][0] % TILE != TILE // 2 or e["position"][1] % TILE != TILE // 2:
            fail(f"entity {e['id']} is not on a tile centre")
        if "target_position" in e:
            target = world_cell(e["target_position"])
            if target not in floor:
                fail(f"door {e['id']} target {target} is not floor")
    return floor, geometry, decor


def components(floor: set) -> int:
    unseen = set(floor)
    count = 0
    while unseen:
        count += 1
        start = unseen.pop()
        queue = [start]
        while queue:
            cx, cy = queue.pop()
            for dx, dy in CARDINAL:
                n = (cx + dx, cy + dy)
                if n in unseen:
                    unseen.remove(n)
                    queue.append(n)
    return count


def door_edges(doc: dict) -> dict:
    edges: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for e in doc["entities"]:
        if e["type"] != "floor_door":
            continue
        edges.setdefault(entity_cell(e), []).append(world_cell(e["target_position"]))
    return edges


def flood(start, walkable, blocked=(), edges=None, diagonal=False):
    seen = set()
    if start not in walkable or start in blocked:
        return seen
    queue = deque([start])
    seen.add(start)
    while queue:
        cur = queue.popleft()
        for dx, dy in CARDINAL:
            nxt = (cur[0] + dx, cur[1] + dy)
            if nxt in seen or nxt not in walkable or nxt in blocked:
                continue
            seen.add(nxt)
            queue.append(nxt)
        for nxt in (edges or {}).get(cur, []):
            if nxt in seen or nxt not in walkable or nxt in blocked:
                continue
            seen.add(nxt)
            queue.append(nxt)
        if diagonal:
            for dx, dy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
                nxt = (cur[0] + dx, cur[1] + dy)
                if nxt in seen or nxt not in walkable or nxt in blocked:
                    continue
                if (cur[0] + dx, cur[1]) not in walkable or (cur[0], cur[1] + dy) not in walkable:
                    continue
                seen.add(nxt)
                queue.append(nxt)
    return seen


def route_check(doc: dict, floor: set) -> None:
    entities = doc["entities"]
    start = entity_cell(next(e for e in entities if e["type"] == "player"))
    edges = door_edges(doc)
    reachable = flood(start, floor, (), edges)
    if len(reachable) != len(floor):
        missing = sorted(floor - reachable)
        fail(f"{len(missing)} floor cells unreachable; first {missing[:5]}")
    if components(floor) != 3:
        fail(f"expected exactly three floor components, found {components(floor)}")

    spikes = {entity_cell(e) for e in entities if e["type"] == "spikes"}
    for e in entities:
        if e["type"] != "spikes":
            continue
        cell = entity_cell(e)
        safe = sum(1 for dx, dy in CARDINAL
                   if (cell[0] + dx, cell[1] + dy) in floor
                   and (cell[0] + dx, cell[1] + dy) not in spikes)
        if safe < 2:
            fail(f"hazard {e['id']} has only {safe} dodge neighbours")
    safe_reachable = flood(start, floor, spikes, edges)
    for e in entities:
        if e["type"] in OBJECTIVE_TYPES and entity_cell(e) not in safe_reachable:
            fail(f"objective {e['id']} unreachable without stepping on spikes")

    # Knight body: 12x16 at offset (0,-8) => needs this cell and the cell above.
    clear = {c for c in floor if (c[0], c[1] - 1) in floor}
    if start not in clear:
        fail("player spawn lacks Knight clearance")
    for e in entities:
        if e["type"] != "floor_door":
            continue
        source = entity_cell(e)
        target = world_cell(e["target_position"])
        if source not in clear:
            fail(f"door {e['id']} source lacks Knight clearance")
        if target not in clear:
            fail(f"door {e['id']} arrival lacks Knight clearance")
    kreach = flood(start, clear, spikes, edges, diagonal=True)
    safe_clear = len(clear - spikes)
    if len(kreach) != safe_clear:
        missing = sorted((clear - spikes) - kreach)
        fail(f"Knight-clear route graph misses {safe_clear - len(kreach)} cells; first {missing[:5]}")
    for e in entities:
        if e["type"] in ENEMY_TYPES:
            cell = entity_cell(e)
            if not any((cell[0] + dx * r, cell[1] + dy * r) in clear
                       for r in range(0, 4) for dx, dy in CARDINAL):
                fail(f"enemy {e['id']} is not reachable with Knight clearance")
    notes.append(f"Knight-clear cells: {len(clear)} / floor {len(floor)}; "
                 f"Knight-reachable {len(kreach)} / {safe_clear}")


def spacing(positions):
    if len(positions) < 2:
        return math.inf
    return min(math.dist(a, b) for i, a in enumerate(positions) for b in positions[i + 1:])


def design_rules(doc: dict, floor: set) -> None:
    entities = doc["entities"]
    by_id = {e["id"]: e for e in entities}
    by_type: dict[str, list] = {}
    for e in entities:
        by_type.setdefault(e["type"], []).append(e)

    for expected, count in (("skeleton", 15), ("spikes", 15), ("floor_door", 4),
                            ("sigil", 4), ("checkpoint", 2), ("chest", 2),
                            ("torch", 10), ("coin", 10)):
        actual = len(by_type.get(expected, []))
        if actual != count:
            fail(f"expected {count} {expected}, found {actual}")
    if len(entities) != 64:
        fail(f"expected 64 authored entities, found {len(entities)}")
    if int(doc["metadata"]["required_sigils"]) != 3:
        fail("required_sigils must remain 3")

    assigned = set()
    for camp in doc["metadata"]["combat_camps"]:
        rect = camp["rect"]
        members = [by_id[i] for i in camp["enemy_ids"] if i in by_id]
        if len(members) != 5:
            fail(f"camp {camp['id']} does not have five live members")
        positions = []
        for member in members:
            if member["id"] in assigned:
                fail(f"enemy {member['id']} assigned twice")
            assigned.add(member["id"])
            cell = entity_cell(member)
            if not (rect[0] <= cell[0] < rect[0] + rect[2]
                    and rect[1] <= cell[1] < rect[1] + rect[3]):
                fail(f"camp member {member['id']} at {cell} outside camp rect")
            positions.append((member["position"][0], member["position"][1]))
            radius = max(1, int(member.get("patrol", 72)) // TILE)
            for dx, dy in CARDINAL:
                for distance in range(1, radius + 1):
                    if (cell[0] + dx * distance, cell[1] + dy * distance) not in floor:
                        fail(f"{member['id']} patrol hits a wall {distance} cell(s) away")
        if positions:
            if spacing(positions) < 55.0:
                fail(f"camp {camp['id']} spacing below 55px: {spacing(positions):.1f}")
            maximum = max(
                ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
                for i, a in enumerate(positions) for b in positions[i + 1:]
            ) if len(positions) > 1 else 0
            if maximum > 560.0:
                fail(f"camp {camp['id']} is too spread out: {maximum:.1f}px")
        entry = camp.get("entry_cell")
        if entry and (entry[0], entry[1]) not in floor:
            fail(f"camp {camp['id']} entry cell is not floor")
    for enemy in by_type.get("skeleton", []):
        if enemy["id"] not in assigned:
            fail(f"enemy {enemy['id']} is not assigned to a camp")

    player_pos = next(e for e in entities if e["type"] == "player")["position"]
    spikes = by_type.get("spikes", [])
    enemies = [e for e in entities if e["type"] in ENEMY_TYPES]

    def nearest(origin, pool):
        return min((math.dist(origin, e["position"]) for e in pool), default=math.inf)

    if nearest(player_pos, enemies) < 240.0:
        fail(f"spawn too close to enemies: {nearest(player_pos, enemies):.1f}px")
    if nearest(player_pos, spikes) < 160.0:
        fail(f"spawn too close to spikes: {nearest(player_pos, spikes):.1f}px")
    for checkpoint in by_type.get("checkpoint", []):
        if nearest(checkpoint["position"], enemies) < 150.0:
            fail(f"checkpoint {checkpoint['id']} inside a sleeping camp")
        if nearest(checkpoint["position"], spikes) < 64.0:
            fail(f"checkpoint {checkpoint['id']} is a trap spawn")
    for door in by_type.get("floor_door", []):
        if nearest(door["position"], spikes) < 64.0:
            fail(f"door {door['id']} has no safe pad")

    anchor = doc["metadata"].get("density_cadence_anchor")
    if anchor != [808, 216] or (50, 13) not in floor:
        fail("density cadence anchor drifted from cell (50, 13)")

    if Counter(entry := None for _ in []) :  # pragma: no cover - placeholder
        pass


def conservation(doc: dict, old: dict) -> None:
    old_e = {e["id"]: e for e in old["entities"]}
    new_e = {e["id"]: e for e in doc["entities"]}
    dropped = sorted(set(old_e) - set(new_e))
    if dropped:
        fail(f"removed original entity IDs: {dropped}")
    added = sorted(set(new_e) - set(old_e))
    if added:
        fail(f"added entity IDs (not allowed in this delivery): {added}")
    mismatch = [i for i in old_e if i in new_e and old_e[i]["type"] != new_e[i]["type"]]
    if mismatch:
        fail(f"changed original entity types: {mismatch}")
    old_rooms = {r["id"] for r in old["metadata"]["rooms"]}
    new_rooms = {r["id"] for r in doc["metadata"]["rooms"]}
    if old_rooms - new_rooms:
        fail(f"removed room anchors: {sorted(old_rooms - new_rooms)}")
    old_camps = {c["id"] for c in old["metadata"]["combat_camps"]}
    new_camps = {c["id"] for c in doc["metadata"]["combat_camps"]}
    if old_camps - new_camps:
        fail(f"removed combat camps: {sorted(old_camps - new_camps)}")
    for door in doc["entities"]:
        if door["type"] != "floor_door":
            continue
        partners = [
            other for other in doc["entities"]
            if other["type"] == "floor_door"
            and other["position"] == door["target_position"]
            and other["target_position"] == door["position"]
        ]
        if len(partners) != 1:
            fail(f"door {door['id']} is not reciprocally paired")


def metrics(doc: dict, old: dict) -> dict:
    floor = layer(doc, "Backdrop")
    old_floor = layer(old, "Backdrop")
    overlap = len(floor & old_floor)
    union = len(floor | old_floor)
    moved = sum(
        1 for e in old["entities"]
        for other in doc["entities"]
        if e["id"] == other["id"] and e["position"] != other["position"]
    )
    result = {
        "floor_cells": len(floor),
        "geometry_cells": len(layer(doc, "Geometry")),
        "decor_cells": len(layer(doc, "Decor")),
        "old_floor_cells": len(old_floor),
        "symmetric_difference": len(floor ^ old_floor),
        "jaccard": round(overlap / union, 4) if union else 1.0,
        "entities": len(doc["entities"]),
        "entities_moved": moved,
    }
    # Route lengths (BFS distance from spawn over floor + doors, spikes free).
    start = entity_cell(next(e for e in doc["entities"] if e["type"] == "player"))
    edges = door_edges(doc)
    dist = {start: 0}
    queue = deque([start])
    while queue:
        cur = queue.popleft()
        for dx, dy in CARDINAL:
            nxt = (cur[0] + dx, cur[1] + dy)
            if nxt in floor and nxt not in dist:
                dist[nxt] = dist[cur] + 1
                queue.append(nxt)
        for nxt in edges.get(cur, []):
            if nxt in floor and nxt not in dist:
                dist[nxt] = dist[cur] + 1
                queue.append(nxt)
    for e in doc["entities"]:
        if e["id"] in ("l2_sigil_choice_north", "l2_sigil_choice_south", "l2_sigil_ring",
                       "l2_sigil_gauntlet", "l2_exit", "l2_checkpoint_floor_2",
                       "l2_checkpoint_floor_3", "l2_chest_risky_branch", "l2_chest_gauntlet"):
            result[f"distance_{e['id']}"] = dist.get(entity_cell(e))
    return result


def main() -> int:
    doc = load(LEVEL)
    old = baseline()
    schema_check(doc)
    floor, geometry, decor = geometry_check(doc)
    route_check(doc, floor)
    design_rules(doc, floor)
    conservation(doc, old)
    report = metrics(doc, old)
    print("=== Level 2 validation ===")
    for key, value in report.items():
        print(f"{key}: {value}")
    for note in notes:
        print(note)
    if failures:
        print(f"\n{len(failures)} HARD FAILURES:")
        for item in failures:
            print(" -", item)
        return 1
    print("\nLEVEL 2 CONTRACT + ROUTE VALIDATION PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
