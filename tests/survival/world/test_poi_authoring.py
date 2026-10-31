"""Truthful POI readiness and two distinct early interaction exemplars."""
from __future__ import annotations

import json

import jsonschema

from validate_world import OUT, validate


def _specs():
    return [json.loads(p.read_text()) for p in sorted((OUT / "poi_authoring").glob("*.v1.json"))]


def test_readiness_counts_are_truthful(plan):
    counts = plan["metrics"]["content_readiness_counts"]
    assert counts == {"WORLD_SITE_CONTRACT_ONLY": 106, "INTERACTION_SPEC_AUTHORED_NOT_NATIVE": 2, "PRESERVED_BASELINE": 10}
    new = [p for p in plan["pois"] if not p["preserved_legacy"]]
    assert len(new) == 108
    assert sum(1 for p in new if p["content_readiness"] == "INTERACTION_SPEC_AUTHORED_NOT_NATIVE") == 2
    assert all(p["content_readiness"] != "NATIVE_ENCOUNTER_IMPLEMENTED" for p in new)


def test_two_early_exemplars_are_distinct_and_actionable():
    specs = _specs()
    assert {s["poi_id"] for s in specs} == {"poi_crown_waystation", "poi_crown_relay_shed"}
    schema = json.loads((OUT / "schemas" / "poi_authoring.schema.json").read_text())
    for s in specs:
        jsonschema.validate(s, schema)
        assert s["native_playable"] is False
        assert s["content_readiness"] == "INTERACTION_SPEC_AUTHORED_NOT_NATIVE"
        assert s["footprint_radius_tiles"] >= 5
        assert s["alternate_approach"] != "rear/climb/boat route where authored; never a fake invisible wall"
        assert s["refresh_policy"] != "outer caches restock; specimen vault one-time until world-state change"
        topo = s["approach_topology"]
        node_ids = {n["id"] for n in topo["nodes"]}
        assert set(topo["retreat_path"]) <= node_ids
        assert topo["retreat_path"][0] != topo["retreat_path"][-1]
        assert any(n["kind"] == "retreat" for n in topo["nodes"])
        action_ids = [a["action_id"] for a in s["world_state_actions"]]
        assert len(action_ids) == len(set(action_ids))
        assert any(a["one_time"] for a in s["world_state_actions"])
        assert {r["owner"] for r in s["interface_requirements"]} == {"A0", "A3", "A6"}
        assert s["persistence"]["save_owner"] == "A0"
        assert s["persistence"]["static_plan_mutation"] is False
    a, b = specs
    assert a["footprint_radius_tiles"] != b["footprint_radius_tiles"]
    assert {x["action_id"] for x in a["world_state_actions"]}.isdisjoint({x["action_id"] for x in b["world_state_actions"]})
    assert a["approach_topology"]["retreat_path"] != b["approach_topology"]["retreat_path"]


def test_relay_first_hour_power_does_not_require_missing_copper():
    relay = next(s for s in _specs() if s["poi_id"] == "poi_crown_relay_shed")
    bypass = next(a for a in relay["world_state_actions"] if a["action_id"] == "hand_crank_bypass")
    assert "copper" not in bypass["consumes"]
    assert bypass["requires_capabilities"] == ["cap_salvage"]
    upgrade = next(a for a in relay["world_state_actions"] if a["action_id"] == "copper_upgrade")
    assert "copper" in upgrade["consumes"]


def test_negative_poi_spec_mutations_fail_schema():
    schema = json.loads((OUT / "schemas" / "poi_authoring.schema.json").read_text())
    base = _specs()[0]
    bad = json.loads(json.dumps(base))
    bad["interface_requirements"] = [r for r in bad["interface_requirements"] if r["owner"] != "A3"]
    try:
        jsonschema.validate(bad, schema); raised = False
    except jsonschema.ValidationError:
        raised = True
    assert raised
    bad2 = json.loads(json.dumps(base))
    bad2["native_playable"] = True
    try:
        jsonschema.validate(bad2, schema); raised2 = False
    except jsonschema.ValidationError:
        raised2 = True
    assert raised2


def test_validator_rejects_missing_spec_ref(plan):
    import copy
    p = copy.deepcopy(plan)
    poi = next(q for q in p["pois"] if q["poi_id"] == "poi_crown_waystation")
    poi["authoring_spec_ref"] = None
    report = validate(p, check_files=False, check_chunks=False)
    assert not report["ok"]
    assert "POI_SPEC_REF" in {e["code"] for e in report["errors"]}
