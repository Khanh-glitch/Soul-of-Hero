"""R13-A8-POI2 source/identity guardrails for Quarry and Orchard."""

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CONTRACT = json.loads(
    (ROOT / "data/survival/world_content/a8_physical_destinations_r13.v1.json").read_text()
)


class R13PhysicalDestinationTests(unittest.TestCase):
    def setUp(self):
        self.sites = CONTRACT["sites"]

    def test_canonical_a1_anchors_and_mount_transforms_are_unchanged(self):
        expected = {
            "quarry": ([30, 280], [424, 4424], "south_quarry.json"),
            "orchard": ([140, 360], [2184, 5704], "south_orchard_ruin.json"),
        }
        for name, (cell, root_px, data_name) in expected.items():
            with self.subTest(site=name):
                entry = self.sites[name]
                self.assertEqual(entry["canonical_cell"], cell)
                self.assertEqual(entry["mount_transform"]["root_world_px"], root_px)
                definition = json.loads(
                    (ROOT / "data/survival/world_content/sites" / data_name).read_text()
                )
                self.assertEqual(definition["source"]["poi_id"], entry["poi_id"])
                self.assertEqual(definition["source"]["canonical_cell"], cell)
                clue = definition["approach_clue"]
                clue_marker = next(
                    prop
                    for prop in definition["overworld_shell"]["visual_layout"]["props"]
                    if prop.get("id", "").endswith("notice")
                )
                self.assertEqual(clue["local_px"], clue_marker["local_px"])
                if name == "orchard":
                    self.assertIn("unknown", clue["text"].lower())
                else:
                    self.assertIn("power", clue["text"].lower())
                socket = entry["mount_transform"]["shell_local_action_socket_px"]
                expected_root = [cell[0] * 16 + 8 - socket[0], cell[1] * 16 + 8 - socket[1]]
                self.assertEqual(expected_root, root_px)
                self.assertTrue(entry["mount_transform"]["interior_must_not_be_scaled_or_mounted_overworld"])

    def test_each_site_has_distinct_physical_scenes_and_stable_source_identity(self):
        quarry = self.sites["quarry"]
        orchard = self.sites["orchard"]
        self.assertEqual(quarry["source_identity"]["poi_id"], quarry["poi_id"])
        self.assertEqual(orchard["source_identity"]["poi_id"], orchard["poi_id"])
        self.assertNotEqual(quarry["poi_id"], orchard["poi_id"])
        self.assertNotEqual(
            quarry["scenes"]["interior_worksite"], orchard["scenes"]["interior_worksite"]
        )
        self.assertEqual(quarry["scenes"]["interior_worksite"], "res://game/survival/world_content/scenes/south_quarry.tscn")
        self.assertEqual(orchard["scenes"]["interior_worksite"], "res://game/survival/world_content/scenes/south_orchard_ruin.tscn")
        for site in (quarry, orchard):
            with self.subTest(site=site["poi_id"]):
                self.assertEqual(site["source_identity"]["physical_instance_id"], None)
                self.assertTrue(site["persistence_intent"]["owner_projection_only"])
                self.assertFalse(site["persistence_intent"]["a8_local_persistent_state"])
                self.assertTrue(site["persistence_intent"]["a0_save_service_required"])
                self.assertTrue(site["transition"]["return"]["same_poi_id"])
                self.assertTrue(site["transition"]["return"]["same_canonical_cell"])

    def test_quarry_is_layered_and_fails_closed_without_existing_owner_capabilities(self):
        quarry = self.sites["quarry"]
        conditions = quarry["clue_credential_power_hazard_conditions"]
        self.assertIn("cap_salvage", conditions["credential_and_power"])
        self.assertIn("cap_power_1", conditions["credential_and_power"])
        self.assertIn("prepared route", conditions["credential_and_power"])
        self.assertIn("Route length", conditions["cost_and_risk"])
        self.assertIn("NOT_AUTHORIZED/NOT_TESTED", conditions["hazard"])
        self.assertIsNone(quarry["actions"]["economic_salvage"]["a3_binding"])
        self.assertEqual(quarry["actions"]["economic_salvage"]["dispatch"], "FAIL_CLOSED")
        gate = quarry["collision_footprint"]["deep_gate_requires_owner_projection"]
        self.assertEqual(gate["capabilities"], ["cap_salvage", "cap_power_1"])
        self.assertIn("quarry_deep_gate", gate["state_values"])
        self.assertIsNone(quarry["actions"]["deep_partial_information"]["a3_receipt"])

    def test_orchard_is_water_and_graft_specific_with_no_assumed_yield(self):
        orchard = self.sites["orchard"]
        actions = orchard["actions"]
        self.assertIn("read_water_marks", actions["neutral_action_ids"])
        self.assertIsNone(actions["knowledge_opportunity"]["reward"])
        self.assertIsNone(actions["knowledge_opportunity"]["a3_receipt"])
        self.assertIsNone(actions["bank_reeds"]["a3_binding"])
        self.assertIn("Water depth remains UNKNOWN", orchard["clue_credential_power_hazard_conditions"]["hazard"])
        self.assertNotIn("quarry_route", json.dumps(orchard))

    def test_owner_authority_and_unapproved_a3_binding_are_explicit(self):
        self.assertEqual(CONTRACT["status"], "A8_SCENES_AND_SOURCE_CONTRACT_READY_FOR_A0_COMPOSITION_NOT_PRODUCTION_MOUNTED")
        self.assertEqual(CONTRACT["source_pins"]["a3_quarry_status"], "REJECTED_PENDING_EVIDENCE_FAIL_CLOSED")
        self.assertEqual(CONTRACT["source_pins"]["a3_approved_bindings"], [])
        fixture = json.loads(
            (ROOT / "tests/fixtures/survival/world_content/a8_native_poi_action_catalog.fixture.json").read_text()
        )
        for action_id in ("inspect_cut_marks", "open_quarry_deep_gate", "survey_deep_cut"):
            with self.subTest(action=action_id):
                behavior = fixture["actions"]["poi_crown_south_quarry"][action_id]
                self.assertEqual(behavior["costs"], {})
                self.assertEqual(behavior["rewards"], {})
                self.assertEqual(behavior["cooldown_seconds"], 0)
                self.assertTrue(behavior["test_only_non_economic_projection"])
        self.assertFalse(CONTRACT["owner_boundary"]["a8_local_save_or_inventory_authority"])
        self.assertFalse(CONTRACT["owner_boundary"]["a8_local_hazard_damage_authority"])
        self.assertEqual(CONTRACT["owner_boundary"]["a0_composition_status"], "NOT_MOUNTED")
        forbidden = {"currency_delta", "item_delta", "receipt", "grant", "cooldown_seconds", "price"}
        for name in ("quarry", "orchard"):
            definition_name = self.sites[name]["scenes"]["definition"].rsplit("/", 1)[-1]
            definition = json.loads(
                (ROOT / "data/survival/world_content/sites" / definition_name).read_text()
            )
            for action in definition["choices"] + definition["actions"]:
                self.assertTrue(forbidden.isdisjoint(action), (name, action["action_id"]))


if __name__ == "__main__":
    unittest.main()
