"""SURV-050A acceptance tests. Static/data gate, not native Godot gameplay proof."""
from __future__ import annotations

import copy
import json
import math
from collections import defaultdict, deque

import pytest

from validate_world import validate, schema_validate, OUT, ROOT
from baseline import Baseline


def test_masterplan_validator_and_schemas(plan):
    report = validate(plan)
    assert report["ok"], report["errors"]
    sch = schema_validate(plan)
    if sch.get("available"):
        assert all(v == "PASS" for v in sch["results"].values()), sch["results"]
    else:
        pytest.skip("jsonschema not installed; structural validator passed")


def test_exactly_ten_legacy_entrances_preserved(plan):
    legacy = [p for p in plan["pois"] if p["preserved_legacy"]]
    assert len(legacy) == 10
    lock = json.loads((OUT / "baseline_lock.json").read_text())
    base = {l["id"]: l for l in lock["landmarks"]}
    sq = plan["starter_quarter"]
    for p in legacy:
        lid = p["poi_id"].replace("legacy_", "")
        assert lid in base
        assert p["threshold"] == base[lid]["threshold"]
        assert p["cell"] == base[lid]["pos"]
        x, y = p["cell"]
        assert sq["x"] <= x < sq["x"] + sq["w"] and sq["y"] <= y < sq["y"] + sq["h"]
    # fresh-save baseline flood with shortcuts closed still reaches every threshold
    b = Baseline()
    for lm in b.world["landmarks"]:
        tx, ty = lm["threshold"]
        assert b.dist[ty * b.w + tx] >= 0, lm["id"]


def test_physical_accessibility_from_spawn(plan, reach):
    seen, w, h = reach
    for p in plan["pois"]:
        if p["preserved_legacy"]:
            continue
        x, y = p["cell"]
        assert y * w + x in seen, p["poi_id"]
    for n in plan["resource_nodes"]:
        x, y = n["cell"]
        assert y * w + x in seen, n["node_id"]
    for s in plan["legacy_seam_carves"]:
        x0, y0, x1, y1 = s["carve"]
        assert y0 * w + x0 in seen and y1 * w + x1 in seen, s["id"]


def test_resource_distribution_and_causal_sources(plan):
    mats = set(plan["materials"])
    sites = plan["resource_sites"]
    nodes = plan["resource_nodes"]
    assert sites and nodes
    by_region = defaultdict(list)
    for s in sites:
        by_region[s["region_id"]].append(s)
        assert s["placed_count"] > 0
        assert s["cause"]
        assert s["material_key"] in mats
    for r in plan["regions"]:
        assert by_region[r["region_id"]], r["region_id"]
    mat_sites = {s["material_key"] for s in sites}
    for p in plan["pois"]:
        if p["preserved_legacy"]:
            continue
        for m in p["material_keys"]:
            assert m in mats and m in mat_sites, (p["poi_id"], m)
    # novice can reach the opening staple loop without mid/late preparation
    novice = {"cap_salvage", "cap_seal_1", "cap_power_1"}
    early_mats = {s["material_key"] for s in sites if set(s["required_capabilities"]) <= novice}
    assert {"timber", "stone", "iron", "fibre", "salvage"} <= early_mats
    for n in nodes:
        assert n["renewal"]
        assert not (0 <= n["cell"][0] < 384 and 0 <= n["cell"][1] < 256), "no new nodes inside preserved legacy inset"


def test_poi_density_emptiness_and_long_run(plan):
    m = plan["metrics"]
    assert m["new_poi_count"] >= 80
    assert m["empty_space_ratio"] <= 0.05
    assert m["max_distance_to_meaningful_anchor_tiles"] <= 96
    by_region = defaultdict(int)
    for p in plan["pois"]:
        if not p["preserved_legacy"]:
            by_region[p["region_id"]] += 1
    for r in plan["regions"]:
        assert by_region[r["region_id"]] >= 5, r["region_id"]
    assert len(plan["long_run_goals"]) >= 3
    assert sum(1 for p in plan["pois"] if p["band"] == "late" and not p["preserved_legacy"]) >= 20


def test_trunk_route_alternates(plan):
    rg = plan["route_graph"]
    trunk = [e for e in rg["edges"] if e["kind"] == "trunk"]
    hubs = {n["node_id"] for n in rg["nodes"] if n["kind"] == "hub"}
    assert len(trunk) >= 20
    for skip in trunk:
        adj = defaultdict(set)
        for e in trunk:
            if e["route_id"] == skip["route_id"]:
                continue
            adj[e["from"]].add(e["to"]); adj[e["to"]].add(e["from"])
        start = next(iter(hubs)); seen = {start}; q = deque([start])
        while q:
            c = q.popleft()
            for n in adj[c]:
                if n not in seen:
                    seen.add(n); q.append(n)
        assert hubs <= seen, skip["route_id"]
    # late regions expose boat/pass/climb alternates rather than a single level gate
    late = [p for p in plan["pois"] if p["band"] == "late" and not p["preserved_legacy"]]
    assert any(p["alternate_approach"] for p in late)
    assert any(e["mode"] in ("boat", "pass") for e in rg["edges"])


def test_three_counterfactuals(plan):
    m = plan["metrics"]
    # 1. novice finds no value: opening must expose meaningful new POIs/materials
    assert m["capability_access_counts"]["novice"] >= 10
    # 2. midgame bypasses all preparation: late core/specimen vaults must not be mid-open
    mid = {"cap_salvage","cap_seal_1","cap_power_1","cap_thermal","cap_filter","cap_climb","cap_boat","cap_seal_2","cap_stormward"}
    late_core = [p for p in plan["pois"] if p["band"] == "late" and p.get("core_family_contract")]
    assert late_core
    assert all(not set(p["required_capabilities"]) <= mid for p in late_core)
    # 3. endgame has nothing left: post-14d goals and late discovery remain
    assert len([g for g in plan["long_run_goals"] if g.get("after_day_equivalent", g.get("earliest_day", 14)) >= 14]) >= 3
    assert m["capability_access_counts"]["late"] > m["capability_access_counts"]["mid"]


@pytest.mark.parametrize("mutate,code,check_files", [
    (lambda p: p["pois"].append(copy.deepcopy(p["pois"][0])), "DUP_ID", False),
    (lambda p: p["legacy_seam_carves"][0].update(carve=[80, 175, 96, 187]), "SEAM_PROTECTED", True),
    (lambda p: p["rivers"][0].update(vertices=list(reversed(p["rivers"][0]["vertices"]))), "RIVER_UPHILL", False),
    (lambda p: p["resource_nodes"][0].update(site_id="missing_site"), "NODE_ORPHAN", False),
    (lambda p: p["metrics"].update(empty_space_ratio=0.5), "EMPTY_SPACE", False),
    (lambda p: p["metrics"]["capability_access_counts"].update(novice=0), "NOVICE_STARVED", False),
    (lambda p: p.update(long_run_goals=[]), "LONGRUN", False),
    (lambda p: p["chunk_manifest"][0].update(sha256="0" * 64), "CHUNK_HASH", False),
])
def test_negative_mutations_fail_closed(plan, mutate, code, check_files):
    p = copy.deepcopy(plan)
    mutate(p)
    report = validate(p, check_files=check_files, check_chunks=(code == "CHUNK_HASH"))
    assert not report["ok"]
    assert code in {e["code"] for e in report["errors"]}, report["errors"]


def test_legacy_entrance_move_fails_closed(plan):
    p = copy.deepcopy(plan)
    legacy = next(q for q in p["pois"] if q["preserved_legacy"])
    legacy["threshold"] = [0, 0]
    report = validate(p, check_files=True, check_chunks=False)
    assert not report["ok"]
    assert "LEGACY_MOVED" in {e["code"] for e in report["errors"]}


def test_mid_bypass_mutation_fails_closed(plan):
    p = copy.deepcopy(plan)
    core = next(q for q in p["pois"] if q["band"] == "late" and q.get("core_family_contract"))
    core["required_capabilities"] = []
    report = validate(p, check_files=False, check_chunks=False)
    assert not report["ok"]
    assert "MID_BYPASS" in {e["code"] for e in report["errors"]}


def test_route_disconnect_mutation_fails_closed(plan):
    p = copy.deepcopy(plan)
    trunk = [e for e in p["route_graph"]["edges"] if e["kind"] == "trunk"]
    spurs = [e for e in p["route_graph"]["edges"] if e["kind"] != "trunk"]
    p["route_graph"]["edges"] = spurs + trunk[:1]
    report = validate(p, check_files=False, check_chunks=False)
    assert not report["ok"]
    assert "ROUTE_NO_ALT" in {e["code"] for e in report["errors"]}
