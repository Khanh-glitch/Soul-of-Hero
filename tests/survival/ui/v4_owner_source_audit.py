#!/usr/bin/env python3
"""Verify the exact A0/A1/A3 sources V4 was designed against.

This is source-contract validation, not gameplay or production-mount evidence.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

A0_SHA = "b2c37d35f47ef870fcbafafbc7f49e3d2730cd17"
A1_SHA = "2951bf8559b2e289ce99fd4d394d44c46fdd91b1"
A3_SHA = "18e7afcbd576bbd9bfbcc509b2ee13216186a522"
EVIDENCE_SHA = "1ee7e43da22adb4b9ce1647efbcb1b07988ceaf7"
ATLAS_SHA256 = "b958de0fc413cc200b35b0938760228c2ebd3a8ef4aa2f52c1051c52cca59157"
ACCEPTANCE_SHA256 = "b9afd6c22e47c1427346b2c8753e85b34ee5012d15e48934656189dd21ac7476"
A0_PANEL_SHA256 = "ce2ac1397c048ab64db997944365916626ca450db8e6700274894ba05ffd7519"
A0_SURVIVAL_SHA256 = "4a4a2962a14d990e4470a41a602ff4fed7afc03d8aad5a88baf029a57722ca5d"
A0_GATE_SHA256 = "c4c113bf871547bf7662d203093bfa1660eb7431a001301f2bab11e2aed23236"
A1_WAYSTATION_SHA256 = "8f2e437a9c4200f737e1b048be70030e4affde37012f1f05421efe7a2e8064cf"
A1_RELAY_SHA256 = "ce450be63c341011fe1d472f3194f9cbe128e4b5e36f2bb9ef207c6818bfda22"
A3_ITEMS_SHA256 = "0dd502bb439a11657c10074e51a55d144ae6b9eb622afa55967207380ba85a2d"
A3_RECIPES_SHA256 = "4933b4698c2a7f3808a536559d0b9c202f9a9254922544f4702825c4443523e4"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"FAIL: {message}")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pinned(root: Path, expected: str, name: str) -> None:
    actual = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
    require(actual == expected, f"{name} source pin drifted: {actual} != {expected}")


def digest(path: Path, expected: str, name: str) -> None:
    actual = sha256(path)
    require(actual == expected, f"{name} content hash drifted: {actual} != {expected}")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--a0-root", type=Path, required=True)
    parser.add_argument("--a1-root", type=Path, required=True)
    parser.add_argument("--a3-root", type=Path, required=True)
    parser.add_argument("--evidence-root", type=Path, required=True)
    args = parser.parse_args()
    for root, expected, name in [
        (args.a0_root, A0_SHA, "A0"),
        (args.a1_root, A1_SHA, "A1"),
        (args.a3_root, A3_SHA, "A3"),
        (args.evidence_root, EVIDENCE_SHA, "Atlas evidence"),
    ]:
        pinned(root, expected, name)

    a0_panel = args.a0_root / "game/survival/chest_inventory_panel.gd"
    a0_service = args.a0_root / "game/survival/survival_service.gd"
    a0_gate = args.a0_root / "game/survival/gameplay_input_gate.gd"
    a0_knight = args.a0_root / "game/characters/knight/knight.gd"
    a0_hud = args.a0_root / "game/overworld/overworld_hud.gd"
    digest(a0_panel, A0_PANEL_SHA256, "A0 chest panel")
    digest(a0_service, A0_SURVIVAL_SHA256, "A0 SurvivalService")
    digest(a0_gate, A0_GATE_SHA256, "A0 gameplay input gate")
    panel_text = a0_panel.read_text(encoding="utf-8")
    service_text = a0_service.read_text(encoding="utf-8")
    gate_text = a0_gate.read_text(encoding="utf-8")
    knight_text = a0_knight.read_text(encoding="utf-8")
    for fragment in ["open_chest(", "_valid_context()", "transfer_to_container", "transfer_from_container"]:
        require(fragment in panel_text, f"A0 chest panel no longer owns {fragment}")
    for fragment in ["func transfer_to_container(", "func transfer_from_container(", "func is_sweepable_item(", "transact_once"]:
        require(fragment in service_text, f"A0 SurvivalService no longer provides {fragment}")
    for fragment in ["func observe_event(", "_event_latches", "func permits(", "func movement()"]:
        require(fragment in gate_text, f"A0 modal gate no longer provides {fragment}")
    for fragment in ["GameplayInputGateScript", "gameplay_input_allowed(", "_gameplay_input_gate.movement()"]:
        require(fragment in knight_text, f"A0 Knight input path no longer uses {fragment}")
    hud_text = a0_hud.read_text(encoding="utf-8")
    for fragment in ["func set_provisions(", "func show_death(", "func show_prompt("]:
        require(fragment in hud_text, f"A0's existing HUD no longer provides {fragment}")

    waystation_path = args.a1_root / "data/survival/world/poi_authoring/poi_crown_waystation.v1.json"
    relay_path = args.a1_root / "data/survival/world/poi_authoring/poi_crown_relay_shed.v1.json"
    digest(waystation_path, A1_WAYSTATION_SHA256, "A1 Waystation")
    digest(relay_path, A1_RELAY_SHA256, "A1 Relay Shed")
    waystation, relay = read_json(waystation_path), read_json(relay_path)
    for poi in [waystation, relay]:
        require(poi.get("native_playable") is False, f"{poi.get('poi_id')} native state changed without owner review")
        require("AUTHORED_NOT_NATIVE" in poi.get("content_readiness", ""), f"{poi.get('poi_id')} readiness label changed")
        require(poi.get("schema") == "soh.world.poi_authoring.v1", "A1 POI authoring schema changed")
    require(waystation.get("poi_id") == "poi_crown_waystation", "A1 Waystation identity changed")
    require(relay.get("poi_id") == "poi_crown_relay_shed", "A1 Relay identity changed")

    items_path = args.a3_root / "data/survival/items/items.json"
    recipes_path = args.a3_root / "data/survival/recipes/recipes.json"
    research_path = args.a3_root / "data/survival/recipes/research.json"
    digest(items_path, A3_ITEMS_SHA256, "A3 item catalog")
    digest(recipes_path, A3_RECIPES_SHA256, "A3 recipe catalog")
    items = read_json(items_path)["items"]
    recipes = read_json(recipes_path)["recipes"]
    technologies = read_json(research_path)["technologies"]
    core = items["core_ember"]
    require(core["kind"] == "skill_core" and core["storage"] == "instance", "A3 physical Core identity/storage changed")
    require(core["max_uses"] == 8 and core["max_condition"] == 100, "A3 Core finite state changed")
    require(core["skill_readiness"] == "BLOCKED_PENDING_A4", "A4 readiness blocker changed without owner evidence")
    require(core["acquisition_status"] == "PROPOSED_WORLD" and core["balance_status"] == "SOH_PROPOSAL", "A3 acquisition/balance is not owner-approved")
    craft = recipes["craft_core_ember"]
    require(craft["inputs"] == {"binding_cloth": 1, "charged_blank": 1, "reaper_essence": 1, "soul_ember": 1}, "Core crafting material vector changed")
    require(craft["station"] == "workbench" and craft["min_tier"] == 2 and craft["knowledge"] == "recipe", "Core crafting station/knowledge changed")
    rebuild = recipes["rebuild_core_ember"]
    require(rebuild["consumes_specimen"] == "core_ember", "specimen sacrifice contract changed")
    require(rebuild["inputs"] == {"core_blank": 1, "knowledge_spares": 2, "soul_ember": 1}, "reconstruction inputs changed")
    require(technologies["tech_core_binding"]["scope"] == "permanent_profile", "permanent knowledge scope changed")

    acceptance = args.a0_root / "docs/survival/ACCEPTANCE.md"
    atlas = args.evidence_root / "docs/survival/source_archive/Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md"
    digest(acceptance, ACCEPTANCE_SHA256, "binding survival acceptance")
    digest(atlas, ATLAS_SHA256, "original Atlas archive")
    print("V4 OWNER SOURCE AUDIT PASS")
    print(f"A0={A0_SHA}; A1={A1_SHA}; A3={A3_SHA}; evidence={EVIDENCE_SHA}")
    print("Validated actual A0 transfer/input/HUD owners, A1 authored non-native POIs, A3 Core/research records, ACCEPTANCE.md, and the immutable Atlas hash.")
    print("This audit establishes source mapping only; it does not certify a production mount, live drops, human readability, or Core readiness.")


if __name__ == "__main__":
    main()
