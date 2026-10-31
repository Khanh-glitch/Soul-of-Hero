"""Exact (closed-form) loot mathematics for the *existing* A3 tables.

No rate is invented here. Every probability is derived from the weights and
quantity ranges that A3 actually authored, under one explicit reading of the
JSON, stated here and repeated in every artifact:

  * a table's ``rolls`` are independent draws with replacement,
  * each draw picks one entry by weight / sum(weights) among legal entries,
  * the quantity is uniform over the inclusive integer range ``quantity``,
  * ``excluded_tags`` removes entries whose item carries that tag.

Where the reading matters (e.g. whether rolls are independent or a
without-replacement draft), the sensitivity module reports the alternative and
labels it as an interpretation, not a balance change.
"""
from __future__ import annotations

import itertools
import math
from dataclasses import dataclass
from fractions import Fraction
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

INTERPRETATION = (
    "independent weighted draws with replacement; uniform inclusive integer quantity; "
    "excluded_tags removes matching entries"
)


@dataclass(frozen=True)
class LootTable:
    table_id: str
    source_id: Optional[str]
    risk: str
    rolls: int
    replenishment_seconds: int
    entries: Tuple[Dict[str, object], ...]
    excluded_tags: Tuple[str, ...]

    @classmethod
    def from_json(cls, table_id: str, payload: Dict[str, object]) -> "LootTable":
        return cls(
            table_id=table_id,
            source_id=payload.get("source_id"),  # type: ignore[arg-type]
            risk=str(payload.get("risk", "unknown")),
            rolls=int(payload["rolls"]),  # type: ignore[arg-type]
            replenishment_seconds=int(payload.get("replenishment_seconds", 0)),  # type: ignore[arg-type]
            entries=tuple(payload.get("entries", [])),  # type: ignore[arg-type]
            excluded_tags=tuple(payload.get("excluded_tags", [])),  # type: ignore[arg-type]
        )

    def legal_entries(self, items: Dict[str, Dict[str, object]]) -> List[Dict[str, object]]:
        legal: List[Dict[str, object]] = []
        for entry in self.entries:
            item = items.get(str(entry["item_id"]))
            tags = set(item.get("tags", [])) if item else set()
            if tags & set(self.excluded_tags):
                continue
            legal.append(entry)
        return legal

    def outcomes_per_roll(
        self, items: Dict[str, Dict[str, object]]
    ) -> List[Tuple[str, int, Fraction]]:
        """(item_id, quantity, probability) for one draw."""
        legal = self.legal_entries(items)
        total = sum(int(entry["weight"]) for entry in legal)  # type: ignore[arg-type]
        if total <= 0:
            return []
        out: List[Tuple[str, int, Fraction]] = []
        for entry in legal:
            weight = int(entry["weight"])  # type: ignore[arg-type]
            low, high = (int(v) for v in entry["quantity"])  # type: ignore[union-attr]
            if high < low:
                raise ValueError(f"{self.table_id}:{entry['item_id']} inverted quantity range")
            steps = high - low + 1
            for qty in range(low, high + 1):
                out.append((str(entry["item_id"]), qty, Fraction(weight, total * steps)))
        return out

    # ------------------------------------------------------------ exact claim
    def claim_distribution(
        self, items: Dict[str, Dict[str, object]], max_states: int = 500_000
    ) -> List[Tuple[Dict[str, int], Fraction]]:
        """Exact joint distribution of one claim (all rolls of the table)."""
        per_roll = self.outcomes_per_roll(items)
        if not per_roll or self.rolls <= 0:
            return []
        states = len(per_roll) ** self.rolls
        if states > max_states:
            raise ValueError(
                f"{self.table_id} would enumerate {states} states (> {max_states}); "
                "extend the model rather than silently sampling"
            )
        results: List[Tuple[Dict[str, int], Fraction]] = []
        for combo in itertools.product(per_roll, repeat=self.rolls):
            probability = Fraction(1)
            bundle: Dict[str, int] = {}
            for item_id, qty, p in combo:
                probability *= p
                bundle[item_id] = bundle.get(item_id, 0) + qty
            results.append((bundle, probability))
        return results

    def item_stats(
        self, items: Dict[str, Dict[str, object]]
    ) -> Dict[str, Dict[str, float]]:
        distribution = self.claim_distribution(items)
        if not distribution:
            return {}
        totals: Dict[str, float] = {}
        squares: Dict[str, float] = {}
        at_least_one: Dict[str, Fraction] = {}
        max_seen: Dict[str, int] = {}
        legal_ids = {str(entry["item_id"]) for entry in self.legal_entries(items)}
        for bundle, probability in distribution:
            for item_id in legal_ids:
                qty = bundle.get(item_id, 0)
                pf = float(probability)
                totals[item_id] = totals.get(item_id, 0.0) + qty * pf
                squares[item_id] = squares.get(item_id, 0.0) + qty * qty * pf
                if qty > 0:
                    at_least_one[item_id] = at_least_one.get(item_id, Fraction(0)) + probability
                max_seen[item_id] = max(max_seen.get(item_id, 0), qty)
        out: Dict[str, Dict[str, float]] = {}
        for item_id in sorted(totals):
            mean = totals[item_id]
            variance = squares[item_id] - mean * mean
            out[item_id] = {
                "mean": round(mean, 6),
                "variance": round(max(variance, 0.0), 6),
                "p_at_least_one": round(float(at_least_one.get(item_id, Fraction(0))), 6),
                "max": float(max_seen.get(item_id, 0)),
            }
        return out

    def covariance(
        self, items: Dict[str, Dict[str, object]], item_a: str, item_b: str
    ) -> float:
        distribution = self.claim_distribution(items)
        if not distribution:
            return 0.0
        mean_a = sum(b.get(item_a, 0) * float(p) for b, p in distribution)
        mean_b = sum(b.get(item_b, 0) * float(p) for b, p in distribution)
        joint = sum(b.get(item_a, 0) * b.get(item_b, 0) * float(p) for b, p in distribution)
        return round(joint - mean_a * mean_b, 6)

    def p_any_of(
        self, items: Dict[str, Dict[str, object]], useful: Iterable[str]
    ) -> float:
        useful_set = set(useful)
        distribution = self.claim_distribution(items)
        probability = sum(
            float(p) for bundle, p in distribution if any(bundle.get(item, 0) > 0 for item in useful_set)
        )
        return round(probability, 6)

    def p_none_of(self, items: Dict[str, Dict[str, object]], tracked: Iterable[str]) -> float:
        """P(a single claim yields zero units of every tracked item)."""
        tracked_set = set(tracked)
        distribution = self.claim_distribution(items)
        probability = sum(
            float(p) for bundle, p in distribution if not any(bundle.get(item, 0) > 0 for item in tracked_set)
        )
        return round(probability, 6)

    # ------------------------------------------------------- hitting-time DP
    def increment_pmf(
        self, items: Dict[str, Dict[str, object]], item_id: str
    ) -> Dict[int, Fraction]:
        """Distribution of one item's contribution from one whole claim."""
        distribution = self.claim_distribution(items)
        out: Dict[int, Fraction] = {}
        for bundle, probability in distribution:
            out[bundle.get(item_id, 0)] = out.get(bundle.get(item_id, 0), Fraction(0)) + probability
        return out

    # E[T] = 1 + sum_{t>=1} P(T > t) because T >= 1 for any target >= 1.
    # The t = 0 term (P(T > 0) = 1) used to be dropped here, which under-reported
    # every nonempty hitting time by exactly one claim.  See
    # expected_claims_to_reach_detail for the two independent computations.
    EXACT_TARGET_LIMIT = 128

    def expected_claims_to_reach(
        self,
        items: Dict[str, Dict[str, object]],
        item_id: str,
        target: int,
        max_claims: int = 200_000,
    ) -> Optional[float]:
        """E[claims until cumulative units of ``item_id`` reach ``target``.

        Returns None when the item cannot drop from this table at all.
        """
        detail = self.expected_claims_to_reach_detail(items, item_id, target, max_claims)
        return detail["expectation"]

    def expected_claims_to_reach_detail(
        self,
        items: Dict[str, Dict[str, object]],
        item_id: str,
        target: int,
        max_claims: int = 200_000,
    ) -> Dict[str, object]:
        """Exact E[T] plus the derivation that produced it.

        ``T`` counts *whole claims*, so ``T >= 1`` whenever ``target >= 1`` and

            E[T] = sum_{t>=0} P(T > t) = 1 + sum_{t>=1} P(T > t).

        Two independent computations are exposed:

        * ``EXACT_LINEAR_SYSTEM`` (default, ``target <= EXACT_TARGET_LIMIT``) solves
          ``E[k] = 1 + sum_q p_q E[k+q]`` backwards from ``E[target] = 0``.  It has no
          truncation and is the value reported.
        * ``SURVIVAL_SUM`` evolves the sub-target mass and adds ``sum_{t>=1} P(T > t)``
          to the ``t = 0`` term.  It is used only above the exact limit and reports an
          upper bound for the dropped tail: from a state short by ``k`` units you need
          at most ``k`` further *successful* claims, so the remaining expectation is at
          most ``k / P(a claim yields >= 1 unit)``.
        """
        if target <= 0:
            return {"expectation": 0.0, "method": "TRIVIAL_TARGET_NOT_POSITIVE", "tail_bound": 0.0}
        pmf = self.increment_pmf(items, item_id)
        if not pmf or all(qty == 0 for qty in pmf):
            return {
                "expectation": None,
                "method": "ITEM_CANNOT_DROP_FROM_THIS_TABLE",
                "tail_bound": None,
            }
        p_zero = pmf.get(0, Fraction(0))
        p_success = Fraction(1) - p_zero
        if p_success == 0:
            return {
                "expectation": None,
                "method": "ITEM_CANNOT_DROP_FROM_THIS_TABLE",
                "tail_bound": None,
            }
        if target <= self.EXACT_TARGET_LIMIT:
            # Backward substitution: every state depends only on higher states.
            expected: List[Fraction] = [Fraction(0)] * (target + 1)
            for short in range(target - 1, -1, -1):
                gain = Fraction(1)
                for qty, probability in pmf.items():
                    if qty <= 0:
                        continue
                    nxt = short + qty
                    if nxt < target:
                        gain += probability * expected[nxt]
                expected[short] = gain / p_success
            return {
                "expectation": float(expected[0]),
                "method": "EXACT_LINEAR_SYSTEM",
                "tail_bound": 0.0,
                "p_zero_claim": round(float(p_zero), 9),
                "p_success_claim": round(float(p_success), 9),
            }

        state: Dict[int, Fraction] = {0: Fraction(1)}
        tail = Fraction(1)  # the t = 0 survival term, P(T > 0) = 1
        for _claim in range(1, max_claims + 1):
            nxt: Dict[int, Fraction] = {}
            for count, mass in state.items():
                for qty, probability in pmf.items():
                    new_count = count + qty
                    if new_count >= target:
                        continue  # absorbed
                    nxt[new_count] = nxt.get(new_count, Fraction(0)) + mass * probability
            state = nxt
            remaining = sum(state.values())
            tail += remaining
            if remaining == 0:
                return {
                    "expectation": float(tail),
                    "method": "SURVIVAL_SUM_EXACT_TERMINATED",
                    "tail_bound": 0.0,
                }
            if remaining < Fraction(1, 10**12):
                bound = float(remaining) * (target - 1) / float(p_success)
                return {
                    "expectation": float(tail),
                    "method": "SURVIVAL_SUM_TRUNCATED",
                    "tail_bound": bound,
                    "upper_bound": float(tail) + bound,
                }
        raise ValueError(f"{self.table_id}: hitting time for {item_id!r} did not converge")

    def p_reach_by(
        self, items: Dict[str, Dict[str, object]], item_id: str, target: int, claims: int
    ) -> float:
        if target <= 0:
            return 1.0
        pmf = self.increment_pmf(items, item_id)
        state: Dict[int, Fraction] = {0: Fraction(1)}
        for _ in range(claims):
            nxt: Dict[int, Fraction] = {}
            for count, mass in state.items():
                for qty, probability in pmf.items():
                    new_count = count + qty
                    if new_count >= target:
                        continue
                    nxt[new_count] = nxt.get(new_count, Fraction(0)) + mass * probability
            state = nxt
        return round(1.0 - float(sum(state.values())), 6)

    def as_dict(self, items: Dict[str, Dict[str, object]]) -> Dict[str, object]:
        return {
            "table_id": self.table_id,
            "source_id": self.source_id,
            "risk": self.risk,
            "rolls": self.rolls,
            "replenishment_seconds": self.replenishment_seconds,
            "excluded_tags": list(self.excluded_tags),
            "entry_count": len(self.entries),
            "legal_entry_count": len(self.legal_entries(items)),
            "item_stats": self.item_stats(items),
            "interpretation": INTERPRETATION,
        }


def tables_from_model(model) -> Dict[str, LootTable]:
    return {
        table_id: LootTable.from_json(table_id, payload)
        for table_id, payload in model.loot_tables.items()
    }


# ----------------------------------------------------------------- sink depth
def sink_demand(model) -> Dict[str, Dict[str, object]]:
    """How many authored sinks consume each item, and in what quantity per use.

    This is a *structural* measure of usefulness (does a looted item feed an
    authored recipe/technology?), not a price. It never converts items to gold.
    """
    demand: Dict[str, Dict[str, object]] = {}
    for recipe_id, recipe in model.recipes.items():
        for item_id, qty in recipe["inputs"].items():
            row = demand.setdefault(item_id, {"recipe_inputs": [], "technology_inputs": [], "total_units_per_cycle": 0})
            row["recipe_inputs"].append(recipe_id)  # type: ignore[union-attr]
            row["total_units_per_cycle"] += int(qty)  # type: ignore[index]
    for tech_id, tech in model.technologies.items():
        for item_id, qty in tech["inputs"].items():
            row = demand.setdefault(item_id, {"recipe_inputs": [], "technology_inputs": [], "total_units_per_cycle": 0})
            row["technology_inputs"].append(tech_id)  # type: ignore[union-attr]
            row["total_units_per_cycle"] += int(qty)  # type: ignore[index]
    for row in demand.values():
        row["recipe_inputs"] = sorted(row["recipe_inputs"])  # type: ignore[arg-type]
        row["technology_inputs"] = sorted(row["technology_inputs"])  # type: ignore[arg-type]
    return {item_id: demand[item_id] for item_id in sorted(demand)}


def sink_targets(model) -> Dict[str, Dict[str, int]]:
    """Named early sinks and their exact input requirements."""
    targets: Dict[str, Dict[str, int]] = {}
    for tech_id, tech in model.technologies.items():
        targets[tech_id] = {k: int(v) for k, v in tech["inputs"].items()}
    for recipe_id in ("research_kit", "workbench_kit", "furnace_kit", "stone_pick", "weave_cloth"):
        recipe = model.recipes.get(recipe_id)
        if recipe:
            targets[recipe_id] = {k: int(v) for k, v in recipe["inputs"].items()}
    return targets


def claims_needed(model, target_name: str, table: LootTable) -> Dict[str, object]:
    """Expected claims of one table to satisfy each input line of a named sink."""
    from .loot import sink_targets as _targets  # local import to keep module import-light

    requirements = _targets(model).get(target_name)
    if requirements is None:
        raise KeyError(f"unknown sink target {target_name!r}")
    rows: Dict[str, object] = {}
    for item_id, qty in sorted(requirements.items()):
        coverage = table.item_stats(model.items).get(item_id, {})
        mean = coverage.get("mean", 0.0)
        expected = table.expected_claims_to_reach(model.items, item_id, qty)
        rows[item_id] = {
            "required_units": qty,
            "mean_units_per_claim": mean,
            "expected_claims": None if expected is None else round(expected, 4),
            "p_covered_in_10_claims": table.p_reach_by(model.items, item_id, qty, 10),
            "authoritative_source": "other_table_or_craft" if mean == 0 else "this_table",
        }
    return {"sink": target_name, "requirements": requirements, "per_item": rows}


def binomial_tail(n: int, k: int, p: float) -> float:
    """P(X >= k) for X ~ Binomial(n, p)."""
    if k <= 0:
        return 1.0
    if k > n:
        return 0.0
    return round(sum(math.comb(n, i) * p**i * (1 - p) ** (n - i) for i in range(k, n + 1)), 9)


def p_at_least_one(n: int, p: float) -> float:
    """1 - (1-p)^N, the Control-Tower style single-container probability."""
    if n < 0:
        raise ValueError("n must be non-negative")
    if p < 0 or p > 1:
        raise ValueError("p must be in [0, 1]")
    return round(1.0 - (1.0 - p) ** n, 9)


def sink_coverage(model, available: Dict[str, float]) -> Dict[str, object]:
    """Compare one trip's loot against named early sinks.

    Only what the trip itself carries is compared. Native harvesting from the
    four LIVE_SURV_010 sources is *not* added, so a "short" row means "this
    pattern alone does not fund the sink", not "the sink is unreachable".
    """
    targets = sink_targets(model)
    rows: Dict[str, object] = {}
    for name, requirements in sorted(targets.items()):
        shortages = {
            item: round(float(required) - float(available.get(item, 0.0)), 3)
            for item, required in sorted(requirements.items())
            if float(available.get(item, 0.0)) + 1e-9 < float(required)
        }
        rows[name] = {
            "requirements": requirements,
            "shortfall": shortages,
            "status": "COVERED_BY_TRIP" if not shortages else "SHORT",
        }
    covered = sorted(name for name, row in rows.items() if row["status"] == "COVERED_BY_TRIP")  # type: ignore[union-attr]
    short = sorted(name for name, row in rows.items() if row["status"] == "SHORT")  # type: ignore[union-attr]
    return {
        "covered": covered,
        "short": short,
        "detail": rows,
        "basis": "trip loot only; native harvest and prior-session stock are excluded",
    }
