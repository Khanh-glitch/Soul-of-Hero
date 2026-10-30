"""One place that collects every finding about a *whole* model.

Both the report and the fault-injection tests call this, so a test can never
pass by checking a different path than the one that produces the artifact.
"""
from __future__ import annotations

from typing import Dict, List, Tuple

from . import access
from .findings import Finding, sort_findings
from .geo import RouteNetwork


def collect(model, network: RouteNetwork) -> Tuple[List[Finding], Dict[str, object]]:
    findings: List[Finding] = []
    meta: Dict[str, object] = {}

    findings.extend(access.audit_integrity(model))

    binding_findings, binding_rows = access.audit_bindings(model, network)
    findings.extend(binding_findings)
    meta["source_bindings"] = binding_rows

    product_findings, product_rows = access.product_source_rows(
        model,
        network,
        capabilities=["cap_salvage", "cap_seal_1", "cap_power_1", "cap_filter"],
    )
    findings.extend(product_findings)
    meta["product_sources"] = product_rows

    findings.extend(access.bootstrap_cycle_findings(model))

    risk_findings, risk_meta = access.risk_vocabulary_findings(model, network)
    findings.extend(risk_findings)
    meta["risk_vocabulary"] = risk_meta

    hazard_findings, hazard_rows = access.hazard_mitigation_matrix(model)
    findings.extend(hazard_findings)
    findings.extend(access.resistance_chain_findings(model, hazard_rows))
    meta["hazard_mitigation"] = hazard_rows
    meta["mitigation_craft_chain"] = access.mitigation_craft_chain(model, hazard_rows)

    findings.extend(access.source_id_divergence(model))
    findings.extend(access.quantity_ownership_findings(model))

    meta["capability_reachability"] = access.capability_reachability(model, network)

    seeds = access.seed_sets(model)
    meta["craft_ladder"] = {label: access.craft_closure(model, seeds[label], label).as_dict() for label in seeds}
    meta["seed_sets"] = seeds

    return sort_findings(findings), meta


def codes_in(findings: List[Finding]) -> List[str]:
    return sorted({finding.code for finding in findings})
