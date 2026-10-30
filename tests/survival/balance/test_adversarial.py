"""Adversarial tests: the validator must catch injected faults, not just clean data."""
from __future__ import annotations

import copy
import unittest

import _support as support

from sohbalance import adversarial
from sohbalance.checks import collect, codes_in


class AdversarialSuiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.model = support.model()
        findings, _meta = collect(cls.model, support.network())
        cls.baseline_codes = codes_in(findings)
        counts = {}
        for finding in findings:
            counts[finding.code] = counts.get(finding.code, 0) + 1
        cls.baseline_counts = counts
        cls.cases = adversarial.run_all(cls.model, cls.baseline_codes, counts)

    def test_every_case_passes(self) -> None:
        failed = [case.as_dict() for case in self.cases if not case.passed]
        self.assertEqual(failed, [])

    def test_case_mix_is_substantial(self) -> None:
        kinds = [case.kind for case in self.cases]
        self.assertEqual(kinds.count("DATA_FAULT"), 12)
        self.assertEqual(kinds.count("BEHAVIOUR"), 12)
        self.assertEqual(len(self.cases), 24)

    def test_data_fault_cases_use_injected_defects(self) -> None:
        for case in self.cases:
            if case.kind != "DATA_FAULT":
                continue
            if case.case_id in {"D11_inaccessible_site", "D12_invented_a1_quantity"}:
                continue  # these two also exist in baseline by design
            self.assertEqual(case.also_in_baseline, [], case.case_id)
            self.assertTrue(case.observed_codes, case.case_id)

    def test_core_in_junk_is_caught(self) -> None:
        case = next(c for c in self.cases if c.case_id == "D02_core_in_roadside_junk")
        self.assertIn("LOOT_EXCLUDED_TAG_VIOLATION", case.observed_codes)

    def test_absent_source_is_caught(self) -> None:
        case = next(c for c in self.cases if c.case_id == "D01_absent_source_item")
        self.assertIn("LOOT_ITEM_UNKNOWN", case.observed_codes)

    def test_repeated_claim_is_blocked(self) -> None:
        case = next(c for c in self.cases if c.case_id == "B03_repeated_one_time_claim")
        self.assertIn("REPEATED_ONE_TIME_CLAIM_BLOCKED", case.observed_codes)

    def test_reload_does_not_regrant(self) -> None:
        case = next(c for c in self.cases if c.case_id == "B04_reload_does_not_regrant")
        self.assertTrue(case.passed)

    def test_zero_restock_rule(self) -> None:
        case = next(c for c in self.cases if c.case_id == "B06_zero_restock_not_renewable")
        self.assertIn("ZERO_RESTOCK_NOT_RENEWABLE", case.observed_codes)

    def test_bag_overflow_is_exact(self) -> None:
        case = next(c for c in self.cases if c.case_id == "B07_bag_capacity_overflow")
        self.assertIn("overflow=15", case.detail)
        self.assertIn("CAPACITY_TRUNCATED", case.observed_codes)

    def test_no_route_case_returns_none_not_a_fake_path(self) -> None:
        case = next(c for c in self.cases if c.case_id == "B01_no_route_returns_none")
        self.assertTrue(case.passed)
        self.assertEqual(case.observed_codes, ["ROUTE_UNREACHABLE"])

    def test_unlucky_player_is_quantified(self) -> None:
        case = next(c for c in self.cases if c.case_id == "B09_unlucky_trip_is_possible")
        self.assertTrue(case.passed)
        self.assertIn("0.166", case.detail)

    def test_fault_injection_never_mutates_the_real_model(self) -> None:
        before = copy.deepcopy(self.model.docs)
        adversarial.run_all(self.model, self.baseline_codes, self.baseline_counts)
        self.assertEqual(before, self.model.docs)

    def test_baseline_model_is_unchanged_by_the_suite(self) -> None:
        findings, _meta = collect(self.model, support.network())
        self.assertEqual(codes_in(findings), self.baseline_codes)


class BootstrapClosureTests(unittest.TestCase):
    """The station-only spare edge stays a detector, not a blocker.

    Round 3 closed the old "first research is a bootstrap cycle" blocker: A1
    authorizes 2 knowledge_spares per Waystation cache claim and ``research_kit``
    is a *workbench* recipe, so the ladder starts with no station at all. The
    detector is deliberately kept as an early warning: it fires on the
    make_spares <-> research-station edge, and it must clear as soon as one
    non-station source exists. That is proven here in memory, without touching
    any loot table or rate.
    """

    def test_cycle_clears_when_one_non_loot_spare_source_exists(self) -> None:
        import copy as _copy

        from sohbalance import access

        model = support.model()
        baseline = access.bootstrap_cycle_findings(model)
        self.assertTrue(any(f.code == "BOOTSTRAP_DEPENDENCY_CYCLE" for f in baseline))

        docs = _copy.deepcopy(model.docs)
        docs["a3.sources"]["sources"]["live_reclaimed_spares"] = {
            "id": "live_reclaimed_spares",
            "item_id": "knowledge_spares",
            "acquisition": "harvest",
            "region_id": "opening_marches",
            "poi_id": None,
            "yield_per_claim": 1,
            "replenishment_seconds": 600,
            "risk": "low",
            "requirements": [],
            "integration_status": "LIVE_SURV_010",
            "provenance": ["TEST_FIXTURE"],
            "balance_status": "TEST_FIXTURE_NOT_GAMEPLAY",
        }
        patched = type(model).from_docs(docs)
        after = access.bootstrap_cycle_findings(patched)
        self.assertFalse(any(f.code == "BOOTSTRAP_DEPENDENCY_CYCLE" for f in after))

        # The real model and the real loot table are untouched.
        self.assertTrue(any(f.code == "BOOTSTRAP_DEPENDENCY_CYCLE" for f in access.bootstrap_cycle_findings(support.model())))


if __name__ == "__main__":
    unittest.main()
