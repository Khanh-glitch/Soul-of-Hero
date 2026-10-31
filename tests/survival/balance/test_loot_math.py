"""Loot mathematics tests: exact values, no invented rates."""
from __future__ import annotations

import unittest
from fractions import Fraction

import _support as support

from sohbalance.loot import (
    LootTable,
    claims_needed,
    p_at_least_one,
    sink_demand,
    sink_targets,
    tables_from_model,
)


class RoadsideTableTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = support.model()
        self.table = tables_from_model(self.model)["roadside_cache"]
        self.stats = self.table.item_stats(self.model.items)

    def test_expectation_matches_published_review(self) -> None:
        # Control Tower reported 3.6 scrap / 1.35 spares / 0.45 notes / 0.45 seeds.
        self.assertAlmostEqual(self.stats["iron_scrap"]["mean"], 3.6, places=9)
        self.assertAlmostEqual(self.stats["knowledge_spares"]["mean"], 1.35, places=9)
        self.assertAlmostEqual(self.stats["research_notes"]["mean"], 0.45, places=9)
        self.assertAlmostEqual(self.stats["grain_seed"]["mean"], 0.45, places=9)

    def test_exact_mass_sums_to_one(self) -> None:
        distribution = self.table.claim_distribution(self.model.items)
        total = sum(probability for _bundle, probability in distribution)
        self.assertEqual(total, Fraction(1))
        self.assertEqual(len(distribution), 343)  # 3 rolls x 7 quantity outcomes

    def test_draw_counts_and_bounds(self) -> None:
        self.assertEqual(self.table.rolls, 3)
        self.assertEqual(self.stats["iron_scrap"]["max"], 12.0)  # 3 rolls x max 4
        self.assertEqual(self.stats["knowledge_spares"]["max"], 6.0)

    def test_probability_at_least_one(self) -> None:
        self.assertAlmostEqual(self.stats["iron_scrap"]["p_at_least_one"], 0.784, places=6)
        self.assertAlmostEqual(self.stats["knowledge_spares"]["p_at_least_one"], 0.657, places=6)
        self.assertAlmostEqual(self.stats["research_notes"]["p_at_least_one"], 0.385875, places=6)

    def test_items_are_negatively_correlated_within_a_claim(self) -> None:
        covariance = self.table.covariance(self.model.items, "iron_scrap", "knowledge_spares")
        self.assertLess(covariance, 0.0)

    def test_expected_claims_to_reach_a_sink(self) -> None:
        # Corrected value: the old 2.525289745 dropped the t = 0 survival term.
        expected = self.table.expected_claims_to_reach(self.model.items, "knowledge_spares", 4)
        self.assertIsNotNone(expected)
        self.assertAlmostEqual(expected, 3.525289745, places=6)

    def test_expected_claims_reproduce_the_control_tower_correction(self) -> None:
        # Independent statement of the same number, from the review defect report.
        detail = self.table.expected_claims_to_reach_detail(self.model.items, "knowledge_spares", 4)
        self.assertEqual(detail["method"], "EXACT_LINEAR_SYSTEM")
        self.assertAlmostEqual(1.0 + 2.525289745, detail["expectation"], places=9)

    def test_hitting_time_is_monotone_in_target(self) -> None:
        low = self.table.expected_claims_to_reach(self.model.items, "research_notes", 2)
        high = self.table.expected_claims_to_reach(self.model.items, "research_notes", 3)
        self.assertLess(low, high)

    def test_p_none_of_is_exact(self) -> None:
        # P(roll is neither spare nor note) = (40 + 15) / 100
        self.assertAlmostEqual(
            self.table.p_none_of(self.model.items, ("knowledge_spares", "research_notes")),
            0.55 ** 3,
            places=9,
        )

    def test_sink_demand_is_structural(self) -> None:
        demand = sink_demand(self.model)
        self.assertIn("smelt_iron", demand["iron_scrap"]["recipe_inputs"])
        self.assertIn("tech_smelting", demand["iron_scrap"]["technology_inputs"])
        expected_oak = sum(
            int(recipe["inputs"].get("oak_wood", 0)) for recipe in self.model.recipes.values()
        )
        self.assertEqual(demand["oak_wood"]["total_units_per_cycle"], expected_oak)
        self.assertEqual(sorted(demand["oak_wood"]["recipe_inputs"]), sorted(
            recipe_id for recipe_id, recipe in self.model.recipes.items() if "oak_wood" in recipe["inputs"]
        ))

    def test_claims_needed_for_tech_smelting(self) -> None:
        row = claims_needed(self.model, "tech_smelting", self.table)
        self.assertEqual(row["per_item"]["knowledge_spares"]["required_units"], 4)
        self.assertEqual(row["per_item"]["knowledge_spares"]["expected_claims"], 3.5253)

    def test_unknown_sink_raises(self) -> None:
        with self.assertRaises(KeyError):
            claims_needed(self.model, "not_a_sink", self.table)


class TableEdgeCaseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = support.model()

    def test_excluded_tag_removes_entry(self) -> None:
        payload = {
            "source_id": "test",
            "risk": "low",
            "rolls": 1,
            "replenishment_seconds": 0,
            "entries": [
                {"item_id": "core_ember", "weight": 50, "quantity": [1, 1]},
                {"item_id": "iron_scrap", "weight": 50, "quantity": [1, 1]},
            ],
            "excluded_tags": ["core"],
        }
        table = LootTable.from_json("test_table", payload)
        legal = table.legal_entries(self.model.items)
        self.assertEqual([entry["item_id"] for entry in legal], ["iron_scrap"])
        stats = table.item_stats(self.model.items)
        self.assertNotIn("core_ember", stats)

    def test_empty_table_is_not_a_division_error(self) -> None:
        table = LootTable.from_json(
            "empty", {"source_id": None, "risk": "low", "rolls": 2, "entries": [], "excluded_tags": []}
        )
        self.assertEqual(table.item_stats(self.model.items), {})
        self.assertEqual(table.claim_distribution(self.model.items), [])
        self.assertIsNone(table.expected_claims_to_reach(self.model.items, "iron_scrap", 1))

    def test_quantity_validation(self) -> None:
        table = LootTable.from_json(
            "bad",
            {
                "source_id": None,
                "risk": "low",
                "rolls": 1,
                "entries": [{"item_id": "iron_scrap", "weight": 1, "quantity": [5, 1]}],
                "excluded_tags": [],
            },
        )
        with self.assertRaises(ValueError):
            table.outcomes_per_roll(self.model.items)

    def test_binomial_helper_matches_closed_form(self) -> None:
        self.assertAlmostEqual(p_at_least_one(10, 0.01), 0.095617925, places=9)
        self.assertEqual(p_at_least_one(0, 0.5), 0.0)
        with self.assertRaises(ValueError):
            p_at_least_one(-1, 0.5)
        with self.assertRaises(ValueError):
            p_at_least_one(1, 1.5)

    def test_sink_targets_cover_named_early_sinks(self) -> None:
        targets = sink_targets(self.model)
        self.assertIn("tech_smelting", targets)
        self.assertIn("research_kit", targets)
        self.assertEqual(targets["research_kit"]["knowledge_spares"], 3)


class HittingTimeOracleTests(unittest.TestCase):
    """Independent oracles for E[T]; these do not depend on any A3 authored table.

    The synthetic tables below are *test fixtures*, not gameplay rates. Each one has
    an analytically known answer, so a sign or off-by-one error cannot pass.
    """

    def setUp(self) -> None:
        self.model = support.model()

    def _table(self, entries):
        return LootTable.from_json(
            "oracle",
            {
                "source_id": None,
                "risk": "low",
                "rolls": 1,
                "replenishment_seconds": 0,
                "entries": entries,
                "excluded_tags": [],
            },
        )

    def test_guaranteed_success_costs_exactly_the_target(self) -> None:
        # One guaranteed unit per claim: target 1 is the CT case (old code said 0),
        # and target k costs k claims.
        table = self._table([{"item_id": "iron_scrap", "weight": 1, "quantity": [1, 1]}])
        for target in (1, 2, 5):
            with self.subTest(target=target):
                self.assertAlmostEqual(
                    table.expected_claims_to_reach(self.model.items, "iron_scrap", target),
                    float(target),
                    places=12,
                )

    def test_guaranteed_two_units_per_claim_halves_the_cost(self) -> None:
        table = self._table([{"item_id": "iron_scrap", "weight": 1, "quantity": [2, 2]}])
        self.assertAlmostEqual(table.expected_claims_to_reach(self.model.items, "iron_scrap", 4), 2.0, places=12)

    def test_fair_coin_single_unit_is_geometric_with_mean_two(self) -> None:
        table = self._table(
            [
                {"item_id": "iron_scrap", "weight": 1, "quantity": [1, 1]},
                {"item_id": "grain_seed", "weight": 1, "quantity": [0, 0]},
            ]
        )
        self.assertAlmostEqual(table.expected_claims_to_reach(self.model.items, "iron_scrap", 1), 2.0, places=12)

    def test_fair_coin_scales_linearly_with_target(self) -> None:
        # T = sum of `target` independent Geometric(1/2) waits, so E[T] = 2 * target.
        table = self._table(
            [
                {"item_id": "iron_scrap", "weight": 1, "quantity": [1, 1]},
                {"item_id": "grain_seed", "weight": 1, "quantity": [0, 0]},
            ]
        )
        for target in (2, 3, 7):
            with self.subTest(target=target):
                self.assertAlmostEqual(
                    table.expected_claims_to_reach(self.model.items, "iron_scrap", target),
                    2.0 * target,
                    places=10,
                )

    def test_survival_sum_matches_linear_system_independently(self) -> None:
        """E[T] = sum_{t>=0} (1 - P(T <= t)), evaluated through p_reach_by."""
        table = tables_from_model(self.model)["roadside_cache"]
        for item_id, target in (("knowledge_spares", 1), ("knowledge_spares", 4), ("iron_scrap", 2)):
            with self.subTest(item=item_id, target=target):
                expectation = table.expected_claims_to_reach(self.model.items, item_id, target)
                survival_total = 1.0  # t = 0 term: P(T > 0) = 1
                previous = 0.0
                for claims in range(1, 400):
                    reached = table.p_reach_by(self.model.items, item_id, target, claims)
                    survival_total += 1.0 - reached
                    if reached == previous and reached > 0.999999:
                        break
                    previous = reached
                self.assertAlmostEqual(expectation, survival_total, places=5)

    def test_monte_carlo_agrees_within_sampling_error(self) -> None:
        import random

        table = tables_from_model(self.model)["roadside_cache"]
        pmf = table.increment_pmf(self.model.items, "knowledge_spares")
        quantities = sorted(pmf)
        weights = [float(pmf[q]) for q in quantities]
        target = 4
        rng = random.Random(20261030)
        trials = 4000
        total = 0
        for _ in range(trials):
            gained = 0
            claims = 0
            while gained < target:
                gained += rng.choices(quantities, weights=weights, k=1)[0]
                claims += 1
            total += claims
        simulated = total / trials
        exact = table.expected_claims_to_reach(self.model.items, "knowledge_spares", target)
        self.assertAlmostEqual(simulated, exact, delta=0.25)

    def test_impossible_item_returns_none(self) -> None:
        table = self._table([{"item_id": "grain_seed", "weight": 1, "quantity": [0, 0]}])
        self.assertIsNone(table.expected_claims_to_reach(self.model.items, "iron_scrap", 1))

    def test_truncated_survival_path_is_bounded_not_claimed_exact(self) -> None:
        # Force the fallback branch and require an explicit tail bound.
        table = tables_from_model(self.model)["roadside_cache"]
        original = table.EXACT_TARGET_LIMIT
        object.__setattr__(table, "EXACT_TARGET_LIMIT", 0)
        try:
            detail = table.expected_claims_to_reach_detail(self.model.items, "knowledge_spares", 4)
        finally:
            object.__setattr__(table, "EXACT_TARGET_LIMIT", original)
        self.assertEqual(detail["method"], "SURVIVAL_SUM_TRUNCATED")
        self.assertGreaterEqual(detail["upper_bound"], detail["expectation"])
        exact = table.expected_claims_to_reach(self.model.items, "knowledge_spares", 4)
        self.assertAlmostEqual(detail["expectation"], exact, places=6)


if __name__ == "__main__":
    unittest.main()
