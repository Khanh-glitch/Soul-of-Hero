"""First-hour hazard bootstrap: safe preparation, retreat and counterfactuals."""
from __future__ import annotations

import copy
import json
import math

import pytest

import authoring as A
from analyze_pacing import build_graph, hazard_exposure, journey, shortest
from validate_world import OUT, reconstruct


def _sample_polyline(pts, w, h, grid):
    vals = []
    for a, b in zip(pts, pts[1:]):
        length = math.hypot(b[0] - a[0], b[1] - a[1])
        steps = max(1, int(math.ceil(length)))
        for i in range(steps + 1):
            t = i / steps
            x = int(round(a[0] + (b[0] - a[0]) * t))
            y = int(round(a[1] + (b[1] - a[1]) * t))
            if 0 <= x < w and 0 <= y < h:
                vals.append(grid[y * w + x])
    return vals


def test_safe_first_hour_route_has_zero_authored_hazard_exposure(plan):
    w, h = plan["frame"]["w"], plan["frame"]["h"]
    hazard = reconstruct(plan, "hazard")
    walk = reconstruct(plan, "walk")
    edges = {e["route_id"]: e for e in plan["route_graph"]["edges"]}
    safe = edges["rt_crown_safe_approach"]
    assert safe["required_capabilities"] == []
    hz = _sample_polyline(safe["polyline"], w, h, hazard)
    wk = _sample_polyline(safe["polyline"], w, h, walk)
    assert all(v == 0 for v in hz), "safe first-hour approach crosses an authored hazard rect"
    assert all(v == 1 for v in wk), "safe first-hour approach is not walkable"


def test_hazardous_shortcut_is_preserved_and_preparation_gated(plan):
    w = plan["frame"]["w"]
    hazard = reconstruct(plan, "hazard")
    hazard_ids = [h["hazard_id"] for h in plan["hazards"]]
    nodes, pois, sites, adj, edges = build_graph(plan)
    exp = hazard_exposure(edges, ["rt_east_seam"], hazard, hazard_ids, w)
    assert exp.get("hz_crown_heat", {}).get("tiles", 0) > 0
    assert exp.get("hz_crown_rot", {}).get("tiles", 0) > 0
    shortcut = edges["rt_east_seam"]
    assert "cap_filter" in shortcut["required_capabilities"]
    # Hazards were not disabled to make the safe route pass.
    assert plan["hazards"] == list(__import__("compile_plan").A_HAZ.values())


def test_first_hour_journey_grants_salvage_power_filter_and_retreats(plan):
    w = plan["frame"]["w"]
    hazard = reconstruct(plan, "hazard")
    hazard_ids = [h["hazard_id"] for h in plan["hazards"]]
    nodes, pois, sites, adj, edges = build_graph(plan)
    caps_by_poi = {p["poi_id"]: p["grants_capabilities"] for p in plan["pois"]}
    seq = ["node_refuge", "poi_crown_waystation", "poi_crown_relay_shed", "node_refuge", "poi_amberwood_apothecary", "node_refuge"]
    j = journey("first_hour_test", seq, set(), nodes, pois, sites, adj, edges, hazard, hazard_ids, w, caps_by_poi)
    assert j["ok"], j
    assert j["hazard_exposure"] == {}
    granted = {g for row in j["grants"] for g in row["grants"]}
    assert {"cap_salvage", "cap_seal_1", "cap_power_1", "cap_filter"} <= granted
    assert j["sequence"][-1] == "node_refuge"


def test_no_circular_bootstrap_material_requirement(plan):
    site_req = {s["site_id"]: set(s["required_capabilities"]) for s in plan["resource_sites"]}
    mat_sites = {}
    for s in plan["resource_sites"]:
        mat_sites.setdefault(s["material_key"], []).append(s["site_id"])
    for cap, row in A.NOVICE_BOOTSTRAP.items():
        for mat in row["bootstrap_materials"]:
            assert mat_sites.get(mat), f"bootstrap material {mat} has no source"
            for sid in mat_sites[mat]:
                assert cap not in site_req[sid], f"{cap} bootstrap requires itself via {sid}"
    # venom_sac is a sustain/repair material, not the filter bootstrap.
    assert "venom_sac" not in A.NOVICE_BOOTSTRAP["cap_filter"]["bootstrap_materials"]
    assert "venom_sac" in A.NOVICE_BOOTSTRAP["cap_filter"]["sustain_materials"]


def test_counterfactual_removing_safe_route_forces_long_detour_not_hazard(plan):
    w = plan["frame"]["w"]
    hazard = reconstruct(plan, "hazard")
    hazard_ids = [h["hazard_id"] for h in plan["hazards"]]
    nodes, pois, sites, adj, edges = build_graph(plan)
    base = shortest(adj, edges, "node_refuge", "poi_crown_waystation", set())
    assert base["ok"]
    p = copy.deepcopy(plan)
    p["route_graph"]["edges"] = [e for e in p["route_graph"]["edges"] if e["route_id"] != "rt_crown_safe_approach"]
    nodes2, pois2, sites2, adj2, edges2 = build_graph(p)
    cut = shortest(adj2, edges2, "node_refuge", "poi_crown_waystation", set())
    assert cut["ok"], "a long southern fallback should remain; no invisible softlock"
    assert cut["tiles"] > base["tiles"] * 2.0
    assert hazard_exposure(edges2, cut["edges"], hazard, hazard_ids, w) == {}
    assert "rt_east_seam" not in cut["edges"], "novice must not be routed through the filter-gated hazard shortcut"


def test_prepared_player_may_take_hazardous_shortcut(plan):
    w = plan["frame"]["w"]
    hazard = reconstruct(plan, "hazard")
    hazard_ids = [h["hazard_id"] for h in plan["hazards"]]
    nodes, pois, sites, adj, edges = build_graph(plan)
    path = shortest(adj, edges, "node_refuge", "poi_crown_waystation", {"cap_filter"})
    assert path["ok"]
    assert "rt_east_seam" in path["edges"]
    exp = hazard_exposure(edges, path["edges"], hazard, hazard_ids, w)
    assert exp.get("hz_crown_heat", {}).get("tiles", 0) > 0


def test_hazard_damage_contract_is_native_compatible_proposal(plan):
    c = json.loads((OUT / "hazard_damage_contract.json").read_text())
    assert c["schema"] == "soh.world.hazard_damage.v1"
    assert c["native_playable"] is False
    assert c["owner_damage_application"] == "A0"
    assert c["owner_gear_resistance"] == "A3"
    assert c["owner_clues_ui"] == "A6"
    assert c["novice_safe_route"]["max_authored_hazard_tiles"] == 0
    assert {h["hazard_id"] for h in c["hazards"]} == {h["hazard_id"] for h in plan["hazards"]}
    for h in c["hazards"]:
        assert h["unmitigated_hp_per_second_proposal"] > 0
        assert h["mitigation"]["capability"] == h["required_capability"]
        assert h["retreat_rule"]
