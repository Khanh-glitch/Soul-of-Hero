"""SURV-050A pacing audit is an estimate, not a playtime claim."""
from __future__ import annotations

import json

from validate_world import OUT


def test_pacing_analysis_present_and_bounded():
    path = OUT / "pacing_analysis.json"
    assert path.exists(), "run tools/survival/worldgen/analyze_pacing.py before pytest"
    report = json.loads(path.read_text())
    assert report["schema"] == "soh.world.pacing_analysis.v1"
    assert report["status"] == "AUTHORED_ESTIMATE_NOT_PLAYTESTED"
    assert report["playtime_claim"] == "NOT_TESTED"
    assert report["combat_crafting_gathering_seconds"] == "NOT_TESTED"
    assert all(j.get("ok") for j in report["journeys"]), report["journeys"]
    early = next(j for j in report["journeys"] if j["journey"] == "early_legacy_home")
    assert early["cost"] == {"oak_wood": 36, "iron_scrap": 2}
    assert len(early["node_visits"]) == 7
    assert early["gather_hits_total"] == 20
    # Capability bootstrap grants are actually modeled, not assumed.
    grants = {g["poi"] for j in report["journeys"] for g in j.get("grants", [])}
    assert {"poi_crown_waystation", "poi_amberwood_apothecary", "poi_ember_piton_works",
            "poi_frost_wardhouse", "poi_saffron_drydock", "poi_pearl_customs",
            "poi_verdant_root_lift"} <= grants
    assert all(g["reachable_with_late_caps"] for g in report["post_14d_goals"])
    assert all(a["alternate_exists"] for a in report["alternate_route_detours"])
    assert len(report["outpost_logistics"]) == 15
    cf = report["novice_hazard_counterfactual"]
    assert cf["first_hour_journey_ok"] is True
    assert cf["first_hour_hazard_exposure"] == {}
    assert cf["no_circular_bootstrap"] is True
    assert cf["safe_first_hour_route"]["exposure"] == {}
    assert cf["hazardous_shortcut"]["exposure"]["hz_crown_heat"]["tiles"] > 0
    assert cf["hazardous_shortcut"]["exposure"]["hz_crown_rot"]["tiles"] > 0
