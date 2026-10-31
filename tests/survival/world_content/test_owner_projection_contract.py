"""Guard A8's fail-closed owner-projection proposal and fixture boundary."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


class OwnerProjectionContractTests(unittest.TestCase):
    def test_projection_identity_revision_and_owner_clock_are_required(self) -> None:
        contract = json.loads(
            (ROOT / "data/survival/world_content/interaction_contract.v3.json").read_text(
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
        self.assertEqual(contract["contract_id"], "soh.native_poi.intent.v3")
        self.assertEqual(contract["intent_required_fields"], contract["intent_allowed_fields"])
        self.assertEqual(len(contract["intent_allowed_fields"]), 16)
        intent_required = set(contract["intent_required_fields"])
        self.assertIn("run_id", intent_required)
        self.assertIn("site_instance_id", intent_required)
        self.assertIn("observed_phase_projection_revision", intent_required)
        self.assertIn("actor_local_position", intent_required)
        superseded = json.loads(
            (ROOT / "data/survival/world_content/interaction_contract.v2.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertIn("SUPERSEDED_BY_V3", superseded["status"])
        self.assertTrue(any("no a3-approved" in rule.lower() for rule in contract["request_rules"]))
        retired = json.loads(
            (ROOT / "data/survival/world_content/interaction_contract.v1.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(retired["status"], "SUPERSEDED_UNAPPROVED_NEVER_USE")
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

    def test_site_sources_cannot_author_prices_and_fixture_catalog_has_no_approval(self) -> None:
        forbidden = {
            "costs", "rewards", "cooldown_seconds", "claim_policy", "catalog_source",
            "provisional_test_only", "unlock_actions", "unlock_after_state_seconds",
        }
        sites = sorted((ROOT / "data/survival/world_content/sites").glob("*.json"))
        action_catalog = json.loads(
            (ROOT / "tests/fixtures/survival/world_content/a8_native_poi_action_catalog.fixture.json")
            .read_text(encoding="utf-8")
        )
        item_catalog = json.loads(
            (ROOT / "data/survival/world_content/catalog_candidates.fixture.json")
            .read_text(encoding="utf-8")
        )
        self.assertEqual(action_catalog["schema"], "soh.a8.test_only_action_catalog.v1")
        self.assertIs(action_catalog["fixture_only"], True)
        self.assertEqual(action_catalog["a3_approved_bindings"], {})
        fixture_source = (
            ROOT / "game/survival/world_content/scripts/poi_authority_fixture.gd"
        ).read_text(encoding="utf-8")
        self.assertIn("tests/fixtures/survival/world_content/", fixture_source)
        self.assertIn('not _fixture_action_catalog.get("fixture_only", false)', fixture_source)
        for path in sites:
            site = json.loads(path.read_text(encoding="utf-8"))
            poi_id = site["source"]["poi_id"]
            entries = site.get("choices", []) + site.get("actions", [])
            for entry in entries:
                self.assertFalse(forbidden.intersection(entry), (path.name, entry))
                self.assertIn(entry["action_id"], action_catalog["actions"][poi_id])
        quarry = action_catalog["actions"]["poi_crown_south_quarry"]
        self.assertEqual(quarry["brace_east_shelf"]["costs"], {"oak_wood": 2})
        self.assertEqual(quarry["chock_west_ramp"]["costs"], {"stone_chunk": 2})
        self.assertEqual(quarry["extract_outcrop"]["rewards"], {"stone_chunk": 2})
        self.assertEqual(quarry["extract_outcrop"]["cooldown_seconds"], 45)
        self.assertIs(item_catalog["fixture_only"], True)

    def test_revision_counter_and_inventory_are_explicitly_test_fixture_only(self) -> None:
        fixture = (
            ROOT / "game/survival/world_content/scripts/poi_authority_fixture.gd"
        ).read_text(encoding="utf-8")
        self.assertIn("TEST FIXTURE ONLY", fixture)
        self.assertIn('"projection_revision"', fixture)
        self.assertIn("func snapshot()", fixture)


if __name__ == "__main__":
    unittest.main()
