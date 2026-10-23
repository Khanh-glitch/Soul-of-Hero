#!/usr/bin/env python3
"""Gate 0 checkpoint M1 - author and validate the Level 3 archive overlay.

This is the single source of truth for where Candidate B's furniture goes on
Candidate A's Chapter 1 Level 3. It is deliberately a *plain data table plus a
validator*: the runtime never positions anything, it only replays the JSON this
script emits.

    python3 tools/gate0/author_overlay.py --level <pinned L3 json>
    python3 tools/gate0/author_overlay.py --check --level <pinned L3 json>

Design rules enforced here (the script refuses to write output if one breaks):

  * A whole prop is never split into tiles: one sprite, one rectangle.
  * Every sprite column stands on authored floor. The row the sprite's base
    lands in must be Backdrop or Geometry, never the void.
  * Props never overlap Candidate A's own drawn entity art (torches draw far
    above their origin, coins are scaled), only its anchor points.
  * Solid props never overlap each other.
  * A prop's collider is derived from the rendered sprite width, sits fully
    inside floor cells, and never seals a route that was open before.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

TILE = 16
SOLID_LAYER = 1
COLLIDER_WIDTH_RATIO = 0.86
COLLIDER_HEIGHT = 12
ENTITY_CLEARANCE = 4

# Candidate A's pinned Level 3 (design-pilot commit f27e8b7). The overlay is
# authored against exactly this document; the capture harness re-checks it.
PINNED_LEVEL_SHA256 = "5ea50e9cf37791a6283bfd9a58bd634ec8aa144e9602c5b9f40f0b4600555f54"
DEFAULT_LEVEL = ROOT / "data/levels/chapter_1_level_3.json"
ATLAS = "res://prototypes/gate0/art/archive_props.png"
FRAMES = ROOT / "prototypes/gate0/art/props.json"
OUTPUT = ROOT / "prototypes/gate0/overlay_level3_archive.json"

# B's warmer wood is pulled towards A's palettised range (A tints its geometry
# 0.74/0.78/0.86); this keeps the furniture inside the same value band.
MODULATE = [0.84, 0.83, 0.88, 1.0]

# Candidate A's entity art as actually drawn, in level pixels, keyed by the
# authored entity type. `anchor` says which edge the authored position pins.
# torches are a 16px sprite at scale 2 offset y-16, so they draw 32px above the
# anchor; coins are 1.5x; spikes are 2x and centred.
ENTITY_ART = {
    # the Knight's body shape is 12x16 and its idle frame draws ~32x32 around
    # the anchor; the spawn marker is treated as centred so a press directly
    # above it is a back-to-wall read, not an overlap.
    "player": {"w": 32, "h": 32, "anchor": "centre"},
    "torch": {"w": 32, "h": 32, "anchor": "bottom"},
    "coin": {"w": 24, "h": 24, "anchor": "centre"},
    "spikes": {"w": 32, "h": 32, "anchor": "centre"},
    "chest": {"w": 32, "h": 32, "anchor": "bottom"},
    "sigil": {"w": 32, "h": 32, "anchor": "centre"},
    "floor_door": {"w": 32, "h": 32, "anchor": "centre"},
    "checkpoint": {"w": 32, "h": 32, "anchor": "bottom"},
    "exit_gate": {"w": 32, "h": 48, "anchor": "bottom"},
}
DEFAULT_ENTITY_ART = {"w": 32, "h": 32, "anchor": "bottom"}

# The curated set. Fifteen fixtures, one evacuation story, told west to east.
# `solid` props get a single collider derived from their sprite width.
PLACEMENTS = [
    # --- the press bank on the entry hall's north wall ----------------------
    dict(sprite="shelf_partial", x=296, base_y=176, solid=True,
         intent="bay 17-19: a partly emptied manuscript press behind the entry, "
                "its visible records distinguish this room from a generic dungeon"),
    dict(sprite="shelf_full", x=440, base_y=176, solid=True,
         intent="bay 26-28: a press still full of rolled records on the "
                "crossfire hall's north wall"),
    dict(sprite="shelf_partial", x=504, base_y=176, solid=True,
         intent="bay 30-32: the same kind of press half-emptied - the "
                "evacuation began here and worked west"),
    # --- the copyist station ------------------------------------------------
    dict(sprite="desk", x=240, base_y=224, solid=True,
         intent="a writing desk west of the spawn, its open page and inkwell "
                "facing the room - the nearest thing to read as 'someone worked here'"),
    dict(sprite="stool", x=248, base_y=240, solid=False,
         intent="its stool, still upright: one station abandoned mid-copy"),
    dict(sprite="scroll_roll", x=408, base_y=208, solid=False,
         intent="the dropped-scroll trail starts between the desks"),
    # --- the lower hall -----------------------------------------------------
    dict(sprite="reading_table", x=136, base_y=256, solid=True,
         intent="a reading table against the west wall, on the side the entry "
                "torch reaches"),
    dict(sprite="long_table", x=256, base_y=320, solid=True,
         intent="the long board through the lower hall - the piece that makes "
                "the space read as a working room rather than a corridor"),
    dict(sprite="bench", x=304, base_y=352, solid=True,
         intent="the bench pulled out from the board's east end and left "
                "askew - the seat nobody pushed back"),
    # --- the collapse -------------------------------------------------------
    dict(sprite="shelf_collapsed", x=184, base_y=320, solid=True,
         intent="a press tipped off the west wall, its shelving face up - "
                "damage that explains why the shelves are empty"),
    dict(sprite="beam", x=200, base_y=320, solid=False,
         intent="the beam that came down with the wall, still lying across "
                "the floor"),
    dict(sprite="rubble_large", x=392, base_y=352, solid=True,
         intent="fallen vaulting in the lower hall, shifted east to leave a "
                "readable threshold beside the floor-door frame"),
    # --- the way out --------------------------------------------------------
    dict(sprite="scrolls_a", x=600, base_y=320, solid=False,
         intent="more of the load dropped further east, towards the exit"),
    dict(sprite="lectern", x=600, base_y=352, solid=True,
         intent="the catalogue lectern, left standing just inside the passage "
                "to the east door, beside the route out"),
    dict(sprite="book_stack", x=680, base_y=352, solid=False,
         intent="a stack set down at the doorway and never picked up again"),
]


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def level_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def frames_table() -> dict:
    return load_json(FRAMES)["frames"]


def frame(name: str) -> dict:
    table = frames_table()
    if name not in table:
        raise SystemExit(f"prop '{name}' is not in {FRAMES.relative_to(ROOT)}")
    return table[name]


def cell_sets(level: dict) -> tuple[set, set, set]:
    layers = level["layers"]
    backdrop = {(c["x"], c["y"]) for c in layers.get("Backdrop", [])}
    geometry = {(c["x"], c["y"]) for c in layers.get("Geometry", [])}
    decor = {(c["x"], c["y"]) for c in layers.get("Decor", [])}
    return backdrop, geometry, decor


def sprite_rect(name: str, x: float, base_y: float) -> tuple[float, float, float, float]:
    """Drawn rectangle (left, top, right, bottom) of a centred Sprite2D whose
    origin is lifted by half its height so the art's base sits on base_y."""
    data = frame(name)
    half_w = data["w"] / 2.0
    return (x - half_w, base_y - data["h"], x + half_w, base_y)


def collider_rect(name: str, x: float, base_y: float) -> tuple[float, float, float, float]:
    """Collider (left, top, right, bottom) derived from the sprite footprint."""
    width = frame(name)["w"] * COLLIDER_WIDTH_RATIO
    return (x - width / 2.0, base_y - COLLIDER_HEIGHT, x + width / 2.0, base_y)


def entity_rects(level: dict) -> list[tuple[str, float, float, float, float]]:
    rects = []
    for entity in level.get("entities", []):
        art = ENTITY_ART.get(entity.get("type", ""), DEFAULT_ENTITY_ART)
        position = entity.get("position", [0, 0])
        ex, ey = float(position[0]), float(position[1])
        half_w, half_h = art["w"] / 2.0, art["h"] / 2.0
        if art["anchor"] == "bottom":
            top, bottom = ey - art["h"], ey
        else:
            top, bottom = ey - half_h, ey + half_h
        rects.append((entity["id"], ex - half_w, top, ex + half_w, bottom))
    return rects


def overlaps(a, b, clearance: float = 0.0) -> bool:
    return not (
        a[2] + clearance <= b[0]
        or b[2] + clearance <= a[0]
        or a[3] + clearance <= b[1]
        or b[3] + clearance <= a[1]
    )


def walkable(backdrop: set, geometry: set) -> set:
    return {cell for cell in backdrop if cell not in geometry}


def flood(start: tuple[int, int], open_cells: set) -> set:
    if start not in open_cells:
        return set()
    seen = {start}
    stack = [start]
    while stack:
        cx, cy = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            neighbour = (cx + dx, cy + dy)
            if neighbour in open_cells and neighbour not in seen:
                seen.add(neighbour)
                stack.append(neighbour)
    return seen


def spawn_cell(level: dict) -> tuple[int, int]:
    for entity in level.get("entities", []):
        if entity.get("type") == "player":
            return (int(entity["position"][0]) // TILE, int(entity["position"][1]) // TILE)
    raise SystemExit("the level authors no player entity")


def blocked_cells(placement: dict) -> set:
    if not placement["solid"]:
        return set()
    left, top, right, bottom = collider_rect(
        placement["sprite"], placement["x"], placement["base_y"]
    )
    cells = set()
    for cx in range(int(left) // TILE, (int(right) - 1) // TILE + 1):
        for cy in range(int(top) // TILE, (int(bottom) - 1) // TILE + 1):
            cells.add((cx, cy))
    return cells


def validate(level: dict, placements: list[dict]) -> tuple[list[str], dict]:
    errors: list[str] = []
    backdrop, geometry, decor = cell_sets(level)
    floor = walkable(backdrop, geometry)
    entities = entity_rects(level)

    solids: list[tuple[str, tuple[float, float, float, float]]] = []
    for placement in placements:
        name = placement["sprite"]
        x, base_y = float(placement["x"]), float(placement["base_y"])
        drawn = sprite_rect(name, x, base_y)
        bottom_row = int(base_y - 0.001) // TILE

        # 1. nothing floats over or stands in the void
        for column in range(int(drawn[0]) // TILE, (int(drawn[2]) - 1) // TILE + 1):
            if (column, bottom_row) not in backdrop or (column, bottom_row) in geometry:
                errors.append(
                    f"{name}@{x:.0f},{base_y:.0f}: column {column} does not stand on "
                    f"floor row {bottom_row}"
                )

        # 2. props never sit on top of Candidate A's own drawn entity art
        for entity_id, *rect in entities:
            if overlaps(drawn, tuple(rect), ENTITY_CLEARANCE):
                errors.append(
                    f"{name}@{x:.0f},{base_y:.0f}: sprite overlaps entity art '{entity_id}'"
                )

        # 3. the collider stays inside the art and inside floor cells
        if placement["solid"]:
            box = collider_rect(name, x, base_y)
            if box[0] < drawn[0] - 0.01 or box[2] > drawn[2] + 0.01:
                errors.append(f"{name}@{x:.0f},{base_y:.0f}: collider is wider than the art")
            for column in range(int(box[0]) // TILE, (int(box[2]) - 1) // TILE + 1):
                for row in range(int(box[1]) // TILE, (int(box[3]) - 1) // TILE + 1):
                    if (column, row) not in backdrop or (column, row) in geometry:
                        errors.append(
                            f"{name}@{x:.0f},{base_y:.0f}: collider covers non-floor cell "
                            f"{column},{row}"
                        )
            for other_id, other_box in solids:
                if overlaps(box, other_box):
                    errors.append(f"{name} collider overlaps {other_id} collider")
            solids.append((name, box))

    # 4. the overlay must not seal any route that was open before it
    start = spawn_cell(level)
    open_before = walkable(backdrop, geometry)
    reach_before = flood(start, open_before)
    closed = set()
    for placement in placements:
        closed |= blocked_cells(placement)
    open_after = open_before - closed
    reach_after = flood(start, open_after)

    anchors = sorted(
        cell
        for cell in {(int(e["position"][0]) // TILE, int(e["position"][1]) // TILE)
                     for e in level.get("entities", [])}
        if cell in reach_before
    )
    lost = [cell for cell in anchors if cell not in reach_after]
    for cell in lost:
        errors.append(f"route anchor {cell} became unreachable once the overlay was applied")

    stats = {
        "reachable_before": len(reach_before),
        "reachable_after": len(reach_after),
        "walkable_total": len(open_before),
        "blocked_by_overlay": len(reach_before) - len(reach_after),
        "anchors": len(anchors),
        "start": start,
        "spawn": spawn_cell(level),
    }
    return errors, stats


def build_document(level: dict, placements: list[dict], level_path: Path) -> dict:
    props = []
    for index, placement in enumerate(placements):
        name = placement["sprite"]
        data = frame(name)
        x, base_y = float(placement["x"]), float(placement["base_y"])
        drawn = sprite_rect(name, x, base_y)
        box = collider_rect(name, x, base_y)
        props.append(
            {
                "id": f"gate0_{index:02d}_{name}",
                "sprite": name,
                "x": round(x, 3),
                "base_y": round(base_y, 3),
                "source": [data["x"], data["y"], data["w"], data["h"]],
                "cells": [
                    int(drawn[0]) // TILE,
                    int(drawn[1]) // TILE,
                    (int(drawn[2]) - 1) // TILE + 1,
                    (int(drawn[3]) - 1) // TILE + 1,
                ],
                "solid": bool(placement["solid"]),
                "collider": [
                    round((box[0] + box[2]) / 2.0, 3),
                    round((box[1] + box[3]) / 2.0, 3),
                    round(box[2] - box[0], 3),
                    round(box[3] - box[1], 3),
                ],
                "intent": placement["intent"],
                "provenance": {
                    "art": f"Candidate B e7cad36 prototypes/environment_art/"
                           f"archive_audition/art/props.png frame '{name}'",
                },
            }
        )
    # stable draw order for review: back to front, then west to east
    props.sort(key=lambda p: (p["base_y"], p["x"]))
    return {
        "version": 1,
        "target_level": "res://data/levels/chapter_1_level_3.json",
        "level_sha256": PINNED_LEVEL_SHA256,
        "atlas": ATLAS,
        "modulate": MODULATE,
        "collision_layer": SOLID_LAYER,
        "collider_width_ratio": COLLIDER_WIDTH_RATIO,
        "collider_height": COLLIDER_HEIGHT,
        "region": {"x": 0, "y": 0, "w": 40, "h": 27},
        "props": props,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", type=Path, default=DEFAULT_LEVEL,
                        help="the pinned Candidate A Level 3 JSON")
    parser.add_argument("--check", action="store_true",
                        help="validate and compare against the committed output")
    args = parser.parse_args()

    if not args.level.exists():
        print(f"LEVEL NOT FOUND: {args.level}")
        return 2
    digest = level_sha256(args.level)
    if digest != PINNED_LEVEL_SHA256:
        print("LEVEL PIN MISMATCH")
        print(f"  expected sha256 {PINNED_LEVEL_SHA256}")
        print(f"  actual   sha256 {digest}")
        print(f"  file     {args.level}")
        print("Gate 0 authors against Candidate A's pinned Level 3 only.")
        return 2

    level = load_json(args.level)
    errors, stats = validate(level, PLACEMENTS)
    backdrop, geometry, _ = cell_sets(level)
    print(
        f"level: {level['name']}  {level['width']}x{level['height']} cells  "
        f"backdrop {len(backdrop)}  geometry {len(geometry)}  "
        f"entities {len(level['entities'])}"
    )
    print(f"placements: {len(PLACEMENTS)}  solids: {sum(1 for p in PLACEMENTS if p['solid'])}")
    print(
        f"route: reachable {stats['reachable_after']}/{stats['walkable_total']} walkable "
        f"cells, {stats['blocked_by_overlay']} blocked by overlay colliders, "
        f"{stats['anchors']} anchors checked"
    )
    if errors:
        print(f"OVERLAY VALIDATION FAILED ({len(errors)})")
        for error in errors:
            print("  ERROR " + error)
        return 1
    print("OVERLAY VALIDATION PASSED (no void, no entity overlap, no collider "
          "overlap, no route seal)")

    document = build_document(level, PLACEMENTS, args.level)
    text = json.dumps(document, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if not OUTPUT.exists():
            print(f"CHECK FAILED: {OUTPUT.relative_to(ROOT)} is missing")
            return 1
        if OUTPUT.read_text(encoding="utf-8") != text:
            print(f"CHECK FAILED: {OUTPUT.relative_to(ROOT)} is stale; re-run without --check")
            return 1
        print(f"CHECK PASSED: {OUTPUT.relative_to(ROOT)} is exactly what this table generates")
        return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(ROOT)} ({len(document['props'])} props)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
