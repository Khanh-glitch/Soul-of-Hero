"""Expedition pattern tests: time separation, claim policy, capacity, risk."""
from __future__ import annotations

import unittest

import _support as support

from sohbalance.routes import ClaimEngine, capacity_check, plan_legs


class SafeBootstrapLoopTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = support.model()
        self.result = support.run_pattern_by_id("P1_SAFE_BOOTSTRAP_LOOP")

    def test_travel_reproduces_a1_published_first_hour(self) -> None:
        tiles = sum(leg.tiles for leg in self.result.legs)
        self.assertAlmostEqual(tiles, 1541.72, places=2)
        self.assertAlmostEqual(self.result.travel_seconds, 256.95, places=2)

    def test_travel_and_gathering_are_reported_separately(self) -> None:
        self.assertGreater(self.result.gather_seconds, 0)
        self.assertGreater(self.result.interaction_seconds, 0)
        self.assertAlmostEqual(
            self.result.total_seconds,
            self.result.travel_seconds + self.result.gather_seconds + self.result.interaction_seconds,
            places=6,
        )

    def test_claims_respect_policies(self) -> None:
        self.assertEqual(self.result.claims_allowed["waystation_locker"], 1)
        self.assertEqual(self.result.claims_allowed["a1_amber_herb"], 2)
        self.assertEqual(self.result.claims_allowed["a1_crown_salvage"], 1)
        blocked = [row for row in self.result.blocked_claims if row["source_id"] == "waystation_locker"]
        self.assertTrue(all(row["reason"] == "one_time_already_claimed" for row in blocked))

    def test_loot_is_not_double_counted(self) -> None:
        # 2 scrap + 3 scrap from the renewable cache, not 4 + 3.
        self.assertAlmostEqual(self.result.loot_units["iron_scrap"], 5.0, places=6)
        self.assertAlmostEqual(self.result.loot_units["knowledge_spares"], 3.0, places=6)

    def test_unmodelled_time_is_declared(self) -> None:
        payload = self.result.as_dict()
        self.assertIn("combat", payload["unmodelled_time"])
        self.assertIn("player reading/planning/deciding", payload["unmodelled_time"])

    def test_risk_label_is_not_silently_converted_to_zero_death(self) -> None:
        payload = self.result.as_dict()
        self.assertEqual(payload["bottleneck_risk"], "early")
        self.assertEqual(payload["death_chance_status"], "UNMODELLED_NO_DEATH_MODEL_KEY")
        self.assertIsNone(payload["death_chance_hypothesis"])


class FilteredMaterialRunTests(unittest.TestCase):
    def setUp(self) -> None:
        self.result = support.run_pattern_by_id("P2_FILTERED_MATERIAL_RUN")

    def test_three_claims_are_harvested(self) -> None:
        self.assertEqual(self.result.claims_allowed["a1_crown_tuff"], 1)
        self.assertEqual(self.result.claims_allowed["a1_crown_iron"], 1)
        self.assertEqual(self.result.claims_allowed["a1_crown_reed"], 2)

    def test_yields_come_from_the_source_declarations(self) -> None:
        self.assertAlmostEqual(self.result.loot_units["stone_chunk"], 2.0)
        self.assertAlmostEqual(self.result.loot_units["iron_ore"], 2.0)
        self.assertAlmostEqual(self.result.loot_units["reed_fibre"], 4.0)

    def test_trip_fits_inside_one_session(self) -> None:
        self.assertLess(self.result.total_seconds, 2700.0)

    def test_route_avoids_high_risk_corridors(self) -> None:
        self.assertTrue(all(leg.risk not in ("high", "combat") for leg in self.result.legs))


class UnderpreparedTests(unittest.TestCase):
    def setUp(self) -> None:
        self.result = support.run_pattern_by_id("P3_UNDERPREPARED_SHORTCUT")

    def test_intended_shortcut_is_reported_as_locked(self) -> None:
        codes = [finding.code for finding in self.result.findings]
        self.assertIn("ROUTE_LOCKED_FOR_CAPABILITIES", codes)

    def test_no_invented_unmitigated_crossing(self) -> None:
        used_routes = {route for leg in self.result.legs for route in leg.route_ids}
        self.assertNotIn("rt_east_seam", used_routes)
        self.assertIn("rt_crown_safe_approach", used_routes)

    def test_fallback_trip_is_still_planned(self) -> None:
        self.assertGreater(len(self.result.legs), 0)
        self.assertTrue(all(leg.tiles > 0 for leg in self.result.legs))


class ContainerSearchTests(unittest.TestCase):
    def setUp(self) -> None:
        self.result = support.run_pattern_by_id("P4_ROADSIDE_CONTAINER_SEARCH")

    def test_yields_are_table_expectations_times_claims(self) -> None:
        self.assertAlmostEqual(self.result.loot_units["iron_scrap"], 10.8, places=6)
        self.assertAlmostEqual(self.result.loot_units["knowledge_spares"], 4.05, places=6)

    def test_result_is_labelled_hypothetical(self) -> None:
        codes = [finding.code for finding in self.result.findings]
        self.assertIn("NONE_ELIGIBLE", codes)
        note = next(f for f in self.result.findings if f.code == "NONE_ELIGIBLE")
        self.assertIn("hypothetical", note.detail)

    def test_search_time_uses_the_a3_assumption(self) -> None:
        self.assertAlmostEqual(self.result.gather_seconds, 3 * 20.0, places=6)


class FirstCoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.result = support.run_pattern_by_id("P5_FIRST_CORE_DETERMINISTIC")

    def test_core_is_deterministic_not_random(self) -> None:
        self.assertAlmostEqual(self.result.loot_units["core_ember"], 1.0, places=6)

    def test_declared_source_risk_drives_the_death_chance(self) -> None:
        payload = self.result.as_dict()
        self.assertEqual(payload["bottleneck_risk"], "medium")
        self.assertAlmostEqual(payload["death_chance_hypothesis"], 0.03, places=6)


class SinkCoverageTests(unittest.TestCase):
    def test_partition_is_exhaustive(self) -> None:
        from sohbalance.loot import sink_coverage, sink_targets

        model = support.model()
        coverage = sink_coverage(model, {"iron_scrap": 5.0})
        self.assertEqual(
            sorted(coverage["covered"] + coverage["short"]), sorted(sink_targets(model))
        )

    def test_first_hour_loop_does_not_fund_a_research_kit_alone(self) -> None:
        from sohbalance.loot import sink_coverage

        result = support.run_pattern_by_id("P1_SAFE_BOOTSTRAP_LOOP")
        coverage = sink_coverage(support.model(), result.loot_units)
        self.assertIn("research_kit", coverage["short"])
        self.assertEqual(
            coverage["detail"]["research_kit"]["shortfall"], {"iron_ingot": 2.0, "oak_wood": 4.0}
        )
        # Spares are exactly enough for the kit: 3 of 3.
        self.assertNotIn("knowledge_spares", coverage["detail"]["research_kit"]["shortfall"])

    def test_filtered_run_covers_weaving(self) -> None:
        from sohbalance.loot import sink_coverage

        result = support.run_pattern_by_id("P2_FILTERED_MATERIAL_RUN")
        coverage = sink_coverage(support.model(), result.loot_units)
        self.assertIn("weave_cloth", coverage["covered"])


class ClaimEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = support.model()

    def test_one_time_flag_survives_a_new_session(self) -> None:
        engine = ClaimEngine(self.model)
        engine.start_session()
        self.assertEqual(engine.request("waystation_locker", 1)[0], 1)
        engine.start_session()
        self.assertEqual(engine.request("waystation_locker", 1)[0], 0)

    def test_session_cap_limits_repeat_claims(self) -> None:
        engine = ClaimEngine(self.model)
        engine.start_session()
        allowed, blocked = engine.request("a1_crown_salvage", 5)
        self.assertEqual(allowed, 1)
        self.assertTrue(any(row["reason"] == "session_claim_cap" for row in blocked))

    def test_unknown_source_raises(self) -> None:
        engine = ClaimEngine(self.model)
        with self.assertRaises(KeyError):
            engine.request("not_a_source", 1)


class LegPlanningTests(unittest.TestCase):
    def setUp(self) -> None:
        self.net = support.network()

    def test_grants_are_applied_between_legs(self) -> None:
        grants = {"poi_crown_waystation": ["cap_salvage"]}
        legs, findings = plan_legs(
            self.net,
            "node_refuge",
            ["poi_crown_waystation", "poi_crown_relay_shed"],
            [],
            ["high", "combat"],
            grants,
        )
        self.assertEqual(findings, [])
        self.assertEqual(len(legs), 3)
        # safe approach 430 + waystation spur 16; waystation spur 16 + relay spur 60;
        # relay spur 60 + safe approach 430 (never the 336.52-tile high-risk seam)
        self.assertAlmostEqual(sum(leg.tiles for leg in legs), 446.0 + 76.0 + 490.0, places=2)
        self.assertTrue(all("rt_east_seam" not in leg.route_ids for leg in legs))

    def test_impossible_stop_reports_unreachable(self) -> None:
        legs, findings = plan_legs(
            self.net, "node_refuge", ["poi_verdant_canopy_temple"], [], ["high", "combat"]
        )
        self.assertEqual(legs, [])
        self.assertEqual([finding.code for finding in findings], ["ROUTE_UNREACHABLE"])


class CapacityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = support.model()

    def test_stack_limit_adds_slots(self) -> None:
        slots, overflow, findings = capacity_check({"knowledge_spares": 120.0}, 30, "case", self.model)
        self.assertEqual(slots, 3)  # 120 / stack_limit 50 -> 3 slots
        self.assertEqual(overflow, 0)
        self.assertEqual(findings, [])

    def test_overflow_is_flagged(self) -> None:
        slots, overflow, findings = capacity_check(
            {f"item_{index}": 1.0 for index in range(45)}, 30, "case", self.model
        )
        self.assertEqual(overflow, 15)
        self.assertEqual([f.code for f in findings], ["CAPACITY_TRUNCATED"])

    def test_unique_instance_cannot_stack(self) -> None:
        _slots, _overflow, findings = capacity_check({"core_ember": 2.0}, 30, "case", self.model)
        self.assertEqual([f.code for f in findings], ["UNIQUE_INSTANCE_DUPLICATION_BLOCKED"])


if __name__ == "__main__":
    unittest.main()
