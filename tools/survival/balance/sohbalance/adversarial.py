"""Adversarial cases: prove the analysis actually detects what it claims to.

Two kinds of case:

``DATA_FAULT``
    A deliberate corruption is injected into an in-memory deep copy of the
    pinned snapshots, and the validator must report the matching finding code.
    The real snapshot files are never written to.

``BEHAVIOUR``
    A player-side edge case (no route, no eligible crate, repeated claim,
    reload, bag overflow, death, unlucky rolls) is executed through the same
    code path the report uses, and the observed behaviour is compared with what
    the report is allowed to claim.

Each case records whether the code also appears in the unmutated baseline, so a
real finding is never confused with an injected one.
"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Sequence

from . import access, routes, sensitivity
from .checks import collect
from .findings import CODES, Finding
from .geo import RouteNetwork
from .loot import tables_from_model
from .model import Model


@dataclass
class CaseResult:
    case_id: str
    kind: str
    description: str
    expected_codes: List[str]
    observed_codes: List[str]
    passed: bool
    detail: str = ""
    also_in_baseline: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, object]:
        return {
            "case_id": self.case_id,
            "kind": self.kind,
            "description": self.description,
            "expected_codes": self.expected_codes,
            "observed_codes": self.observed_codes,
            "also_in_baseline": self.also_in_baseline,
            "passed": self.passed,
            "detail": self.detail,
        }


# --------------------------------------------------------------- data faults
def _mutate_drop_loot_item(docs: Dict[str, object]) -> None:
    table = docs["a3.loot_tables"]["tables"]["roadside_cache"]
    table["entries"].append({"item_id": "phantom_relic", "weight": 5, "quantity": [1, 1]})


def _mutate_core_into_roadside(docs: Dict[str, object]) -> None:
    table = docs["a3.loot_tables"]["tables"]["roadside_cache"]
    table["entries"].append({"item_id": "core_ember", "weight": 5, "quantity": [1, 1]})


def _mutate_degenerate_table(docs: Dict[str, object]) -> None:
    table = docs["a3.loot_tables"]["tables"]["roadside_cache"]
    for entry in table["entries"]:
        entry["weight"] = 0


def _mutate_inverted_quantity(docs: Dict[str, object]) -> None:
    table = docs["a3.loot_tables"]["tables"]["roadside_cache"]
    table["entries"][0]["quantity"] = [5, 1]


def _mutate_zero_rolls(docs: Dict[str, object]) -> None:
    docs["a3.loot_tables"]["tables"]["roadside_cache"]["rolls"] = 0


def _mutate_source_unknown_item(docs: Dict[str, object]) -> None:
    docs["a3.sources"]["sources"]["live_oak_wood"]["item_id"] = "phantom_wood"


def _mutate_item_orphan_source(docs: Dict[str, object]) -> None:
    docs["a3.items"]["items"]["oak_wood"]["source_ids"].append("ghost_source")


def _mutate_recipe_unknown_item(docs: Dict[str, object]) -> None:
    docs["a3.recipes"]["recipes"]["burn_charcoal"]["inputs"]["phantom_input"] = 1


def _mutate_recipe_unknown_station(docs: Dict[str, object]) -> None:
    docs["a3.recipes"]["recipes"]["burn_charcoal"]["station"] = "phantom_station"


def _mutate_capability_self_dependency(docs: Dict[str, object]) -> None:
    for poi in docs["a1.world_plan"]["pois"]:
        if poi["poi_id"] == "poi_crown_waystation":
            poi["required_capabilities"] = ["cap_salvage"]


def _mutate_unreachable_edge(docs: Dict[str, object]) -> None:
    # Cut every edge into the quarry by demanding a capability A1 never grants.
    for edge in docs["a1.poi_route_graph"]["route_graph"]["edges"]:
        if edge["to"] == "poi_crown_quarry" or edge["from"] == "poi_crown_quarry":
            edge["required_capabilities"] = ["cap_nonexistent"]


def _mutate_invent_a1_quantities(docs: Dict[str, object]) -> None:
    # A1's authored reward starts carrying numbers it never authored.
    for reward in docs["a1.waystation_spec"]["rewards"]:
        if reward.get("reward_id") == "locker_reward":
            reward["quantities"] = {"knowledge_spares": 5}


DATA_FAULTS: List[Dict[str, object]] = [
    {
        "case_id": "D01_absent_source_item",
        "description": "loot table gains an entry whose item does not exist",
        "mutate": _mutate_drop_loot_item,
        "codes": ["LOOT_ITEM_UNKNOWN"],
    },
    {
        "case_id": "D02_core_in_roadside_junk",
        "description": "a Core-tagged unique item is injected into the roadside junk table",
        "mutate": _mutate_core_into_roadside,
        "codes": ["LOOT_EXCLUDED_TAG_VIOLATION"],
    },
    {
        "case_id": "D03_zero_weight_table",
        "description": "every entry weight is zeroed",
        "mutate": _mutate_degenerate_table,
        "codes": ["LOOT_TABLE_DEGENERATE"],
    },
    {
        "case_id": "D04_inverted_quantity",
        "description": "quantity range runs backwards",
        "mutate": _mutate_inverted_quantity,
        "codes": ["LOOT_QUANTITY_RANGE_INVALID"],
    },
    {
        "case_id": "D05_zero_rolls",
        "description": "table declares zero rolls",
        "mutate": _mutate_zero_rolls,
        "codes": ["LOOT_ROLLS_INVALID"],
    },
    {
        "case_id": "D06_source_item_unknown",
        "description": "a live source points at a nonexistent item",
        "mutate": _mutate_source_unknown_item,
        "codes": ["SOURCE_ITEM_UNKNOWN"],
    },
    {
        "case_id": "D07_item_orphan_source",
        "description": "an item claims a source that does not exist",
        "mutate": _mutate_item_orphan_source,
        "codes": ["ITEM_ORPHAN_SOURCE"],
    },
    {
        "case_id": "D08_recipe_unknown_item",
        "description": "a recipe consumes a nonexistent item",
        "mutate": _mutate_recipe_unknown_item,
        "codes": ["RECIPE_ITEM_UNKNOWN"],
    },
    {
        "case_id": "D09_recipe_unknown_station",
        "description": "a recipe references a station that does not exist",
        "mutate": _mutate_recipe_unknown_station,
        "codes": ["RECIPE_UNKNOWN_STATION"],
    },
    {
        "case_id": "D10_capability_self_dependency",
        "description": "the only POI granting cap_salvage also requires cap_salvage",
        "mutate": _mutate_capability_self_dependency,
        "codes": ["CAPABILITY_SELF_DEPENDENCY"],
    },
    {
        "case_id": "D11_inaccessible_site",
        "description": "every edge into the quarry demands a capability that is never granted",
        "mutate": _mutate_unreachable_edge,
        "codes": ["POI_ROUTE_UNREACHABLE", "ROUTE_UNREACHABLE", "ROUTE_LOCKED_FOR_CAPABILITIES"],
        "allow_any": True,
    },
    {
        "case_id": "D12_invented_a1_quantity",
        "description": "A1's authored reward gains a quantity it never authored",
        "mutate": _mutate_invent_a1_quantities,
        "codes": ["QUANTITY_OWNERSHIP_UNRESOLVED"],
        "expect_delta": {"QUANTITY_OWNERSHIP_UNRESOLVED": 1},
    },
]


def run_data_faults(
    model: Model, baseline_codes: Sequence[str], baseline_counts: Optional[Dict[str, int]] = None
) -> List[CaseResult]:
    baseline_counts = dict(baseline_counts or {})
    results: List[CaseResult] = []
    for case in DATA_FAULTS:
        docs = copy.deepcopy(model.docs)
        case["mutate"](docs)  # type: ignore[operator]
        try:
            mutated = Model.from_docs(docs)
            network = RouteNetwork(mutated.graph_doc)
            findings, _meta = collect(mutated, network)
            observed = sorted({finding.code for finding in findings})
            counts: Dict[str, int] = {}
            for finding in findings:
                counts[finding.code] = counts.get(finding.code, 0) + 1
        except Exception as error:  # a validator that crashes is a failed case
            results.append(
                CaseResult(
                    case_id=str(case["case_id"]),
                    kind="DATA_FAULT",
                    description=str(case["description"]),
                    expected_codes=list(case["codes"]),  # type: ignore[arg-type]
                    observed_codes=[],
                    passed=False,
                    detail=f"validator raised {type(error).__name__}: {error}",
                )
            )
            continue
        expected = list(case["codes"])  # type: ignore[arg-type]
        if case.get("allow_any"):
            passed = any(code in observed for code in expected)
        else:
            passed = all(code in observed for code in expected)
        for code, delta in (case.get("expect_delta") or {}).items():  # type: ignore[union-attr]
            if counts.get(code, 0) < baseline_counts.get(code, 0) + int(delta):
                passed = False
        results.append(
            CaseResult(
                case_id=str(case["case_id"]),
                kind="DATA_FAULT",
                description=str(case["description"]),
                expected_codes=expected,
                observed_codes=[code for code in observed if code in expected],
                passed=passed,
                detail="all expected codes present" if passed else "expected code missing",
                also_in_baseline=[code for code in expected if code in baseline_codes],
            )
        )
    return results


# ------------------------------------------------------------ behaviour cases
def run_behaviour_cases(model: Model, network: RouteNetwork) -> List[CaseResult]:
    results: List[CaseResult] = []
    tables = tables_from_model(model)

    # B01 - no route at all under an impossible capability set
    path = network.shortest_path("node_refuge", "poi_verdant_canopy_temple", [])
    results.append(
        CaseResult(
            case_id="B01_no_route_returns_none",
            kind="BEHAVIOUR",
            description="a trip that needs capabilities the actor lacks yields no path, not a fake path",
            expected_codes=["ROUTE_UNREACHABLE"],
            observed_codes=["ROUTE_UNREACHABLE"] if path is None else [],
            passed=path is None,
            detail="no capability-permitting path -> None" if path is None else f"unexpected path {path}",
        )
    )

    # B02 - zero eligible containers
    empty_model = Model.from_docs(copy.deepcopy(model.docs))
    empty_model.docs["a3.loot_tables"]["tables"]["roadside_cache"]["entries"] = []
    empty_tables = tables_from_model(empty_model)
    empty_stats = empty_tables["roadside_cache"].item_stats(empty_model.items)
    results.append(
        CaseResult(
            case_id="B02_zero_eligible_containers",
            kind="BEHAVIOUR",
            description="a table with no legal entries yields zero loot and does not crash",
            expected_codes=[],
            observed_codes=[],
            passed=not empty_stats,
            detail="empty claim distribution handled without raising",
        )
    )

    # B03 - repeated one-time claim
    engine = routes.ClaimEngine(model)
    engine.start_session()
    first, _ = engine.request("waystation_locker", 1)
    second, blocked = engine.request("waystation_locker", 1)
    results.append(
        CaseResult(
            case_id="B03_repeated_one_time_claim",
            kind="BEHAVIOUR",
            description="a one-time locker reward cannot be claimed twice",
            expected_codes=["REPEATED_ONE_TIME_CLAIM_BLOCKED"],
            observed_codes=["REPEATED_ONE_TIME_CLAIM_BLOCKED"] if second == 0 else [],
            passed=first == 1 and second == 0,
            detail=f"first={first} second={second} reasons={[b['reason'] for b in blocked]}",
        )
    )

    # B04 - reload / new session must not re-grant a one-time flag
    engine.start_session()
    again, blocked_again = engine.request("waystation_locker", 1)
    results.append(
        CaseResult(
            case_id="B04_reload_does_not_regrant",
            kind="BEHAVIOUR",
            description="starting a new session (reload) does not re-grant a one-time reward",
            expected_codes=["REPEATED_ONE_TIME_CLAIM_BLOCKED"],
            observed_codes=["REPEATED_ONE_TIME_CLAIM_BLOCKED"] if again == 0 else [],
            passed=again == 0,
            detail=f"after reload allowed={again} reasons={[b['reason'] for b in blocked_again]}",
        )
    )

    # B05 - per-session claim cap
    engine = routes.ClaimEngine(model)
    engine.start_session()
    allowed, blocked_cap = engine.request("a1_crown_salvage", 5)
    results.append(
        CaseResult(
            case_id="B05_session_claim_cap",
            kind="BEHAVIOUR",
            description="a source capped at one claim per session cannot be farmed",
            expected_codes=[],
            observed_codes=[],
            passed=allowed <= 1,
            detail=f"allowed={allowed} reasons={[b['reason'] for b in blocked_cap]}",
        )
    )

    # B06 - a non-one-time source with zero restock must not be farmed in-session
    zero_docs = copy.deepcopy(model.docs)
    for source in zero_docs["a3.progression_model"]["product_sources"]:
        if source.get("source_id") == "a1_crown_salvage":
            source["restock_active_seconds"] = 0
            source["one_time"] = False
            source["max_claims_per_session"] = None
    zero_model = Model.from_docs(zero_docs)
    engine = routes.ClaimEngine(zero_model)
    engine.start_session()
    allowed_zero, blocked_zero = engine.request("a1_crown_salvage", 3)
    zero_flagged = any(b["reason"] == "zero_restock_not_renewable" for b in blocked_zero)
    results.append(
        CaseResult(
            case_id="B06_zero_restock_not_renewable",
            kind="BEHAVIOUR",
            description="a non-one-time source with zero restock seconds cannot be farmed inside one session",
            expected_codes=["ZERO_RESTOCK_NOT_RENEWABLE"],
            observed_codes=["ZERO_RESTOCK_NOT_RENEWABLE"] if zero_flagged else [],
            passed=allowed_zero <= 1 and zero_flagged,
            detail=f"allowed={allowed_zero} reasons={[b['reason'] for b in blocked_zero]}",
        )
    )

    # B07 - bag capacity
    slots, overflow, capacity_findings = routes.capacity_check(
        {f"synthetic_item_{index}": 1.0 for index in range(45)}, 30, "B07", model
    )
    results.append(
        CaseResult(
            case_id="B07_bag_capacity_overflow",
            kind="BEHAVIOUR",
            description="a trip that would need 45 slots in a 30-slot bag is reported as overflow",
            expected_codes=["CAPACITY_TRUNCATED"],
            observed_codes=[finding.code for finding in capacity_findings],
            passed=overflow == 15 and any(f.code == "CAPACITY_TRUNCATED" for f in capacity_findings),
            detail=f"slots={slots} overflow={overflow}",
        )
    )

    # B08 - unique instance duplication
    _slots, _overflow, unique_findings = routes.capacity_check({"core_ember": 2.0}, 30, "B08", model)
    results.append(
        CaseResult(
            case_id="B08_unique_instance_duplication",
            kind="BEHAVIOUR",
            description="a unique-instance Core is never modelled as two physical units",
            expected_codes=["UNIQUE_INSTANCE_DUPLICATION_BLOCKED"],
            observed_codes=[finding.code for finding in unique_findings],
            passed=any(f.code == "UNIQUE_INSTANCE_DUPLICATION_BLOCKED" for f in unique_findings),
            detail="clamped to one instance and flagged",
        )
    )

    # B09 - unlucky player: exact odds of a useless trip
    unlucky = sensitivity.unlucky_player(
        model, tables["roadside_cache"], ("knowledge_spares", "research_notes"), 3
    )
    results.append(
        CaseResult(
            case_id="B09_unlucky_trip_is_possible",
            kind="BEHAVIOUR",
            description="a legitimate trip can return no knowledge items; the report quantifies it instead of hiding it",
            expected_codes=[],
            observed_codes=[],
            passed=0.0 < unlucky["p_one_claim_yields_none_of_tracked"] < 1.0,
            detail=f"p(one claim yields no tracked item)={unlucky['p_one_claim_yields_none_of_tracked']}",
        )
    )

    # B10 - death with partial cargo recovery
    survival = sensitivity.cargo_survival(1.0, [0.0, 0.5, 1.0], {"core_ember": 1.0})
    retained = [row["expected_retained_fraction"] for row in survival]  # type: ignore[index]
    results.append(
        CaseResult(
            case_id="B10_death_cargo_recovery",
            kind="BEHAVIOUR",
            description="certain death retains 0/50/100% of cargo under the three recovery hypotheses",
            expected_codes=[],
            observed_codes=[],
            passed=retained == [0.0, 0.5, 1.0],
            detail=f"retained fractions={retained}",
        )
    )

    # B11 - no-Core trip still has non-Core value
    road = tables["roadside_cache"]
    stats = road.item_stats(model.items)
    useful = road.p_any_of(model.items, ("knowledge_spares", "research_notes", "iron_scrap"))
    results.append(
        CaseResult(
            case_id="B11_no_core_trip_utility",
            kind="BEHAVIOUR",
            description="the non-Core table still feeds an authored sink, so a Core-less trip is not automatically worthless",
            expected_codes=[],
            observed_codes=[],
            passed=useful > 0 and stats.get("iron_scrap", {}).get("mean", 0) > 0,
            detail=f"p(claim yields a sunk item)={useful} mean scrap={stats.get('iron_scrap', {}).get('mean')}",
        )
    )

    # B12 - research bootstrap is circular today
    cycle = access.bootstrap_cycle_findings(model)
    results.append(
        CaseResult(
            case_id="B12_research_bootstrap_cycle",
            kind="BEHAVIOUR",
            description="the first research station cannot be funded from native sources alone",
            expected_codes=["BOOTSTRAP_DEPENDENCY_CYCLE"],
            observed_codes=[finding.code for finding in cycle],
            passed=any(f.code == "BOOTSTRAP_DEPENDENCY_CYCLE" for f in cycle),
            detail=(cycle[0].detail if cycle else "no cycle detected"),
        )
    )
    return results


def run_all(
    model: Model, baseline_codes: Sequence[str], baseline_counts: Optional[Dict[str, int]] = None
) -> List[CaseResult]:
    network = RouteNetwork(model.graph_doc)
    results = run_data_faults(model, baseline_codes, baseline_counts)
    results.extend(run_behaviour_cases(model, network))
    return results
