from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/survival/worldgen"))
import compile_round11_continuity as compiler

CONTRACT = ROOT / "data/survival/world/a1_round11_continuity_contract.v1.json"


@pytest.fixture(scope="session")
def continuity() -> dict:
    return compiler.build(CONTRACT)


def test_one_exact_source_slice_not_another_poi_catalog(continuity: dict) -> None:
    contract = json.loads(CONTRACT.read_text())
    assert contract["schema"] == "soh.world.a1_round11_continuity.v1"
    assert contract["consumer_slice"]["canonical_poi_ids"] == [
        "poi_crown_south_quarry", "poi_amberwood_mill", "poi_mirrormere_piles"
    ]
    assert contract["consumer_slice"]["new_poi_count"] == 0
    assert contract["consumer_slice"]["new_region_count"] == 0
    assert continuity["production_native_playable"] is False
    assert continuity["reward_items_granted"] == 0
    assert continuity["save_mutation"] is False
    assert continuity["world_plan_sha256"] == compiler.sha_file(ROOT / "data/survival/world/world_plan.v1.json")
    assert len(continuity["route_required_chunk_ids"]) == 20
    assert len(continuity["chunks"]) == 54  # route chunks plus a real one-chunk halo
    for chunk in continuity["chunks"]:
        source = ROOT / chunk["source_path"].removeprefix("res://")
        assert compiler.sha_file(source) == chunk["source_sha256"]
        assert chunk["ground"]["rows"]
        assert len(chunk["ground"]["rows"]) == chunk["size"][1]


def test_multi_region_physical_loop_and_alternative_are_continuous(continuity: dict) -> None:
    ordinary = continuity["ordinary_expedition"]
    deep = continuity["last72_expedition"]
    assert ordinary["future_chest_mounted"] is False
    assert deep["future_chest_mounted"] is True
    assert ordinary["legs"][0]["cells"][0] == [56, 218]
    assert ordinary["legs"][-1]["cells"][-1] == [56, 218]
    assert deep["legs"][0]["cells"][0] == [56, 218]
    assert deep["legs"][-1]["cells"][-1] == [56, 218]
    for journey in (ordinary, deep):
        for previous, following in zip(journey["legs"], journey["legs"][1:]):
            assert previous["cells"][-1] == following["cells"][0]
        for leg in journey["legs"]:
            assert leg["return_cells"] == list(reversed(leg["cells"]))
            assert leg["stats"]["hazard_cells"] == []
            assert leg["stats"]["step_count"] == len(leg["cells"]) - 1
    regions = set().union(*(set(x["stats"]["region_ids"]) for x in ordinary["legs"]))
    assert {"r_ashen_crown", "r_amberwood", "r_mirrormere"} <= regions
    assert sum(x["stats"]["freshwater_marsh_cells"] for x in ordinary["legs"]) > 0
    assert sum(len(x["cells"]) for x in ordinary["legs"]) == 992
    assert sum(len(x["cells"]) for x in deep["legs"]) == 975
    # The future-body route is not just the ordinary route with a chest painted on top.
    assert deep["legs"][-2]["cells"] != ordinary["legs"][1]["cells"]
    chest = continuity["chest_source_proposal"]
    body = compiler.body_from_socket(chest["socket_cell"], chest["collision_size_px"], chest["proposal_id"])
    for leg in deep["legs"]:
        assert all(compiler.hero_clear_of_body(c, [12, 16], body) for c in leg["cells"])


def test_broad_deterministic_spawn_matrix_and_home_links(continuity: dict) -> None:
    spawn = continuity["spawn_safety"]
    assert len(spawn["cases"]) == 18
    assert len({tuple(x["spawn_cell"]) for x in spawn["cases"]}) == 18
    assert {x["zone_id"] for x in spawn["cases"]} == {
        "safe_refuge_meadow", "safe_quarry_rim", "safe_amber_orchard"
    }
    assert [z["safe_cell_count"] for z in spawn["zones"]] == [225, 500, 625]
    assert spawn["production_spawn_approval"] is False
    for case in spawn["cases"]:
        assert case["source"]["walk"] == 1
        assert case["source"]["hazard"] == 0
        assert case["forward_cells"][0] == case["spawn_cell"]
        assert case["forward_cells"][-1] == case["rally_cell"]
        assert case["return_cells"] == list(reversed(case["forward_cells"]))
        assert case["path_stats"]["hazard_cells"] == []
    assert len(spawn["zone_links"]) == 3
    for link in spawn["zone_links"]:
        assert link["forward_cells"][-1] == [56, 218]
        assert link["return_cells"] == list(reversed(link["forward_cells"]))


def test_geographic_hazard_transitions_and_test_only_friction(continuity: dict) -> None:
    fields = continuity["hazard_fields"]
    assert [p["hazard_id"] for p in fields["probes"]] == ["hz_crown_heat", "hz_crown_cold"]
    for probe in fields["probes"]:
        samples = probe["source_samples"]
        assert samples[0]["hazard_id"] is None
        assert samples[1]["hazard_id"] == probe["hazard_id"]
        assert samples[2]["hazard_id"] == probe["hazard_id"]
        assert all(s["walk"] == 1 for s in samples)
        assert probe["return_cells"] == list(reversed(probe["forward_cells"]))
        assert probe["damage_application"] == "A0_NOT_APPLIED"
        assert "unmitigated_hp_per_second" not in probe
    marsh = fields["marsh"]
    assert marsh["test_only_speed_multiplier_proposal"] == 0.65
    assert "A7_INDEPENDENT_MEASUREMENT" in marsh["proposal_status"]
    assert len(marsh["dry_forward_cells"]) == len(marsh["wet_forward_cells"]) == 9
    assert marsh["dry_stats"]["freshwater_marsh_cells"] == 0
    assert marsh["wet_stats"]["freshwater_marsh_cells"] == 8
    assert marsh["retreat_stats"]["hazard_cells"] == []
    assert marsh["damage_application"] == "NONE"
    assert fields["darkness_response"] == "NOT_TESTED"
    assert "NOT_COMPLETED" in fields["D071_weather_cargo_pets"]


def test_exactly_one_separate_sealed_chest_source(continuity: dict) -> None:
    chest = continuity["chest_source_proposal"]
    assert chest["source_class"] == "CHEST_SOURCE"
    assert chest["source_instance_id"] == "si:r_ashen_crown:south_quarry:last72_cache:01"
    assert chest["socket_cell"] == [33, 280]
    assert chest["stand_cell"] == [33, 282]
    assert chest["ordinary_action_socket_cell"] == [30, 280]
    assert chest["ordinary_elder_anchor_cell_unchanged"] == [30, 280]
    assert chest["socket_cell"] != chest["ordinary_action_socket_cell"]
    assert chest["socket_world_px"] == [536, 4488]
    assert chest["stand_world_px"] == [536, 4527]
    assert chest["collision_size_px"] == [28, 28]
    assert chest["interaction_radius_px"] == 62
    assert chest["max_claims_per_run_proposal"] == 1
    assert chest["finite_once_per_run"] is True
    assert chest["interaction_enabled"] is False
    assert chest["reward_items"] == []
    assert chest["drop_chance"] is None and chest["units"] is None and chest["prices"] is None
    assert "PENDING_A3" in chest["authorization"]
    body = compiler.body_from_socket(chest["socket_cell"], chest["collision_size_px"], "chest")
    doorway = chest["a8_doorway_clear_world_rect_px"]
    doorway_center = (doorway[0] + doorway[2] / 2, doorway[1] + doorway[3] / 2)
    assert not compiler.rect_intersects(tuple(body["center_px"]), body["size_px"], doorway_center, doorway[2:])


def test_atomic_migration_and_distinct_visual_references(continuity: dict) -> None:
    migration = continuity["source_manifest_migration"]
    assert migration["decision"] == "NO_BLIND_REPIN_ATOMIC_COHERENT_SET_ONLY"
    assert migration["changed_file_count"] == 6
    assert sum(x["whole_file_match"] for x in migration["files"]) == 3
    assert set(migration["hash_domains"]) == {"whole_file", "payload_subset", "raw_rgba"}
    visuals = continuity["visual_identity_proposals"]
    assert len(visuals) == 4
    by_id = {x["endpoint_id"]: x for x in visuals}
    assert len({x["identity"] for x in visuals}) == 4
    assert "signpost" not in {f["frame"] for f in by_id["endpoint.ragnarok.fixed_vendor"]["frames"]}
    assert "signpost" not in {f["frame"] for f in by_id["endpoint.ragnarok.evacuation"]["frames"]}
    assert "mill_wheel" not in {f["frame"] for f in by_id["endpoint.ragnarok.recycler"]["frames"]}
    assert all("NOT_FINAL" in x["status"] for x in visuals)


def test_compiler_is_deterministic(continuity: dict, tmp_path: Path) -> None:
    first = tmp_path / "first.json"
    second = tmp_path / "second.json"
    command = [sys.executable, str(ROOT / "tools/survival/worldgen/compile_round11_continuity.py")]
    subprocess.run(command + ["--out", str(first)], cwd=ROOT, check=True, capture_output=True, text=True)
    subprocess.run(command + ["--out", str(second)], cwd=ROOT, check=True, capture_output=True, text=True)
    assert first.read_bytes() == second.read_bytes()
    assert json.loads(first.read_text())["source_contract_sha256"] == continuity["source_contract_sha256"]


def test_negative_contracts_fail_closed(tmp_path: Path) -> None:
    source = json.loads(CONTRACT.read_text())
    bad_chest = deepcopy(source)
    bad_chest["chest_source_proposal"]["socket_cell"] = [30, 280]
    path = tmp_path / "bad_chest.json"
    path.write_text(json.dumps(bad_chest))
    with pytest.raises(ValueError, match="ordinary action socket"):
        compiler.build(path)

    bad_reward = deepcopy(source)
    bad_reward["chest_source_proposal"]["reward_items"] = ["ragnarok_unbanked"]
    path = tmp_path / "bad_reward.json"
    path.write_text(json.dumps(bad_reward))
    with pytest.raises(ValueError, match="cannot authorize rewards"):
        compiler.build(path)

    bad_damage = deepcopy(source)
    bad_damage["hazard_fields"]["damage_values_authored_here"] = True
    path = tmp_path / "bad_damage.json"
    path.write_text(json.dumps(bad_damage))
    with pytest.raises(ValueError, match="cannot approve final damage"):
        compiler.build(path)

    bad_spawn = deepcopy(source)
    bad_spawn["spawn_safety"]["zones"][0]["rect_cells"] = [160, 184, 2, 2]
    path = tmp_path / "bad_spawn.json"
    path.write_text(json.dumps(bad_spawn))
    with pytest.raises(ValueError, match="unsafe spawn zone"):
        compiler.build(path)
