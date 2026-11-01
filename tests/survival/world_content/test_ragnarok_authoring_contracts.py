"""Guard the source-grounded A8 phase, territory, and endpoint authoring boundary."""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WORLD_CONTENT = ROOT / "data/survival/world_content"


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


class RagnarokAuthoringContractTests(unittest.TestCase):
    def test_phase_profiles_are_a0_owned_and_keep_existing_three_site_identity(self) -> None:
        data = read_json(WORLD_CONTENT / "site_phase_transformations.v1.json")
        self.assertEqual(data["schema_version"], 1)
        self.assertEqual(data["document_status"], "A8_AUTHORED_OWNER_PROJECTION_REQUIRED_NOT_PRODUCTION_MOUNTED")
        self.assertEqual(data["authority_boundary"]["clock_and_phase"], "A0_ONLY")
        self.assertTrue(data["authority_boundary"]["phase_projection_is_not_a_clock"])
        self.assertTrue(data["authority_boundary"]["a8_may_not_finalize_a_run_or_write_save_data"])
        profiles = {site["poi_id"]: site for site in data["physical_site_profiles"]}
        self.assertEqual(
            set(profiles),
            {"poi_crown_south_quarry", "poi_crown_south_orchard", "poi_crown_south_mill"},
        )
        expected_scenes = {
            "poi_crown_south_quarry": "south_quarry.tscn",
            "poi_crown_south_orchard": "south_orchard_ruin.tscn",
            "poi_crown_south_mill": "south_crown_mill.tscn",
        }
        for poi_id, profile in profiles.items():
            self.assertEqual(Path(profile["a8_scene"]).name, expected_scenes[poi_id])
            self.assertEqual(profile["a1_geography_status"], "AUTHORED_PLAN_NOT_NATIVE_INTEGRATED")
            self.assertEqual(
                set(profile["phase_profiles"]),
                {"ordinary", "ragnarok_day12", "ragnarok_day13", "ragnarok_day14", "run_expired"},
            )
            self.assertTrue(all(entry.get("retreat_route_remains_open", True) for entry in profile["phase_profiles"].values()))
        schedule = {entry["phase_id"]: entry for entry in data["phase_schedule"]}
        self.assertEqual(schedule["ordinary"]["maximum_elapsed_real_hours_exclusive"], 264)
        self.assertEqual(schedule["ragnarok_day12"]["minimum_elapsed_real_hours_inclusive"], 264)
        self.assertEqual(schedule["ragnarok_day13"]["minimum_elapsed_real_hours_inclusive"], 288)
        self.assertEqual(schedule["ragnarok_day14"]["minimum_elapsed_real_hours_inclusive"], 312)
        self.assertEqual(schedule["run_expired"]["minimum_elapsed_real_hours_inclusive"], 336)
        self.assertFalse(schedule["run_expired"]["mutating_a8_intents_allowed"])
        quarry = profiles["poi_crown_south_quarry"]["phase_profiles"]
        self.assertEqual(quarry["ragnarok_day12"]["safe_local_route"], "west")
        self.assertEqual(quarry["ragnarok_day13"]["safe_local_route"], "east")
        self.assertEqual(quarry["ragnarok_day14"]["safe_local_route"], "west")
        for phase in ("ragnarok_day12", "ragnarok_day13", "ragnarok_day14"):
            self.assertEqual(len(quarry[phase]["temporary_blockers"]), 1)
            self.assertTrue(quarry[phase]["retreat_route_remains_open"])
        self.assertEqual(profiles["poi_crown_south_orchard"]["environment_policy"], "unknown_water_depth_remains_blocking; phase_cues_never_change_or_bypass_it")
        for poi_id in ("poi_crown_south_orchard", "poi_crown_south_mill"):
            for phase in ("ragnarok_day12", "ragnarok_day13", "ragnarok_day14"):
                self.assertEqual(profiles[poi_id]["phase_profiles"][phase]["temporary_blockers"], [])

    def test_six_territories_match_pinned_a1_anchors_and_are_not_six_boss_pois(self) -> None:
        data = read_json(WORLD_CONTENT / "ragnarok_six_territories.v1.json")
        self.assertEqual(data["schema_version"], 1)
        self.assertEqual(data["status"], "A8_SOURCE_GROUNDED_AUTHORING_MODEL_NOT_SIX_PLAYABLE_BOSSES")
        self.assertEqual(data["source_pins"]["a1_head"], "9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf")
        self.assertEqual(data["source_pins"]["world_plan_sha256"], "fc5412dfd9651e0b73f65159d686a39b9ec9a3eebac6fb92c9cedd1984175af4")
        territories = data["territories"]
        self.assertEqual(len(territories), 6)
        poi_ids = [territory["canonical_poi_id"] for territory in territories]
        elder_ids = [territory["elder_id"] for territory in territories]
        stone_ids = [territory["stone_id"] for territory in territories]
        milestone_ids = [territory["milestone_id"] for territory in territories]
        self.assertEqual(len(set(poi_ids)), 6)
        self.assertEqual(len(set(elder_ids)), 6)
        self.assertEqual(len(set(stone_ids)), 6)
        self.assertEqual(len(set(milestone_ids)), 6)
        self.assertFalse(data["system_contract"]["territories_are_authored_anchors_not_new_pois"] is False)
        self.assertEqual(data["system_contract"]["boss_presence"], "A5_AUTHORITY_REQUIRED_NOT_IMPLEMENTED_BY_A8")
        self.assertFalse(data["acceptance_scope"]["six_territory_entries_are_playable_bosses"])
        for territory in territories:
            poi_id = territory["canonical_poi_id"]
            self.assertEqual(territory["ordinary_identity"]["a1_status"], "AUTHORED_PLAN_NOT_NATIVE_INTEGRATED")
            self.assertTrue(territory["ordinary_identity"]["name"])
            self.assertTrue(territory["ordinary_identity"]["purpose"])
            self.assertEqual(territory["a1_approach_route_id"], "sp_" + poi_id)
            self.assertTrue(territory["environmental_counterplay"])
            proposals = territory.get("approach_and_retreat_proposals", territory.get("local_route_variants", []))
            self.assertGreaterEqual(len(proposals), 2)
            self.assertIn("A1", territory["approach_and_retreat_status"] or "A1")
            source = territory["rare_late_currency_source"]
            self.assertEqual(source["status"], "A3_NOT_AUTHORIZED_FAIL_CLOSED")
            self.assertIsNone(source["quantity"])
            self.assertIsNone(source["cooldown"])
            self.assertIn("NOT_IMPLEMENTED", territory["boss_and_stone_grant"])
        self.assertEqual(data["two_economies"]["run_local"]["technical_slot_candidate"], "ragnarok_unbanked")
        self.assertEqual(data["two_economies"]["profile_secured"]["technical_slot_candidate"], "profile.secured_ragnarok_currency")
        self.assertEqual(data["two_economies"]["run_local"]["display_name_key"], "currency.ragnarok_unbanked")
        self.assertEqual(data["two_economies"]["profile_secured"]["display_name_key"], "profile.secured_ragnarok_currency")
        self.assertEqual(data["source_pins"]["a3_economy_policy_sha256"], "bbe1095ca589a767742bf0a54ffd4f012d2135410713baa274bafee97cbf91bf")
        self.assertEqual(data["source_pins"]["a3_display_registry_sha256"], "bc5dc5173a13ffcea691289c860baa5532c79b246ad4685ecc2572f75c707c59")
        self.assertIsNone(data["two_economies"]["prices_yields_caps_and_drop_rates"])
        self.assertEqual(data["two_economies"]["candidate_ids_and_display_keys"], "PROPOSAL_NOT_A3_OR_A0_SCHEMA_APPROVAL")
        for service in data["shared_logistics"].values():
            if isinstance(service, dict) and "poi_id" in service:
                self.assertIn(service["status"], {"A1_AUTHORED_ANCHOR_NOT_A8_MOUNTED", "A1_AUTHORED_ANCHOR_A8_SOCKET_PLACEMENT_REQUIRES_A1_REVIEW", "A1_TRIAL_SOCKET_APPROVED_A8_NOT_PRODUCTION_MOUNTED"})

    def test_physical_endpoint_intents_are_neutral_and_use_existing_anchors(self) -> None:
        data = read_json(WORLD_CONTENT / "physical_ragnarok_endpoints.v1.json")
        contract = data["intent_contract"]
        self.assertEqual(data["source_pins"]["a0_head"], "84ac9c1afe19627044c572f6f76794f4923334d6")
        self.assertEqual(data["source_pins"]["a1_head"], "439d5ef1f743da388883377c3e1d4c594e5e8101")
        self.assertEqual(data["source_pins"]["a1_trial_placement_contract_commit"], "439d5ef1f743da388883377c3e1d4c594e5e8101")
        self.assertEqual(data["source_pins"]["a1_trial_placement_contract_path"], "data/survival/world/a1_world_placement_contract.v1.json")
        self.assertEqual(data["source_pins"]["a1_trial_placement_contract_sha256"], "b3ba37aa2dfe91b51689fdac0bab2ad44caa9059204332050c5322d6643f9969")
        self.assertEqual(data["source_pins"]["a3_head"], "b44e22df3af40939069189be14afc23ee1ce21c4")
        self.assertEqual(data["source_pins"]["a1_world_plan_sha256"], "fc5412dfd9651e0b73f65159d686a39b9ec9a3eebac6fb92c9cedd1984175af4")
        self.assertEqual(contract["contract_id"], "soh.a8.physical_intent.v1")
        self.assertTrue(contract["intent_is_neutral_and_not_authoritative"])
        self.assertEqual(len(data["endpoints"]), 4)
        self.assertEqual({item["endpoint_id"] for item in data["endpoints"]}, {
            "endpoint.ragnarok.deposit", "endpoint.ragnarok.fixed_vendor", "endpoint.ragnarok.recycler", "endpoint.ragnarok.evacuation"
        })
        art_manifest = read_json(WORLD_CONTENT / "a8_art_manifest.v1.json")
        visual_authority = data["trial_visual_authority"]
        self.assertEqual(visual_authority["texture_sha256"], art_manifest["textures"]["props"]["sha256"])
        self.assertFalse(visual_authority["production_mount_authorized"])
        self.assertTrue(visual_authority["labels_are_affordances_not_result_or_reward_claims"])
        seen_labels = set()
        for endpoint in data["endpoints"]:
            self.assertIn(endpoint["art_frame"], art_manifest["props_frames"])
            if endpoint.get("accent_art_frame"):
                self.assertIn(endpoint["accent_art_frame"], art_manifest["props_frames"])
            self.assertEqual(endpoint["trial_visual_status"], "A8_SOURCE_ATLAS_COMPOSITION_TRIAL_ONLY_NOT_FINAL_A1_ART_APPROVAL")
            self.assertNotIn(endpoint["trial_affordance_label"], seen_labels)
            seen_labels.add(endpoint["trial_affordance_label"])
            self.assertTrue(endpoint["existing_poi_id"].startswith("poi_"))
            self.assertTrue(endpoint["a1_route_id"].startswith("sp_"))
            self.assertEqual(endpoint["placement_status"], "A1_APPROVED_TRIAL_ONLY_NOT_PRODUCTION_MOUNT")
            self.assertEqual(endpoint["a1_geography_status"], "AUTHORED_PLAN_NOT_NATIVE_INTEGRATED")
            self.assertEqual(endpoint["trial_collision_size_px"], [28, 28])
            self.assertEqual(endpoint["collision_size_px"], [28, 28])
            self.assertEqual(endpoint["trial_interaction_radius_px"], 62)
            self.assertEqual(endpoint["interaction_radius_px"], 62)
            self.assertEqual(endpoint["trial_stand_offset_px"], [0, 39])
            self.assertEqual(endpoint["fixture_stand_offset_px"], [0, 39])
            self.assertIn("NOT_IMPLEMENTED_FAIL_CLOSED", str(endpoint))
        approved_trial_cells = {
            "endpoint.ragnarok.deposit": ([404, 202], [404, 204]),
            "endpoint.ragnarok.fixed_vendor": ([412, 202], [412, 204]),
            "endpoint.ragnarok.recycler": ([126, 440], [126, 442]),
            "endpoint.ragnarok.evacuation": ([894, 422], [894, 424]),
        }
        for endpoint in data["endpoints"]:
            socket, stand = approved_trial_cells[endpoint["endpoint_id"]]
            self.assertEqual(endpoint["a1_trial_socket_cell"], socket)
            self.assertEqual(endpoint["a1_trial_stand_cell"], stand)
        deposit = next(item for item in data["endpoints"] if item["endpoint_id"] == "endpoint.ragnarok.deposit")
        self.assertEqual(deposit["candidate_resource_slot"], "ragnarok_unbanked")
        self.assertEqual(deposit["candidate_destination_slot"], "profile.secured_ragnarok_currency")
        self.assertEqual(deposit["candidate_display_name_key"], "currency.ragnarok_unbanked")
        vendor = next(item for item in data["endpoints"] if item["endpoint_id"] == "endpoint.ragnarok.fixed_vendor")
        self.assertEqual(vendor["candidate_currency_slot"], "profile.secured_ragnarok_currency")
        required = set(contract["required_fields"])
        self.assertTrue({"run_id", "run_epoch", "phase_id", "observed_phase_projection_revision", "poi_id", "site_instance_id", "endpoint_id", "actor_local_position", "actor_facing"}.issubset(required))
        forbidden = set(contract["a8_prohibited_payload_fields"])
        self.assertTrue({"currency_delta", "item_delta", "price", "yield", "reward", "balance_after", "transaction_receipt", "save_patch", "run_finalized"}.issubset(forbidden))
        self.assertFalse(data["canonical_placement_policy"]["A8_may_add_world_map_poi"])
        self.assertTrue(data["canonical_placement_policy"]["physical_test_fixture_coordinates_are_not_world_cells"])
        self.assertFalse(data["canonical_placement_policy"]["production_mount_authorized"])
        self.assertFalse(data["canonical_placement_policy"]["economy_or_reward_authorized"])
        self.assertEqual(data["canonical_placement_policy"]["trial_socket_dimensions_px"], [28, 28])
        self.assertEqual(data["canonical_placement_policy"]["trial_interaction_radius_px"], 62)
        self.assertEqual(data["canonical_placement_policy"]["trial_stand_offset_px"], [0, 39])

    def test_ordinary_waystation_slice_is_source_pinned_and_only_emits_neutral_intents(self) -> None:
        data = read_json(WORLD_CONTENT / "ordinary_waystation_opportunity.v1.json")
        self.assertEqual(data["schema"], "soh.a8.ordinary_waystation_opportunity.v1")
        self.assertEqual(data["schema_version"], 1)
        self.assertEqual(data["status"], "A1_A3_SOURCE_GROUNDED_A8_PHYSICAL_SHADOW_A0_MOUNT_PENDING")
        pins = data["source_pins"]
        self.assertEqual(pins["a1_head"], "9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf")
        self.assertEqual(pins["a1_slice_sha256"], "3a4981fd3e24580e2e7c2ee5d0929f76c432d785e142b67a222c6480af01e16f")
        self.assertEqual(pins["a1_authoring_sha256"], "8f2e437a9c4200f737e1b048be70030e4affde37012f1f05421efe7a2e8064cf")
        self.assertEqual(pins["a3_head"], "b44e22df3af40939069189be14afc23ee1ce21c4")
        self.assertEqual(pins["a3_bindings_sha256"], "7b9670f4971d2f161138e0754cbbe66dfe2a239bf0d15d3079a766d729dd230b")
        self.assertEqual(pins["a0_head"], "84ac9c1afe19627044c572f6f76794f4923334d6")
        self.assertEqual(pins["a0_candidate_slice_sha256"], pins["a1_slice_sha256"])
        source = data["canonical_source"]
        self.assertEqual(source["poi_id"], "poi_crown_waystation")
        self.assertEqual(source["anchor_cell"], [408, 200])
        self.assertEqual(source["approach_route_id"], "sp_poi_crown_waystation")
        self.assertEqual(source["hero_spawn_cell"], [392, 200])
        self.assertEqual(source["hero_return_cell"], [392, 200])
        self.assertEqual(len(source["primary_approach_cells"]), 17)
        self.assertEqual(len(source["primary_retreat_cells"]), 29)
        self.assertEqual(source["primary_retreat_cells"][-1], [392, 200])
        cache = data["cache_interaction"]
        self.assertEqual(cache["endpoint_id"], "node_waystation_cache")
        self.assertEqual(cache["a1_interaction_cell"], [406, 203])
        self.assertEqual(cache["a1_stand_cell"], [406, 202])
        self.assertEqual(cache["a3_binding_id"], "a1_waystation_roadside_cache_v3")
        self.assertFalse(cache["core_or_boss_required"])
        self.assertIn("A0_PR21_GUARDED_CANDIDATE", cache["a0_production_receipt_or_save_grant"])
        self.assertEqual(cache["a0_integration_evidence"]["a0_waystation_host_sha256"], "be01490ee52fc004f11cb07fb93176ecea0aefdbe38f814a3d268ea3465bc444")
        self.assertTrue(cache["a0_integration_evidence"]["separate_from_a8_shadow_physics"])
        harness = data["owner_independent_physics_harness"]
        self.assertEqual(harness["status"], "TEST_HARNESS_ONLY_NOT_A1_WORLD_MOUNT")
        self.assertEqual(harness["a1_hero_body_px"], [12, 16])
        self.assertEqual(harness["a1_hero_offset_px"], [0, -8])
        self.assertEqual(
            {item["obstacle_id"] for item in harness["source_static_obstacles"]},
            {
                "obs_waystation_locker_bank",
                "obs_waystation_ledger_desk",
                "obs_waystation_cache_crate",
                "obs_waystation_deadfall",
            },
        )
        self.assertEqual(len(data["endpoints"]), 1)
        self.assertEqual(data["endpoints"][0]["available_phases"], ["ordinary"])
        self.assertEqual(data["endpoints"][0]["a3_binding_id"], cache["a3_binding_id"])
        a8_source = (ROOT / "game/survival/world_content/scripts/native_poi_physical_endpoint.gd").read_text(encoding="utf-8")
        for forbidden in ("rewards", "item_delta", "cooldown_active_seconds", "currency_delta", "SaveService"):
            self.assertNotIn(forbidden, a8_source)

    def test_tuning_is_versioned_editable_and_not_gameplay_authorization(self) -> None:
        tuning = read_json(WORLD_CONTENT / "ragnarok_site_tuning.v1.json")
        self.assertEqual(tuning["schema_version"], 1)
        self.assertEqual(tuning["status"], "VERSIONED_AI_AUTHORED_PROPOSAL_NOT_CREATOR_APPROVED")
        self.assertTrue(tuning["acceptance"]["changing_presentation_values_requires_no_scene_identity_or_save_migration"])
        self.assertTrue(tuning["acceptance"]["numbers_are_ai_proposal_not_creator_approved_gameplay_rates"])
        self.assertTrue(tuning["acceptance"]["proposed_values_have_no_economic_or_combat_effect"])
        for owner_group in ("combat", "currency_and_economy"):
            values = tuning["owner_owned_tunables"][owner_group]["values"]
            self.assertTrue(all(value is None for value in values.values()))

    def test_runtime_owner_phase_context_does_not_own_a_clock_or_save(self) -> None:
        source = (ROOT / "game/survival/world_content/scripts/native_poi_phase_context.gd").read_text(encoding="utf-8")
        self.assertIn("soh.a0.run_phase_projection.v1", source)
        self.assertNotIn("Time.get_ticks", source)
        self.assertNotIn("SaveService", source)
        self.assertIn("phase_id_for_elapsed_hours", source)
        self.assertIn("run_epoch", source)
        self.assertIn("site_instance_id", source)
        endpoint = (ROOT / "game/survival/world_content/scripts/native_poi_physical_endpoint.gd").read_text(encoding="utf-8")
        self.assertIn("soh.a8.physical_intent.v1", endpoint)
        self.assertNotIn("currency_delta", endpoint)
        self.assertNotIn("SaveService", endpoint)


if __name__ == "__main__":
    unittest.main()
