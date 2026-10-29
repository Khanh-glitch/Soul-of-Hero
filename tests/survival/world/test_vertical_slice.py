import copy
import hashlib
import json

import pytest

import compile_slice
import validate_slice
from slice_state import SliceMachine

WORLD = compile_slice.WORLD
SLICE = compile_slice.OUT


@pytest.fixture(scope="module")
def slice_data():
    compile_slice.compile_all()
    return {
        "manifest": json.loads((SLICE / "manifest.json").read_text()),
        "handoff": json.loads((SLICE / "handoff_contracts.json").read_text()),
        "vectors": json.loads((SLICE / "test_vectors.json").read_text()),
        "contracts": {
            "poi_crown_waystation": json.loads((SLICE / "poi_crown_waystation.slice.json").read_text()),
            "poi_crown_relay_shed": json.loads((SLICE / "poi_crown_relay_shed.slice.json").read_text()),
        },
    }


def test_slice_validator_passes(slice_data):
    result = validate_slice.validate()
    assert result["ok"], result["errors"]
    assert result["native_playable"] is False
    assert result["vectors"] >= 10


def test_manifest_is_two_poi_and_not_native(slice_data):
    manifest = slice_data["manifest"]
    assert manifest["native_playable"] is False
    assert manifest["integration_status"] == "NATIVE_READY_CONTRACT_NOT_MOUNTED"
    assert set(manifest["poi_ids"]) == {"poi_crown_waystation", "poi_crown_relay_shed"}
    assert manifest["world_plan_sha256"] == hashlib.sha256((WORLD / "world_plan.v1.json").read_bytes()).hexdigest()
    assert manifest["world_plan_sha256"].startswith("fc5412df")


def test_slice_compilation_is_deterministic(slice_data):
    first = compile_slice.compile_all()["manifest_sha256"]
    second = compile_slice.compile_all()["manifest_sha256"]
    assert first == second


def test_required_nav_is_chunk_walkable_and_zero_hazard(slice_data, plan):
    from validate_world import reconstruct

    walk = reconstruct(plan, "walk")
    hazard = reconstruct(plan, "hazard")
    w = plan["frame"]["w"]
    for contract in slice_data["contracts"].values():
        for cell in contract["immutable_geography"]["required_nav_cells"]:
            i = cell[1] * w + cell[0]
            assert walk[i] == 1, (contract["poi_id"], cell)
            assert hazard[i] == 0, (contract["poi_id"], cell)


def test_obstacles_do_not_block_nav_or_doorways(slice_data):
    for contract in slice_data["contracts"].values():
        geo = contract["immutable_geography"]
        nav = {tuple(c) for c in geo["required_nav_cells"]}
        obstacles = {tuple(c) for ob in geo["static_obstacles"] for c in ob["cells"]}
        assert not (nav & obstacles)
        for ent in geo["entrances"]:
            clear = {tuple(c) for c in ent["clearance_cells"]}
            assert clear <= nav
            assert not (clear & obstacles)
        assert geo["dynamic_spawns"] == []
        assert nav <= {tuple(c) for c in geo["spawn_forbidden_cells"]}
        assert tuple(geo["hero_spawn_cell"]) in {tuple(c) for c in geo["spawn_forbidden_cells"]}


def test_negative_obstacle_intersection_is_rejected(slice_data):
    machine = SliceMachine(slice_data["contracts"], slice_data["handoff"])
    mutated = copy.deepcopy(slice_data["contracts"])
    geo = mutated["poi_crown_waystation"]["immutable_geography"]
    geo["static_obstacles"][0]["cells"] = [geo["required_nav_cells"][0]]
    bad = SliceMachine(mutated, slice_data["handoff"])
    assert machine.apply({"event": "validate_geometry", "poi_id": "poi_crown_waystation"})["result"] == "SUCCESS"
    assert bad.apply({"event": "validate_geometry", "poi_id": "poi_crown_waystation"})["result"] == "REJECTED"


def test_all_authored_vectors_execute(slice_data):
    for vector in slice_data["vectors"]["vectors"]:
        machine = SliceMachine(slice_data["contracts"], slice_data["handoff"])
        for step in vector["steps"]:
            result = machine.apply(step)
            if "expect" in step:
                assert result["result"] == step["expect"], (vector["vector_id"], step, result)
                if "reason" in step:
                    assert result["reason"] == step["reason"], (vector["vector_id"], step, result)
            elif "expect_visibility" in step:
                assert result["visibility"] == step["expect_visibility"], (vector["vector_id"], step, result)


def test_first_hour_vector_grants_bootstrap_and_return(slice_data):
    vector = next(v for v in slice_data["vectors"]["vectors"] if v["vector_id"] == "VS-01")
    machine = SliceMachine(slice_data["contracts"], slice_data["handoff"])
    for step in vector["steps"]:
        assert machine.apply(step)["result"] == step["expect"]
    assert {"cap_salvage", "cap_seal_1", "cap_power_1"} <= set(machine.state["capabilities"])
    assert machine.state["inventory"]["iron_scrap"] >= 1
    assert machine.state["inventory"]["knowledge_spares"] >= 2
    assert machine.state["inventory"]["oak_wood"] >= 1
    assert machine.state["pois"]["poi_crown_relay_shed"]["bus_powered"] is True
    assert machine.state["hero_cell"] == (392, 200)


def test_failed_action_consumes_nothing(slice_data):
    machine = SliceMachine(slice_data["contracts"], slice_data["handoff"])
    machine.apply({"event": "discover", "poi_id": "poi_crown_relay_shed"})
    machine.apply({"event": "set_capabilities", "capabilities": ["cap_salvage"]})
    machine.apply({"event": "set_inventory", "inventory": {"iron_scrap": 2, "oak_wood": 0}})
    result = machine.apply({"event": "request_action", "poi_id": "poi_crown_relay_shed", "action_id": "hand_crank_bypass", "hero_cell": [442, 234]})
    assert result["result"] == "REJECTED"
    assert result["reason"] == "MISSING_ITEM:oak_wood"
    assert machine.state["inventory"] == {"iron_scrap": 2, "oak_wood": 0}
    assert machine.state["journal"] == {}
    assert machine.state["pending"] is None


def test_one_time_reward_not_duplicated_after_reload(slice_data):
    machine = SliceMachine(slice_data["contracts"], slice_data["handoff"])
    machine.apply({"event": "discover", "poi_id": "poi_crown_waystation"})
    machine.apply({"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "pry_locker", "hero_cell": [408, 199]})
    assert machine.apply({"event": "commit"})["result"] == "SUCCESS"
    machine.apply({"event": "reload"})
    again = machine.apply({"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "pry_locker", "hero_cell": [408, 199]})
    assert again["result"] == "ALREADY_APPLIED"
    assert machine.state["capabilities"].count("cap_salvage") == 1


def test_interrupted_pending_is_not_durable(slice_data):
    machine = SliceMachine(slice_data["contracts"], slice_data["handoff"])
    machine.apply({"event": "discover", "poi_id": "poi_crown_waystation"})
    machine.apply({"event": "request_action", "poi_id": "poi_crown_waystation", "action_id": "pry_locker", "hero_cell": [408, 199]})
    machine.apply({"event": "interrupt"})
    machine.apply({"event": "reload"})
    assert machine.state["pois"]["poi_crown_waystation"]["locker_opened"] is False
    assert machine.state["journal"] == {}


def test_filter_shortcut_blocked_but_safe_route_open(slice_data):
    machine = SliceMachine(slice_data["contracts"], slice_data["handoff"])
    blocked = machine.apply({"event": "check_route", "route_id": "rt_east_seam", "capabilities": []})
    assert blocked["result"] == "BLOCKED"
    assert blocked["reason"] == "MISSING_CAPABILITY:cap_filter"
    assert machine.apply({"event": "check_route", "route_id": "rt_crown_safe_approach", "capabilities": []})["result"] == "SUCCESS"


def test_spawn_policy_rejects_hero_and_doorway(slice_data):
    machine = SliceMachine(slice_data["contracts"], slice_data["handoff"])
    assert machine.apply({"event": "spawn_check", "poi_id": "poi_crown_waystation", "cell": [392, 200], "hero_cell": [392, 200]})["reason"] == "SPAWN_ON_HERO"
    assert machine.apply({"event": "spawn_check", "poi_id": "poi_crown_waystation", "cell": [403, 200], "hero_cell": [392, 200]})["reason"] == "SPAWN_BLOCKED_REQUIRED_DOORWAY"
    assert machine.apply({"event": "spawn_check", "poi_id": "poi_crown_relay_shed", "cell": [434, 232], "hero_cell": [392, 200]})["reason"] == "SPAWN_BLOCKED_REQUIRED_DOORWAY"


def test_a6_hidden_projection_leaks_no_private_metadata(slice_data):
    machine = SliceMachine(slice_data["contracts"], slice_data["handoff"])
    hidden = machine.apply({"event": "project_a6", "poi_id": "poi_crown_relay_shed"})
    assert hidden["visibility"] == "HIDDEN"
    assert hidden["clues"] == []
    assert hidden["missing_prerequisite_reasons"] == []
    machine.apply({"event": "discover", "poi_id": "poi_crown_relay_shed"})
    discovered = machine.apply({"event": "project_a6", "poi_id": "poi_crown_relay_shed"})
    assert discovered["visibility"] == "DISCOVERED"
    assert discovered["clues"]


def test_a3_ids_and_renewal_are_exact(slice_data):
    a3 = slice_data["handoff"]["a3"]
    assert set(a3["exact_item_ids"]) == {"iron_scrap", "oak_wood", "knowledge_spares"}
    assert set(a3["exact_source_ids"]) <= {"road_scrap", "road_supplies", "live_oak_wood", "live_iron_scrap"}
    cache = next(a for a in slice_data["contracts"]["poi_crown_waystation"]["actions"] if a["action_id"] == "cache_restock")
    assert cache["one_time"] is False
    assert cache["cooldown_active_seconds"] == 1800
    assert {i["item_id"] for i in cache["reward_items"]} == {"iron_scrap", "knowledge_spares"}
    assert a3["alias_decisions"]["early_roadside_salvage"].startswith("REJECT")
    assert a3["alias_decisions"]["a1_crown_salvage"].startswith("SPLIT")


def test_copper_upgrade_is_deferred_not_enabled(slice_data):
    relay = slice_data["contracts"]["poi_crown_relay_shed"]
    copper = next(a for a in relay["actions"] if a["action_id"] == "copper_upgrade")
    assert copper["enabled"] is False
    assert copper["deferred_reason"] == "ITEM_NOT_IN_A3_CATALOG:copper"
    machine = SliceMachine(slice_data["contracts"], slice_data["handoff"])
    machine.apply({"event": "discover", "poi_id": "poi_crown_relay_shed"})
    result = machine.apply({"event": "request_action", "poi_id": "poi_crown_relay_shed", "action_id": "copper_upgrade", "hero_cell": [443, 238]})
    assert result["result"] == "REJECTED"
    assert result["reason"] == "DEFERRED:ITEM_NOT_IN_A3_CATALOG:copper"


def test_persistence_and_research_firewall(slice_data):
    for contract in slice_data["contracts"].values():
        assert contract["persistence"]["owner"] == "A0"
        assert contract["persistence"]["atomic_commit"] == "SaveService.transact_once"
        assert contract["immutable_geography"]["build_permission_delegation"] == "A0_SURVIVAL_BUILD_VALIDATOR"
    firewall = slice_data["handoff"]["research_firewall"]
    assert firewall["typescript_imported"] is False
    assert firewall["world_regenerated"] is False
    for key in ("prototype_p1_core_world_interactions", "prototype_p2_dynamic_weather", "prototype_p3_physical_cart"):
        assert firewall[key] == "RESEARCH_ONLY_NOT_IMPLEMENTED"


def test_required_adversarial_vectors_present(slice_data):
    ids = {v["vector_id"] for v in slice_data["vectors"]["vectors"]}
    assert {"VS-01", "VS-02", "VS-03", "VS-04", "VS-05", "VS-06", "VS-07"} <= ids
    required = [v for v in slice_data["vectors"]["vectors"] if v["required"]]
    assert len(required) == 7
