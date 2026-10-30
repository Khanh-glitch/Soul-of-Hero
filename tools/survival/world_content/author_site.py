#!/usr/bin/env python3
"""Validate and stamp a native POI wrapper without adding interaction code."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "data/survival/world_content/sites"
SCENES = ROOT / "game/survival/world_content/scenes"
FIXTURE_CATALOG = ROOT / "data/survival/world_content/catalog_candidates.fixture.json"
CONTRACT_FILE = ROOT / "data/survival/world_content/interaction_contract.v1.json"
TEMPLATE = "res://game/survival/world_content/scenes/native_poi_template.tscn"
CANONICAL = {
    "poi_crown_south_quarry": [30, 280],
    "poi_crown_south_orchard": [140, 360],
    "poi_crown_south_mill": [120, 300],
}


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def validate(data: dict, fixture_catalog: dict) -> list[str]:
    errors: list[str] = []
    required = ("schema_version", "source", "site_id", "display_name", "template_id", "visual_profile", "world_bounds", "spawn", "action_socket", "approach_stand", "interaction_radius", "walls", "choices", "actions", "return_hook")
    for key in required:
        if key not in data:
            errors.append(f"missing required field {key}")
    if data.get("schema_version") != 1:
        errors.append("unsupported site schema_version")
    source = data.get("source", {})
    poi_id = source.get("poi_id")
    if poi_id in CANONICAL and source.get("canonical_cell") != CANONICAL[poi_id]:
        errors.append(f"canonical A1 cell mismatch for {poi_id}: {source.get('canonical_cell')}")
    if poi_id not in CANONICAL and not data.get("test_only", False):
        errors.append("non-canonical site must be explicitly marked test_only")
    if poi_id == "poi_crown_south_mill" and "cap_salvage" not in data.get("access", {}).get("outer_requires", []):
        errors.append("A1 mill outer access must retain cap_salvage")
    if poi_id in ("poi_crown_south_quarry", "poi_crown_south_orchard") and data.get("access", {}).get("outer_requires", []):
        errors.append(f"A1 outer approach must remain uncapped for {poi_id}")
    if not data.get("display_name") or not data.get("return_hook"):
        errors.append("display_name and a meaningful return_hook are required")
    if len(data.get("world_bounds", [])) != 2 or any(float(n) <= 0 for n in data.get("world_bounds", [])):
        errors.append("world_bounds must be two positive numbers")
    if len(data.get("choices", [])) < 1:
        errors.append("at least one consequential choice is required")
    if len(data.get("actions", [])) < 1:
        errors.append("at least one action/candidate is required")
    action_ids: set[str] = set()
    for entry in data.get("choices", []) + data.get("actions", []):
        action_id = entry.get("action_id", "")
        if not action_id or action_id in action_ids:
            errors.append(f"missing or duplicate action_id {action_id!r}")
        action_ids.add(action_id)
        if not entry.get("claim_policy") in ("once", "replenishable"):
            errors.append(f"unsupported claim_policy on {action_id}")
        if entry.get("claim_policy") == "replenishable" and float(entry.get("cooldown_seconds", 0)) <= 0:
            errors.append(f"replenishable action {action_id} needs a finite recovery interval")
        for group_name in ("costs", "rewards"):
            for item_id, count in entry.get(group_name, {}).items():
                if item_id not in fixture_catalog.get("items", {}):
                    errors.append(f"{action_id} {group_name} uses unknown candidate item {item_id}")
                if int(count) <= 0:
                    errors.append(f"{action_id} {group_name} amount for {item_id} must be positive")
    forbidden = set(fixture_catalog.get("blocked_item_ids", []))
    for entry in data.get("choices", []) + data.get("actions", []):
        for group_name in ("costs", "rewards"):
            for item_id in entry.get(group_name, {}):
                if item_id in forbidden:
                    errors.append(f"blocked reward/cost is referenced: {item_id}")
    for rect in data.get("walls", []):
        if len(rect) != 4 or float(rect[2]) <= 0 or float(rect[3]) <= 0:
            errors.append("walls must be positive [x,y,width,height] rectangles")
    return errors


def wrapper_text(site: dict) -> str:
    file_stem = re.sub(r"[^a-z0-9_]+", "_", site["site_id"].lower()).strip("_")
    node_name = "POI_" + "".join(part.title() for part in file_stem.split("_"))
    json_path = "res://data/survival/world_content/sites/" + site["site_id"] + ".json"
    return (
        "[gd_scene load_steps=2 format=3]\n\n"
        f'[ext_resource type="PackedScene" path="{TEMPLATE}" id="1_template"]\n\n'
        f'[node name="{node_name}" instance=ExtResource("1_template")]\n'
        f'definition_path = "{json_path}"\n'
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate every site file and wrapper")
    parser.add_argument("--site", help="site JSON filename (without .json) to stamp")
    parser.add_argument("--write", action="store_true", help="write a wrapper for --site")
    args = parser.parse_args()
    fixture_catalog = load_json(FIXTURE_CATALOG)
    if not fixture_catalog.get("fixture_only"):
        print("ERROR: candidate catalog must remain explicitly fixture-only", file=sys.stderr)
        return 2
    contract = load_json(CONTRACT_FILE)
    if contract.get("contract_id") != "soh.native_poi.intent.v1" or contract.get("contract_version") != 1:
        print("ERROR: unsupported shared interaction contract", file=sys.stderr)
        return 2
    selected = [DATA / f"{args.site}.json"] if args.site else sorted(DATA.glob("*.json"))

    problems: list[str] = []
    for path in selected:
        if not path.is_file():
            problems.append(f"missing site source: {path}")
            continue
        data = load_json(path)
        problems.extend(f"{path.name}: {message}" for message in validate(data, fixture_catalog))
        scene_path = SCENES / (path.stem + ".tscn")
        if args.write and path.stem == args.site:
            scene_path.write_text(wrapper_text(data), encoding="utf-8")
            print(f"STAMPED {scene_path.relative_to(ROOT)} from {path.relative_to(ROOT)}")
        if scene_path.is_file() and scene_path.read_text(encoding="utf-8") != wrapper_text(data):
            problems.append(f"{path.name}: wrapper differs from generated template instance {scene_path.name}")
        elif not scene_path.is_file() and not (args.write and path.stem == args.site):
            problems.append(f"{path.name}: missing PackedScene wrapper {scene_path.name}")
    if problems:
        for problem in problems:
            print("ERROR:", problem, file=sys.stderr)
        return 1
    print(f"A8 site data valid: {len(selected)} sites; one reusable PackedScene / interaction engine")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
