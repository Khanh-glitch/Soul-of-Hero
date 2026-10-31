from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/survival/worldgen"))
import compile_round12_runtime as compiler
import estimate_round12_native_budget as budget

CONTRACT = compiler.CONTRACT


@pytest.fixture(scope="session")
def native_inputs() -> dict:
    return compiler.build()


def test_full_authored_continent_and_legacy_authority(native_inputs: dict) -> None:
    contract = json.loads(CONTRACT.read_text())
    plan = json.loads((ROOT / "data/survival/world/world_plan.v1.json").read_text())
    assert contract["schema"] == "soh.world.a1_round12_runtime.v1"
    assert native_inputs["world_extents_cells"] == [0, 0, 1024, 768]
    assert native_inputs["tile_px"] == 16
    assert len(plan["chunk_manifest"]) == 192
    assert native_inputs["chunk_cells"] == 64
    assert plan["legacy_inset"]["w"] == 384 and plan["legacy_inset"]["h"] == 256
    assert len(plan["pois"]) == 118 and len(plan["regions"]) == 11
    assert contract["new_poi_count"] == contract["new_region_count"] == 0
    assert contract["reward_items_granted"] == 0 and contract["save_mutation"] is False
    assert native_inputs["production_native_playable"] is False
    assert native_inputs["legacy"]["scope"].startswith("ISOLATED_RUNTIME_SOURCE_COMPOSITION")
    assert len(native_inputs["legacy"]["seam_carves"]) == 2


def test_exact_a8_transforms_and_physical_stands(native_inputs: dict) -> None:
    expected = {
        "quarry": ("poi_crown_south_quarry", [30, 280], [424, 4424], [30, 283]),
        "orchard": ("poi_crown_south_orchard", [140, 360], [2184, 5704], [140, 363]),
        "mill": ("poi_crown_south_mill", [120, 300], [1864, 4744], [120, 303]),
    }
    assert set(native_inputs["physical_sites"]) == set(expected)
    for key, (poi_id, cell, origin, approach) in expected.items():
        site = native_inputs["physical_sites"][key]
        assert site["poi_id"] == poi_id
        assert site["canonical_cell"] == cell
        assert site["shell_origin_world_px"] == origin
        assert site["approach_cell"] == approach
        assert site["shell_bounds_px"] == [128, 128]
        assert site["entry_portal_world_px"] == site["return_anchor_world_px"]
        assert site["production_scene_mounted"] is False
        assert site["fixture_proxy_only"] is True
        assert site["visual_layout"]["doorway_clear_rect_px"] == [44, 92, 40, 36]
        assert all(compiler.hero_clear_of_body(approach, body) for body in site["obstacles"])


def test_broad_spawn_index_is_deterministic_and_non_fixture(native_inputs: dict) -> None:
    spawn = native_inputs["spawn_safety"]
    cases = spawn["cases"]
    assert native_inputs["spawn_index_sha256"] == compiler.sha_file(compiler.SPAWN_INDEX)
    assert spawn["candidate_cells"] >= 20_000
    assert spawn["candidate_chunks"] >= 18
    assert set(spawn["region_counts"]) == {"r_ashen_crown", "r_amberwood", "r_mirrormere"}
    assert len(cases) == 36
    assert len({tuple(case["spawn_cell"]) for case in cases}) == 36
    assert len({case["source"]["chunk_id"] for case in cases}) >= 12
    assert sum(case["native_drive"] for case in cases) == 12
    for case in cases:
        assert case["source"]["walk"] == 1 and case["source"]["hazard"] == 0
        assert case["source"]["preserved"] == 0
        assert case["forward_cells"][0] == case["spawn_cell"]
        assert case["return_cells"] == list(reversed(case["forward_cells"]))
        if case["native_drive"]:
            assert len(case["forward_cells"]) >= 2
        assert case["eligibility"]["material_families"]


def test_routes_are_real_geographic_choices(native_inputs: dict) -> None:
    assert set(native_inputs["route_alternatives"]) == {"quarry", "orchard", "mill"}
    for site, rows in native_inputs["route_alternatives"].items():
        assert len(rows) == 3
        assert len({row["stats"]["cells_sha256"] for row in rows}) == 3
        assert len({row["stats"]["estimated_travel_seconds_at_96"] for row in rows}) == 3
        assert any(row["stats"]["opportunity_node_ids"] != rows[0]["stats"]["opportunity_node_ids"] for row in rows[1:])
        for row in rows:
            assert row["site_key"] == site
            assert row["stats"]["hazard_cells"] == []
            assert row["return_cells"] == list(reversed(row["cells"]))
            assert all(abs(b[0] - a[0]) + abs(b[1] - a[1]) == 1 for a, b in zip(row["cells"], row["cells"][1:]))
    primary = native_inputs["primary_journey"]
    assert primary["waypoints"] == ["home", "salvage", "quarry", "orchard", "mill", "home"]
    assert primary["cells"][0] == primary["cells"][-1] == [56, 218]
    assert primary["teleport_between_legs"] is False
    assert primary["stats"]["hazard_cells"] == []
    assert "salvage" in primary["stats"]["opportunity_materials"]


def test_roadside_sources_keep_identity_collision_and_no_economy(native_inputs: dict) -> None:
    rows = native_inputs["roadside_sources"]
    assert len(rows) == 3
    assert {row["material_key"] for row in rows} == {"salvage"}
    for row in rows:
        assert row["collision"]["blocks_nav"] is True
        assert row["collision_size_px"] == [16, 6]
        assert row["visual_frame"] == "camp_crate"
        assert row["economy_binding"]["reward_items"] is None
        assert row["production_economy_mounted"] is False
        assert compiler.hero_clear_of_body(row["stand_cell"], row["body"])


def test_dynamic_baseline_block_and_reload_detour(native_inputs: dict) -> None:
    fixture = native_inputs["dynamic_fixture"]
    baseline = native_inputs["reload_baseline_journey"]
    detour = native_inputs["reload_journey"]
    base_leg = next(leg for leg in baseline["legs"] if leg["leg_id"] == fixture["baseline_leg_id"])
    detour_leg = next(leg for leg in detour["legs"] if leg["leg_id"] == fixture["detour_leg_id"])
    assert base_leg["cells"] != detour_leg["cells"]
    assert fixture["cell"] in base_leg["cells"]
    assert fixture["cell"] not in detour_leg["cells"]
    assert base_leg["cells"][fixture["baseline_cell_index"]] == fixture["cell"]
    assert fixture["expected_base"] == 1 and fixture["value"] == 0
    assert fixture["source"]["build_permission"] == 1 and fixture["source"]["preserved"] == 0
    assert fixture["collision_size_px"] == [16, 16]
    assert detour_leg["return_cells"] == list(reversed(detour_leg["cells"]))


def test_hazards_and_visual_viewpoints_are_explicit(native_inputs: dict) -> None:
    assert len(native_inputs["hazard_probes"]) == 2
    for probe in native_inputs["hazard_probes"]:
        assert probe["damage_application"] == "A0_NOT_APPLIED"
        assert probe["required_capability"] and probe["clue"]
        assert probe["return_cells"] == list(reversed(probe["forward_cells"]))
        assert probe["source_samples"][0]["hazard"] == 0
        assert all(sample["hazard_id"] == probe["hazard_id"] for sample in probe["source_samples"][1:])
    views = native_inputs["visual_views"]
    assert len(views) == 25
    assert len({view["region_id"] for view in views}) == 11
    assert sum("pair_of" in view for view in views) == 3
    for view in views:
        assert view["render_source"] == "LIVE_STREAMED_CHUNKS_NOT_COMPILED_WINDOW"
        assert view["stand_source"]["walk"] == 1
        assert view["stand_is_safe_spawn"] == (view["stand_source"]["hazard"] == 0)
        if not view["stand_is_safe_spawn"]:
            assert view["hazard_preparation_required"]


def test_compiler_output_is_byte_deterministic(tmp_path: Path) -> None:
    outputs = []
    for index in range(2):
        native = tmp_path / f"native-{index}.json"
        spawn = tmp_path / f"spawn-{index}.json"
        subprocess.run([
            sys.executable, str(ROOT / "tools/survival/worldgen/compile_round12_runtime.py"),
            "--out", str(native), "--spawn-out", str(spawn),
        ], cwd=ROOT, check=True, capture_output=True, text=True)
        outputs.append((native.read_bytes(), spawn.read_bytes()))
    assert outputs[0] == outputs[1]


def test_negative_authority_and_identity_contracts_fail_closed(tmp_path: Path) -> None:
    source = json.loads(CONTRACT.read_text())

    bad_pin = deepcopy(source)
    bad_pin["source_pins"]["world_plan"]["sha256"] = "0" * 64
    path = tmp_path / "bad-pin.json"
    path.write_text(json.dumps(bad_pin))
    with pytest.raises(ValueError, match="source pin mismatch"):
        compiler.RuntimeBuilder(path).validate_sources()

    bad_reward = deepcopy(source)
    bad_reward["reward_items_granted"] = 1
    path = tmp_path / "bad-reward.json"
    path.write_text(json.dumps(bad_reward))
    with pytest.raises(ValueError, match="exceeds authority"):
        compiler.RuntimeBuilder(path).validate_sources()

    bad_save = deepcopy(source)
    bad_save["save_mutation"] = True
    path = tmp_path / "bad-save.json"
    path.write_text(json.dumps(bad_save))
    with pytest.raises(ValueError, match="exceeds authority"):
        compiler.RuntimeBuilder(path).validate_sources()

    bad_a8 = deepcopy(source)
    bad_a8["physical_sites"]["quarry"]["canonical_cell"] = [30, 281]
    path = tmp_path / "bad-a8.json"
    path.write_text(json.dumps(bad_a8))
    with pytest.raises(ValueError, match="A8 canonical identity drift"):
        compiler.RuntimeBuilder(path).validate_sources()


def test_source_queries_reject_nonterrain_and_inset_overlay() -> None:
    builder = compiler.RuntimeBuilder()
    builder.validate_sources()
    assert not builder.source_clear((-1, 0))
    assert not builder.source_clear((1024, 768))
    hazard = native_hazard_cell(builder)
    assert not builder.source_clear(hazard)
    assert builder.source_clear(hazard, allow_hazard=True)


def native_hazard_cell(builder: compiler.RuntimeBuilder) -> tuple[int, int]:
    for cell in [(162, 185), (246, 123)]:
        if builder.source_clear(cell, allow_hazard=True):
            return cell
    raise AssertionError("authored hazard probe missing")


def test_measured_native_budget_uses_real_probe_and_full_work(native_inputs: dict) -> None:
    work = budget.planned_work(native_inputs)
    assert work["drive_cells"] > 2500
    assert work["drive_segments"] == 37
    assert work["expected_block_frames"] == 180
    labels = budget.planned_journey_labels(native_inputs)
    assert len(labels) == len(set(labels)) == 37
    assert "reloaded dynamic detour physical return" in labels
    assert work["captures"] == 69
    probe = {
        "budget_probe": True, "ok": True, "abort": False, "elapsed_seconds": 20.0,
        "dispositions": {"NATIVE_FIXTURE_PASS": "NOT_TESTED"},
        "journeys": [
            {"cells": 32, "frames": 320, "wall_ms": 5000},
            {"cells": 32, "frames": 320, "wall_ms": 5000},
        ],
        "captures": [
            {"capture_wall_ms": 1000, "resolution": [1280, 720]},
            {"capture_wall_ms": 1000, "resolution": [2560, 1440]},
            {"capture_wall_ms": 1000, "resolution": [3840, 2160]},
            {"capture_wall_ms": 1000, "resolution": [1280, 720], "single_resolution_branch": True},
        ],
        "prepare_measurements": [{"wall_ms": 1000}],
    }
    result = budget.estimate(probe, native_inputs)
    assert result["ok"]
    assert result["planned"] == work
    assert result["estimated_full_seconds"] > 100
    assert 300 <= result["timeout_seconds"] <= 1800
    assert result["native_fixture_evidence"] is False


def test_measured_native_budget_rejects_overcap_or_fake_probe(native_inputs: dict) -> None:
    probe = {
        "budget_probe": True, "ok": True, "abort": False, "elapsed_seconds": 2000.0,
        "dispositions": {"NATIVE_FIXTURE_PASS": "NOT_TESTED"},
        "journeys": [
            {"cells": 32, "frames": 320, "wall_ms": 500000},
            {"cells": 32, "frames": 320, "wall_ms": 500000},
        ],
        "captures": [
            {"capture_wall_ms": 100000, "resolution": [1280, 720]},
            {"capture_wall_ms": 100000, "resolution": [2560, 1440]},
            {"capture_wall_ms": 100000, "resolution": [3840, 2160]},
            {"capture_wall_ms": 100000, "resolution": [1280, 720], "single_resolution_branch": True},
        ],
        "prepare_measurements": [{"wall_ms": 100000}],
    }
    result = budget.estimate(probe, native_inputs)
    assert not result["ok"] and "exceeds cap" in result["error"]
    probe["dispositions"]["NATIVE_FIXTURE_PASS"] = "PASS"
    with pytest.raises(ValueError, match="must not claim"):
        budget.estimate(probe, native_inputs)
    probe["dispositions"]["NATIVE_FIXTURE_PASS"] = "NOT_TESTED"
    probe["captures"] = probe["captures"][:3]
    with pytest.raises(ValueError, match="single-resolution branch"):
        budget.estimate(probe, native_inputs)
