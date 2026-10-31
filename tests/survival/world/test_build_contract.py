"""SURV-050A W-01 regression: legacy build=0 delegates to A0, never forbids homes.

The oracle below reproduces the read-only terrain/protected/reach half of A0's
validate_cell for a fresh save. It is a test oracle, not a replacement for the
native paid-construction transaction or live physics occupancy.
"""
from __future__ import annotations

import json

import pytest

from baseline import Baseline
from build_contract import apply_overlay, resolve_build, BUILD_PERMISSION
from validate_world import OUT, load, reconstruct


def a0_terrain_oracle(cell, base: Baseline, player=(56, 218)):
    x, y = cell
    if not (0 <= x < base.w and 0 <= y < base.h):
        return "outside_world"
    i = y * base.w + x
    if base.blocked[i]:
        return "solid_terrain"
    if base.ground[i][:1] in "~bm":
        return "water"
    for lm in base.world["landmarks"]:
        tx, ty = lm["threshold"]
        if abs(x - tx) <= 5 and abs(y - ty) <= 5:
            return "protected_place"
    for camp in base.world["camps"]:
        cx, cy = camp["pos"]
        if abs(x - cx) <= 5 and abs(y - cy) <= 5:
            return "protected_place"
    if base.detail[i][:1] in ("=", "+", ":"):
        return "on_route"
    for short in base.world["shortcuts"]:
        sx, sy = short["pos"]
        if abs(x - sx) <= 4 and abs(y - sy) <= 4:
            return "near_shortcut"
    if max(abs(x - player[0]), abs(y - player[1])) > 6:
        return "out_of_range"
    return ""


@pytest.fixture(scope="module")
def base():
    return Baseline()


@pytest.fixture(scope="module")
def contract():
    return json.loads((OUT / "reader_contract.json").read_text())


def test_legacy_legal_home_cell_delegates_and_allows(plan, contract, base):
    cell = tuple(contract["sample_cells"]["legacy_legal_home"])
    assert a0_terrain_oracle(cell, base) == "", "fixture must be a legal fresh-save A0 home cell"
    w = plan["frame"]["w"]
    i = cell[1] * w + cell[0]
    build = reconstruct(plan, "build")
    perm = reconstruct(plan, "build_permission")
    pres = reconstruct(plan, "preserved")
    assert pres[i] == 1
    assert build[i] == 0, "historical hint is preserved verbatim"
    assert perm[i] == 2, "machine-readable authority delegates to A0"
    calls = []

    def delegate():
        calls.append(cell)
        reason = a0_terrain_oracle(cell, base)
        return {"ok": reason == "", "reason": reason}

    result = resolve_build(perm[i], delegate)
    assert result["decision"] == "allow"
    assert result["authority"] == "a0"
    assert calls == [cell], "A0 validator was actually consulted"
    naive_zero_would_deny = build[i] == 0
    assert naive_zero_would_deny and result["decision"] == "allow", (
        "negative regression: a naive build=0 adapter would forbid a legal home; "
        "the corrected contract delegates and preserves it"
    )


def test_legacy_missing_delegate_is_error_not_deny(plan, contract):
    cell = tuple(contract["sample_cells"]["legacy_legal_home"])
    w = plan["frame"]["w"]
    perm = reconstruct(plan, "build_permission")[cell[1] * w + cell[0]]
    result = resolve_build(perm, None)
    assert result["decision"] == "error"
    assert result["reason"] == "legacy_build_delegate_required"


def test_legacy_protected_and_dynamic_child_veto(plan, contract, base):
    protected = tuple(contract["sample_cells"]["legacy_protected_camp"])
    assert a0_terrain_oracle(protected, base) == "protected_place"
    result = resolve_build(2, lambda: {"ok": False, "reason": "protected_place"})
    assert result["decision"] == "deny" and result["reason"] == "protected_place"
    occupied = resolve_build(2, lambda: {"ok": True, "reason": ""}, dynamic_child_blocked=True)
    assert occupied["decision"] == "deny" and occupied["reason"] == "dynamic_child_occupancy"


def test_new_land_candidate_and_no_build_road(plan, contract):
    w = plan["frame"]["w"]
    perm = reconstruct(plan, "build_permission")
    candidate = tuple(contract["sample_cells"]["new_build_candidate"])
    road = tuple(contract["sample_cells"]["new_road_no_build"])
    cp = perm[candidate[1] * w + candidate[0]]
    rp = perm[road[1] * w + road[0]]
    assert cp == 1 and rp == 0
    assert resolve_build(cp, None)["decision"] == "candidate_not_validated"
    assert resolve_build(cp, lambda: {"ok": True, "reason": ""})["decision"] == "allow"
    assert resolve_build(rp, lambda: {"ok": True, "reason": ""})["decision"] == "deny"
    assert resolve_build(cp, lambda: {"ok": True, "reason": ""}, True)["reason"] == "dynamic_child_occupancy"


def test_overlay_precedence_and_immutability(plan, contract):
    cell = list(contract["sample_cells"]["new_build_candidate"])
    values = {"walk": 1, "road": 0, "build": 1, "build_permission": 1, "preserved": 0}
    overlay = {"source_id": "repair_1", "revision": 1, "cell": cell, "layer": "road", "value": 1, "expected_base": 0}
    result = apply_overlay(values, overlay, preserved=0)
    assert result["ok"] and result["values"]["road"] == 1
    assert result["values"]["build_permission"] == 1, "overlay cannot authorize construction"
    assert apply_overlay(values, overlay, preserved=1)["reason"] == "legacy_overlay_forbidden"
    bad_layer = dict(overlay, layer="build_permission")
    assert apply_overlay(values, bad_layer, preserved=0)["reason"] == "immutable_overlay_layer"
    stale = dict(overlay, expected_base=1)
    assert apply_overlay(values, stale, preserved=0)["reason"] == "stale_overlay_base"
    assert resolve_build(result["values"]["build_permission"], lambda: {"ok": True, "reason": ""})["decision"] == "allow"


def test_reader_contract_matches_plan_and_samples(plan, contract):
    import hashlib
    assert contract["plan_sha256"] == hashlib.sha256((OUT / "world_plan.v1.json").read_bytes()).hexdigest()
    assert contract["required_layers"] == list(BUILD_PERMISSION.keys()) or "build_permission" in contract["required_layers"]
    assert plan["layer_semantics"]["build_permission"]["legacy_inset_value"] == 2
    w = plan["frame"]["w"]
    perm = reconstruct(plan, "build_permission")
    pres = reconstruct(plan, "preserved")
    for name, cell in contract["sample_cells"].items():
        i = cell[1] * w + cell[0]
        if name.startswith("legacy"):
            assert pres[i] == 1 and perm[i] == 2
        elif name == "new_road_no_build":
            assert pres[i] == 0 and perm[i] == 0
        elif name == "new_build_candidate":
            assert pres[i] == 0 and perm[i] == 1
