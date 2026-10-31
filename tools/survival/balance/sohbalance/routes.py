"""Expedition patterns: travel vs gathering vs interaction, loot, capacity, risk.

Deliberate separations
----------------------
* Movement seconds come from A1 authored polylines at A3's stated walk speed.
* Gathering seconds per claim, POI interaction seconds and search seconds come
  from A3's own ``progression_model.assumptions`` and are labelled as SOH
  design proposals, not measurements.
* Combat, reading, planning, UI and death-recovery time are *not modelled* and
  are reported as UNMODELLED, never as zero.
* A claim is only counted if the claim engine allows it (one-time flags,
  per-session caps, zero-restock non-renewal).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

from .findings import Finding
from .geo import RouteNetwork, travel_seconds
from .loot import LootTable

# A1 authors one ``risk`` field that mixes two different axes: a severity
# (low/high/combat) and a progression band (early/mid/late). They must not be
# silently rank-ordered against each other, so severity and band are separated.
SEVERITY_ORDER = ["low", "medium", "mid", "high", "combat"]
BAND_LABELS = ["early", "mid", "late"]
SEVERITY_ALIASES = {"low": "low", "medium": "medium", "mid": "medium", "high": "high", "combat": "combat"}


def severity_of(risk: str) -> str:
    return SEVERITY_ALIASES.get(risk, "unknown")


def risk_rank(risk: str) -> int:
    """Rank by severity, keeping band-only labels strictly below real severities.

    A band label ("early"/"mid"/"late") says nothing about danger severity, so it
    must never outrank a source that declares "medium" or "high".
    """
    severity = severity_of(risk)
    if severity == "unknown":
        # Unknown severity is treated as worse than a declared "low" (conservative)
        # but never as worse than a declared medium/high/combat.
        return 1
    return {"low": 0, "medium": 2, "high": 3, "combat": 4}[severity]


def band_of(risk: str) -> Optional[str]:
    return risk if risk in BAND_LABELS else None


class ClaimEngine:
    """Enforces the claim policies that already exist in the data.

    One-time rewards are claimed at most once *ever* (across sessions), sources
    with ``replenishment_seconds == 0`` never renew, and per-session caps from
    A3's product sources are respected. Anything blocked is reported with a
    reason so a test can assert an exploit is not simulated away.
    """

    def __init__(self, model) -> None:
        self.model = model
        self.claimed_one_time: Set[str] = set()
        self.claims_this_session: Dict[str, int] = {}

    def start_session(self) -> None:
        self.claims_this_session = {}

    def policy_of(self, source_id: str) -> Dict[str, object]:
        for source in self.model.product_sources():
            if source.get("source_id") == source_id:
                return {
                    "one_time": bool(source.get("one_time")),
                    "max_claims_per_session": source.get("max_claims_per_session"),
                    "restock_active_seconds": source.get("restock_active_seconds"),
                    "kind": "product_source",
                }
        source = self.model.sources.get(source_id)
        if source is not None:
            return {
                "one_time": False,
                "max_claims_per_session": None,
                "restock_active_seconds": source.get("replenishment_seconds"),
                "kind": "catalog_source",
            }
        raise KeyError(f"unknown source {source_id!r}")

    def request(self, source_id: str, times: int = 1) -> Tuple[int, List[Dict[str, object]]]:
        """Return (allowed_claims, blocked_reasons)."""
        policy = self.policy_of(source_id)
        blocked: List[Dict[str, object]] = []
        already = self.claims_this_session.get(source_id, 0)
        allowance = times
        if policy["one_time"]:
            if source_id in self.claimed_one_time:
                blocked.append({"source_id": source_id, "reason": "one_time_already_claimed"})
                allowance = 0
            else:
                allowance = min(allowance, 1)
                if times > 1:
                    blocked.append(
                        {"source_id": source_id, "reason": "one_time_policy_caps_claims", "requested": times}
                    )
        cap = policy.get("max_claims_per_session")
        if isinstance(cap, int) and cap >= 0:
            remaining = max(cap - already, 0)
            if allowance > remaining:
                blocked.append(
                    {
                        "source_id": source_id,
                        "reason": "session_claim_cap",
                        "cap": cap,
                        "already_this_session": already,
                        "requested": times,
                    }
                )
                allowance = remaining
        restock = policy.get("restock_active_seconds")
        if not policy["one_time"] and restock == 0 and allowance > 1:
            # A zero-restock non-one-time source must not be farmed inside a
            # single session without another explicit renewal rule.
            blocked.append(
                {"source_id": source_id, "reason": "zero_restock_not_renewable", "requested": times}
            )
            allowance = min(allowance, 1 + already) - already
            allowance = max(allowance, 0)
        self.claims_this_session[source_id] = already + allowance
        if policy["one_time"] and allowance > 0:
            self.claimed_one_time.add(source_id)
        return allowance, blocked


@dataclass
class Leg:
    start: str
    goal: str
    tiles: float
    seconds: float
    route_ids: Sequence[str]
    risk: str

    def as_dict(self) -> Dict[str, object]:
        return {
            "start": self.start,
            "goal": self.goal,
            "tiles": round(self.tiles, 2),
            "seconds": round(self.seconds, 1),
            "route_ids": list(self.route_ids),
            "risk": self.risk,
        }


@dataclass
class ClaimSpec:
    """One harvesting/looting intent.

    ``kind`` is either ``"material"`` (yields come from the source declaration)
    or ``"container"`` (yields come from a weighted loot table). Nothing in this
    spec invents a yield: both paths read the pinned A3 data.
    """

    source_id: str
    times: int
    poi_id: Optional[str] = None
    table_id: Optional[str] = None
    kind: str = "material"  # "material" | "container"

    @classmethod
    def from_json(cls, payload: Dict[str, object]) -> "ClaimSpec":
        return cls(
            source_id=str(payload["source_id"]),
            times=int(payload.get("times", 1)),
            poi_id=payload.get("poi_id"),  # type: ignore[arg-type]
            table_id=payload.get("table_id"),  # type: ignore[arg-type]
            kind=str(payload.get("kind", "material")),
        )


@dataclass
class PatternSpec:
    pattern_id: str
    label: str
    capabilities: List[str]
    avoid_risks: List[str]
    stops: List[str]
    claims: List[ClaimSpec]
    status: str
    intended_route_ids: List[str] = field(default_factory=list)
    notes: str = ""

    @classmethod
    def from_json(cls, payload: Dict[str, object]) -> "PatternSpec":
        return cls(
            pattern_id=str(payload["pattern_id"]),
            label=str(payload["label"]),
            capabilities=list(payload.get("capabilities", [])),  # type: ignore[arg-type]
            avoid_risks=list(payload.get("avoid_risks", [])),  # type: ignore[arg-type]
            stops=list(payload.get("stops", [])),  # type: ignore[arg-type]
            claims=[ClaimSpec.from_json(claim) for claim in payload.get("claims", [])],  # type: ignore[arg-type]
            status=str(payload.get("status", "HYPOTHESIS")),
            intended_route_ids=list(payload.get("intended_route_ids", [])),  # type: ignore[arg-type]
            notes=str(payload.get("notes", "")),
        )


def _forbidden_routes(network: RouteNetwork, avoid_risks: Iterable[str]) -> Set[str]:
    avoid = {risk for risk in avoid_risks}
    return {
        str(edge.get("route_id"))
        for edge in network.edges
        if str(edge.get("risk")) in avoid
    }


def plan_legs(
    network: RouteNetwork,
    start: str,
    stops: Sequence[str],
    capabilities: Iterable[str],
    avoid_risks: Iterable[str],
    grants: Optional[Dict[str, List[str]]] = None,
) -> Tuple[List[Leg], List[Finding]]:
    """Route through the ordered stops and back to ``start``.

    Capabilities are re-evaluated after every stop, because A1 grants them by
    visiting the POI (e.g. the Relay shed spur itself requires cap_salvage,
    which the Waystation has just taught).
    """
    banned = _forbidden_routes(network, avoid_risks)
    legs: List[Leg] = []
    findings: List[Finding] = []
    cursor = start
    have = set(capabilities)
    for stop in list(stops) + [start]:
        path = network.shortest_path(cursor, stop, have, forbidden_route_ids=banned)
        if path is None:
            findings.append(
                Finding(
                    "ROUTE_UNREACHABLE",
                    "MAJOR",
                    f"{cursor}->{stop}",
                    f"no route with capabilities {sorted(capabilities)} avoiding risks {sorted(avoid_risks)}",
                    "A1",
                )
            )
            return legs, findings
        legs.append(
            Leg(
                start=cursor,
                goal=stop,
                tiles=path.tiles,
                seconds=path.seconds,
                route_ids=path.route_ids,
                risk=path.bottleneck_risk,
            )
        )
        if grants and stop in grants:
            have.update(grants[stop])
        cursor = stop
    return legs, findings


@dataclass
class TripResult:
    pattern_id: str
    label: str
    status: str
    capabilities: List[str]
    legs: List[Leg] = field(default_factory=list)
    claims_allowed: Dict[str, int] = field(default_factory=dict)
    blocked_claims: List[Dict[str, object]] = field(default_factory=list)
    loot_units: Dict[str, float] = field(default_factory=dict)
    loot_slots: int = 0
    capacity_slots: int = 0
    overflow_slots: int = 0
    capacity_findings: List[Finding] = field(default_factory=list)
    travel_seconds: float = 0.0
    gather_seconds: float = 0.0
    interaction_seconds: float = 0.0
    total_seconds: float = 0.0
    session_budget_seconds: float = 0.0
    bottleneck_risk: str = "low"
    death_chance: Optional[float] = 0.0
    death_chance_status: str = "MODELLED_FROM_A3_ASSUMPTION"
    useful_units: float = 0.0
    sinkless_units: float = 0.0
    findings: List[Finding] = field(default_factory=list)

    def as_dict(self) -> Dict[str, object]:
        return {
            "pattern_id": self.pattern_id,
            "label": self.label,
            "status": self.status,
            "capabilities": self.capabilities,
            "legs": [leg.as_dict() for leg in self.legs],
            "travel_seconds": round(self.travel_seconds, 1),
            "travel_tiles": round(sum(leg.tiles for leg in self.legs), 2),
            "gather_seconds": round(self.gather_seconds, 1),
            "interaction_seconds": round(self.interaction_seconds, 1),
            "total_accounted_seconds": round(self.total_seconds, 1),
            "session_budget_seconds": self.session_budget_seconds,
            "unmodelled_time": ["combat", "player reading/planning/deciding", "UI frames", "death and recovery"],
            "claims_allowed": dict(sorted(self.claims_allowed.items())),
            "blocked_claims": self.blocked_claims,
            "loot_units": {item: round(units, 3) for item, units in sorted(self.loot_units.items())},
            "loot_slots": self.loot_slots,
            "capacity_slots": self.capacity_slots,
            "overflow_slots": self.overflow_slots,
            "useful_units": round(self.useful_units, 3),
            "sinkless_units": round(self.sinkless_units, 3),
            "bottleneck_risk": self.bottleneck_risk,
            "bottleneck_risk_severity": severity_of(self.bottleneck_risk),
            "bottleneck_risk_band": band_of(self.bottleneck_risk),
            "death_chance_hypothesis": None if self.death_chance is None else round(self.death_chance, 4),
            "death_chance_status": self.death_chance_status,
            "findings": [finding.as_dict() for finding in self.findings],
        }


def run_pattern(
    model,
    network: RouteNetwork,
    pattern: PatternSpec,
    tables: Dict[str, LootTable],
    engine: Optional[ClaimEngine] = None,
    start: str = "node_refuge",
    session_budget_seconds: float = 2700.0,
) -> TripResult:
    assumptions = model.progression["assumptions"]
    budget = float(session_budget_seconds)
    result = TripResult(
        pattern_id=pattern.pattern_id,
        label=pattern.label,
        status=pattern.status,
        capabilities=sorted(pattern.capabilities),
        session_budget_seconds=budget,
    )
    engine = engine or ClaimEngine(model)

    # An explicit route intent lets the model say "the player tried the
    # shortcut" without pretending the shortcut is passable.
    for route_id in pattern.intended_route_ids:
        required = network.route_capabilities(route_id)
        missing = required - frozenset(pattern.capabilities)
        if missing:
            result.findings.append(
                Finding(
                    "ROUTE_LOCKED_FOR_CAPABILITIES",
                    "MAJOR",
                    f"{pattern.pattern_id}:{route_id}",
                    f"intended route needs {sorted(missing)}; trip falls back to permitted routes",
                    "A1",
                )
            )
        else:
            result.findings.append(
                Finding(
                    "HYPOTHESIS_USED",
                    "INFO",
                    f"{pattern.pattern_id}:{route_id}",
                    "intended route is passable under the stated capabilities",
                    "A7",
                )
            )

    grant_map: Dict[str, List[str]] = {
        poi_id: list(poi.get("grants_capabilities", []) or []) for poi_id, poi in model.poi_index().items()
    }
    legs, leg_findings = plan_legs(
        network, start, pattern.stops, pattern.capabilities, pattern.avoid_risks, grant_map
    )
    result.legs = legs
    result.findings.extend(leg_findings)
    result.travel_seconds = sum(leg.seconds for leg in legs)
    # Trip risk = worst of (route legs, declared source risk). A POI hazard is
    # reported separately: a hazard is a preparation axis, not an automatic
    # multiplier on the whole trip.
    declared_risks = []
    for claim in pattern.claims:
        product = next((p for p in model.product_sources() if p.get("source_id") == claim.source_id), None)
        catalog = model.sources.get(claim.source_id)
        risk = (product or catalog or {}).get("risk")
        if risk:
            declared_risks.append(str(risk))
        if claim.table_id:
            table_payload = model.loot_tables.get(str(claim.table_id)) or {}
            if table_payload.get("risk"):
                declared_risks.append(str(table_payload["risk"]))
    result.bottleneck_risk = max(
        [leg.risk for leg in legs] + declared_risks, key=risk_rank, default="low"
    )

    items = model.items
    gather_per_claim = float(assumptions.get("gather_seconds_per_claim", 6))
    interaction = float(assumptions.get("poi_interaction_seconds", 45))
    search_seconds = float(assumptions.get("search_seconds", 20))

    # Walk the stops in order; capability grants land mid-trip, so a claim is
    # only counted if its own require list is satisfied by then.
    running_caps: Set[str] = set(pattern.capabilities)
    poi_index = model.poi_index()

    def _product(source_id: str) -> Optional[Dict[str, object]]:
        return next((s for s in model.product_sources() if s.get("source_id") == source_id), None)

    order = {stop: index for index, stop in enumerate(pattern.stops)}
    ordered_claims = sorted(
        pattern.claims,
        key=lambda claim: order.get(str(claim.poi_id), -1) if claim.poi_id else -1,
    )
    granted_at: Dict[int, List[str]] = {index: [] for index in range(len(pattern.stops))}
    for claim in ordered_claims:
        position = order.get(str(claim.poi_id), -1) if claim.poi_id else -1
        if position >= 0:
            poi = poi_index.get(str(claim.poi_id))
            if poi:
                granted_at[position].extend(poi.get("grants_capabilities", []) or [])

    claims_by_position: Dict[int, List[ClaimSpec]] = {}
    for claim in ordered_claims:
        position = order.get(str(claim.poi_id), -1) if claim.poi_id else -1
        claims_by_position.setdefault(position, []).append(claim)

    for position in [-1] + list(range(len(pattern.stops))):
        if position >= 0:
            running_caps.update(granted_at.get(position, []))
        for claim in claims_by_position.get(position, []):
            product = _product(claim.source_id)
            required: Set[str] = set((product or {}).get("requires_capabilities", []) or [])  # type: ignore[arg-type]
            catalog = model.sources.get(claim.source_id)
            if catalog is not None:
                for requirement in catalog.get("requirements", []) or []:
                    if requirement.get("kind") == "tool_item":
                        required.add(str(requirement.get("value")))
            missing = required - running_caps
            if missing and (product is not None or catalog is not None):
                result.blocked_claims.append(
                    {
                        "source_id": claim.source_id,
                        "reason": "capability_required",
                        "missing_capabilities": sorted(missing),
                    }
                )
                result.claims_allowed[claim.source_id] = 0
                continue
            allowed, blocked = engine.request(claim.source_id, claim.times)
            result.blocked_claims.extend(blocked)
            result.claims_allowed[claim.source_id] = result.claims_allowed.get(claim.source_id, 0) + allowed
            if allowed <= 0:
                continue
            if claim.kind == "container":
                if catalog is not None:
                    reference = catalog.get("poi")
                    resolved = False
                    if isinstance(reference, str):
                        resolved = reference.split(":", 1)[-1] in model.poi_index()
                    if not resolved:
                        result.findings.append(
                            Finding(
                                "NONE_ELIGIBLE",
                                "INFO",
                                claim.source_id,
                                "loot table source has no placed A1 container; yields below are hypothetical",
                                "A3",
                            )
                        )
                table = tables.get(str(claim.table_id))
                if table is None:
                    result.findings.append(
                        Finding("NONE_ELIGIBLE", "MAJOR", claim.source_id, f"no table {claim.table_id!r}", "A3")
                    )
                    continue
                stats = table.item_stats(items)
                for item_id, row in stats.items():
                    result.loot_units[item_id] = result.loot_units.get(item_id, 0.0) + row["mean"] * allowed
                result.gather_seconds += allowed * search_seconds
            else:
                catalog = model.sources.get(claim.source_id)
                if product is not None and product.get("outputs"):
                    for item_id, units in product["outputs"].items():  # type: ignore[union-attr]
                        result.loot_units[str(item_id)] = (
                            result.loot_units.get(str(item_id), 0.0) + float(units) * allowed
                        )
                elif product is not None and product.get("item_id"):
                    # One physical specimen: expected units = declared discovery
                    # chance x 1. No rate is invented; discovery_chance is A3's.
                    per_claim = product.get("yield_per_claim")
                    if per_claim is None:
                        per_claim = float(product.get("discovery_chance", 1.0))
                    result.loot_units[str(product["item_id"])] = (
                        result.loot_units.get(str(product["item_id"]), 0.0)
                        + float(per_claim) * allowed
                    )
                elif catalog is not None and catalog.get("item_id"):
                    result.loot_units[str(catalog["item_id"])] = (
                        result.loot_units.get(str(catalog["item_id"]), 0.0)
                        + float(catalog.get("yield_per_claim", 0)) * allowed
                    )
                else:
                    result.findings.append(
                        Finding(
                            "NONE_ELIGIBLE",
                            "MAJOR",
                            claim.source_id,
                            "source has no pinned yield declaration; claim cannot be counted",
                            "A3",
                        )
                    )
                result.gather_seconds += allowed * gather_per_claim

    result.interaction_seconds = interaction * len(pattern.stops)
    result.total_seconds = result.travel_seconds + result.gather_seconds + result.interaction_seconds

    result.capacity_slots = int(assumptions.get("bag_slots", 30))
    slots, overflow, capacity_findings = capacity_check(
        result.loot_units, result.capacity_slots, pattern.pattern_id, model
    )
    result.loot_slots = slots
    result.overflow_slots = overflow
    result.capacity_findings.extend(capacity_findings)
    result.findings.extend(capacity_findings)

    # usefulness against authored sinks
    from .loot import sink_demand

    demand = sink_demand(model)
    terminal_kinds = {"skill_core", "equipment", "consumable", "key_item", "station_kit"}
    for item_id, units in result.loot_units.items():
        item = items.get(item_id, {})
        if item_id in demand or str(item.get("kind")) in terminal_kinds:
            result.useful_units += units
        else:
            result.sinkless_units += units
    if result.sinkless_units:
        result.findings.append(
            Finding(
                "HYPOTHESIS_USED",
                "INFO",
                pattern.pattern_id,
                f"{result.sinkless_units:.2f} units have no authored sink",
                "A7",
            )
        )

    # Death probability is applied ONLY when A3's own key set actually covers the
    # label. Band-only labels leave it UNMODELLED instead of assuming zero risk.
    base_death = model.progression["assumptions"].get("base_death_chance", {})
    severity = severity_of(result.bottleneck_risk)
    if severity != "unknown" and severity in base_death:
        result.death_chance = float(base_death[severity])
        result.death_chance_status = "MODELLED_FROM_A3_ASSUMPTION"
    elif result.bottleneck_risk in base_death:
        result.death_chance = float(base_death[result.bottleneck_risk])
        result.death_chance_status = "MODELLED_FROM_A3_ASSUMPTION"
    else:
        result.death_chance = None  # type: ignore[assignment]
        result.death_chance_status = "UNMODELLED_NO_DEATH_MODEL_KEY"
        result.findings.append(
            Finding(
                "DEATH_CARGO_LOSS_UNMODELLED",
                "INFO",
                pattern.pattern_id,
                f"A1 risk label {result.bottleneck_risk!r} has no A3 death-chance key; "
                "expected cargo survival is not computed",
                "A1/A3",
            )
        )
    return result


def capacity_check(
    loot_units: Dict[str, float], bag_slots: int, subject: str, model
) -> Tuple[int, int, List[Finding]]:
    """One slot per distinct item type; unique instances never stack.

    Also refuses to let a unique-instance item exceed one physical unit, which is
    the same rule that stops a save/reload from duplicating a Core specimen.
    """
    findings: List[Finding] = []
    used = 0
    overflow = 0
    for item_id, units in sorted(loot_units.items()):
        if units <= 0:
            continue
        item = model.items.get(item_id, {})
        if str(item.get("storage")) == "instance":
            used += 1
            if units > 1 + 1e-9:
                findings.append(
                    Finding(
                        "UNIQUE_INSTANCE_DUPLICATION_BLOCKED",
                        "MAJOR",
                        f"{subject}:{item_id}",
                        f"unique-instance item modelled at {units:.2f} units; clamped to 1",
                        "A7",
                    )
                )
        else:
            used += 1
            stack_limit = int(item.get("stack_limit", 1) or 1)
            if units > stack_limit:
                extra = -(units // -stack_limit) - 1  # ceil divisions beyond the first slot
                used += int(extra)
    if used > bag_slots:
        overflow = used - bag_slots
        findings.append(
            Finding(
                "CAPACITY_TRUNCATED",
                "MINOR",
                subject,
                f"{used} slots needed, bag holds {bag_slots}",
                "A3",
            )
        )
    return used, overflow, findings
