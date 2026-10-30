"""Probability sensitivity under explicitly labelled hypotheses.

Rule for this module: it may illustrate how an answer moves, and it may never
present an illustration as an authored rate. Every block therefore carries a
``label`` and a ``basis`` string, and the report repeats them next to the value.
"""
from __future__ import annotations

import random
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from .loot import LootTable, binomial_tail, p_at_least_one

HYPOTHETICAL_LABEL = "HYPOTHETICAL_NOT_A3_TUNING"


# ------------------------------------------------------- what exists today
def core_capable_sources(model) -> Dict[str, object]:
    """Derived, not asserted: which authored sources can currently hand out a Core?"""
    rows: List[Dict[str, object]] = []
    for table_id, payload in sorted(model.loot_tables.items()):
        emits_core = False
        for entry in payload.get("entries", []):
            item = model.items.get(str(entry.get("item_id")), {})
            if "core" in set(item.get("tags", []) or []):
                emits_core = True
        rows.append(
            {
                "table_id": table_id,
                "rolls": payload.get("rolls"),
                "excluded_tags": payload.get("excluded_tags", []),
                "can_emit_core_tagged_item": emits_core,
                "replenishment_seconds": payload.get("replenishment_seconds"),
            }
        )
    specimen_rows: List[Dict[str, object]] = []
    for source in model.product_sources():
        item_id = source.get("item_id")
        item = model.items.get(str(item_id), {}) if item_id else {}
        if "core" in set(item.get("tags", []) or []):
            specimen_rows.append(
                {
                    "source_id": source.get("source_id"),
                    "item_id": item_id,
                    "poi_id": source.get("poi_id"),
                    "binding_status": source.get("binding_status"),
                    "one_time": source.get("one_time"),
                    "discovery_chance": source.get("discovery_chance"),
                    "requires_capabilities": source.get("requires_capabilities", []),
                    "risk": source.get("risk"),
                }
            )
    plan_rows: List[str] = sorted(
        source_id
        for source_id, source in model.sources.items()
        if model.items.get(str(source.get("item_id")), {}).get("kind") == "blueprint"
        and "plan_drop" in source_id
    )
    return {
        "loot_tables": rows,
        "core_capable_loot_tables": sum(1 for row in rows if row["can_emit_core_tagged_item"]),
        "roadside_core_capable_loot_tables": sum(
            1 for row in rows if row["can_emit_core_tagged_item"] and "roadside" in str(row["table_id"])
        ),
        "physical_core_specimen_sources": specimen_rows,
        "plan_sources": plan_rows,
        "eligible_roadside_containers_today": 0,
        "eligible_roadside_containers_basis": (
            "derived: no authored table that a roadside container would use can emit a core-tagged "
            "item, and no roadside container POI is resolved against A1"
        ),
    }


# ------------------------------------------------------- hypothetical grid
def core_probability_grid(hypothesis: Dict[str, object]) -> Dict[str, object]:
    counts = [int(value) for value in hypothesis["eligible_container_counts"]]  # type: ignore[index]
    probabilities = [float(value) for value in hypothesis["per_container_probabilities"]]  # type: ignore[index]
    trips = [int(value) for value in hypothesis.get("trips_per_measure", [1, 10, 20])]  # type: ignore[union-attr]
    table: List[Dict[str, object]] = []
    for p in probabilities:
        for crates_per_trip in counts:
            row: Dict[str, object] = {
                "p_per_crate": p,
                "crates_per_trip": crates_per_trip,
                "expected_trips_to_first": None if p == 0 or crates_per_trip == 0 else round(1.0 / (p * crates_per_trip), 3),
            }
            for trip_count in trips:
                row[f"p_after_{trip_count}_trips"] = p_at_least_one(crates_per_trip * trip_count, p)
            table.append(row)
    return {
        "label": HYPOTHETICAL_LABEL,
        "basis": "pure probability arithmetic on assumed p and assumed eligible crate counts; not an authored rate",
        "table": table,
        "note": (
            "The counts are illustrations of how the answer scales. They must not be read as a proposal to "
            "set p anywhere; the current data contains no usable p."
        ),
    }


def crates_needed_for_confidence(p: float, confidence: float) -> Optional[int]:
    """Smallest N with 1-(1-p)^N >= confidence."""
    if p <= 0:
        return None
    if confidence <= 0:
        return 0
    n = 1
    while p_at_least_one(n, p) < confidence:
        n += 1
        if n > 10_000_000:
            return None
    return n


def count_uncertainty(hypothesis: Dict[str, object]) -> List[Dict[str, object]]:
    """How fragile is the answer to being wrong about how many crates exist?"""
    rows: List[Dict[str, object]] = []
    for p in (0.002, 0.005, 0.01, 0.02):
        for base in (1, 2, 4):
            for delta in (-1, 0, 1):
                crates = base + delta
                if crates < 0:
                    continue
                rows.append(
                    {
                        "p_per_crate": p,
                        "crates_per_trip": crates,
                        "p_after_10_trips": p_at_least_one(crates * 10, p),
                        "relative_to_base": round(
                            p_at_least_one(crates * 10, p) / max(p_at_least_one(base * 10, p), 1e-12), 4
                        ),
                    }
                )
    return rows


def reading_sensitivity(model, table: LootTable) -> Dict[str, object]:
    """Same table, two defensible readings of ``rolls``.

    Independent draws with replacement (this tool's reading) vs a
    without-replacement draft across distinct entries. The difference is shown,
    not hidden, so a reviewer can see how much the interpretation matters.
    """
    items = model.items
    independent = table.item_stats(items)
    # without replacement: only meaningful when rolls <= distinct entries
    per_roll = table.outcomes_per_roll(items)
    by_entry: Dict[str, int] = {}
    for item_id, _qty, _p in per_roll:
        by_entry[item_id] = by_entry.get(item_id, 0) + 1
    total_entries = len(by_entry)
    draft: Dict[str, float] = {}
    if table.rolls <= total_entries:
        import itertools
        from fractions import Fraction

        weight_by_item: Dict[str, int] = {item_id: 0 for item_id in by_entry}
        for entry in table.legal_entries(items):
            weight_by_item[str(entry["item_id"])] += int(entry["weight"])  # type: ignore[arg-type]
        total_weight = sum(weight_by_item.values())
        count = 0
        for combo in itertools.permutations(sorted(weight_by_item), table.rolls):
            probability = Fraction(1)
            remaining = dict(weight_by_item)
            remaining_total = total_weight
            for item_id in combo:
                probability *= Fraction(remaining[item_id], remaining_total)
                remaining_total -= remaining[item_id]
                remaining[item_id] = 0
            for item_id in combo:
                draft[item_id] = draft.get(item_id, 0.0) + float(probability)
            count += 1
    return {
        "table_id": table.table_id,
        "reading_a": {"label": "independent draws with replacement", "p_at_least_one": {k: v["p_at_least_one"] for k, v in independent.items()}},
        "reading_b": {"label": "without-replacement draft of distinct entries", "p_at_least_one": {k: round(v, 6) for k, v in sorted(draft.items())}},
        "difference_note": (
            "A3's JSON says 'rolls' without stating replacement. The tool uses reading A everywhere else; the "
            "gap is reported so a reviewer can judge whether the ambiguity matters for the claim being made."
        ),
    }


# ------------------------------------------------------------ Monte Carlo
def draw_claim(table: LootTable, items, rng: random.Random) -> Dict[str, int]:
    outcomes = table.outcomes_per_roll(items)
    cumulative: List[Tuple[str, int, float]] = []
    running = 0.0
    for item_id, qty, probability in outcomes:
        running += float(probability)
        cumulative.append((item_id, qty, running))
    bundle: Dict[str, int] = {}
    for _ in range(table.rolls):
        roll = rng.random() * cumulative[-1][2]
        for item_id, qty, edge in cumulative:
            if roll <= edge:
                bundle[item_id] = bundle.get(item_id, 0) + qty
                break
    return bundle


def seeded_sessions(
    model,
    table: LootTable,
    claims_per_session: int,
    sessions: int,
    runs: int,
    seed: int,
    tracked: Sequence[str] = ("iron_scrap", "knowledge_spares", "research_notes", "grain_seed"),
) -> Dict[str, object]:
    """Seeded resampling of *authored table weights* over a session sequence.

    This is not a playtest and not pacing evidence. It only shows the spread of
    material totals for a fixed claim budget, so an unlucky percentile can be
    quoted instead of only a mean.
    """
    rng = random.Random(seed)
    per_run_totals: List[Dict[str, float]] = []
    for _ in range(runs):
        totals = {item: 0.0 for item in tracked}
        for _session in range(sessions):
            for _claim in range(claims_per_session):
                bundle = draw_claim(table, model.items, rng)
                for item, qty in bundle.items():
                    if item in totals:
                        totals[item] += qty
        per_run_totals.append(totals)
    summary: Dict[str, object] = {}
    for item in tracked:
        values = sorted(run[item] for run in per_run_totals)
        summary[item] = {
            "p10": round(values[int(0.10 * (len(values) - 1))], 2),
            "p50": round(values[int(0.50 * (len(values) - 1))], 2),
            "p90": round(values[int(0.90 * (len(values) - 1))], 2),
            "mean": round(sum(values) / len(values), 3),
            "zero_runs": sum(1 for value in values if value == 0),
        }
    both_zero = sum(
        1
        for run in per_run_totals
        if run["knowledge_spares"] == 0 and run["research_notes"] == 0
    )
    return {
        "table_id": table.table_id,
        "seed": seed,
        "runs": runs,
        "sessions": sessions,
        "claims_per_session": claims_per_session,
        "label": HYPOTHETICAL_LABEL,
        "basis": "seeded resampling of authored table weights over an assumed claim budget; no human playtest",
        "per_item": summary,
        "runs_with_no_spares_and_no_notes": both_zero,
        "p_no_spares_and_no_notes": round(both_zero / runs, 4),
    }


def unlucky_player(model, table: LootTable, tracked: Sequence[str], claims_per_trip: int) -> Dict[str, object]:
    """Exact odds that a trip produces nothing useful, from authored weights only."""
    per_claim_none = table.p_none_of(model.items, tracked)
    per_trip_none = round(per_claim_none**claims_per_trip, 6)
    claims_for_90 = None
    n = 1
    while n <= 1000:
        if 1.0 - per_claim_none**n >= 0.9:
            claims_for_90 = n
            break
        n += 1
    return {
        "table_id": table.table_id,
        "tracked_items": list(tracked),
        "claims_per_trip": claims_per_trip,
        "p_one_claim_yields_none_of_tracked": per_claim_none,
        "p_one_trip_yields_none_of_tracked": per_trip_none,
        "claims_for_90pct_chance_of_one_useful_claim": claims_for_90,
        "basis": "exact arithmetic on the authored weights; assumes a container exists",
    }


def trip_budget_sensitivity(
    trip_seconds: Sequence[float], budgets: Sequence[float] = (2700.0, 5400.0, 1350.0)
) -> List[Dict[str, object]]:
    rows: List[Dict[str, object]] = []
    for seconds in trip_seconds:
        for budget in budgets:
            rows.append(
                {
                    "trip_seconds": round(seconds, 1),
                    "session_budget_seconds": budget,
                    "trips_per_session_floor": int(budget // seconds) if seconds > 0 else None,
                    "share_of_budget": round(seconds / budget, 4) if budget else None,
                }
            )
    return rows


def cargo_survival(
    death_chance: Optional[float], recovery_probabilities: Sequence[float], loot_value: Dict[str, float]
) -> List[Dict[str, object]]:
    """Expected retained cargo under death + recovery hypotheses.

    ``recovery_probabilities`` are hypotheses because A0's death-bag behaviour is
    not native-accepted; both extremes are always reported.
    """
    rows: List[Dict[str, object]] = []
    if death_chance is None:
        return [
            {
                "death_chance": None,
                "status": "UNMODELLED_NO_DEATH_MODEL_KEY",
                "detail": "A1 risk label has no A3 death-chance key; no cargo-loss number is computed",
            }
        ]
    for recovery in recovery_probabilities:
        retained = (1.0 - death_chance) + death_chance * recovery
        rows.append(
            {
                "death_chance": round(death_chance, 4),
                "cargo_recovery_probability": recovery,
                "expected_retained_fraction": round(retained, 4),
                "expected_retained_units": {item: round(units * retained, 3) for item, units in sorted(loot_value.items())},
            }
        )
    return rows


def research_gate_claims(model, table: LootTable, target: str = "tech_smelting") -> Dict[str, object]:
    """Claims of one table needed to fund a named technology, plus tail risk."""
    from .loot import claims_needed

    base = claims_needed(model, target, table)
    requirements = base["requirements"]
    worst_item = None
    worst_claims = 0.0
    for item_id, row in base["per_item"].items():  # type: ignore[union-attr]
        expected = row.get("expected_claims")  # type: ignore[union-attr]
        if isinstance(expected, (int, float)) and expected > worst_claims:
            worst_claims = float(expected)
            worst_item = item_id
    return {
        "sink": target,
        "gating_item": worst_item,
        "gating_expected_claims": round(worst_claims, 3),
        "per_item": base["per_item"],
        "p_gated_item_covered_in_10_claims": (
            table.p_reach_by(model.items, worst_item, int(requirements[worst_item]), 10) if worst_item else None
        ),
        "note": "Only the existing roadside_cache table is assumed; the table's A3 POI is unresolved.",
    }
