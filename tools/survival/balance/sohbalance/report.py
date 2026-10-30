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

from . import access, adversarial, evidence as evidence_module
from . import gate as gate_module
from . import quality as quality_module
from . import routes, sensitivity
from .checks import collect, codes_in
from .findings import Assertion, Finding, severity_counts, sort_findings
from .geo import RouteNetwork, travel_seconds
from .hypotheses import load_hypotheses, patterns as pattern_payloads
from . import blockers as blocker_module
from . import product as product_module
from .identity import binding_adoption, loot_identity_map
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
    "product.json",
    "gate.json",
    "quality.json",
    "blockers.json",
)

# Generated human-readable companion of blockers.json (owned doc path).
BLOCKERS_DOC = Path("docs/survival/balance/PLAYER_BLOCKERS.md")


def _dump(path: Path, payload: Dict[str, Any]) -> str:
    text = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    path.write_text(text, encoding="utf-8")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def build(data_dir: Path = DEFAULT_DATA_DIR, include_upstream: bool = False) -> Dict[str, Any]:
    """Build every artifact.

    ``include_upstream`` is False by default on purpose: whether the upstream A1/A3
    commits happen to be fetched in this checkout is an environment fact, not a
    property of the repository. Artifacts must be reproducible from committed
    bytes alone, so the live drift check is reported by the CLI
    (``run_analysis.py --check-upstream``) and recorded here only as "not part of
    this artifact".
    """
    model = Model.load(data_dir)
    network = RouteNetwork(model.graph_doc)
    hypotheses = load_hypotheses(data_dir / "hypotheses.v1.json")
    tables = tables_from_model(model)
    artifacts: Dict[str, Any] = {}

    # ------------------------------------------------------------ provenance
    snapshots, snapshot_findings = verify_snapshots(data_dir)
    if include_upstream:
        upstream = verify_upstream(snapshots)
    else:
        upstream = {
            "refs": [],
            "findings": [],
            "status": "ENVIRONMENT_DEPENDENT_NOT_IN_ARTIFACT",
            "command": "python3 tools/survival/balance/run_analysis.py --check-upstream",
        }
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
        "upstream_drift_check": upstream["refs"]
        if upstream["refs"]
        else {
            "status": upstream.get("status", "ENVIRONMENT_DEPENDENT_NOT_IN_ARTIFACT"),
            "command": upstream.get("command"),
            "why": (
                "the upstream commits may or may not be fetched in a given checkout; snapshot SHA-256 "
                "verification above is the reproducible check"
            ),
        },
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
    identity_map = loot_identity_map(model)
    artifacts["access.json"]["loot_identity"] = identity_map
    artifacts["access.json"]["loot_identity_legend"] = {
        "source record": "one item-yield row in A3 sources.json (16 of them)",
        "source class": "the kind of container that yields it, e.g. 'roadside_cache' (10 distinct)",
        "physical instance": "a placed copy of a class in the world (A1 authors 0)",
        "region": "A3 names 3 bare regions; A1 publishes 11 'r_*' regions, disjoint vocabularies",
        "poi id": "identifier scheme: A3 'poi:name' vs A1 'poi_name'",
    }
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

    # ------------------------------------------------------- product surface
    repo_root = data_dir.parents[2]
    product_texts, product_manifest = product_module.load_snapshot(repo_root)
    product_facts = product_module.build_facts(
        product_texts,
        product_manifest,
        loot_tables=sorted(model.loot_tables),
        station_ids=sorted(model.stations),
    )
    product_facts.update(product_module.model_facts(model))
    product_checks = product_module.run_checks(product_facts)
    artifacts["product.json"] = {
        "schema": "soh.balance.product.v1",
        "snapshot": {
            "manifest": "data/survival/balance/snapshot/product_manifest.json",
            "a0_head": product_manifest.get("a0_head"),
            "a6_head": product_manifest.get("a6_head"),
            "files_verified": len(product_manifest.get("files", [])),
        },
        "claim_scope": (
            "STATIC READ of pinned bytes. 'Mounted' means a production scene references the file. "
            "Whether it RUNS is NOT_TESTED here."
        ),
        "checks": product_checks,
        "verdict_counts": _counts(check["status"] for check in product_checks),
        "unknown_evidence": product_module.data_gaps(product_facts)["unknown_evidence"],
        "player_surface_facts": {
            "home_destinations": product_facts["home_function_keys"],
            "mounted_player_scene": product_facts["mounted_player_scene"],
            "canonical_avatar_production_refs": product_facts["canonical_avatar_production_refs"],
            "visible_debug_tokens": len(product_facts["visible_debug_tokens"]),
            "survival_ui_scenes_mounted": product_facts["survival_ui_scenes_mounted"],
        },
    }

    # ------------------------------------------------------- integration gate
    evidence_payload = evidence_module.load()
    gate_payload = gate_module.build(
        model,
        product_texts,
        product_facts,
        product_manifest,
        evidence=evidence_payload,
        paths=product_module.path_index(product_manifest),
        tree=product_module.load_tree(product_manifest),
    )
    adoption = binding_adoption(model, gate_payload["contract"])
    gate_payload["binding_adoption"] = adoption
    product_facts["binding_adoption"] = adoption
    artifacts["gate.json"] = gate_payload

    # --------------------------------------------------------- quality checks
    quality_checks = quality_module.run_all(model, product_texts, product_facts, product_manifest)
    quality_counts = _counts(check["status"] for check in quality_checks)
    artifacts["quality.json"] = {
        "schema": "soh.balance.quality.v1",
        "read_this_first": (
            "Seven checks for the ways a half-built feature is mistaken for real gameplay. Every verdict is a "
            "static read of pinned bytes; a PASS means the pinned bytes do not show the defect, not that the "
            "feature runs."
        ),
        "counts": quality_counts,
        "checks": quality_checks,
        "failures": [check for check in quality_checks if check["status"] == "FAIL"],
        "snapshot_heads": {
            "a0": product_manifest.get("a0_head"),
            "a1": product_manifest.get("a1_head"),
            "a6": product_manifest.get("a6_head"),
            "a8": product_manifest.get("a8_head"),
        },
    }

    # -------------------------------------------------- consolidated blockers
    blocker_payload = blocker_module.build(
        [finding.as_dict() for finding in all_findings],
        product_checks,
        {**identity_map, "binding_adoption": adoption},
        product_facts,
        gate_payload=gate_payload,
        quality_payload=artifacts["quality.json"],
    )
    artifacts["blockers.json"] = blocker_payload

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
        product_checks=product_checks,
        blocker_payload=blocker_payload,
        gate_payload=gate_payload,
        quality_payload=artifacts["quality.json"],
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
            "pois_loot_bearing_in_authored_contract": sum(
                1 for poi in model.pois if model.loot_bearing_in_authored_contract(poi)
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
            "player_facing_blockers": len(blocker_payload["blockers"]),
            "closed_by_measurement": blocker_payload["counts"]["closed_blockers"],
            "integration_gate_levels": {
                chain["chain_id"]: chain["chain_level"] for chain in gate_payload["chains"]
            },
            "native_verified": gate_payload["any_native_verified"],
            "binding_adoption": adoption["summary"],
            "quality_checks": quality_counts,
            "observation_reduction": blocker_payload["reduction"],
            "product_checks": _counts(check["status"] for check in product_checks),
            "mounted_survival_ui_scenes": len(product_facts["survival_ui_scenes_mounted"]),
            "canonical_avatar_production_refs": product_facts["canonical_avatar_production_refs"],
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
                "loot_bearing_in_authored_contract": model.loot_bearing_in_authored_contract(poi),
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
    product_checks=None,
    blocker_payload=None,
    gate_payload=None,
    quality_payload=None,
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
            sum(1 for poi in model.pois if model.loot_bearing_in_authored_contract(poi)) == 0
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
    # Corrected hitting time: the old value dropped P(T > 0).  The oracle in
    # tests/survival/balance/test_loot_math.py proves both directions.
    detail = road.expected_claims_to_reach_detail(model.items, "knowledge_spares", 4)
    assertions.append(
        Assertion(
            "A13_expected_claims_includes_the_t0_survival_term",
            detail["method"] == "EXACT_LINEAR_SYSTEM"
            and abs(float(detail["expectation"]) - 3.525289745) < 1e-6,
            "E[T] for 4 knowledge_spares is 3.525289745 claims (was reported as 2.525289745 before the t=0 fix)",
            ["loot", "math_correction"],
        )
    )
    checks = list(product_checks or [])
    assertions.append(
        Assertion(
            "A14_blockers_are_few_owned_and_closable",
            blocker_payload is not None
            and 1 <= len(blocker_payload["blockers"]) <= 5
            and all(row["owner"] and row["closure_test"] for row in blocker_payload["blockers"]),
            "the raw observation list is consolidated into 5 owned blockers, each with an executable closure test",
            ["blockers", "delivery"],
        )
    )
    assertions.append(
        Assertion(
            "A15_product_checks_read_only_pinned_bytes",
            bool(checks)
            and all(check["status"] in {"FAIL", "PASS", "WARN", "UNKNOWN"} for check in checks)
            and any(check["check_id"] == "PROD-01" and check["status"] == "FAIL" for check in checks),
            "the product audit runs on sha256-pinned copies and reproduces the missing survival entry point",
            ["product"],
        )
    )
    gate_payload = gate_payload or {}
    chains = gate_payload.get("chains") or []
    level_names = {level["level"] for level in gate_payload["s_levels"]}
    assertions.append(
        Assertion(
            "A16_gate_separates_source_mount_native_and_visual",
            bool(chains)
            and all(
                link["level"] in level_names
                and link["source_state"] in ("ABSENT", "AUTHORED_ONLY", "SCENE_FIXTURE", "PRODUCTION_SEAM")
                and link["statically_verifiable"] == (link["rank"] <= 3)
                for chain in chains
                for link in chain["links"]
            ),
            "every link reports a source state, a native evidence state and a level; static evidence never exceeds S3",
            ["gate", "delivery"],
        )
    )
    claims = gate_payload.get("entry_claims") or {}
    assertions.append(
        Assertion(
            "A17_entry_claim_A_is_separated_from_B_C_D",
            set(claims) == {
                "A_route_exists_in_source",
                "B_route_runs_in_native_godot",
                "C_content_is_mounted",
                "D_useful_reward_claimable",
            }
            and claims["A_route_exists_in_source"]["state"] == "SOURCE_PRESENT"
            and claims["B_route_runs_in_native_godot"]["level"] != "S4_NATIVE_VERIFIED"
            and claims["C_content_is_mounted"]["state"] == "ABSENT",
            "the normal menu route exists in source, its native run is unverified, and no content is mounted in it",
            ["gate", "entry"],
        )
    )
    seam = gate_payload.get("commit_seam") or {}
    assertions.append(
        Assertion(
            "A18_commit_seam_is_classified_not_substring_matched",
            seam.get("raw_token_occurrences", 0) >= seam.get("mounted_caller_count", 0) > 0
            and seam.get("rejected_count", 0) > 0
            and all(row.get("reason") for row in seam.get("rejected", [])),
            "raw transact_once tokens exceed the mounted callers, and every rejected match carries a reason",
            ["gate", "commit"],
        )
    )
    assertions.append(
        Assertion(
            "A19_native_claims_require_a_green_run_on_the_pinned_commit",
            all(
                row.get("state") != "VERIFIED"
                for row in (gate_payload.get("native_states") or {}).values()
            )
            and not gate_payload.get("any_native_verified"),
            "no pinned head has a verified native run, so no link is reported above S3",
            ["gate", "native"],
        )
    )
    adoption = gate_payload.get("binding_adoption") or {}
    assertions.append(
        Assertion(
            "A20_a1_bindings_adopted_without_any_rate_change",
            adoption.get("rebind_required") == 2
            and adoption.get("rebind_adopted") == 2
            and all(
                row["a1_authorized_yield"] == row["a3_declared_yield"]
                for row in adoption.get("rows", [])
                if row.get("a3_declared_yield") is not None
            ),
            "A3 adopted both instance rebinds with A1's own yields (3 iron_scrap / 2 knowledge_spares) and no rate moved",
            ["gate", "bindings"],
        )
    )
    quality_checks = (quality_payload or {}).get("checks") or []
    assertions.append(
        Assertion(
            "A21_quality_fails_only_the_avatar_and_stale_mirror",
            sorted(check["check_id"] for check in quality_checks if check["status"] == "FAIL") == ["Q-03", "Q-04"],
            "of seven checks only the avatar (Q-04) and the stale A0 catalog mirror (Q-03) fail",
            ["quality"],
        )
    )
    assertions.append(
        Assertion(
            "A22_self_corrections_are_recorded",
            blocker_payload is not None
            and len(blocker_payload.get("corrections", [])) >= 4
            and all(row.get("round3_claim") and row.get("what_is_actually_true") for row in blocker_payload["corrections"]),
            "the five round-3 claims that the owners' source contradicted are recorded with what is actually true",
            ["blockers", "delivery"],
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
    markdown = (artifacts.get("blockers.json") or {}).get("markdown")
    if markdown:
        # Always the repo's owned doc path, never the (possibly temporary) results dir.
        doc = Path(__file__).resolve().parents[4] / BLOCKERS_DOC
        doc.parent.mkdir(parents=True, exist_ok=True)
        doc.write_text(markdown, encoding="utf-8")
    return digests


def load_artifacts(results_dir: Path = RESULTS_DIR) -> Dict[str, Any]:
    return {
        path.stem: json.loads(path.read_text(encoding="utf-8"))
        for path in sorted(results_dir.glob("*.json"))
    }
