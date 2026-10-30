"""V5 pacing/model negatives. These are not native Godot or human playtests."""
from __future__ import annotations

import copy
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/survival/economy"))
import progression_v5 as pv5  # noqa: E402
from world_binding_contract import validate  # noqa: E402


def load(rel):
    return json.loads((ROOT / rel).read_text())


class ProgressionV5Contracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report = pv5.run_all()
        cls.bindings = load("data/survival/items/world_source_bindings.v3.json")
        cls.items = load("data/survival/items/items.json")["items"]
        cls.sources = load("data/survival/items/sources.json")["sources"]
        cls.recipes = load("data/survival/recipes/recipes.json")["recipes"]

    def test_two_strategies_are_model_only_and_no_core(self):
        self.assertEqual(set(self.report["scenarios"]), {"explore_first", "home_first"})
        for scenario in self.report["scenarios"].values():
            self.assertEqual(scenario["technical_status"], "MODEL_ONLY")
            self.assertFalse(scenario["human_playtest"])
            self.assertFalse(scenario["production_a0_mount"])
            self.assertTrue(scenario["no_core"])
            self.assertTrue(scenario["no_gold"])
            self.assertTrue(scenario["canonical_rates_unchanged"])
            self.assertEqual(scenario["tool_effect_status"], "UNWIRED_A0")

    def test_milestones_fit_budgets_without_forced_three_hour_cache_chain(self):
        for scenario in self.report["scenarios"].values():
            m = scenario["milestones"]
            self.assertLessEqual(m["20_min"]["lower_bound_seconds"], 20 * 60)
            self.assertLessEqual(m["45_min"]["lower_bound_seconds"], 45 * 60)
            self.assertLessEqual(m["90_min"]["lower_bound_seconds"], 90 * 60)
            self.assertLessEqual(m["180_min"]["lower_bound_seconds"], 180 * 60)
            self.assertEqual(m["90_min"]["cache_active_wait_seconds"], 1800)
            self.assertLess(m["90_min"]["cache_active_wait_seconds"], 6 * 1800)

    def test_basic_tool_research_override_is_explicit_and_advanced_default_unchanged(self):
        self.assertEqual(self.recipes["iron_pick"]["research_cost"], {"knowledge_spares": 3, "research_notes": 1})
        self.assertNotIn("research_cost", self.recipes["salvage_hammer"])
        self.assertEqual(self.recipes["stone_pick"]["knowledge"], "starter")

    def test_one_time_crates_cannot_be_made_renewable_by_oracle_drift(self):
        self.assertEqual(validate(self.bindings, self.items, self.sources), [])
        bad = copy.deepcopy(self.bindings)
        crate = next(b for b in bad["bindings"] if b["binding_id"] == "a1_roadside_salvage_02_v5")
        crate["max_claims"] = 0
        crate["cooldown_active_seconds"] = 1800
        errors = validate(bad, self.items, self.sources)
        self.assertTrue(any("one-time" in e or "crate 02" in e for e in errors))
        bad_sources = copy.deepcopy(self.sources)
        bad_sources["roadside_scrap_02"]["max_claims"] = 0
        errors = validate(self.bindings, self.items, bad_sources)
        self.assertTrue(any("max_claims drift" in e for e in errors))

    def test_canonical_cache_and_notes_rates_are_still_exact(self):
        cache = next(b for b in self.bindings["bindings"] if b["binding_id"] == "a1_waystation_roadside_cache_v3")
        notes = next(b for b in self.bindings["bindings"] if b["binding_id"] == "a1_roadside_notes_01_v4")
        self.assertEqual({r["item_id"]: r["quantity"] for r in cache["rewards"]}, {"iron_scrap": 3, "knowledge_spares": 2})
        self.assertEqual(cache["cooldown_active_seconds"], 1800)
        self.assertEqual({r["item_id"]: r["quantity"] for r in notes["rewards"]}, {"research_notes": 1})
        self.assertEqual(notes["cooldown_active_seconds"], 1800)

    def test_tool_host_contract_is_explicitly_unwired_and_atomic(self):
        contract = load("docs/survival/economy/A0_TOOL_HOST_CONTRACT_V5.json")
        self.assertEqual(contract["status"], "UNWIRED_A0")
        for tool in contract["tools"].values():
            self.assertEqual(tool["current_a0_effect"], "NONE")
            self.assertEqual(tool["condition_cost_per_swing"], 1)
        self.assertIn("SAME SaveService.transact_once", contract["minimal_host_contract"]["atomic_commit_rule"])
        self.assertIn("byte-identical", contract["minimal_host_contract"]["failure_rule"])


if __name__ == "__main__":
    unittest.main()
