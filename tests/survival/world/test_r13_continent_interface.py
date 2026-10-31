"""R13 source contract checks; native/production claims are deliberately separate."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct

import pytest

import compile_r13_continent_interface as compiler
import validate_r13_continent_seam as native_validator


ROOT = compiler.ROOT
MANIFEST = compiler.OUTPUT
EXPECTED_ANCHORS = {"quarry": [30, 280], "orchard": [140, 360], "mill": [120, 300]}


@pytest.fixture(scope="module")
def built() -> dict:
    return compiler.build()


def test_committed_manifest_is_exact_deterministic_output(built: dict) -> None:
    assert MANIFEST.read_bytes() == compiler.json_bytes(built)
    assert MANIFEST.read_bytes() == compiler.json_bytes(compiler.build())
    assert json.loads(MANIFEST.read_text())["schema"] == compiler.SCHEMA


def test_world_transform_and_chunk_contract(built: dict) -> None:
    world = built["world"]
    assert world["world_id"] == "world:soh_continent_v1"
    assert world["geography_instance_id"] == "continent:soh_continent_v1"
    assert world["cell_size_px"] == [16, 16]
    assert world["cell_origin_px"] == [0, 0]
    assert world["world_size_cells"] == [1024, 768]
    assert world["world_size_px"] == [16384, 12288]
    assert world["chunk_cells"] == [64, 64]
    assert world["chunk_size_px"] == [1024, 1024]
    assert world["chunk_grid"] == [16, 12]
    assert world["chunk_count"] == 192
    assert world["axes"] == {"x": "EAST_RIGHT", "y": "SOUTH_DOWN"}
    assert "HALF_OPEN" in world["cell_bounds"]
    assert "x*16+8,y*16+15" in world["actor_origin"]
    plan = json.loads((ROOT / "data/survival/world/world_plan.v1.json").read_text())
    assert len(plan["chunk_manifest"]) == 192
    for entry in plan["chunk_manifest"]:
        x, y = entry["origin"]
        assert entry["chunk_id"] == f"chunk:{x // 64}:{y // 64}"


def test_exact_a8_anchors_sockets_identity_and_sources(built: dict) -> None:
    assert set(built["sites"]) == set(EXPECTED_ANCHORS)
    for key, anchor in EXPECTED_ANCHORS.items():
        site = built["sites"][key]
        identity = site["instance_identity"]
        assert site["canonical_cell"] == anchor
        assert identity["world_id"] == built["world"]["world_id"]
        assert identity["site_instance_id"].startswith("world:soh_continent_v1/site:")
        assert identity["run_local_identity_owner"] == "A0"
        assert identity["run_id"] is None
        assert site["physical_approach"]["cell"] == [anchor[0], anchor[1] + 3]
        assert site["retreat_target"]["cell"] == [anchor[0], anchor[1] + 9]
        assert site["physical_approach"]["actor_origin_px"] == [anchor[0] * 16 + 8.0, (anchor[1] + 3) * 16 + 15.0]
        assert site["retreat_target"]["actor_origin_px"] == [anchor[0] * 16 + 8.0, (anchor[1] + 9) * 16 + 15.0]
        expected_origin = [anchor[0] * 16 + 8 - 64, anchor[1] * 16 + 8 - 64]
        assert site["shell"]["origin_world_px"] == expected_origin
        assert site["shell"]["bounds_px"] == [128, 128]
        assert site["shell"]["scale"] == [1, 1]
        assert site["shell"]["rotation_degrees"] == 0
        assert site["door_target"]["world_px"] == [expected_origin[0] + 64, expected_origin[1] + 108]
        assert site["return_anchor"]["world_target_px"] == site["door_target"]["world_px"]
        assert site["required_inputs"] == compiler.REQUIRED_INPUTS
        reference = site["source_reference"]
        assert hashlib.sha256((ROOT / reference["path"]).read_bytes()).hexdigest() == reference["sha256"]
        source = json.loads((ROOT / reference["path"]).read_text())
        assert source["source"]["canonical_cell"] == anchor
        assert source["overworld_shell"]["scene"] == site["shell"]["scene"]
        assert source["local_transition"]["return_anchor"]["canonical_cell"] == anchor


def test_collision_exclusions_and_source_reachability_are_real(built: dict) -> None:
    expected_counts = {"quarry": 5, "orchard": 7, "mill": 8}
    for key, site in built["sites"].items():
        collision = site["collision"]
        assert collision["body_size_px"] == [12, 16]
        assert collision["body_offset_px"] == [0, -8]
        assert len(collision["exclusions"]) == expected_counts[key]
        assert sum(row["kind"] == "shell_boundary" for row in collision["exclusions"]) == 5
        assert all(row["authority"] == "A8_SCENE_ALREADY_OWNS_BODY_DO_NOT_DUPLICATE"
                   for row in collision["exclusions"])
        for target, flag in ((site["physical_approach"]["actor_origin_px"], "approach_body_clear"),
                             (site["door_target"]["world_px"], "door_body_clear"),
                             (site["retreat_target"]["actor_origin_px"], "retreat_body_clear")):
            center = [target[0], target[1] - 8]
            for body in collision["exclusions"]:
                x, y, w, h = body["rect_px"]
                separated = (center[0] + 6 <= x or center[0] - 6 >= x + w or
                             center[1] + 8 <= y or center[1] - 8 >= y + h)
                assert separated, (key, flag, body)
            assert collision[flag] is True
        reach = site["reachability"]
        assert reach["from_home_cell"] == [56, 218]
        assert reach["home_to_approach"]["cell_count"] > 1
        assert reach["approach_to_retreat"]["cell_count"] == 7
        for evidence in (reach["home_to_approach"], reach["approach_to_retreat"]):
            assert len(evidence["sha256"]) == 64
            assert evidence["cells_published"] is False
        assert reach["safe_source_component_cells"] > 400000
        assert "NOT_NATIVE_OR_PRODUCTION" in reach["kind"]


def test_spawn_contract_is_broad_deterministic_and_not_three_zones(built: dict) -> None:
    spawn = built["spawn"]
    index = json.loads(compiler.SPAWN_INDEX.read_text())
    assert spawn["candidate_cells"] == index["candidate_cells"] == 27445
    assert spawn["candidate_chunks"] == index["candidate_chunks"]
    assert spawn["candidate_cells"] >= 20000
    assert spawn["candidate_chunks"] >= 18
    assert len(spawn["region_counts"]) >= 3
    assert spawn["production_spawn_approval"] is False
    assert spawn["criteria"] == index["criteria"]
    assert spawn["candidate_evidence"].startswith("PINNED_ROUND12_INDEX_REGENERATED_BYTE_FOR_BYTE")
    assert "COMPILER_SQUARE_WINDOW" in spawn["opportunity_distance_metric"]
    assert "no fixed spawn rectangles or seed%3 zone picker" in spawn["criteria"]["rules"]
    chunks = {row["chunk_id"]: row for row in index["chunks"]}
    selected = []
    for seed in (1103 + i * 7919 for i in range(36)):
        digest = hashlib.sha256(f"{built['world']['world_id']}|{seed}|round12-spawn-v1".encode()).digest()
        chunk = index["chunks"][int.from_bytes(digest[:8], "big") % len(index["chunks"])]
        local = chunk["cells"][int.from_bytes(digest[8:16], "big") % len(chunk["cells"])]
        selected.append((chunk["chunk_id"], local))
    assert len(set(selected)) >= 30
    assert len({chunk for chunk, _ in selected}) >= 12
    for chunk_id, local in selected:
        assert local in chunks[chunk_id]["cells"]


def test_consumer_sample_has_no_fixture_or_owner_authority_dependency(built: dict) -> None:
    sample = (ROOT / "game/survival/world/a1_continent_consumer_sample.gd").read_text()
    for forbidden in ("tests/", "native_inputs", "round12", "SaveService", "reward_items", "fixture"):
        assert forbidden not in sample
    assert "choose_safe_spawn" in sample
    assert "acquire_for_actor" in sample
    assert "continent.site" in sample
    interface = (ROOT / "game/survival/world/a1_continent_interface.gd").read_text()
    for method in ("cell_to_world", "world_to_cell", "chunk_for_cell", "acquire_for_actor",
                   "release_chunks", "sample_cell", "physics_sample_cell", "build_eligibility",
                   "choose_safe_spawn", "validate_spawn_cell", "site"):
        assert f"func {method}(" in interface
    for forbidden in ("SaveService", "reward_items_granted =", "global_position ="):
        assert forbidden not in interface
    assert built["runtime"]["mutable_runtime_policy"] == "SEMANTIC_INTERFACE_ONLY; no A0/A6/Knight byte pins"
    observed = set(json.loads(compiler.CONTRACT.read_text())["runtime_interfaces"]["observed_paths"].values())
    pinned = {row["path"] for row in built["source_pins"].values()}
    assert pinned.isdisjoint(observed)


def test_scope_remains_source_ready_not_production(built: dict) -> None:
    assert built["status"] == "SOURCE_READY_NOT_PRODUCTION_MOUNTED"
    assert built["production"] == {
        "production_mounted": False,
        "player_playable": False,
        "visually_accepted": False,
        "a8_interior_or_loot_accepted": False,
        "d051_visual_accepted": False,
        "save_mutation_authorized": False,
        "reward_items_granted": 0,
    }
    for site in built["sites"].values():
        assert site["production_scene_mounted"] is False
        assert site["interior_or_loot_accepted"] is False
        assert site["reachability"]["native_evidence"] == "PENDING_EXACT_HEAD_R13_NATIVE_REPORT"


def test_native_validator_accepts_complete_synthetic_evidence(built: dict, tmp_path: Path,
                                                               monkeypatch: pytest.MonkeyPatch) -> None:
    """Exercise every validator branch without pretending this is native evidence."""
    sizes: dict[Path, list[int]] = {}
    captures = []
    for view in native_validator.VIEWS:
        for width, height in native_validator.RESOLUTIONS:
            path = tmp_path / f"{view}_{width}x{height}.png"
            path.write_bytes(f"native-test:{view}:{width}".encode())
            sizes[path] = [width, height]
            captures.append({
                "view_id": view, "path": str(path), "resolution": [width, height],
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "camera_zoom": [1, 1],
                "render_scale": 1, "logical_viewport": [640, 360], "world_id": "world:soh_continent_v1",
                "region_id": "r_mirrormere" if view == "region_transition" else "r_ashen_crown",
                "biome_id": "freshwater_marsh" if view == "region_transition" else "temperate_mixed",
                "surface_id": "marsh" if view == "region_transition" else "grass",
                "visual_acceptance": "NOT_TESTED", "production_frame": False,
                "sample_unique_colors": 12, "sample_luminance_range": 0.5,
                "time_of_day": 0.82 if view.endswith("night") else 0.35,
                "source_visual": {"night_factor": 0.8 if view.endswith("night") else 0.0},
            })
    monkeypatch.setattr(native_validator, "png_size", lambda path: sizes[path])
    arrivals = []
    for key, site in built["sites"].items():
        arrivals.append({
            "site_key": key, "canonical_cell": site["canonical_cell"],
            "approach_cell": site["physical_approach"]["cell"], "door_target": site["door_target"]["world_px"],
            "retreat_cell": site["retreat_target"]["cell"],
            "site_instance_id": site["instance_identity"]["site_instance_id"],
            "real_a8_scene": site["shell"]["scene"], "approach_ok": True, "door_ok": True,
            "return_ok": True, "interior_entered": False, "production_scene_mounted": False,
        })
    spawns = [{"cell": [i, i + 1], "chunk_id": f"chunk:{i % 12}:0",
               "region_id": f"region:{i % 3}", "minimum_material_families": 2,
               "index_verified": True, "deterministic": True} for i in range(36)]
    controls = [{"id": key, "pass": True, "refused": True, "actual": actual,
                 "contacts": 1 if key == "blocked_terrain" else 0}
                for key, actual in native_validator.NEGATIVES.items()]
    report = {
        "ok": True, "abort": False, "input_bootstrap_initialized": True, "consumer_sample_used": True,
        "consumer_sample_path": "res://game/survival/world/a1_continent_consumer_sample.gd",
        "godot_version": {"string": "4.7.stable.official.5b4e0cb0f"}, "checks": 200,
        "source_report": {"ok": True, "interface_ready": True, "verified_chunks": 192},
        "interface_manifest_sha256": hashlib.sha256(MANIFEST.read_bytes()).hexdigest(),
        "spawn_results": spawns, "site_arrivals": arrivals,
        "journeys": [{"ok": True, "input_driven": True, "position_writes": 0, "production_mount": False}] * 20,
        "travel_position_writes": 0, "teleport_violations": [], "stream_violations": [],
        "unexpected_contacts": [], "max_hero_step_px": 1.0,
        "region_transitions": [{"from": "r_ashen_crown", "to": "r_mirrormere",
                                "from_biome_id": "temperate_mixed", "to_biome_id": "freshwater_marsh",
                                "from_surface_id": "grass", "to_surface_id": "marsh",
                                "from_world_id": "world:soh_continent_v1", "world_id": "world:soh_continent_v1"}],
        "chunk_transitions": [{"from": "chunk:2:5", "to": "chunk:2:6"}],
        "negative_controls": controls, "captures": captures,
        "dispositions": {"SOURCE_INTERFACE_READY": "PASS", "COMPOSED_NATIVE_SEAM": "PASS",
                         "PRODUCTION_MOUNTED": "NOT_TESTED", "PLAYER_PLAYABLE": "NOT_TESTED",
                         "VISUALLY_ACCEPTED": "NOT_TESTED", "D051_VISUALLY_ACCEPTED": "NOT_TESTED",
                         "A8_INTERIOR_OR_LOOT_ACCEPTED": "NOT_TESTED"},
        "production_save_mutation": False, "reward_items_granted": 0,
        "production_A8_interior_entered": False, "production_D051_visual_accepted": False,
    }
    checks = native_validator.validate(report, built, ROOT, False)
    assert not [row for row in checks if not row["ok"]], [row for row in checks if not row["ok"]]


def test_native_validator_png_header_and_incomplete_matrix(tmp_path: Path, built: dict) -> None:
    path = tmp_path / "header.png"
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", 17, 19))
    assert native_validator.png_size(path) == [17, 19]
    checks = native_validator.validate({"captures": []}, built, ROOT, False)
    assert any(row["name"] == "capture_matrix_complete" and not row["ok"] for row in checks)
    assert any(row["name"] == "completed_native_ok" and not row["ok"] for row in checks)
