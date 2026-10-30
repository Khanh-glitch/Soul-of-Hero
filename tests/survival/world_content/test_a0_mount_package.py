"""A0 owner handoff contract assertions; no production mount is simulated here."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "data/survival/world_content"


class A0MountTransitionPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.package = json.loads((DATA / "a8_a0_mount_transition_package.v2.json").read_text(encoding="utf-8"))
        cls.historical = json.loads((DATA / "a0_mount_transition_package.v1.json").read_text(encoding="utf-8"))

    def test_current_owner_pins_and_contract_versions_are_explicit(self) -> None:
        package = self.package
        self.assertEqual(package["package_status"], "A8_OWNER_CONTRACT_REFRESH_READY_FOR_A0_REVIEW_NOT_MOUNTED")
        self.assertEqual(package["source_pins"]["a0_pr21_head"], "5b932fd4bc6ae5966cd9662f262f70aa384c2f99")
        self.assertEqual(package["source_pins"]["a1_pr20_head"], "61cd8d3730cef91fe061ac9cd7cfee9f6e013193")
        self.assertEqual(package["contracts"]["physical_interaction"], "data/survival/world_content/interaction_contract.v3.json")
        self.assertEqual(package["contracts"]["shell_transition"], "data/survival/world_content/transition_contract.v2.json")
        self.assertEqual(package["contracts"]["run_phase_projection"], "soh.a0.run_phase_projection.v1")
        self.assertEqual(package["a1_authored_world_extent_cells"], [1024, 768])
        self.assertEqual(package["production_world_extent_mount_status"], "A0_REVIEW_REQUIRED_NOT_ASSERTED_BY_A8")
        self.assertFalse(package["owner_seam"]["a8_has_save_or_currency_authority"])
        self.assertEqual(len(package["existing_a8_sites"]), 3)
        self.assertEqual({site["poi_id"] for site in package["existing_a8_sites"]}, {
            "poi_crown_south_quarry", "poi_crown_south_orchard", "poi_crown_south_mill"
        })

    def test_historical_package_is_not_reused_and_integration_stays_external(self) -> None:
        self.assertIn("HISTORICAL_SUPERSEDED_BY_V2", self.historical["package_status"])
        self.assertFalse(self.package["current_evidence_status"]["a0_a1_a3_avfx_production_integration"] == "PASS")
        self.assertIn("two-process", self.package["production_mount_gates"][-1])
        self.assertTrue(any("A3" in gate for gate in self.package["production_mount_gates"]))
        self.assertTrue(any("AVFX" in gate for gate in self.package["production_mount_gates"]))


if __name__ == "__main__":
    unittest.main()
