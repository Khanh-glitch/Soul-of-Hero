"""V3/V4 physical source-binding contracts and independent negative oracles."""
from __future__ import annotations

import copy
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/survival/economy"))
import model_progression as mp  # noqa: E402
from world_binding_contract import validate  # noqa: E402


def load(rel):
    return json.loads((ROOT / rel).read_text())


class WorldSourceBindingContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bindings = load("data/survival/items/world_source_bindings.v3.json")
        cls.items = load("data/survival/items/items.json")["items"]
        cls.sources = load("data/survival/items/sources.json")["sources"]
        cls.adoption = load("data/survival/items/a1_source_adoption.v2.json")
        cls.config = load("data/survival/recipes/progression_model.json")
        cls.quarry = load("docs/survival/economy/A8_QUARRY_AUTHORIZATION_V4.json")

    def test_current_bindings_pass_oracle(self):
        self.assertEqual(validate(self.bindings, self.items, self.sources), [])

    def test_identity_is_class_region_poi_instance(self):
        cache = next(b for b in self.bindings["bindings"] if b["binding_id"] == "a1_waystation_roadside_cache_v3")
        self.assertEqual(cache["source_class"], "roadside_cache")
        self.assertEqual(cache["region_id"], "r_ashen_crown")
        self.assertEqual(cache["poi_id"], "poi_crown_waystation")
        self.assertEqual(cache["instance_id"], "si:r_ashen_crown:waystation_cache:01")
        self.assertEqual(cache["interaction_node_id"], "node_waystation_cache")
        self.assertEqual(cache["identity"], "roadside_cache|r_ashen_crown|poi_crown_waystation|si:r_ashen_crown:waystation_cache:01")
        self.assertIsNone(cache["loot_table"])
        self.assertEqual({r["source_id"]: r["quantity"] for r in cache["rewards"]}, {"road_scrap": 3, "road_supplies": 2})
        self.assertEqual(cache["cooldown_active_seconds"], 1800)

    def test_locker_and_ledger_are_capability_only(self):
        actions = {(a["poi_id"], a["action_id"]): a for a in self.bindings["world_actions"]}
        locker = actions[("poi_crown_waystation", "pry_locker")]
        ledger = actions[("poi_crown_waystation", "seal_ledger")]
        self.assertEqual(locker["reward_items"], [])
        self.assertEqual(locker["grants_capabilities"], ["cap_salvage"])
        self.assertEqual(ledger["reward_items"], [])
        self.assertEqual(ledger["grants_capabilities"], ["cap_seal_1"])
        proposal = self.config["novice_bootstrap"]["a3_world_action_proposals"]["waystation_locker"]
        self.assertEqual(proposal["reward_proposal"], {})
        adopted = self.adoption["novice_bootstrap_adoption"]["a3_world_action_proposals"]["waystation_locker"]
        self.assertEqual(adopted["reward_proposal"], {})

    def test_relay_spends_real_materials_for_power(self):
        relay = next(a for a in self.bindings["world_actions"] if a["action_id"] == "hand_crank_bypass")
        self.assertEqual({c["item_id"]: c["quantity"] for c in relay["consumes_items"]}, {"iron_scrap": 2, "oak_wood": 1})
        self.assertEqual(relay["grants_capabilities"], ["cap_power_1"])
        self.assertTrue(relay["state_writes"]["bus_powered"])
        self.assertEqual(relay["reward_items"], [])

    def test_source_records_backlink_canonical_cache(self):
        for sid in ("road_scrap", "road_supplies"):
            src = self.sources[sid]
            self.assertEqual(src["integration_status"], "A1_PINNED_A3_BOUND")
            self.assertEqual(src["region_id"], "r_ashen_crown")
            self.assertEqual(src["poi_id"], "poi_crown_waystation")
            self.assertEqual(src["instance_id"], "si:r_ashen_crown:waystation_cache:01")
            self.assertEqual(src["world_binding_id"], "a1_waystation_roadside_cache_v3")
        self.assertEqual(self.sources["road_scrap"]["yield_per_claim"], 3)
        self.assertEqual(self.sources["road_supplies"]["yield_per_claim"], 2)

    def test_roadside_crates_preserve_rates_and_only_add_one_time_salvage(self):
        notes = next(b for b in self.bindings["bindings"] if b["binding_id"] == "a1_roadside_notes_01_v4")
        self.assertEqual(notes["instance_id"], "si:r_ashen_crown:roadside_supply:01")
        self.assertIsNone(notes["canonical_poi_id"])
        self.assertEqual(notes["context_poi_id"], "poi_crown_waystation")
        self.assertEqual(notes["stand_cells"], [[395, 220]])
        self.assertEqual({r["item_id"]: r["quantity"] for r in notes["rewards"]}, {"research_notes": 1})
        self.assertEqual(notes["cooldown_active_seconds"], 1800)
        self.assertEqual(notes.get("max_claims", 0), 0)
        src = self.sources["road_notes"]
        self.assertEqual(src["world_binding_id"], "a1_roadside_notes_01_v4")
        self.assertEqual(src["yield_per_claim"], 1)
        self.assertEqual(src["replenishment_seconds"], 1800)
        salvage02 = next(b for b in self.bindings["bindings"] if b["binding_id"] == "a1_roadside_salvage_02_v5")
        timber03 = next(b for b in self.bindings["bindings"] if b["binding_id"] == "a1_roadside_timber_03_v5")
        self.assertEqual(salvage02["stand_cells"], [[400, 217]])
        self.assertEqual(timber03["stand_cells"], [[402, 221]])
        self.assertEqual(salvage02["max_claims"], 1)
        self.assertEqual(timber03["max_claims"], 1)
        self.assertEqual(salvage02["cooldown_active_seconds"], 0)
        self.assertEqual(timber03["cooldown_active_seconds"], 0)
        self.assertEqual({r["item_id"]: r["quantity"] for r in salvage02["rewards"]}, {"iron_scrap": 3, "knowledge_spares": 2})
        self.assertEqual({r["item_id"]: r["quantity"] for r in timber03["rewards"]}, {"oak_wood": 2, "research_notes": 1})
        for sid in ("roadside_scrap_02", "roadside_supplies_02", "roadside_oak_03", "roadside_notes_03"):
            self.assertEqual(self.sources[sid]["max_claims"], 1)
            self.assertEqual(self.sources[sid]["replenishment_seconds"], 0)

    def test_a8_quarry_is_fail_closed_not_guess_priced(self):
        self.assertEqual(self.quarry["status"], "REJECTED_PENDING_EVIDENCE_FAIL_CLOSED")
        for action in self.quarry["actions"].values():
            self.assertEqual(action["verdict"], "REJECT_PENDING_EVIDENCE")
            self.assertIsNone(action.get("authorized_cost_quantity", action.get("authorized_reward_quantity")))
        self.assertIsNone(self.quarry["actions"]["extract_outcrop"]["authorized_replenishment_seconds"])
        errors = validate(self.bindings, self.items, self.sources)
        self.assertFalse(any("Quarry" in e for e in errors))
        bad = copy.deepcopy(self.bindings)
        bad["world_actions"].append({"poi_id": "poi_crown_south_quarry", "action_id": "brace_east_shelf", "transaction_key_template": "x:{claim_index}"})
        self.assertTrue(any("Quarry world_action present" in e for e in validate(bad, self.items, self.sources)))

    def test_negative_oracle_rejects_abundance_core_and_identity_drift(self):
        bad = copy.deepcopy(self.bindings)
        cache = next(b for b in bad["bindings"] if b["binding_id"] == "a1_waystation_roadside_cache_v3")
        cache["rewards"][0]["quantity"] = 4
        errors = validate(bad, self.items, self.sources)
        self.assertTrue(any("canonical yield/cooldown drift" in e or "canonical Waystation cache" in e for e in errors))

        bad = copy.deepcopy(self.bindings)
        cache = next(b for b in bad["bindings"] if b["binding_id"] == "a1_waystation_roadside_cache_v3")
        cache["rewards"].append({"source_id": "specimen_ember", "item_id": "core_ember", "quantity": 1})
        errors = validate(bad, self.items, self.sources)
        self.assertTrue(any("Core reward forbidden" in e for e in errors))

        bad = copy.deepcopy(self.bindings)
        bad["bindings"][0]["region_id"] = "opening_marches"
        errors = validate(bad, self.items, self.sources)
        self.assertTrue(any("identity mismatch" in e for e in errors))

        bad = copy.deepcopy(self.bindings)
        locker = next(a for a in bad["world_actions"] if a["action_id"] == "pry_locker")
        locker["reward_items"] = [{"item_id": "iron_scrap", "quantity": 2}]
        errors = validate(bad, self.items, self.sources)
        self.assertTrue(any("locker must grant cap_salvage and ZERO items" in e for e in errors))

    def test_negative_oracle_rejects_missing_backlink_random_table_and_alias_collision(self):
        bad_sources = copy.deepcopy(self.sources)
        bad_sources["road_scrap"].pop("world_binding_id")
        errors = validate(self.bindings, self.items, bad_sources)
        self.assertTrue(any("proposed source is neither bound nor live" in e for e in errors))

        bad = copy.deepcopy(self.bindings)
        bad["bindings"][0]["loot_table"] = "roadside_cache"
        errors = validate(bad, self.items, self.sources)
        self.assertTrue(any("must not use a random loot table" in e for e in errors))

        bad = copy.deepcopy(self.bindings)
        bad["bindings"][1]["interaction_node_id"] = "node_waystation_cache"
        errors = validate(bad, self.items, self.sources)
        self.assertTrue(any("alias collision" in e for e in errors))


class WorldSourceProgressionRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inp = mp.load_inputs()
        cls.report = mp.run_all(inputs=cls.inp)
        cls.baseline = cls.report["baseline"]

    def test_model_locker_grants_zero_items_and_cache_owns_spares(self):
        events = self.baseline["novice_bootstrap_events"]
        locker = next(e for e in events if e["action_id"] == "waystation_locker")
        self.assertEqual(locker["rewards"], {})
        self.assertEqual(locker["grants_capabilities"], ["cap_salvage"])
        cache = next(s for s in self.inp["config"]["product_sources"] if s["source_id"] == "a1_crown_salvage")
        self.assertEqual(cache["outputs"], {"iron_scrap": 3, "knowledge_spares": 2})
        self.assertEqual(cache["restock_active_seconds"], 1800)
        relay = next(e for e in events if e["action_id"] == "relay_hand_crank")
        self.assertEqual(relay["costs"], {"iron_scrap": 2, "oak_wood": 1})

    def test_all_scenarios_still_run_without_free_locker_materials(self):
        self.assertEqual(len(self.report["scenarios"]), 15)
        for name, scenario in self.report["scenarios"].items():
            self.assertEqual(scenario["technical_status"], "PASS", name)
            for event in scenario.get("novice_bootstrap_events", []):
                if event["action_id"] == "waystation_locker":
                    self.assertEqual(event["rewards"], {})


if __name__ == "__main__":
    unittest.main()
