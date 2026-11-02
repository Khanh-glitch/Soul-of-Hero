#!/usr/bin/env python3
"""Check the *baked* Hollow Marches data for internal consistency.

This validates what is actually on disk — the emitted world document and the
baked RLE layers — and does not re-derive geography from a second, private
model of the map. Reachability is owned by `tools/overworld/author.py`'s own
flood fill, which runs on the real grids and refuses to bake when it fails.

  python3 tools/validate_overworld_topology.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "overworld"
WORLD = DATA / "hollow_marches.json"
REGISTRY = DATA / "landmark_registry.json"
LAYERS = DATA / "hollow_marches_layers.json"

TILE = 16
REQUIRED_LEVELS = [f"chapter_1_level_{i}" for i in range(1, 11)]
BLOCKING_TOKENS = {"#", "W", "T", "!"}


def load(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def decode_rle(rle: list) -> list[str]:
    grid: list[str] = []
    for entry in rle:
        if not isinstance(entry, list) or len(entry) < 2:
            continue
        grid.extend([str(entry[0])] * int(entry[1]))
    return grid


def token_at(grid: list[str], width: int, x: int, y: int) -> str:
    index = y * width + x
    if index < 0 or index >= len(grid):
        return "#"
    return grid[index]


def blocked(token: str) -> bool:
    return (token[:1] if token else ".") in BLOCKING_TOKENS


def main() -> int:
    errors: list[str] = []
    world = load(WORLD)
    registry = load(REGISTRY)
    layers = load(LAYERS)

    width = int(layers.get("width", 0))
    height = int(layers.get("height", 0))
    bounds = world.get("world_bounds", {})
    if (int(bounds.get("w", 0)), int(bounds.get("h", 0))) != (width, height):
        errors.append(
            f"world_bounds {bounds.get('w')}x{bounds.get('h')} != layer grid {width}x{height}"
        )
    if int(world.get("tile_size", 0)) != TILE:
        errors.append("tile_size must be 16")

    ground = decode_rle(layers["layers"]["ground"]["rle"])
    solid = decode_rle(layers["layers"]["solid"]["rle"])
    for name, grid in (("ground", ground), ("solid", solid)):
        if len(grid) != width * height:
            errors.append(f"{name} layer has {len(grid)} cells, expected {width * height}")

    landmarks = world.get("landmarks", [])
    if len(landmarks) != 10:
        errors.append(f"expected 10 landmarks, found {len(landmarks)}")
    seen_levels = {str(lm.get("campaign_level_id")) for lm in landmarks}
    for level in REQUIRED_LEVELS:
        if level not in seen_levels:
            errors.append(f"missing landmark for {level}")

    by_world = registry.get("camp_levels_by_world_id", {})
    if len(by_world) != 10:
        errors.append(f"registry has {len(by_world)} entries, expected 10")
    if len({str(value) for value in by_world.values()}) != len(by_world):
        errors.append("registry is not bijective (duplicate campaign ids)")

    # Every threshold must stand on walkable ground in the baked solid layer.
    if len(solid) == width * height:
        for landmark in landmarks:
            threshold = landmark.get("threshold") or landmark.get("pos") or []
            if len(threshold) < 2:
                errors.append(f"{landmark.get('id')}: no threshold")
                continue
            token = token_at(solid, width, int(threshold[0]), int(threshold[1]))
            if blocked(token):
                errors.append(f"{landmark.get('id')} threshold is blocked by '{token}'")

    # Every shortcut's carve box must be fully solid while closed.
    for shortcut in world.get("shortcuts", []):
        carve = shortcut.get("carve") or []
        if len(carve) != 4:
            errors.append(f"{shortcut.get('id')}: carve box must be [x0, y0, x1, y1]")
            continue
        if not str(shortcut.get("granted_by", "")).startswith("chapter_1_level_"):
            errors.append(f"{shortcut.get('id')}: granted_by is not a campaign level")
        if len(solid) != width * height:
            continue
        for y in range(int(carve[1]), int(carve[3]) + 1):
            for x in range(int(carve[0]), int(carve[2]) + 1):
                if not blocked(token_at(solid, width, x, y)):
                    errors.append(f"{shortcut.get('id')}: carve cell ({x},{y}) is not solid")

    # Camps and discoveries must be on real ground and inside the envelope.
    for entry in world.get("camps", []) + world.get("discoveries", []):
        position = entry.get("pos") or []
        if len(position) < 2:
            errors.append(f"{entry.get('id')}: no pos")
            continue
        x, y = int(position[0]), int(position[1])
        if not (0 <= x < width and 0 <= y < height):
            errors.append(f"{entry.get('id')}: outside the envelope")
        elif blocked(token_at(solid, width, x, y)):
            errors.append(f"{entry.get('id')}: stands on blocked terrain")

    survival = world.get("survival", {})
    if float(survival.get("drain_per_second_wild", 0)) <= 0:
        errors.append("survival.drain_per_second_wild must be > 0")
    if float(survival.get("drain_per_second_hazard", 0)) < float(
        survival.get("drain_per_second_wild", 0)
    ):
        errors.append("hazard drain must be >= wild drain")
    if int(survival.get("start", 0)) > int(survival.get("max", 0)):
        errors.append("survival.start must be <= survival.max")

    if errors:
        for error in errors:
            print("TOPOLOGY FAIL:", error)
        return 1
    print(
        "OVERWORLD TOPOLOGY VALIDATION PASSED\n"
        f"  {len(landmarks)} landmarks, {len(world.get('camps', []))} camps, "
        f"{len(world.get('discoveries', []))} discoveries, "
        f"{len(world.get('shortcuts', []))} shortcuts\n"
        f"  grid {width}x{height}, solid cells "
        f"{sum(1 for token in solid if blocked(token))}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
