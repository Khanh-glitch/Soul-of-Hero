#!/usr/bin/env python3
"""Pinned-baseline Level 2 audition audit. Standard library; never alters game data.

Usage: python3 tools/design/level2_audition_audit.py
Creates .artifacts/level2_audition_metrics.md and an SVG footprint overlay.
Exit !=0 on broken immutable mission/entity contracts. Spatial change is reported
but not scored automatically; high Jaccard similarity is NOT proof of bad design.
"""
from __future__ import annotations

from collections import Counter
from pathlib import Path
import json
import subprocess
import sys

BASE_SHA = "1c21a49c2eb3775c4b421dab86d057c7256f5964"
LEVEL_PATH = "data/levels/chapter_1_level_2.json"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / ".artifacts"
OUT.mkdir(parents=True, exist_ok=True)


def load_original():
    result = subprocess.run(
        ["git", "show", f"{BASE_SHA}:{LEVEL_PATH}"], cwd=ROOT,
        check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    return json.loads(result.stdout)


def load_candidate():
    return json.loads((ROOT / LEVEL_PATH).read_text(encoding="utf-8"))


def cells(doc, layer):
    result = set()
    for raw in doc.get("layers", {}).get(layer, []):
        result.add((int(raw["x"]), int(raw["y"])))
    return result


def keyed(rows, subject, errors):
    result = {}
    for row in rows:
        identity = row.get("id")
        if not isinstance(identity, str) or not identity:
            errors.append(f"{subject}: missing stable ID")
        elif identity in result:
            errors.append(f"{subject}: duplicate ID {identity}")
        else:
            result[identity] = row
    return result


def point(entry):
    p = entry.get("position", [])
    if not isinstance(p, list) or len(p) != 2:
        return None
    return tuple(p)


def overlay_svg(old, new):
    """Blue = kept, orange = removed, green = added. Geometric, not gameplay capture."""
    before = cells(old, "Backdrop")
    after = cells(new, "Backdrop")
    w = max(int(old["width"]), int(new["width"]))
    h = max(int(old["height"]), int(new["height"]))
    chunks = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'width="{w * 6}" height="{h * 6}" shape-rendering="crispEdges">',
        f'<rect width="{w}" height="{h}" fill="#101621"/>',
    ]
    for positions, color in [
        (before & after, "#647a95"),
        (before - after, "#c97b55"),
        (after - before, "#76bf92"),
    ]:
        # Draw unit cells as one SVG path to keep artifacts small.
        if positions:
            commands = " ".join(f"M{x},{y}h1v1h-1z" for x, y in sorted(positions))
            chunks.append(f'<path d="{commands}" fill="{color}"/>')
    chunks.append("</svg>")
    (OUT / "level2_footprint_overlay.svg").write_text("".join(chunks))


def main():
    try:
        before, after = load_original(), load_candidate()
    except (subprocess.CalledProcessError, OSError, ValueError, KeyError) as exc:
        print(f"AUDITION AUDIT FAILED: unable to read pinned baseline/map: {exc}", file=sys.stderr)
        return 2

    errors = []
    warnings = []
    for k in ("version", "tile_size", "movement_mode"):
        if before.get(k) != after.get(k):
            errors.append(f"changed schema contract: {k}")
    if after.get("version") != 2 or after.get("tile_size") != 16:
        errors.append("LevelSchema v2 / 16 px tile size must remain intact")
    width, height = after.get("width", 0), after.get("height", 0)
    if not isinstance(width, int) or not isinstance(height, int) or min(width, height) <= 0:
        errors.append("invalid map dimensions")

    old_e = keyed(before.get("entities", []), "old entity", errors)
    new_e = keyed(after.get("entities", []), "candidate entity", errors)
    dropped = sorted(set(old_e) - set(new_e))
    added = sorted(set(new_e) - set(old_e))
    if dropped:
        errors.append("removed original entity IDs: " + ", ".join(dropped))
    type_mismatch = [
        eid for eid in old_e.keys() & new_e.keys()
        if old_e[eid].get("type") != new_e[eid].get("type")
    ]
    if type_mismatch:
        errors.append("changed original entity types: " + ", ".join(sorted(type_mismatch)))

    old_rooms = keyed(before.get("metadata", {}).get("rooms", []), "old room", errors)
    new_rooms = keyed(after.get("metadata", {}).get("rooms", []), "candidate room", errors)
    room_missing = sorted(set(old_rooms) - set(new_rooms))
    if room_missing:
        errors.append("removed room IDs required by captures/objectives: " + ", ".join(room_missing))
    old_camps = keyed(before.get("metadata", {}).get("combat_camps", []), "old camp", errors)
    new_camps = keyed(after.get("metadata", {}).get("combat_camps", []), "candidate camp", errors)
    camp_missing = sorted(set(old_camps) - set(new_camps))
    if camp_missing:
        errors.append("removed combat camp IDs: " + ", ".join(camp_missing))

    if after.get("metadata", {}).get("required_sigils") != 3:
        errors.append("required_sigils must remain 3")
    if after.get("metadata", {}).get("layout_profile") != before.get("metadata", {}).get("layout_profile"):
        warnings.append("layout_profile changed; explain any runtime compatibility")
    if Counter(e.get("type") for e in after.get("entities", []))["floor_door"] != 4:
        errors.append("requires four original reciprocal floor doors")

    doors = [e for e in after.get("entities", []) if e.get("type") == "floor_door"]
    for door in doors:
        src, target = point(door), door.get("target_position")
        if src is None or not isinstance(target, list):
            errors.append(f"door {door.get('id')} lacks a source/target")
            continue
        if not any(point(other) == tuple(target) and other.get("target_position") == list(src)
                   for other in doors):
            errors.append(f"door {door.get('id')} has no reciprocal partner")

    floor = cells(after, "Backdrop")
    walls = cells(after, "Geometry")
    for layer_name in ("Backdrop", "Geometry", "Decor"):
        if not isinstance(after.get("layers", {}).get(layer_name), list):
            errors.append(f"missing required TileMap layer {layer_name}")
        for x, y in cells(after, layer_name):
            if not (0 <= x < width and 0 <= y < height):
                errors.append(f"out-of-bounds {layer_name} cell {(x, y)}")
                break

    for eid, e in new_e.items():
        p = point(e)
        if p is None:
            errors.append(f"entity {eid} invalid world position")
            continue
        x, y = int(p[0]) // 16, int(p[1]) // 16
        if (x, y) not in floor:
            errors.append(f"entity {eid} outside floor footprint")
        if (x, y) in walls:
            errors.append(f"entity {eid} inside solid geometry")
    previous_floor = cells(before, "Backdrop")
    overlap = len(previous_floor & floor)
    union = len(previous_floor | floor)
    jaccard = overlap / union if union else 1.0
    changed_tiles = len(previous_floor ^ floor)
    original_entities_moved = sum(point(old_e[i]) != point(new_e[i]) for i in old_e.keys() & new_e.keys())
    if changed_tiles < 500:
        warnings.append("floor footprint barely changed (<500 cells); visual redesign needs strong independent evidence")
    if original_entities_moved < 8:
        warnings.append("fewer than eight existing entity markers moved; assess encounter redesign carefully")
    if added:
        warnings.append("new entity IDs require explicit explanation: " + ", ".join(added))
    if new_rooms.keys() == old_rooms.keys() and all(
        old_rooms[r].get("rect") == new_rooms[r].get("rect") for r in old_rooms
    ):
        warnings.append("room anchor rectangles unchanged; verify substantive room reconfiguration")
    if before == after:
        errors.append("Level 2 JSON is byte-semantically unchanged: no delivered redesign")

    report = [
        "# Level 2 candidate — auditable diff against frozen integration baseline",
        f"- Frozen SHA: `{BASE_SHA}`",
        f"- Schema: {after.get('version')}; map dimensions: {width}×{height} 16px cells",
        f"- Authored entities: {len(old_e)} baseline → {len(new_e)} candidate",
        f"- Original entity IDs preserved: {len(dropped)==0}; types preserved: {not type_mismatch}",
        f"- Newly added entity IDs: {len(added)}",
        f"- Existing entities moved: {original_entities_moved}",
        f"- Rooms: {len(old_rooms)} → {len(new_rooms)}; combat camps: {len(old_camps)} → {len(new_camps)}",
        f"- Floor cells: {len(previous_floor)} → {len(floor)}",
        f"- Floor footprint symmetric difference: **{changed_tiles} cells**",
        f"- Floor mask Jaccard similarity: **{jaccard:.3f}** (1.000 = unchanged)",
        "- Geometry overlay: `level2_footprint_overlay.svg` (blue retained / orange removed / green added)",
        "",
        "## Automated immutable-contract violations",
        *([f"- FAIL: {x}" for x in errors] or ["- None detected."]),
        "",
        "## Review notes (not automatic rejection)",
        *([f"- {x}" for x in warnings] or ["- No additional warnings."]),
        "",
        "## Important limits",
        "This is a **source audit**, not Godot collision, room routing, screenshot or independent level design approval.",
        "Spatial difference metrics cannot establish quality. Godot runtime + actual images + design review are required.",
    ]
    (OUT / "level2_audition_metrics.md").write_text("\n".join(report)+"\n", encoding="utf-8")
    overlay_svg(before, after)
    print("\n".join(report))
    if errors:
        print(f"LEVEL 2 AUDITION SOURCE AUDIT FAILED — {len(errors)} violations", file=sys.stderr)
        return 1
    print("LEVEL 2 AUDITION SOURCE AUDIT PASSED — design quality ungraded")
    return 0


if __name__ == "__main__":
    sys.exit(main())
