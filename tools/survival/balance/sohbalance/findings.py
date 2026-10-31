"""Small shared value types for findings and severity.

Nothing here contains gameplay rules. A Finding is an *observation about the
current authored data*, not a balance recommendation.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List

SEVERITY_ORDER = {"BLOCKER": 0, "MAJOR": 1, "MINOR": 2, "INFO": 3}

# Stable finding codes. Tests assert on these; do not rename casually.
CODES: Dict[str, str] = {
    "SNAPSHOT_HASH_MISMATCH": "pinned snapshot bytes do not match the manifest",
    "SNAPSHOT_MISSING": "a pinned snapshot file is absent",
    "UPSTREAM_BLOB_DRIFT": "upstream ref blob differs from the pinned snapshot",
    "PIN_DRIFT_VS_ADOPTION_CONTRACT": "an owner's own pinned hash disagrees with the pinned snapshot",
    "LOOT_ITEM_UNKNOWN": "loot table references an item id absent from items.json",
    "LOOT_EXCLUDED_TAG_VIOLATION": "loot table can emit an item carrying one of its own excluded tags",
    "LOOT_TABLE_DEGENERATE": "loot table has no positive weight",
    "LOOT_QUANTITY_RANGE_INVALID": "loot quantity range is inverted or negative",
    "LOOT_ROLLS_INVALID": "loot table declares a non-positive roll count",
    "SOURCE_ITEM_UNKNOWN": "source references an item id absent from items.json",
    "SOURCE_POI_UNRESOLVED": "source POI id does not resolve to an A1 POI",
    "SOURCE_REGION_UNRESOLVED": "source region id does not resolve to an A1 region",
    "SOURCE_REQUIREMENT_UNMAPPED": "source requirement kind has no A1 capability vocabulary",
    "ITEM_SOURCE_MISMATCH": "item.source_ids and source.item_id disagree",
    "ITEM_ORPHAN_SOURCE": "item declares a source id that does not exist",
    "ITEM_NO_SOURCE": "non-craftable item has no source at all",
    "ITEM_OVEROWNED": "two live sources claim the same item with different yields",
    "RECIPE_ITEM_UNKNOWN": "recipe/research references an item id absent from items.json",
    "RECIPE_UNKNOWN_STATION": "recipe references a station id absent from stations.json",
    "RECIPE_UNKNOWN_TECH": "recipe requires a technology id absent from research.json",
    "RECIPE_CYCLE": "item production graph contains a cycle",
    "BOOTSTRAP_DEPENDENCY_CYCLE": "a capability/item bootstrap needs its own downstream output",
    "CAPABILITY_SELF_DEPENDENCY": "a POI requires a capability it is the only source of",
    "CAPABILITY_ORPHAN": "requirement references a capability A1 never authors",
    "POI_ROUTE_UNREACHABLE": "POI is not reachable in the authored route graph under the given capabilities",
    "POI_NOT_ON_ROUTE_GRAPH": "POI has no route-graph node",
    "POI_NOT_PLAYABLE": "POI is authored-only and cannot be entered natively",
    "ROUTE_UNREACHABLE": "no capability-permitting route exists for the requested trip",
    "ROUTE_LOCKED_FOR_CAPABILITIES": "trip requires a capability the actor does not hold",
    "NONE_ELIGIBLE": "no eligible container/source exists for the requested claim set",
    "REPEATED_ONE_TIME_CLAIM_BLOCKED": "one-time reward was requested twice",
    "ZERO_RESTOCK_NOT_RENEWABLE": "source declares 0 restock seconds and must not renew",
    "CAPACITY_TRUNCATED": "trip loot exceeds modelled bag/stack capacity",
    "UNIQUE_INSTANCE_DUPLICATION_BLOCKED": "unique instance item requested more than once",
    "QUANTITY_OWNERSHIP_UNRESOLVED": "one owner assigns a quantity to another owner's reward",
    "DEATH_CARGO_LOSS_UNMODELLED": "death risk applies to cargo that the model cannot recover",
    "CORE_DROP_RATE_ABSENT": "no Core drop rate exists in the current data",
    "PROVISIONAL_BINDING": "binding is provisional and not owner-approved",
    "SOURCE_ID_DIVERGENCE": "the same physical source has different ids in different A3 files",
    "RESISTANCE_CHAIN_BLOCKED": "the mitigation item for a gated source is itself behind an unreachable chain",
    "NOT_NATIVE_INTEGRATED": "authored contract is not native-integrated",
    "HYPOTHESIS_USED": "a result depends on a labelled hypothesis, not authored data",
}


@dataclass(frozen=True)
class Finding:
    code: str
    severity: str
    subject: str
    detail: str
    owner: str = "A1/A3"

    def __post_init__(self) -> None:
        if self.code not in CODES:
            raise ValueError(f"unknown finding code: {self.code}")
        if self.severity not in SEVERITY_ORDER:
            raise ValueError(f"unknown severity: {self.severity}")

    def as_dict(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "severity": self.severity,
            "subject": self.subject,
            "detail": self.detail,
            "owner": self.owner,
            "code_meaning": CODES[self.code],
        }


def sort_findings(findings: Iterable[Finding]) -> List[Finding]:
    return sorted(
        findings,
        key=lambda f: (SEVERITY_ORDER[f.severity], f.code, f.subject),
    )


def by_code(findings: Iterable[Finding]) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    for finding in findings:
        out.setdefault(finding.code, []).append(finding.subject)
    return {code: sorted(subjects) for code, subjects in sorted(out.items())}


def severity_counts(findings: Iterable[Finding]) -> Dict[str, int]:
    counts = {name: 0 for name in SEVERITY_ORDER}
    for finding in findings:
        counts[finding.severity] += 1
    return counts


@dataclass
class Assertion:
    """A named machine-checkable claim about the analysis, for CI-style output."""

    assertion_id: str
    holds: bool
    detail: str = ""
    tags: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "assertion_id": self.assertion_id,
            "holds": bool(self.holds),
            "detail": self.detail,
            "tags": list(self.tags),
        }
