#!/usr/bin/env python3
"""Level 3/4 pilot audit against Candidate A's approved Level 2 revision.

Only Python stdlib. Read-only. A source-integrity check is NOT a level-design
rating or substitute for the real Godot collision/camera QA.
"""
from collections import Counter
from pathlib import Path
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
BASE = "2903a305c610fc547581cc82268f3b7e37e8e75a"
SLOTS = {3: (77, 4, 5, 11, 3), 4: (74, 4, 4, 9, 3)}
OUT = ROOT / ".artifacts"
OUT.mkdir(exist_ok=True)


def baseline(slot):
    p = f"data/levels/chapter_1_level_{slot}.json"
    completed = subprocess.run(
        ["git", "show", f"{BASE}:{p}"], cwd=ROOT,
        check=True, capture_output=True, text=True,
    )
    return json.loads(completed.stdout)


def items_index(doc, name, issues):
    result = {}
    for item in doc:
        key = item.get("id")
        if not isinstance(key, str) or not key or key in result:
            issues.append(f"missing / duplicate {name} id: {key}")
        else:
            result[key] = item
    return result


def floor_cells(doc):
    return {
        (int(t["x"]), int(t["y"]))
        for t in doc["layers"]["Backdrop"]
    }


def analyze(slot):
    original = baseline(slot)
    current = json.loads(
        (ROOT / f"data/levels/chapter_1_level_{slot}.json").read_text("utf-8")
    )
    count, required, sigils, rooms, camps = SLOTS[slot]
    issues = []
    warnings = []
    for key in ["version", "tile_size", "movement_mode"]:
        if original.get(key) != current.get(key):
            issues.append(f"immutable schema field changed: {key}")
    if current.get("version") != 2 or current.get("tile_size") != 16:
        issues.append("must remain LevelSchema v2 at 16px")
    old_e = items_index(original.get("entities", []), "old entity", issues)
    new_e = items_index(current.get("entities", []), "new entity", issues)
    if len(old_e) != count:
        issues.append(f"baseline expected {count} entities but saw {len(old_e)}")
    for key, before in old_e.items():
        after = new_e.get(key)
        if after is None:
            issues.append(f"deleted entity: {key}")
        elif after.get("type") != before.get("type"):
            issues.append(f"changed type: {key}")
        elif after.get("type") in ("chest", "sigil", "exit_gate") and {
            k: v for k, v in before.items() if k not in ("position", "patrol")
        } != {
            k: v for k, v in after.items() if k not in ("position", "patrol")
        }:
            issues.append(f"non-spatial reward/objective payload changed: {key}")
    if sum(e.get("type") == "sigil" for e in new_e.values()) < sigils:
        issues.append("authored Sigil count dropped")
    if sum(e.get("type") == "floor_door" for e in new_e.values()) != 4:
        issues.append("four reciprocal floor doors required")
    if int(current.get("metadata", {}).get("required_sigils", -1)) != required:
        issues.append(f"required_sigils changed from {required}")
    for section, minimum in [("rooms", rooms), ("combat_camps", camps)]:
        old = items_index(original["metadata"].get(section, []), f"old {section}", issues)
        new = items_index(current["metadata"].get(section, []), f"new {section}", issues)
        if len(old) != minimum:
            issues.append(f"baseline {section} count mismatch")
        for key in old:
            if key not in new:
                issues.append(f"removed {section} ID: {key}")
    oldfloor = floor_cells(original)
    newfloor = floor_cells(current)
    walls = {(int(t["x"]), int(t["y"])) for t in current["layers"]["Geometry"]}
    w, h = current["width"], current["height"]
    for layer in ("Backdrop", "Geometry", "Decor"):
        for cell in current["layers"][layer]:
            if not (0 <= int(cell["x"]) < w and 0 <= int(cell["y"]) < h):
                issues.append(f"out-of-bounds {layer} tile")
                break
    for key, e in new_e.items():
        pos = e.get("position")
        if not isinstance(pos, list) or len(pos) != 2:
            issues.append(f"bad entity position {key}")
            continue
        cell = (int(pos[0]) // 16, int(pos[1]) // 16)
        if cell not in newfloor or cell in walls:
            issues.append(f"entity outside floor/inside wall: {key}")
    doors = [e for e in new_e.values() if e.get("type") == "floor_door"]
    for d in doors:
        p = d.get("position", [])
        q = d.get("target_position", [])
        if not isinstance(p, list) or not isinstance(q, list) or not any(
            other.get("position") == q and other.get("target_position") == p
            for other in doors
        ):
            issues.append(f"unpaired floor door: {d.get('id')}")
    delta = len(oldfloor ^ newfloor)
    jaccard = len(oldfloor & newfloor) / max(1, len(oldfloor | newfloor))
    moves = sum(old_e[k].get("position") != new_e[k].get("position")
                for k in old_e.keys() & new_e.keys())
    if len(newfloor) > len(oldfloor) * 1.4:
        warnings.append("floor area grew >40%; demand gameplay density and route-time evidence")
    if current == original:
        warnings.append("NOT IMPLEMENTED YET — unchanged from pinned baseline")
    if delta < 500 and current != original:
        warnings.append("small floor silhouette change; require strong visual evidence")
    summary = [
        f"## Level {slot}",
        f"- Authored entities: {len(old_e)} original, {len(new_e)} current; moved: {moves}",
        f"- Rooms/camps and required sigils preserved: {'YES' if not issues else 'CHECK VIOLATIONS'}",
        f"- Walkable floor: {len(oldfloor)} → {len(newfloor)} cells",
        f"- Footprint delta: {delta} cells; Jaccard similarity: {jaccard:.3f}",
        f"- 3-floor design remains to be reviewed from Godot screenshots",
        *(f"- Warning: {warn}" for warn in warnings),
        *(f"- CONTRACT FAIL: {err}" for err in issues),
    ]
    status = "FAIL" if issues else "PASS"
    print(f"LEVEL {slot} PILOT CONTRACT {status}; floor_delta={delta}; moved={moves}")
    return summary, issues, current != original


def main():
    reports = [f"# Pilot Levels 3–4 source contract audit", f"Pinned A baseline: `{BASE}`", ""]
    errors, implemented = [], []
    for slot in SLOTS:
        lines, issues, changed = analyze(slot)
        reports.extend(lines + [""])
        errors.extend(f"Level {slot}: {issue}" for issue in issues)
        if changed:
            implemented.append(slot)
    (OUT / "levels3_4_contract_report.md").write_text("\n".join(reports) + "\n", "utf-8")
    if errors:
        for item in errors:
            print("CONTRACT FAILURE: " + item, file=sys.stderr)
        return 1
    print("LEVELS 3–4 SOURCE CONTRACT AUDIT PASSED; changed=" + ",".join(map(str, implemented)))
    print("Source checks do NOT certify design quality, collision, or gameplay.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
