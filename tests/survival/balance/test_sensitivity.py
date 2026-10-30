"""Sensitivity tests: labelled hypotheses, monotonicity, determinism."""
from __future__ import annotations

import unittest

import _support as support

from sohbalance import sensitivity
from sohbalance.loot import tables_from_model


class CoreProbabilityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = support.model()
        self.hypotheses = support.hypotheses()

    def test_no_authored_core_rate_exists(self) -> None:
        facts = sensitivity.core_capable_sources(self.model)
        self.assertEqual(facts["core_capable_loot_tables"], 0)
        self.assertEqual(facts["roadside_core_capable_loot_tables"], 0)
        self.assertEqual(facts["eligible_roadside_containers_today"], 0)
        self.assertEqual(len(facts["physical_core_specimen_sources"]), 3)
        self.assertEqual(len(facts["plan_sources"]), 3)

    def test_specimen_sources_are_one_time_and_flagged(self) -> None:
        facts = sensitivity.core_capable_sources(self.model)
        for row in facts["physical_core_specimen_sources"]:
            self.assertTrue(row["one_time"])
            self.assertIn("PROVISIONAL", str(row["binding_status"]))

    def test_grid_is_labelled_and_zero_probability_means_zero(self) -> None:
        grid = sensitivity.core_probability_grid(self.hypotheses["core_probability"])
        self.assertEqual(grid["label"], sensitivity.HYPOTHETICAL_LABEL)
        for row in grid["table"]:
            if row["p_per_crate"] == 0 or row["crates_per_trip"] == 0:
                self.assertEqual(row["p_after_10_trips"], 0.0)
                self.assertIsNone(row["expected_trips_to_first"])

    def test_grid_is_monotone_in_crates_and_probability(self) -> None:
        grid = sensitivity.core_probability_grid(self.hypotheses["core_probability"])
        rows = {(row["p_per_crate"], row["crates_per_trip"]): row for row in grid["table"]}
        self.assertLess(
            rows[(0.01, 1)]["p_after_10_trips"], rows[(0.01, 2)]["p_after_10_trips"]
        )
        self.assertLess(
            rows[(0.005, 4)]["p_after_10_trips"], rows[(0.01, 4)]["p_after_10_trips"]
        )

    def test_crates_needed_for_confidence(self) -> None:
        self.assertEqual(sensitivity.crates_needed_for_confidence(0.01, 0.9), 230)
        self.assertIsNone(sensitivity.crates_needed_for_confidence(0.0, 0.9))

    def test_count_uncertainty_shows_fragility(self) -> None:
        rows = sensitivity.count_uncertainty(self.hypotheses["core_probability"])
        base = next(row for row in rows if row["p_per_crate"] == 0.01 and row["crates_per_trip"] == 2)
        minus = next(row for row in rows if row["p_per_crate"] == 0.01 and row["crates_per_trip"] == 1)
        plus = next(row for row in rows if row["p_per_crate"] == 0.01 and row["crates_per_trip"] == 3)
        self.assertLess(minus["p_after_10_trips"], base["p_after_10_trips"])
        self.assertLess(base["p_after_10_trips"], plus["p_after_10_trips"])


class ReadingTests(unittest.TestCase):
    def test_two_readings_of_rolls_are_reported(self) -> None:
        model = support.model()
        table = tables_from_model(model)["roadside_cache"]
        rows = sensitivity.reading_sensitivity(model, table)
        self.assertEqual(rows["reading_a"]["label"], "independent draws with replacement")
        # Without replacement the chance of seeing each item must be higher.
        for item, probability in rows["reading_a"]["p_at_least_one"].items():
            self.assertGreater(rows["reading_b"]["p_at_least_one"][item], probability)


class MonteCarloDeterminismTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = support.model()
        self.table = tables_from_model(self.model)["roadside_cache"]

    def run_once(self, seed: int):
        return sensitivity.seeded_sessions(
            self.model, self.table, claims_per_session=3, sessions=14, runs=200, seed=seed
        )

    def test_same_seed_same_result(self) -> None:
        self.assertEqual(self.run_once(20261030), self.run_once(20261030))

    def test_different_seed_is_close_but_not_identical(self) -> None:
        a = self.run_once(1)
        b = self.run_once(2)
        self.assertNotEqual(a["per_item"], b["per_item"])
        self.assertLess(abs(a["per_item"]["iron_scrap"]["mean"] - b["per_item"]["iron_scrap"]["mean"]), 12.0)

    def test_labels_are_present(self) -> None:
        result = self.run_once(7)
        self.assertEqual(result["label"], sensitivity.HYPOTHETICAL_LABEL)
        self.assertIn("no human playtest", result["basis"])


class UnluckyAndBudgetTests(unittest.TestCase):
    def test_unlucky_probability_is_exact(self) -> None:
        model = support.model()
        table = tables_from_model(model)["roadside_cache"]
        result = sensitivity.unlucky_player(
            model, table, ("knowledge_spares", "research_notes"), claims_per_trip=3
        )
        self.assertAlmostEqual(result["p_one_claim_yields_none_of_tracked"], 0.55 ** 3, places=6)
        self.assertAlmostEqual(result["p_one_trip_yields_none_of_tracked"], 0.55 ** 9, places=6)
        self.assertEqual(result["claims_for_90pct_chance_of_one_useful_claim"], 2)

    def test_trip_budget_math(self) -> None:
        rows = sensitivity.trip_budget_sensitivity([416.0], budgets=(2700.0,))
        self.assertEqual(rows[0]["trips_per_session_floor"], 6)
        self.assertAlmostEqual(rows[0]["share_of_budget"], 0.1541, places=4)

    def test_cargo_survival_extremes(self) -> None:
        rows = sensitivity.cargo_survival(0.08, [0.0, 0.5, 1.0], {"core_ember": 1.0})
        fractions = [row["expected_retained_fraction"] for row in rows]
        self.assertEqual(fractions, [0.92, 0.96, 1.0])

    def test_unmodelled_death_is_not_zero(self) -> None:
        rows = sensitivity.cargo_survival(None, [0.0], {"core_ember": 1.0})
        self.assertEqual(rows[0]["status"], "UNMODELLED_NO_DEATH_MODEL_KEY")
        self.assertIsNone(rows[0]["death_chance"])

    def test_research_gate_numbers(self) -> None:
        model = support.model()
        table = tables_from_model(model)["roadside_cache"]
        result = sensitivity.research_gate_claims(model, table, "tech_smelting")
        self.assertEqual(result["gating_item"], "knowledge_spares")
        self.assertAlmostEqual(result["gating_expected_claims"], 2.525, places=3)
        self.assertGreater(result["p_gated_item_covered_in_10_claims"], 0.99)


if __name__ == "__main__":
    unittest.main()
