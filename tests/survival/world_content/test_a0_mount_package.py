"""A0 owner handoff geometry/authority assertions; no mount is simulated here."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PACKAGE = ROOT / "data/survival/world_content/a0_mount_transition_package.v1.json"


class A0MountTransitionPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.package = json.loads(PACKAGE.read_text(encoding="utf-8"))

    def test_full_world_targets_are_exact_and_outside_the_current_a0_host(self) -> None:
        package = self.package
        self.assertEqual(package["package_status"], "READY_FOR_A0_REVIEW_NOT_MOUNTED")
        geometry = package["geometry"]
        self.assertEqual(geometry["interior_bounds_px"], [960, 608])
        self.assertEqual(geometry["shell_bounds_px"], [128, 128])
        host_width, host_height = package["a0_current_candidate_bounds"]["host_world_cells"]
        for site in package["sites"]:
            cell = site["canonical_cell"]
            self.assertEqual(site["canonical_anchor_px"], [cell[0] * 16 + 8, cell[1] * 16 + 8])
            self.assertEqual(site["shell_root_px"], [cell[0] * 16 - 56, cell[1] * 16 - 56])
            self.assertFalse(0 <= cell[0] < host_width and 0 <= cell[1] < host_height)
            annex = package["a0_current_candidate_bounds"]
            origin, size = annex["annex_origin_cells"], annex["annex_size_cells"]
            self.assertFalse(origin[0] <= cell[0] < origin[0] + size[0])
            self.assertFalse(origin[1] <= cell[1] < origin[1] + size[1])
            self.assertTrue(site["shell_scene"].startswith("res://"))
            self.assertTrue(site["interior_scene"].startswith("res://"))
            self.assertTrue(site["poi_id"].startswith("poi_crown_"))
        self.assertFalse(package["a0_current_candidate_bounds"]["production_mounted"])
        self.assertFalse(package["owner_seam"]["a8_authority"])
        self.assertFalse(package["owner_seam"]["fixture_data_live"])

    def test_save_and_new_run_proof_remain_a0_two_process_acceptance(self) -> None:
        acceptance = self.package["save_acceptance"]
        self.assertIn("two-process", acceptance["required"])
        self.assertIn("SceneTree", acceptance["not_equivalent"])
        self.assertEqual(acceptance["a8_claim"], "NOT_RUN_BY_A8")
        self.assertIn("retain general achievements", acceptance["d056"])


if __name__ == "__main__":
    unittest.main()
