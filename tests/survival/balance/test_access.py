"""Access, ownership and craft-ladder tests.

These are the checks that decide whether a loot source is *reachable*, not
merely *authored*.
"""
from __future__ import annotations

import unittest

import _support as support

from sohbalance import access
from sohbalance.checks import collect

NOVICE_CAPS = ["cap_salvage", "cap_seal_1", "cap_power_1", "cap_filter"]


class BindingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = support.model()
        self.net = support.network()

    def test_every_loot_source_fails_a1_poi_resolution(self) -> None:
        findings, rows = access.audit_bindings(self.model, self.net)
        loot_rows = [row for row in rows if row["acquisition"] == "loot"]
        self.assertEqual(len(loot_rows), 16)
        self.assertEqual(sum(1 for row in loot_rows if row["a1_poi_resolved"]), 0)
        self.assertEqual(
            len([finding for finding in findings if finding.code == "SOURCE_POI_UNRESOLVED"]), 16
        )

    def test_a3_pseudo_poi_ids_are_not_a1_ids(self) -> None:
        references = {
            str(source.get("poi")) for source in self.model.sources.values() if source.get("poi")
        }
        self.assertTrue(all(reference.startswith("poi:") for reference in references), references)
        poi_ids = set(self.model.poi_index())
        self.assertFalse({reference.split(":", 1)[1] for reference in references} & poi_ids)

    def test_product_sources_do_resolve(self) -> None:
        _findings, rows = access.product_source_rows(self.model, self.net, NOVICE_CAPS)
        bound = [row for row in rows if row["poi_id"]]
        self.assertEqual(len(rows), 19)
        self.assertTrue(all(row["a1_poi_resolved"] for row in bound))
        self.assertTrue(all(row["a1_poi_readiness"] in {
            "AUTHORED_SPEC_NATIVE_NOT_INTEGRATED",
            "CONTRACT_ONLY_NOT_PLAYABLE",
            "SHIPPED_LEGACY_SCENE_NO_A3_LOOT",
        } for row in bound))

    def test_three_specimen_bindings_are_route_locked_at_novice_capabilities(self) -> None:
        _findings, rows = access.product_source_rows(self.model, self.net, NOVICE_CAPS)
        locked = sorted(row["source_id"] for row in rows if row["route_locked"])
        self.assertEqual(locked, ["catalyst_vault", "specimen_frost", "specimen_venom"])

    def test_provisional_bindings_are_labelled(self) -> None:
        findings, _rows = access.product_source_rows(self.model, self.net, NOVICE_CAPS)
        provisional = [finding for finding in findings if finding.code == "PROVISIONAL_BINDING"]
        self.assertGreaterEqual(len(provisional), 4)


class IntegrityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = support.model()
        self.net = support.network()

    def test_no_blocking_reference_errors_in_a3(self) -> None:
        findings = access.audit_integrity(self.model)
        blockers = [finding for finding in findings if finding.severity == "BLOCKER"]
        self.assertEqual(blockers, [])

    def test_seed_preserving_cultivation_cycles_are_informational(self) -> None:
        findings = [f for f in access.audit_integrity(self.model) if f.code == "RECIPE_CYCLE"]
        self.assertTrue(findings)
        self.assertTrue(all(finding.severity == "INFO" for finding in findings))

    def test_overowned_items_are_visible(self) -> None:
        findings = [f for f in access.audit_integrity(self.model) if f.code == "ITEM_OVEROWNED"]
        subjects = sorted(finding.subject for finding in findings)
        self.assertEqual(subjects, ["iron_scrap", "moonleaf_seed"])

    def test_quantity_ownership_dispute_is_reported(self) -> None:
        findings = access.quantity_ownership_findings(self.model)
        self.assertTrue(any(f.code == "QUANTITY_OWNERSHIP_UNRESOLVED" for f in findings))
        self.assertTrue(all(f.severity in ("MAJOR", "BLOCKER") for f in findings))

    def test_source_id_divergence_between_a3_files(self) -> None:
        findings = access.source_id_divergence(self.model)
        subjects = {finding.subject for finding in findings}
        self.assertIn("ancient_catalyst", subjects)


class CraftLadderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = support.model()
        self.seeds = access.seed_sets(self.model)

    def test_native_seed_set_is_the_four_live_items(self) -> None:
        self.assertEqual(
            self.seeds["NATIVE_PROVEN"], ["iron_scrap", "oak_wood", "reed_fibre", "stone_chunk"]
        )

    def test_native_ladder_cannot_build_a_research_station(self) -> None:
        closure = access.craft_closure(self.model, self.seeds["NATIVE_PROVEN"], "native")
        self.assertNotIn("research", closure.stations)
        research_kit = next(
            row for row in closure.blocked if row["recipe_id"] == "research_kit"
        )
        self.assertEqual(research_kit["reason"], "material")
        self.assertIn("knowledge_spares", research_kit["missing"])

    def test_legacy_rewards_ladder_still_cannot(self) -> None:
        closure = access.craft_closure(self.model, self.seeds["NATIVE_PLUS_LEGACY_REWARDS"], "legacy")
        self.assertNotIn("research", closure.stations)
        self.assertEqual(closure.technologies, [])

    def test_authored_plan_ladder_reaches_every_catalogued_item(self) -> None:
        closure = access.craft_closure(
            self.model, self.seeds["AUTHORED_PLAN_INCLUDING_LOOT"], "authored"
        )
        self.assertEqual(sorted(closure.obtainable), sorted(self.model.items))
        self.assertEqual(len(closure.technologies), 5)

    def test_bootstrap_cycle_is_detected(self) -> None:
        findings = access.bootstrap_cycle_findings(self.model)
        cycle = [f for f in findings if f.code == "BOOTSTRAP_DEPENDENCY_CYCLE"]
        self.assertEqual(len(cycle), 1)
        self.assertIn("knowledge_spares", cycle[0].detail)

    def test_no_capability_self_dependency_in_authored_data(self) -> None:
        findings = access.bootstrap_cycle_findings(self.model)
        self.assertEqual([f for f in findings if f.code == "CAPABILITY_SELF_DEPENDENCY"], [])


class HazardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = support.model()

    def test_venom_gate_has_a_covering_item(self) -> None:
        _findings, rows = access.hazard_mitigation_matrix(self.model)
        self.assertTrue(rows)
        for row in rows:
            self.assertEqual(row["covering_items"], ["toxin_mask"])

    def test_acid_gas_hazard_is_not_covered_by_venom_resistance(self) -> None:
        findings, rows = access.hazard_mitigation_matrix(self.model)
        catalyst = next(row for row in rows if row["source_id"] == "vault_catalyst")
        self.assertEqual(catalyst["bound_hazard_kind"], "acid_gas")
        self.assertEqual(catalyst["required_resistance"], "venom:60")
        mismatches = [
            finding
            for finding in findings
            if finding.code == "SOURCE_REQUIREMENT_UNMAPPED" and "acid_gas" in finding.detail
        ]
        self.assertEqual(len(mismatches), 1)

    def test_mitigation_item_is_not_reachable_natively(self) -> None:
        findings = access.resistance_chain_findings(
            self.model, access.hazard_mitigation_matrix(self.model)[1]
        )
        self.assertTrue(any(f.code == "RESISTANCE_CHAIN_BLOCKED" for f in findings))

    def test_risk_vocabulary_mix_is_reported(self) -> None:
        findings, meta = access.risk_vocabulary_findings(self.model, support.network())
        self.assertEqual(meta["severity_labels_used"], ["high", "low"])
        self.assertEqual(meta["band_labels_used"], ["early", "late", "mid"])
        self.assertLess(meta["edges_with_death_model"], meta["edges_total"])
        self.assertTrue(any(f.code == "DEATH_CARGO_LOSS_UNMODELLED" for f in findings))


class ReachabilitySummaryTests(unittest.TestCase):
    def test_playability_is_never_overstated(self) -> None:
        # Whole-model check: no POI may be reported as natively loot bearing.
        _findings, meta = collect(support.model(), support.network())
        for tier, row in meta["capability_reachability"].items():
            self.assertEqual(row["loot_bearing_reachable_pois"], 0, tier)
            self.assertLessEqual(row["playable_reachable_pois"], 2, tier)

    def test_reachable_counts_grow_with_capabilities(self) -> None:
        rows = access.capability_reachability(support.model(), support.network())
        order = ["EMPTY_HANDED", "AFTER_WAYSTATION", "AFTER_RELAY", "AFTER_APOTHECARY", "ALL_AUTHORED_CAPABILITIES"]
        counts = [rows[tier]["reachable_pois"] for tier in order]
        self.assertEqual(counts, sorted(counts))
        self.assertEqual(rows["ALL_AUTHORED_CAPABILITIES"]["reachable_pois"], 108)


if __name__ == "__main__":
    unittest.main()
