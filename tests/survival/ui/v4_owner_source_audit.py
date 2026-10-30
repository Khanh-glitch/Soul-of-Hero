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

A0_SHA = "2b209b0c0b4f0b82f0a56a7b8903e2832a197eac"
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
A1_WAYSTATION_SLICE_SHA256 = "3a4981fd3e24580e2e7c2ee5d0929f76c432d785e142b67a222c6480af01e16f"
A1_RELAY_SLICE_SHA256 = "5ab0042980a43e64f05aa73870b0d99f906fb95f70492daf2a6b6f7b585b77ad"
A1_SLICE_HANDOFF_SHA256 = "c4f0a453c8143bfae9db88b269cd5406d6e4ae1c8b80ad2c0e70f865de7f97a1"
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

    slice_root = args.a1_root / "data/survival/world/vertical_slice"
    waystation_slice_path = slice_root / "poi_crown_waystation.slice.json"
    relay_slice_path = slice_root / "poi_crown_relay_shed.slice.json"
    handoff_path = slice_root / "handoff_contracts.json"
    digest(waystation_slice_path, A1_WAYSTATION_SLICE_SHA256, "A1 Waystation canonical slice")
    digest(relay_slice_path, A1_RELAY_SLICE_SHA256, "A1 Relay canonical slice")
    digest(handoff_path, A1_SLICE_HANDOFF_SHA256, "A1 slice handoff contract")
    waystation_slice = read_json(waystation_slice_path)
    relay_slice = read_json(relay_slice_path)
    slice_handoff = read_json(handoff_path)
    require(slice_handoff.get("native_playable") is False, "A1 slice must remain explicitly non-native")
    way_actions = {action.get("action_id"): action for action in waystation_slice.get("actions", [])}
    relay_actions = {action.get("action_id"): action for action in relay_slice.get("actions", [])}
    def action_vector(action: dict, field: str) -> dict:
        return {row.get("item_id"): row.get("quantity") for row in action.get(field, [])}

    cache = way_actions.get("cache_restock", {})
    require(cache.get("action_id") == "cache_restock" and cache.get("reward_right_id") == "rr_waystation_cache_claim", "A1 cache identity/reward right changed")
    require(cache.get("enabled") is True and cache.get("one_time") is False, "A1 cache renewable status changed")
    require(action_vector(cache, "reward_items") == {"iron_scrap": 3, "knowledge_spares": 2}, "A1 cache reward vector changed")
    require(cache.get("cooldown_active_seconds") == 1800, "A1 cache cooldown contract changed")
    require(cache.get("requires_capabilities") == ["cap_salvage"] and cache.get("missing_prerequisite_reasons") == ["NOT_DISCOVERED", "OUT_OF_RANGE", "MISSING_CAPABILITY:cap_salvage", "COOLDOWN", "ALREADY_APPLIED"], "A1 cache gate/status vector changed")
    deadfall = way_actions.get("gather_deadfall", {})
    require(deadfall.get("action_id") == "gather_deadfall" and deadfall.get("reward_right_id") == "rr_waystation_deadfall_claim", "A1 deadfall identity/reward right changed")
    require(deadfall.get("enabled") is True and deadfall.get("one_time") is False, "A1 deadfall renewable status changed")
    require(action_vector(deadfall, "reward_items") == {"oak_wood": 2} and deadfall.get("cooldown_active_seconds") == 300, "A1 deadfall reward/cooldown changed")
    locker = way_actions.get("pry_locker", {})
    require(locker.get("action_id") == "pry_locker" and locker.get("reward_right_id") == "rr_waystation_salvage_tool", "A1 locker identity/reward right changed")
    require(locker.get("enabled") is True and locker.get("one_time") is True and locker.get("reward_items") == [], "A1 locker action status/rewards changed")
    require(locker.get("grants_capabilities") == ["cap_salvage"] and locker.get("missing_prerequisite_reasons") == ["NOT_DISCOVERED", "OUT_OF_RANGE", "ALREADY_APPLIED"], "A1 locker capability/gates changed")
    ledger = way_actions.get("seal_ledger", {})
    require(ledger.get("action_id") == "seal_ledger" and ledger.get("reward_right_id") == "rr_waystation_seal_ledger", "A1 ledger identity/reward right changed")
    require(ledger.get("enabled") is True and ledger.get("one_time") is True and ledger.get("reward_items") == [], "A1 ledger action status/rewards changed")
    require(ledger.get("requires_capabilities") == ["cap_salvage"] and ledger.get("grants_capabilities") == ["cap_seal_1"], "A1 ledger capability chain changed")
    bypass = relay_actions.get("hand_crank_bypass", {})
    require(bypass.get("action_id") == "hand_crank_bypass" and bypass.get("reward_right_id") == "rr_relay_power_bypass", "A1 Relay bypass identity/reward right changed")
    require(bypass.get("enabled") is True and bypass.get("one_time") is True and bypass.get("reward_items") == [], "A1 Relay bypass status/reward changed")
    require(action_vector(bypass, "consumes_items") == {"iron_scrap": 2, "oak_wood": 1}, "A1 Relay bypass cost changed")
    require(bypass.get("requires_capabilities") == ["cap_salvage"] and bypass.get("grants_capabilities") == ["cap_power_1"], "A1 Relay bypass capability chain changed")
    require(bypass.get("missing_prerequisite_reasons") == ["NOT_DISCOVERED", "OUT_OF_RANGE", "MISSING_CAPABILITY:cap_salvage", "MISSING_ITEM:iron_scrap", "MISSING_ITEM:oak_wood", "ALREADY_APPLIED"], "A1 Relay bypass gate/status vector changed")
    breaker = relay_actions.get("breaker_reset", {})
    require(breaker.get("enabled") is True and breaker.get("requires_capabilities") == ["cap_power_1"] and breaker.get("reward_items") == [], "A1 breaker status/gate changed")
    copper = relay_actions.get("copper_upgrade", {})
    require(copper.get("action_id") == "copper_upgrade" and copper.get("reward_right_id") == "rr_relay_copper_upgrade", "A1 copper upgrade identity/reward right changed")
    require(copper.get("enabled") is False and copper.get("deferred_reason") == "ITEM_NOT_IN_A3_CATALOG:copper", "A1 copper upgrade must remain deferred")
    require(action_vector(copper, "consumes_items") == {"copper": 2, "iron_scrap": 1} and copper.get("grants_capabilities") == ["cap_power_2"], "A1 deferred copper action's authored vector changed")
    require(copper.get("requires_capabilities") == ["cap_power_1"] and copper.get("missing_prerequisite_reasons") == ["DEFERRED:ITEM_NOT_IN_A3_CATALOG:copper", "MISSING_CAPABILITY:cap_power_1", "MISSING_ITEM:copper", "MISSING_ITEM:iron_scrap"], "A1 deferred copper gates/status changed")
    a6_projection = slice_handoff.get("a6", {})
    require(a6_projection.get("projection_schema") == "soh.world.slice.a6_projection.v1", "A1 A6 projection schema changed")
    projection_rules = a6_projection.get("rules", [])
    require(any("Undiscovered POIs expose no private action, reward, prerequisite or map metadata" == rule for rule in projection_rules), "A1 hidden-projection rule changed")
    hidden_payload = a6_projection.get("payload_examples", {}).get("hidden", {})
    require(hidden_payload.get("visibility") == "HIDDEN" and hidden_payload.get("map_status") == "HIDDEN", "A1 hidden projection status changed")
    require(hidden_payload.get("clues") == [] and hidden_payload.get("hazard_telegraphs") == [] and hidden_payload.get("missing_prerequisite_reasons") == [], "A1 hidden projection leaks clue/hazard/action metadata")
    discovered_payload = a6_projection.get("payload_examples", {}).get("discovered_missing_prereq", {})
    require(discovered_payload.get("visibility") == "DISCOVERED" and discovered_payload.get("map_status") == "MISSING_PREREQUISITE" and discovered_payload.get("missing_prerequisite_reasons") == ["MISSING_ITEM:oak_wood"], "A1 discovered projection status/reason changed")
    a3_handoff = slice_handoff.get("a3", {})
    require(a3_handoff.get("atomic_reward_ownership", "").startswith("A0 SaveService transaction is the sole commit boundary"), "A1 handoff reward mutation ownership changed")
    require(a3_handoff.get("exact_item_ids") == ["iron_scrap", "oak_wood", "knowledge_spares"], "A1 handoff exact item vocabulary changed")
    require(a3_handoff.get("alias_decisions", {}).get("hardwood_to_oak_wood", "").startswith("REJECT_ALIAS"), "A1/A3 hardwood alias rejection changed")
    require(slice_handoff.get("a0", {}).get("owner") == "A0", "A1 handoff action owner changed")

    items_path = args.a3_root / "data/survival/items/items.json"
    recipes_path = args.a3_root / "data/survival/recipes/recipes.json"
    research_path = args.a3_root / "data/survival/recipes/research.json"
    digest(items_path, A3_ITEMS_SHA256, "A3 item catalog")
    digest(recipes_path, A3_RECIPES_SHA256, "A3 recipe catalog")
    items = read_json(items_path)["items"]
    recipes = read_json(recipes_path)["recipes"]
    technologies = read_json(research_path)["technologies"]
    for reward_item in ["iron_scrap", "knowledge_spares", "oak_wood"]:
        require(reward_item in items, f"A1 canonical reward item is not in the pinned A3 catalog: {reward_item}")
    require("copper" not in items, "A1's copper upgrade may not be shown as available without an A3 item")
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
    print("Validated A0 transfer/input/HUD owners, canonical A1 Waystation/Relay action vectors and A6 handoff projection, A3 Core/research records, ACCEPTANCE.md, and the immutable Atlas hash.")
    print("This audit establishes source mapping only; it does not certify a production mount, live drops, human readability, or Core readiness.")


if __name__ == "__main__":
    main()
