"""Guard A8's fail-closed owner-projection proposal and fixture boundary."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


class OwnerProjectionContractTests(unittest.TestCase):
    def test_projection_identity_revision_and_owner_clock_are_required(self) -> None:
        contract = json.loads(
            (ROOT / "data/survival/world_content/interaction_contract.v1.json").read_text(
                encoding="utf-8"
            )
        )
        required = set(contract["projection_required_fields"])
        self.assertTrue(
            {
                "schema_version",
                "source_id",
                "projection_revision",
                "site_state",
                "claim_generation",
                "capabilities",
                "ready_actions",
                "resource_ready_at",
                "clock_seconds",
            }.issubset(required)
        )
        proposal = contract["owner_projection_contract"]
        self.assertEqual(proposal["contract_id"], "soh.native_poi.owner_projection.v1")
        self.assertIn("A0 approval required", proposal["status"])
        self.assertIn("monotonically increasing", proposal["revision"])

    def test_scene_checks_owner_identity_revision_and_receipt_identity(self) -> None:
        source = (
            ROOT / "game/survival/world_content/scripts/native_poi_site.gd"
        ).read_text(encoding="utf-8")
        self.assertIn('owner_projection.get("source_id", "")', source)
        self.assertIn('owner_projection.get("projection_revision", null)', source)
        self.assertIn('result.get("intent_id", "")', source)
        self.assertIn("_projection_payload_matches", source)
        self.assertIn("_projection_revision", source)

    def test_revision_counter_and_inventory_are_explicitly_test_fixture_only(self) -> None:
        fixture = (
            ROOT / "game/survival/world_content/scripts/poi_authority_fixture.gd"
        ).read_text(encoding="utf-8")
        self.assertIn("TEST FIXTURE ONLY", fixture)
        self.assertIn('"projection_revision"', fixture)
        self.assertIn("func snapshot()", fixture)


if __name__ == "__main__":
    unittest.main()
