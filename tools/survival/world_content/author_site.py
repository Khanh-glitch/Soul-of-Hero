#!/usr/bin/env python3
"""Validate and stamp native POI wrappers and their source-backed local shells."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "data/survival/world_content/sites"
SCENES = ROOT / "game/survival/world_content/scenes"
FIXTURE_CATALOG = ROOT / "data/survival/world_content/catalog_candidates.fixture.json"
FIXTURE_ACTION_CATALOG = ROOT / "tests/fixtures/survival/world_content/a8_native_poi_action_catalog.fixture.json"
CONTRACT_FILE = ROOT / "data/survival/world_content/interaction_contract.v2.json"
TRANSITION_CONTRACT_FILE = ROOT / "data/survival/world_content/transition_contract.v1.json"
WORKSITE_TEMPLATE = "res://game/survival/world_content/scenes/native_poi_template.tscn"
SHELL_TEMPLATE = "res://game/survival/world_content/scenes/native_poi_shell_template.tscn"
CANONICAL = {
    "poi_crown_south_quarry": [30, 280],
    "poi_crown_south_orchard": [140, 360],
    "poi_crown_south_mill": [120, 300],
}
DEFINITION_LINE = re.compile(r'^definition_path\s*=\s*"([^"]+)"\s*$', re.MULTILINE)


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def validate(data: dict, action_catalog: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["site source must be a JSON object"]
    required = (
        "schema_version", "source", "site_id", "display_name", "template_id",
        "visual_profile", "world_bounds", "spawn", "action_socket",
        "approach_stand", "interaction_radius", "walls", "choices", "actions",
        "return_hook",
    )
    for key in required:
        if key not in data:
            errors.append(f"missing required field {key}")
    if data.get("schema_version") != 1:
        errors.append("unsupported site schema_version")
    source = data.get("source", {})
    if not isinstance(source, dict):
        errors.append("source must be a JSON object")
        source = {}
    poi_id = source.get("poi_id")
    if poi_id in CANONICAL and source.get("canonical_cell") != CANONICAL[poi_id]:
        errors.append(f"canonical A1 cell mismatch for {poi_id}: {source.get('canonical_cell')}")
    if poi_id not in CANONICAL and not data.get("test_only", False):
        errors.append("non-canonical site must be explicitly marked test_only")
    access = data.get("access", {})
    if not isinstance(access, dict):
        errors.append("access must be a JSON object")
        access = {}
    if poi_id == "poi_crown_south_mill" and "cap_salvage" not in access.get("outer_requires", []):
        errors.append("A1 mill outer access must retain cap_salvage")
    if poi_id in ("poi_crown_south_quarry", "poi_crown_south_orchard") and access.get("outer_requires", []):
        errors.append(f"A1 outer approach must remain uncapped for {poi_id}")
    if not data.get("display_name") or not data.get("return_hook"):
        errors.append("display_name and a meaningful return_hook are required")

    bounds = data.get("world_bounds", [])
    if not isinstance(bounds, list) or len(bounds) != 2:
        errors.append("world_bounds must be two positive numbers")
    else:
        try:
            if any(float(value) <= 0 for value in bounds):
                errors.append("world_bounds must be two positive numbers")
        except (TypeError, ValueError):
            errors.append("world_bounds must contain numeric values")

    choices = data.get("choices", [])
    actions = data.get("actions", [])
    if not isinstance(choices, list):
        errors.append("choices must be an array")
        choices = []
    if not isinstance(actions, list):
        errors.append("actions must be an array")
        actions = []
    if not choices:
        errors.append("at least one consequential choice is required")
    if not actions:
        errors.append("at least one action/candidate is required")
    entries: list[dict] = []
    for entry in choices + actions:
        if not isinstance(entry, dict):
            errors.append("every choice/action must be a JSON object")
        else:
            entries.append(entry)
    action_ids: set[str] = set()
    action_table = action_catalog.get("actions", {}) if isinstance(action_catalog, dict) else {}
    fixture_actions = action_table.get(poi_id, {}) if isinstance(action_table, dict) else {}
    forbidden_source_fields = {
        "costs", "rewards", "cooldown_seconds", "claim_policy", "catalog_source",
        "provisional_test_only", "unlock_actions", "unlock_after_state_seconds",
        "a3_approval_ref", "approved_binding_ref",
    }
    for entry in entries:
        action_id = entry.get("action_id", "")
        if not action_id or action_id in action_ids:
            errors.append(f"missing or duplicate action_id {action_id!r}")
        action_ids.add(action_id)
        for field in forbidden_source_fields:
            if field in entry:
                errors.append(f"{action_id} source JSON may not author transaction field {field}")
        object_id = entry.get("object_id")
        if not isinstance(object_id, str) or not object_id:
            errors.append(f"{action_id} must have an explicit neutral object_id")
        fixture_action = fixture_actions.get(action_id) if isinstance(fixture_actions, dict) else None
        if not isinstance(fixture_action, dict):
            errors.append(f"{action_id} has no isolated test-fixture behavior record")
        elif fixture_action.get("object_id") != object_id:
            errors.append(f"{action_id} object_id differs from its test-fixture record")
    if set(action_ids) != set(fixture_actions):
        errors.append(
            f"fixture action identities must exactly match site identities; "
            f"site_only={sorted(set(action_ids)-set(fixture_actions))}, "
            f"fixture_only={sorted(set(fixture_actions)-set(action_ids))}"
        )

    walls = data.get("walls", [])
    if not isinstance(walls, list):
        errors.append("walls must be an array")
        walls = []
    for rect in walls:
        if not isinstance(rect, list) or len(rect) != 4:
            errors.append("walls must be positive [x,y,width,height] rectangles")
            continue
        try:
            if float(rect[2]) <= 0 or float(rect[3]) <= 0:
                errors.append("walls must be positive [x,y,width,height] rectangles")
        except (TypeError, ValueError):
            errors.append("wall rectangles must contain numeric values")

    transition = data.get("local_transition", {})
    if not isinstance(transition, dict):
        errors.append("local_transition must be a JSON object")
        transition = {}
    if poi_id in CANONICAL:
        if data.get("scene_role") != "local_worksite":
            errors.append("canonical 960x600 scene must be marked scene_role=local_worksite")
        if transition.get("contract_id") != "soh.native_poi.transition.v1" or transition.get("contract_version") != 1:
            errors.append("canonical local_transition must use soh.native_poi.transition.v1")
        interior_entry = transition.get("interior_entry", [])
        if not transition.get("shell_scene") or not isinstance(interior_entry, list) or len(interior_entry) != 2:
            errors.append("canonical local_transition needs a shell scene and interior_entry")
        shell = data.get("overworld_shell", {})
        if not isinstance(shell, dict):
            errors.append("overworld_shell must be a JSON object")
            shell = {}
        if shell.get("scene") != transition.get("shell_scene"):
            errors.append("overworld_shell.scene must match local_transition.shell_scene")
        if shell.get("bounds_px") != [128, 128] or shell.get("action_socket") != [64, 64]:
            errors.append("overworld shell must use the A1 128x128 footprint and centered action socket")
        if shell.get("canonical_cell") != source.get("canonical_cell"):
            errors.append("overworld shell canonical_cell must match A1 source identity")
        if shell.get("rotation_degrees") != 0 or shell.get("scale") != [1, 1]:
            errors.append("overworld shell transform must remain rotation 0 / scale 1")
        if shell.get("footprint_radius_tiles") != 4:
            errors.append("overworld shell must fit the authored four-tile radius")
        portal = shell.get("entry_portal", [])
        try:
            portal_valid = (
                isinstance(portal, list) and len(portal) == 2
                and 0 <= float(portal[0]) <= 128 and 0 <= float(portal[1]) <= 128
            )
        except (TypeError, ValueError):
            portal_valid = False
        if not portal_valid:
            errors.append("overworld shell entry_portal must be within the 128x128 bounds")
        worksite_scene = transition.get("worksite_scene", "")
        shell_scene = transition.get("shell_scene", "")
        for label, resource_path in (("worksite_scene", worksite_scene), ("shell_scene", shell_scene)):
            if not isinstance(resource_path, str) or not resource_path.startswith("res://game/survival/world_content/scenes/"):
                errors.append(f"local_transition.{label} must point to an A8 scene")
            elif ".." in PurePosixPath(resource_path.removeprefix("res://")).parts:
                errors.append(f"local_transition.{label} cannot escape the resource root")
        if interior_entry != data.get("spawn"):
            errors.append("local_transition.interior_entry must equal the local-only worksite spawn")
        exit_portal = transition.get("exit_portal", [])
        local_points = [data.get("spawn", []), exit_portal]
        try:
            local_bounds = [float(value) for value in bounds]
            for point in local_points:
                if not isinstance(point, list) or len(point) != 2:
                    errors.append("local worksite spawn and exit_portal must be 2D points")
                    continue
                px, py = float(point[0]), float(point[1])
                if not (10 <= px <= local_bounds[0] - 10 and 10 <= py <= local_bounds[1] - 10):
                    errors.append("local worksite doorway point must fit inside the 960x600 scene")
                    continue
                for rect in walls:
                    if not isinstance(rect, list) or len(rect) != 4:
                        continue
                    x, y, width, height = (float(value) for value in rect)
                    nearest_x = min(max(px, x), x + width)
                    nearest_y = min(max(py, y), y + height)
                    if (px - nearest_x) ** 2 + (py - nearest_y) ** 2 < 100:
                        errors.append("local doorway/spawn collider overlaps an authored wall")
                        break
        except (TypeError, ValueError, IndexError):
            errors.append("local doorway/spawn and world_bounds must contain numeric values")
        return_anchor = transition.get("return_anchor", {})
        if not isinstance(return_anchor, dict) or (
            return_anchor.get("world_id") != source.get("world_id")
            or return_anchor.get("poi_id") != poi_id
            or return_anchor.get("canonical_cell") != source.get("canonical_cell")
            or return_anchor.get("shell_scene") != shell.get("scene")
            or return_anchor.get("shell_local_position") != shell.get("entry_portal")
        ):
            errors.append("local_transition.return_anchor must return to the exact canonical shell doorway")
        gates = data.get("gates", [])
        if not isinstance(gates, list):
            errors.append("gates must be an array")
            gates = []
        for gate in gates:
            if not isinstance(gate, dict):
                errors.append("every capability gate must be a JSON object")
                continue
            if not isinstance(gate.get("requires_state_values", {}), dict):
                errors.append("gate requires_state_values must be a JSON object")
        if poi_id == "poi_crown_south_mill":
            outer_gate = next((gate for gate in gates if isinstance(gate, dict) and gate.get("zone") == "outer_access"), {})
            if outer_gate.get("requires") != "cap_salvage":
                errors.append("Mill outer inspection must remain separated from salvage access")
            maintenance = next((gate for gate in gates if isinstance(gate, dict) and gate.get("zone") == "maintenance_walk"), {})
            if (
                maintenance.get("requires") != "cap_salvage"
                or "turning" not in maintenance.get("requires_state_values", {}).get("mill_wheel", [])
            ):
                errors.append("Mill maintenance walk must require cap_salvage and an owner-projected repaired wheel")
            salvage = next((entry for entry in actions if entry.get("action_id") == "recover_fastener"), {})
            if "turning" not in salvage.get("requires_state_values", {}).get("mill_wheel", []):
                errors.append("Mill fastener salvage must require the accepted turning-wheel state")
    return errors


def validate_fixture_action_catalog(action_catalog: dict, item_catalog: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(action_catalog, dict) or action_catalog.get("schema") != "soh.a8.test_only_action_catalog.v1":
        return ["test action catalog has an unsupported schema"]
    if action_catalog.get("fixture_only") is not True:
        errors.append("test action catalog must remain fixture_only=true")
    if action_catalog.get("a3_approved_bindings") != {}:
        errors.append("A8 fixture action catalog must not claim or contain A3 approvals")
    items = item_catalog.get("items", {}) if isinstance(item_catalog, dict) else {}
    blocked = set(item_catalog.get("blocked_item_ids", [])) if isinstance(item_catalog, dict) else set()
    all_actions = action_catalog.get("actions", {})
    if not isinstance(all_actions, dict):
        return errors + ["test action catalog actions must be an object"]
    for poi_id, actions in all_actions.items():
        if not isinstance(actions, dict):
            errors.append(f"fixture actions for {poi_id} must be an object")
            continue
        for action_id, behavior in actions.items():
            if not isinstance(behavior, dict):
                errors.append(f"fixture behavior {poi_id}/{action_id} must be an object")
                continue
            if behavior.get("claim_policy") not in ("once", "replenishable"):
                errors.append(f"fixture behavior {poi_id}/{action_id} has unsupported claim policy")
            try:
                cooldown = float(behavior.get("cooldown_seconds", 0))
            except (TypeError, ValueError):
                cooldown = -1
            if behavior.get("claim_policy") == "replenishable" and cooldown <= 0:
                errors.append(f"fixture replenishable action {poi_id}/{action_id} needs positive test timer")
            for group in ("costs", "rewards"):
                values = behavior.get(group, {})
                if not isinstance(values, dict):
                    errors.append(f"fixture {poi_id}/{action_id} {group} must be an object")
                    continue
                for item_id, amount in values.items():
                    if item_id not in items:
                        errors.append(f"fixture {poi_id}/{action_id} uses unknown candidate item {item_id}")
                    if item_id in blocked:
                        errors.append(f"fixture {poi_id}/{action_id} references blocked item {item_id}")
                    if isinstance(amount, bool) or not isinstance(amount, int) or amount <= 0:
                        errors.append(f"fixture {poi_id}/{action_id} {group}.{item_id} must be a positive integer")
    return errors


def wrapper_text(site: dict, source_filename: str, kind: str = "worksite") -> str:
    file_stem = re.sub(r"[^a-z0-9_]+", "_", site["site_id"].lower()).strip("_")
    node_name = "POI_" + "".join(part.title() for part in file_stem.split("_"))
    if kind == "shell":
        template = SHELL_TEMPLATE
        node_name += "_OverworldShell"
    else:
        template = WORKSITE_TEMPLATE
    json_path = f"res://data/survival/world_content/sites/{source_filename}"
    return (
        "[gd_scene load_steps=2 format=3]\n\n"
        f'[ext_resource type="PackedScene" path="{template}" id="1_template"]\n\n'
        f'[node name="{node_name}" instance=ExtResource("1_template")]\n'
        f'definition_path = "{json_path}"\n'
    )


def referenced_definition(scene_path: Path) -> tuple[str | None, str | None]:
    """Read the serialized reference independently from generator output."""
    try:
        scene_text = scene_path.read_text(encoding="utf-8")
    except OSError as error:
        return None, f"cannot read PackedScene {scene_path}: {error}"
    matches = DEFINITION_LINE.findall(scene_text)
    if len(matches) != 1:
        return None, f"expected exactly one definition_path in {scene_path.name}; found {len(matches)}"
    return matches[0], None


def audit_wrapper(scene_path: Path, expected_source: Path, expected_data: dict, root: Path) -> list[str]:
    """Resolve and verify an actual wrapper reference without consulting its generator."""
    problems: list[str] = []
    if not scene_path.is_file():
        return [f"missing PackedScene wrapper {scene_path.name}"]
    reference, parse_error = referenced_definition(scene_path)
    if parse_error:
        return [parse_error]
    assert reference is not None
    if not reference.startswith("res://"):
        return [f"{scene_path.name}: definition_path must be a res:// resource path"]
    relative = PurePosixPath(reference.removeprefix("res://"))
    if ".." in relative.parts:
        return [f"{scene_path.name}: definition_path escapes the project resource root"]
    actual_source = (root / Path(*relative.parts)).resolve()
    project_root = root.resolve()
    if not actual_source.is_relative_to(project_root):
        return [f"{scene_path.name}: definition_path resolves outside the project resource root"]
    if not actual_source.is_file():
        return [f"{scene_path.name}: referenced JSON does not exist: {reference}"]
    if actual_source != expected_source.resolve():
        problems.append(
            f"{scene_path.name}: references {reference}, expected source {expected_source.relative_to(root)}"
        )
    try:
        actual_data = load_json(actual_source)
    except (OSError, json.JSONDecodeError) as error:
        return problems + [f"{scene_path.name}: referenced JSON is invalid: {error}"]
    if not isinstance(actual_data, dict):
        return problems + [f"{scene_path.name}: referenced JSON must be an object"]
    expected_source_meta = expected_data.get("source", {})
    actual_source_meta = actual_data.get("source", {})
    expected_source_id = expected_source_meta.get("poi_id") if isinstance(expected_source_meta, dict) else None
    actual_source_id = actual_source_meta.get("poi_id") if isinstance(actual_source_meta, dict) else None
    if actual_source_id != expected_source_id:
        problems.append(
            f"{scene_path.name}: referenced POI identity {actual_source_id!r} does not match {expected_source_id!r}"
        )
    if actual_data.get("site_id") != expected_data.get("site_id"):
        problems.append(f"{scene_path.name}: referenced site_id does not match {expected_source.name}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate every site file, wrapper, and shell")
    parser.add_argument("--site", help="site JSON filename (without .json) to stamp")
    parser.add_argument("--write", action="store_true", help="write wrappers for --site")
    args = parser.parse_args()
    fixture_catalog = load_json(FIXTURE_CATALOG)
    if fixture_catalog.get("fixture_only") is not True:
        print("ERROR: candidate item catalog must remain explicitly fixture-only", file=sys.stderr)
        return 2
    action_catalog = load_json(FIXTURE_ACTION_CATALOG)
    contract = load_json(CONTRACT_FILE)
    if contract.get("contract_id") != "soh.native_poi.intent.v2" or contract.get("contract_version") != 2:
        print("ERROR: unsupported neutral-identity interaction contract", file=sys.stderr)
        return 2
    transition_contract = load_json(TRANSITION_CONTRACT_FILE)
    if (
        transition_contract.get("contract_id") != "soh.native_poi.transition.v1"
        or transition_contract.get("contract_version") != 1
    ):
        print("ERROR: unsupported local transition contract", file=sys.stderr)
        return 2
    if args.site and Path(args.site).name != args.site:
        print("ERROR: --site accepts only a source filename stem", file=sys.stderr)
        return 2
    selected = [DATA / f"{args.site}.json"] if args.site else sorted(DATA.glob("*.json"))

    problems: list[str] = validate_fixture_action_catalog(action_catalog, fixture_catalog)
    for template_path in (WORKSITE_TEMPLATE, SHELL_TEMPLATE):
        resource_path = ROOT / template_path.removeprefix("res://")
        if not resource_path.is_file():
            problems.append(f"missing shared PackedScene template: {resource_path.relative_to(ROOT)}")
    for path in selected:
        if not path.is_file():
            problems.append(f"missing site source: {path}")
            continue
        try:
            data = load_json(path)
        except (OSError, json.JSONDecodeError) as error:
            problems.append(f"{path.name}: invalid site JSON: {error}")
            continue
        problems.extend(f"{path.name}: {message}" for message in validate(data, action_catalog))
        scene_path = SCENES / (path.stem + ".tscn")
        shell_metadata = data.get("overworld_shell", {})
        transition_metadata = data.get("local_transition", {})
        if isinstance(shell_metadata, dict) and shell_metadata:
            expected_worksite = f"res://game/survival/world_content/scenes/{path.stem}.tscn"
            expected_shell = f"res://game/survival/world_content/scenes/{path.stem}_overworld.tscn"
            if not isinstance(transition_metadata, dict) or transition_metadata.get("worksite_scene") != expected_worksite:
                problems.append(f"{path.name}: local worksite scene path must match the source filename")
            if shell_metadata.get("scene") != expected_shell:
                problems.append(f"{path.name}: compact shell scene path must match the source filename")
        has_site_id = isinstance(data.get("site_id"), str) and bool(data.get("site_id"))
        if args.write and path.stem == args.site and has_site_id:
            scene_path.write_text(wrapper_text(data, path.name), encoding="utf-8")
            print(f"STAMPED {scene_path.relative_to(ROOT)} from {path.relative_to(ROOT)}")
        problems.extend(audit_wrapper(scene_path, path, data, ROOT))
        if has_site_id and scene_path.is_file() and scene_path.read_text(encoding="utf-8") != wrapper_text(data, path.name):
            problems.append(f"{path.name}: wrapper differs from generated template instance {scene_path.name}")

        shell = data.get("overworld_shell", {})
        if not isinstance(shell, dict):
            shell = {}
        if shell:
            shell_scene_value = str(shell.get("scene", ""))
            shell_relative = PurePosixPath(shell_scene_value.removeprefix("res://"))
            if (
                not shell_scene_value.startswith("res://game/survival/world_content/scenes/")
                or ".." in shell_relative.parts
            ):
                problems.append(f"{path.name}: overworld shell scene path must stay inside A8 scenes")
                continue
            shell_scene = ROOT / Path(*shell_relative.parts)
            if args.write and path.stem == args.site and has_site_id:
                shell_scene.parent.mkdir(parents=True, exist_ok=True)
                shell_scene.write_text(wrapper_text(data, path.name, "shell"), encoding="utf-8")
                print(f"STAMPED {shell_scene.relative_to(ROOT)} from {path.relative_to(ROOT)}")
            problems.extend(audit_wrapper(shell_scene, path, data, ROOT))
            if has_site_id and shell_scene.is_file() and shell_scene.read_text(encoding="utf-8") != wrapper_text(data, path.name, "shell"):
                problems.append(f"{path.name}: shell wrapper differs from generated template instance {shell_scene.name}")
        elif data.get("source", {}).get("poi_id") in CANONICAL:
            problems.append(f"{path.name}: canonical POI is missing its compact overworld_shell")
    if problems:
        for problem in problems:
            print("ERROR:", problem, file=sys.stderr)
        return 1
    print(f"A8 site data valid: {len(selected)} site files; references independently resolved")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
