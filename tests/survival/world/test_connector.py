from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/survival/worldgen"))
import compile_connector as cc  # noqa: E402
import validate_connector as vc  # noqa: E402


@pytest.fixture(scope="module")
def compiled(tmp_path_factory):
    out = tmp_path_factory.mktemp("connector")
    result = cc.compile_all(out, write_contract=False)
    assert result["ok"]
    return out


def test_committed_contract_and_delta_are_deterministic(compiled):
    con = cc.load(cc.CONNECTOR / "canonical_connector.v1.json")
    delta = cc.load(cc.CONNECTOR / "legacy_cell_delta.v1.json")
    legacy_layers = cc.load(cc.LEGACY / "hollow_marches_layers.json")
    legacy_props = cc.load(cc.LEGACY / "hollow_marches_props.json")
    chunk = cc.load(cc.WORLD / cc.ANNEX_PATH)
    cc.check_pins()
    assert con == cc.contract(cc.build_delta(legacy_layers, legacy_props, chunk))
    assert delta == cc.build_delta(legacy_layers, legacy_props, chunk)
    assert con["native_playable"] is False
    assert con["annex"]["imported_chunk_count"] == 1
    assert con["coordinate_frame"]["composed_bounds"] == {"x": 0, "y": 0, "w": 448, "h": 256}


def test_exact_footprint_and_apron_are_not_overclaimed():
    delta = cc.load(cc.CONNECTOR / "legacy_cell_delta.v1.json")
    assert delta["collision_cell_count"] == 46
    assert delta["dressed_cell_count"] == 48
    assert len(delta["prop_suppressions"]) == 14
    cells = {tuple(r["cell"]) for r in delta["cell_deltas"]}
    assert (368, 201) in cells  # native return trace proved this corner must be cleared
    assert (368, 199) in cells and (368, 200) in cells
    for record in delta["cell_deltas"]:
        x, y = record["cell"]
        assert 368 <= x <= 383 and 199 <= y <= 201
        assert record["after"]["solid"] == "."
        if (x, y) in [(368, 199), (368, 200)]:
            assert record["before"]["solid"] == "."
        else:
            assert record["before"]["solid"] != "."
        assert record["after"]["ground"] == "d"
        assert record["after"]["detail"].startswith("=")


def test_protected_legacy_content_is_untouched(compiled):
    legacy = cc.load(cc.LEGACY / "hollow_marches.json")
    world = cc.load(compiled / "annex_world.v1.json")
    assert world["landmarks"] == legacy["landmarks"]
    assert world["camps"] == legacy["camps"]
    assert world["shortcuts"] == legacy["shortcuts"]
    assert world["discoveries"] == legacy["discoveries"]
    delta = cc.load(cc.CONNECTOR / "legacy_cell_delta.v1.json")
    dressed = {tuple(c) for c in delta["road_dressing_cells"]}
    protected = set()
    for lm in legacy["landmarks"]:
        protected.add(tuple(lm["pos"]))
        protected.add(tuple(lm["threshold"]))
    for key in ("camps", "discoveries"):
        protected.update(tuple(item["pos"]) for item in legacy[key])
    for sc in legacy["shortcuts"]:
        protected.add(tuple(sc["pos"]))
        x0, y0, x1, y1 = sc["carve"]
        protected.update((x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1))
    assert not (protected & dressed)


def test_composed_grid_preserves_legacy_outside_mouth_and_fails_closed(compiled):
    legacy_layers = cc.load(cc.LEGACY / "hollow_marches_layers.json")
    layers = cc.load(compiled / "annex_layers.v1.json")
    delta = cc.load(cc.CONNECTOR / "legacy_cell_delta.v1.json")
    lw, lh = legacy_layers["width"], legacy_layers["height"]
    cw, ch = layers["width"], layers["height"]
    old = {n: cc.decode(e["rle"], lw * lh) for n, e in legacy_layers["layers"].items()}
    new = {n: cc.decode(e["rle"], cw * ch) for n, e in layers["layers"].items()}
    dressed = {tuple(c) for c in delta["road_dressing_cells"]}
    changed = set()
    for y in range(lh):
        for x in range(lw):
            if any(old[n][y * lw + x] != new[n][y * cw + x] for n in old):
                changed.add((x, y))
    assert changed == dressed
    for y in range(ch):
        for x in range(384, cw):
            if 192 <= y < 256:
                continue
            assert new["solid"][y * cw + x] != "."
    chunk = cc.load(cc.WORLD / cc.ANNEX_PATH)
    walk = cc.decode(chunk["layers"]["walk"], 64 * 64)
    for ly in range(64):
        for lx in range(64):
            x, y = 384 + lx, 192 + ly
            assert (new["solid"][y * cw + x] != ".") == (walk[ly * 64 + lx] != 1)


def test_canonical_rewards_are_byte_locked():
    way = cc.load(cc.WORLD / "vertical_slice/poi_crown_waystation.slice.json")
    relay = cc.load(cc.WORLD / "vertical_slice/poi_crown_relay_shed.slice.json")
    actions = {a["action_id"]: a for s in (way, relay) for a in s["actions"]}
    items = lambda a: {r["item_id"]: r["quantity"] for r in a.get("reward_items", [])}
    consumes = lambda a: {r["item_id"]: r["quantity"] for r in a.get("consumes_items", [])}
    assert actions["pry_locker"]["grants_capabilities"] == ["cap_salvage"] and items(actions["pry_locker"]) == {}
    assert actions["seal_ledger"]["grants_capabilities"] == ["cap_seal_1"] and items(actions["seal_ledger"]) == {}
    assert items(actions["cache_restock"]) == {"iron_scrap": 3, "knowledge_spares": 2}
    assert actions["cache_restock"]["cooldown_active_seconds"] == 1800
    assert items(actions["gather_deadfall"]) == {"oak_wood": 2}
    assert actions["gather_deadfall"]["cooldown_active_seconds"] == 300
    assert consumes(actions["hand_crank_bypass"]) == {"iron_scrap": 2, "oak_wood": 1}
    assert actions["hand_crank_bypass"]["grants_capabilities"] == ["cap_power_1"]
    assert actions["copper_upgrade"]["enabled"] is False


def test_inverse_delta_restores_legacy_grids_and_props(compiled):
    legacy_layers = cc.load(cc.LEGACY / "hollow_marches_layers.json")
    legacy_props = cc.load(cc.LEGACY / "hollow_marches_props.json")
    layers = cc.load(compiled / "annex_layers.v1.json")
    props = cc.load(compiled / "annex_props.v1.json")
    delta = cc.load(cc.CONNECTOR / "legacy_cell_delta.v1.json")
    lw, lh = legacy_layers["width"], legacy_layers["height"]
    cw = layers["width"]
    restored = {n: cc.decode(e["rle"], cw * layers["height"]) for n, e in layers["layers"].items()}
    for record in delta["cell_deltas"]:
        x, y = record["cell"]
        for name, token in record["before"].items():
            restored[name][y * cw + x] = token
    for name, entry in legacy_layers["layers"].items():
        original = cc.decode(entry["rle"], lw * lh)
        cropped = [restored[name][y * cw + x] for y in range(lh) for x in range(lw)]
        assert cropped == original
    restored_props = list(props["props"])
    for suppression in sorted(delta["prop_suppressions"], key=lambda p: p["index"]):
        original = legacy_props["props"][suppression["index"]]
        restored_props.insert(suppression["index"], original)
    assert restored_props == legacy_props["props"]


def test_source_pin_tamper_fails_closed(monkeypatch):
    original = cc.SOURCE_PINS["a1_chunk_6_3"]["sha256"]
    monkeypatch.setitem(cc.SOURCE_PINS["a1_chunk_6_3"], "sha256", "0" * 64)
    with pytest.raises(ValueError, match="source pin mismatch"):
        cc.check_pins()
    monkeypatch.setitem(cc.SOURCE_PINS["a1_chunk_6_3"], "sha256", original)


def test_validator_gate_passes_and_does_not_claim_native(compiled):
    report = vc.validate(compiled)
    assert report["ok"], report["errors"]
    assert report["source_verified"] is True
    assert report["native_playable"] is False
    assert report["protected_legacy_cells_touched"] == 0
    assert report["canonical_rewards_unchanged"] is True


def test_connector_preserves_ridge_and_points_to_repaired_locker_stand():
    con = cc.load(cc.CONNECTOR / "canonical_connector.v1.json")
    assert con["approach"]["waystation_locker_stand"] == [408, 199]
    assert con["approach"]["waystation_anchor"] == [408, 200]
    cn03 = next(v for v in con["acceptance_vectors"] if v["id"] == "CN-03")
    assert "exact Waystation locker stand (408,199)" in cn03["gate"]
    way = cc.load(cc.WORLD / "vertical_slice/poi_crown_waystation.slice.json")
    ob = next(o for o in way["immutable_geography"]["static_obstacles"] if o["obstacle_id"] == "obs_waystation_locker_bank")
    assert ob["collision_size_px"] == [16, 14] and ob["collision_offset_px"] == [0, -1]
