from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CONTRACT = ROOT / "data/survival/world/a1_world_placement_contract.v1.json"


def test_contract_reviews_existing_a8_ids_without_duplicate_system() -> None:
    contract = json.loads(CONTRACT.read_text())
    a8t = json.loads((ROOT / contract["source_pins"]["a8_territories"]["path"]).read_text())
    a8e = json.loads((ROOT / contract["source_pins"]["a8_endpoints"]["path"]).read_text())
    assert len(contract["territory_reviews"]) == len(a8t["territories"]) == 6
    assert len(contract["endpoint_reviews"]) == len(a8e["endpoints"]) == 4
    assert {x["elder_id"] for x in contract["territory_reviews"]} == {x["elder_id"] for x in a8t["territories"]}
    assert {x["endpoint_id"] for x in contract["endpoint_reviews"]} == {x["endpoint_id"] for x in a8e["endpoints"]}
    assert contract["global_decisions"]["new_poi_count"] == 0
    assert contract["global_decisions"]["new_regions"] == 0
    assert contract["global_decisions"]["fixture_pixels_are_not_world_cells"] is True


def test_compiler_emits_zero_hazard_forward_and_return_native_inputs(tmp_path: Path) -> None:
    out = tmp_path / "placement_native_inputs.json"
    subprocess.run(
        [sys.executable, str(ROOT / "tools/survival/worldgen/compile_placement_review.py"), "--out", str(out)],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    data = json.loads(out.read_text())
    assert len(data["reviews"]) == 10
    assert sum(1 for r in data["reviews"] if r["kind"] == "territory") == 6
    assert sum(1 for r in data["reviews"] if r["kind"] == "endpoint") == 4
    assert sum(r["path_cell_count"] for r in data["reviews"]) == 557
    for row in data["reviews"]:
        assert row["forward_cells"][0] == row["start_cell"]
        assert row["forward_cells"][-1] == row["goal_cell"]
        assert row["return_cells"] == list(reversed(row["forward_cells"]))
        assert row["hazard_exposure_cells"] == 0
        assert row["production_status"] == "AUTHORED_SOURCE_WINDOW_NOT_PRODUCTION_MOUNTED"
        assert row["ground"]["rows"]
        if row["kind"] == "endpoint":
            endpoint = row["endpoint"]
            sx, sy = endpoint["socket_cell"]
            tx, ty = endpoint["stand_cell"]
            assert endpoint["socket_world_px"] == [sx * 16 + 8, sy * 16 + 8]
            assert endpoint["stand_world_px"] == [tx * 16 + 8, ty * 16 + 15]
            assert endpoint["stand_offset_px"] == [0, 39]
            assert endpoint["collision_size_px"] == [28, 28]
            assert endpoint["interaction_radius_px"] == 62
            assert (ty - sy) == 2
            assert endpoint["native_marker_is_final_art"] is False


def test_safe_perimeter_corrections_and_art_rejections_are_explicit() -> None:
    contract = json.loads(CONTRACT.read_text())
    by_id = {x["elder_id"]: x for x in contract["territory_reviews"]}
    assert by_id["elder.ember_forge"]["ordinary_safe_threshold_cell"] == [559, 322]
    assert by_id["elder.verdant_temple"]["ordinary_safe_threshold_cell"] == [633, 660]
    assert by_id["elder.pearl_grotto"]["ordinary_safe_threshold_cell"] == [857, 690]
    for row in contract["endpoint_reviews"]:
        assert row["fixture_position_px_decision"] == "REJECT_AS_WORLD_COORDINATES"
        assert row["placement_decision"] == "APPROVE_RELOCATED_WORLD_SOCKET_FOR_A0_TRIAL"
    art = {x["endpoint_id"]: x["art_review"] for x in contract["endpoint_reviews"]}
    assert "rejected" in art["endpoint.ragnarok.fixed_vendor"]
    assert "rejected" in art["endpoint.ragnarok.recycler"]
    assert "rejected" in art["endpoint.ragnarok.evacuation"]
