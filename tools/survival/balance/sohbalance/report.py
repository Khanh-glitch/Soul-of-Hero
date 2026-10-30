"""Assemble the machine-readable artifact set.

Determinism contract: the same snapshots + the same hypothesis file produce
byte-identical JSON. No timestamps, no absolute paths, sorted keys, fixed
rounding. ``tests/survival/balance/test_artifacts_determinism.py`` enforces it.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List

from . import access, adversarial, routes, sensitivity
from .checks import collect, codes_in
from .findings import Assertion, Finding, severity_counts, sort_findings
from .geo import RouteNetwork, travel_seconds
from .hypotheses import load_hypotheses, patterns as pattern_payloads
from .loot import claims_needed, sink_coverage, sink_demand, tables_from_model
from .model import Model
from .provenance import (
    DEFAULT_DATA_DIR,
    REPO_ROOT,
    load_manifest,
    verify_owner_pins,
    verify_snapshots,
    verify_upstream,
)

RESULTS_DIR = DEFAULT_DATA_DIR / "results"
ARTIFACTS = (
    "provenance.json",
    "findings.json",
    "access.json",
    "opportunity.json",
    "sensitivity.json",
    "adversarial.json",
    "summary.json",
)


def _dump(path: Path, payload: Dict[str, Any]) -> str:
    text = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    path.write_text(text, encoding="utf-8")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def build(data_dir: Path = DEFAULT_DATA_DIR) -> Dict[str, Any]:
    model = Model.load(data_dir)
    network = RouteNetwork(model.graph_doc)
    hypotheses = load_hypotheses(data_dir / "hypotheses.v1.json")
    tables = tables_from_model(model)
    artifacts: Dict[str, Any] = {}

    # ------------------------------------------------------------ provenance
    snapshots, snapshot_findings = verify_snapshots(data_dir)
    upstream = verify_upstream(snapshots)
    owner_pins, pin_findings = verify_owner_pins(snapshots, model.adoption)
    manifest = load_manifest(data_dir)
    provenance_findings = sort_findings(snapshot_findings + upstream["findings"] + pin_findings)
    artifacts["provenance.json"] = {
        "schema": "soh.balance.provenance.v1",
        "manifest_pinned_at_utc": manifest.get("pinned_at_utc"),
        "snapshots": [
            {
                "key": snap.key,
                "owner": snap.owner,
                "upstream_ref": snap.upstream_ref,
                "upstream_commit": snap.upstream_commit,
                "upstream_path": snap.upstream_path,
                "sha256": snap.sha256,
                "exists": snap.absolute_path.exists(),
                "verified": snap.absolute_path.exists()
                and snap.absolute_path.read_bytes()
                and hashlib.sha256(snap.absolute_path.read_bytes()).hexdigest() == snap.sha256,
            }
            for snap in snapshots
        ],
        "upstream_drift_check": upstream["refs"],
        "owner_pin_comparison": owner_pins,
        "findings": [finding.as_dict() for finding in provenance_findings],
        "interpretation": (
            "MATCH means the bytes this analysis used are the bytes the owner's commit contains. "
            "SKIPPED_REF_NOT_FETCHED means the check could not be run in this checkout; it is not a pass."
        ),
    }

    # -------------------------------------------------------------- findings
    findings, meta = collect(model, network)
    all_findings: List[Finding] = sort_findings(findings + provenance_findings)
    artifacts["findings.json"] = {
        "schema": "soh.balance.findings.v1",
        "severity_counts": severity_counts(all_findings),
        "codes": codes_in(all_findings),
        "findings": [finding.as_dict() for finding in all_findings],
        "not_claimed": [
            "native gameplay acceptance",
            "human playtest / fun / pacing",
            "A4 Gold attestation or Core usability",
            "any Core drop rate",
            "any adjustment of existing loot tables",
        ],
    }

    # ---------------------------------------------------------------- access
    source_binding_rows = meta["source_bindings"]
    loot_sources = [row for row in source_binding_rows if row["acquisition"] == "loot"]
    artifacts["access.json"] = {
        "schema": "soh.balance.access.v1",
        "source_bindings": source_binding_rows,
        "loot_source_summary": {
            "loot_sources_total": len(loot_sources),
            "loot_sources_with_resolved_a1_poi": sum(1 for row in loot_sources if row["a1_poi_resolved"]),
            "loot_sources_with_resolved_a1_region": sum(1 for row in loot_sources if row["a1_region_resolved"]),
            "loot_sources_unresolved": sorted(row["source_id"] for row in loot_sources if not row["a1_poi_resolved"]),
        },
        "product_sources": meta["product_sources"],
        "product_source_summary": {
            "total": len(meta["product_sources"]),
            "with_resolved_a1_poi": sum(1 for row in meta["product_sources"] if row["a1_poi_resolved"]),
            "route_locked_with_novice_capabilities": sorted(
                row["source_id"] for row in meta["product_sources"] if row["route_locked"]
            ),
            "binding_status_counts": _counts(row["binding_status"] for row in meta["product_sources"]),
        },
        "poi_readiness": _poi_readiness(model),
        "capability_reachability": meta["capability_reachability"],
        "risk_vocabulary": meta["risk_vocabulary"],
        "hazard_mitigation": meta["hazard_mitigation"],
        "mitigation_craft_chain": meta["mitigation_craft_chain"],
        "craft_ladder": meta["craft_ladder"],
        "sink_depth": sink_demand(model),
    }

    # ----------------------------------------------------------- opportunity
    engine = routes.ClaimEngine(model)
    pattern_results: List[Dict[str, Any]] = []
    for payload in pattern_payloads(hypotheses):
        spec = routes.PatternSpec.from_json(payload)
        engine.start_session()
        trip = routes.run_pattern(
            model,
            network,
            spec,
            tables,
            engine,
            session_budget_seconds=float(hypotheses["session"]["active_seconds"]),
        )
        row = trip.as_dict()
        row["notes"] = spec.notes
        row["sink_coverage"] = sink_coverage(model, trip.loot_units)
        row["cargo_survival"] = sensitivity.cargo_survival(
            trip.death_chance,
            hypotheses["death_and_recovery"]["cargo_recovery_probability_values"],
            trip.loot_units,
        )
        pattern_results.append(row)
    artifacts["opportunity.json"] = {
        "schema": "soh.balance.opportunity.v1",
        "session_seconds": hypotheses["session"]["active_seconds"],
        "time_model": {
            "travel": "A1 authored polylines / 96 px per second (A3 assumption)",
            "gather_and_interaction": "A3 progression_model.assumptions (design proposals)",
            "unmodelled": hypotheses["time_model"]["unmodelled"],
        },
        "patterns": pattern_results,
        "trip_budget_sensitivity": sensitivity.trip_budget_sensitivity(
            [row["total_accounted_seconds"] for row in pattern_results]
        ),
        "first_hour_route_reproduction": _first_hour_reproduction(model, network),
    }

    # ----------------------------------------------------------- sensitivity
    road = tables["roadside_cache"]
    artifacts["sensitivity.json"] = {
        "schema": "soh.balance.sensitivity.v1",
        "core_capable_sources": sensitivity.core_capable_sources(model),
        "core_probability_grid": sensitivity.core_probability_grid(hypotheses["core_probability"]),
        "crates_needed_for_confidence": {
            f"p={p}": {
                "n_for_50pct": sensitivity.crates_needed_for_confidence(float(p), 0.5),
                "n_for_90pct": sensitivity.crates_needed_for_confidence(float(p), 0.9),
            }
            for p in hypotheses["core_probability"]["per_container_probabilities"]
        },
        "count_uncertainty": sensitivity.count_uncertainty(hypotheses["core_probability"]),
        "reading_sensitivity": sensitivity.reading_sensitivity(model, road),
        "unlucky_player": sensitivity.unlucky_player(
            model, road, ("knowledge_spares", "research_notes"), 3
        ),
        "seeded_sessions": sensitivity.seeded_sessions(
            model,
            road,
            claims_per_session=3,
            sessions=int(hypotheses["monte_carlo"]["sessions_per_run"]),
            runs=int(hypotheses["monte_carlo"]["runs"]),
            seed=int(hypotheses["monte_carlo"]["seed"]),
        ),
        "research_gate": sensitivity.research_gate_claims(model, road, "tech_smelting"),
        "labels": {
            "hypothetical": sensitivity.HYPOTHETICAL_LABEL,
            "rule": "no authored Core rate exists in the pinned data; grid values are illustrations only",
        },
    }

    # ------------------------------------------------------------ adversarial
    baseline_counts = _counts(finding.code for finding in all_findings)
    cases = adversarial.run_all(model, codes_in(all_findings), baseline_counts)
    artifacts["adversarial.json"] = {
        "schema": "soh.balance.adversarial.v1",
        "cases_total": len(cases),
        "cases_passed": sum(1 for case in cases if case.passed),
        "cases": [case.as_dict() for case in cases],
        "interpretation": (
            "DATA_FAULT cases prove the validator detects a defect rather than only describing clean data. "
            "BEHAVIOUR cases prove the claim model refuses the exploit/edge case instead of averaging it away."
        ),
    }

    # --------------------------------------------------------------- summary
    assertions = _assertions(
        model=model,
        network=network,
        tables=tables,
        pattern_results=pattern_results,
        all_findings=all_findings,
        owner_pins=owner_pins,
        cases=cases,
        road=road,
    )
    artifacts["summary.json"] = {
        "schema": "soh.balance.summary.v1",
        "tool": "A7 independent balance / loot-discovery inspector",
        "status": "ANALYSIS_COMPLETE_NOT_NATIVE_NOT_HUMAN",
        "source_basis": {
            "a1_commit": _commit_for(snapshots, "A1"),
            "a3_commit": _commit_for(snapshots, "A3"),
            "hypothesis_file": "data/survival/balance/hypotheses.v1.json",
        },
        "headline": {
            "pois_authored": len(model.pois),
            "poi_playability": _counts(model.playability(poi) for poi in model.pois),
            "pois_loot_bearing_natively": sum(
                1 for poi in model.pois if model.is_loot_bearing_natively(poi)
            ),
            "loot_tables_authored": len(model.loot_tables),
            "loot_tables_that_can_emit_a_core": sensitivity.core_capable_sources(model)[
                "core_capable_loot_tables"
            ],
            "a3_loot_sources_with_unresolved_a1_poi": len(
                [row for row in loot_sources if not row["a1_poi_resolved"]]
            ),
            "a3_loot_sources_total": len(loot_sources),
            "resource_nodes_authored_not_crates": len(model.resource_nodes),
            "findings_by_severity": severity_counts(all_findings),
            "adversarial_cases_passed": f"{sum(1 for case in cases if case.passed)}/{len(cases)}",
        },
        "assertions": [assertion.as_dict() for assertion in assertions],
        "assertions_all_hold": all(assertion.holds for assertion in assertions),
        "explicit_non_claims": [
            "This is not a playtest and not native gameplay acceptance.",
            "No Core drop rate is derived, chosen or recommended.",
            "No existing loot table or A1/A3 file is modified by this tool.",
            "A1's 118 POIs are authored contracts; 0 of them hand out A3 loot natively today.",
            "A3's 14-session model is a conservation/scenario model, not human pacing evidence.",
            "Gold-blocked Cores remain BLOCKED_PENDING_A4 and are not treated as usable skills.",
        ],
    }
    return artifacts


def _counts(values) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for value in values:
        key = str(value)
        out[key] = out.get(key, 0) + 1
    return {key: out[key] for key in sorted(out)}


def _commit_for(snapshots, owner: str) -> str:
    commits = sorted({snap.upstream_commit for snap in snapshots if snap.owner == owner})
    return commits[0] if len(commits) == 1 else ",".join(commits)


def _poi_readiness(model) -> Dict[str, Any]:
    rows = []
    for poi in model.pois:
        rows.append(
            {
                "poi_id": poi["poi_id"],
                "band": poi.get("band"),
                "archetype": poi.get("archetype"),
                "content_readiness": poi.get("content_readiness"),
                "playability": model.playability(poi),
                "loot_bearing_natively": model.is_loot_bearing_natively(poi),
                "route_node": poi["poi_id"] in model.node_index(),
                "hazard_id": poi.get("hazard_id"),
                "requires": poi.get("required_capabilities", []),
                "grants": poi.get("grants_capabilities", []),
            }
        )
    return {
        "total": len(rows),
        "by_playability": _counts(row["playability"] for row in rows),
        "by_readiness": _counts(row["content_readiness"] for row in rows),
        "without_route_node": sorted(row["poi_id"] for row in rows if not row["route_node"]),
        "rows": rows,
    }


def _first_hour_reproduction(model, network) -> Dict[str, Any]:
    """Recompute A1's own first-hour route length independently."""
    sequence = model.bootstrap["stages"]
    order = ["node_refuge"] + [stage["poi"] for stage in sequence] + ["node_refuge"]
    tiles = 0.0
    legs = []
    have = set()
    for start, goal in zip(order, order[1:]):
        path = network.shortest_path(start, goal, have)
        if path is None:
            legs.append({"start": start, "goal": goal, "tiles": None})
            continue
        tiles += path.tiles
        legs.append({"start": start, "goal": goal, "tiles": round(path.tiles, 2), "route_ids": list(path.route_ids)})
        poi = model.poi_index().get(goal)
        if poi:
            have.update(poi.get("grants_capabilities", []) or [])
    a1_claim = None
    for journey in model.pacing.get("journeys", []) or []:
        text = json.dumps(journey)
        if "first_hour" in text or "novice" in text:
            a1_claim = journey.get("route_length_tiles") or journey.get("tiles") or journey.get("model")
    return {
        "sequence": order,
        "legs": legs,
        "total_tiles": round(tiles, 2),
        "movement_seconds": round(travel_seconds(tiles), 2),
        "a1_published_first_hour_tiles": 1541.72,
        "difference_tiles": round(tiles - 1541.72, 2),
        "difference_note": (
            "A1's own pacing_analysis number is reproduced from the same polylines; a large gap would mean "
            "either the tool or A1's model used different legs."
        ),
        "a1_journey_hint": a1_claim,
    }


def _assertions(
    *,
    model,
    network,
    tables,
    pattern_results,
    all_findings,
    owner_pins,
    cases,
    road,
) -> List[Assertion]:
    assertions: List[Assertion] = []
    counts = {}
    for finding in all_findings:
        counts[finding.code] = counts.get(finding.code, 0) + 1

    stats = road.item_stats(model.items)
    assertions.append(
        Assertion(
            "A01_roadside_expectation_reproduces_review",
            abs(stats["iron_scrap"]["mean"] - 3.6) < 1e-9
            and abs(stats["knowledge_spares"]["mean"] - 1.35) < 1e-9
            and abs(stats["research_notes"]["mean"] - 0.45) < 1e-9
            and abs(stats["grain_seed"]["mean"] - 0.45) < 1e-9,
            "exact per-claim expectation 3.6 scrap / 1.35 spares / 0.45 notes / 0.45 seeds",
            ["loot"],
        )
    )
    assertions.append(
        Assertion(
            "A02_no_authored_core_drop_table",
            sensitivity.core_capable_sources(model)["core_capable_loot_tables"] == 0
            and "core" in set(model.loot_tables["roadside_cache"].get("excluded_tags", [])),
            "no existing table can emit a core-tagged item, and the junk table excludes the tag explicitly",
            ["core"],
        )
    )
    assertions.append(
        Assertion(
            "A03_zero_native_loot_bearing_pois",
            sum(1 for poi in model.pois if model.is_loot_bearing_natively(poi)) == 0
            and len(model.pois) == 118,
            "118 authored POIs, 0 with native A3 loot",
            ["world"],
        )
    )
    assertions.append(
        Assertion(
            "A04_loot_source_pois_unresolved",
            len([f for f in all_findings if f.code == "SOURCE_POI_UNRESOLVED"]) >= 16,
            "all 16 A3 loot sources fail A1 POI resolution",
            ["access"],
        )
    )
    assertions.append(
        Assertion(
            "A05_resource_nodes_not_counted_as_containers",
            len(model.resource_nodes) == 178
            and sensitivity.core_capable_sources(model)["eligible_roadside_containers_today"] == 0,
            "178 resource nodes stay on the harvest axis; eligible roadside containers counted separately = 0",
            ["world"],
        )
    )
    assertions.append(
        Assertion(
            "A06_first_hour_route_reproduced",
            _first_hour_reproduction(model, network)["difference_tiles"] is not None
            and abs(float(_first_hour_reproduction(model, network)["difference_tiles"])) < 1.0,
            "the tool's own route length matches A1's published 1541.72 tiles within 1 tile",
            ["time"],
        )
    )
    assertions.append(
        Assertion(
            "A07_no_capability_self_dependency_in_authored_data",
            counts.get("CAPABILITY_SELF_DEPENDENCY", 0) == 0,
            "no authored capability gate requires the capability it is the only source of",
            ["world"],
        )
    )
    assertions.append(
        Assertion(
            "A08_research_bootstrap_cycle_detected",
            counts.get("BOOTSTRAP_DEPENDENCY_CYCLE", 0) >= 1,
            "knowledge_spares <-> research station cycle is present and reported",
            ["economy"],
        )
    )
    assertions.append(
        Assertion(
            "A09_one_time_claims_not_double_counted",
            all(
                row["claims_allowed"].get("waystation_locker", 0) <= 1 for row in pattern_results
            ),
            "the duplicated locker claim in P1 is blocked by the one-time policy",
            ["claims"],
        )
    )
    assertions.append(
        Assertion(
            "A10_adversarial_suite_complete",
            all(case.passed for case in cases) and len(cases) >= 20,
            f"{sum(1 for case in cases if case.passed)}/{len(cases)} adversarial cases pass",
            ["adversarial"],
        )
    )
    assertions.append(
        Assertion(
            "A11_owner_pins_consistent",
            all(row.get("status") in ("MATCH", "NOT_IN_THIS_SNAPSHOT") for row in owner_pins),
            "A3's pinned A1 hashes agree with the pinned A1 snapshot",
            ["provenance"],
        )
    )
    underprepared = next(
        (row for row in pattern_results if row["pattern_id"] == "P3_UNDERPREPARED_SHORTCUT"), None
    )
    shortcut_locked = bool(underprepared) and any(
        finding["code"] == "ROUTE_LOCKED_FOR_CAPABILITIES" and "rt_east_seam" in finding["subject"]
        for finding in underprepared["findings"]  # type: ignore[index]
    )
    assertions.append(
        Assertion(
            "A12_underprepared_shortcut_not_invented",
            shortcut_locked,
            "the east-seam shortcut is reported as capability-locked, not as an unmitigated crossing",
            ["routes"],
        )
    )
    return assertions


def write(artifacts: Dict[str, Any], results_dir: Path = RESULTS_DIR) -> Dict[str, str]:
    results_dir.mkdir(parents=True, exist_ok=True)
    digests: Dict[str, str] = {}
    for name in ARTIFACTS:
        digests[name] = _dump(results_dir / name, artifacts[name])
    index = {
        "schema": "soh.balance.digest.v1",
        "artifacts": {name: digests[name] for name in sorted(digests)},
        "combined_sha256": hashlib.sha256(
            "".join(digests[name] for name in sorted(digests)).encode("utf-8")
        ).hexdigest(),
        "determinism": "same inputs -> same bytes; sorted keys, no timestamps",
    }
    _dump(results_dir / "digest.json", index)
    return digests


def load_artifacts(results_dir: Path = RESULTS_DIR) -> Dict[str, Any]:
    return {
        path.stem: json.loads(path.read_text(encoding="utf-8"))
        for path in sorted(results_dir.glob("*.json"))
    }
