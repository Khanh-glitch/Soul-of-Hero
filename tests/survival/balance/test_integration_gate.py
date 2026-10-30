"""Integration-gate tests: every blocker must flip FAIL -> PASS on a simulated owner edit.

These tests never touch the repository. They deep-copy the pinned texts/facts,
apply the *single* correction the blocker asks its owner to make, and require the
gate link that was blocked to become unblocked. That is what makes the blockers
falsifiable instead of rhetorical: if an owner makes the stated edit, the probe
moves, and if they make a different edit it does not.
"""
from __future__ import annotations

import copy
import json
import unittest

import _support as support

from sohbalance import gate, identity, product


def _inputs():
    texts, manifest = product.load_snapshot(support.REPO_ROOT)
    model = support.model()
    facts = product.build_facts(
        texts, manifest, loot_tables=sorted(model.loot_tables), station_ids=sorted(model.stations)
    )
    facts.update(product.model_facts(model))
    return model, texts, manifest, facts


def _gate(texts, facts, manifest):
    model = support.model()
    return gate.build(model, texts, facts, manifest)


def _blocked(payload, chain_id, link_id):
    chain = next(row for row in payload["chains"] if row["chain_id"] == chain_id)
    link = next(row for row in chain["links"] if row["link"] == link_id)
    return link["blocked"], link


class GateShapeTests(unittest.TestCase):
    """The gate itself must never over-claim."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.model, cls.texts, cls.manifest, cls.facts = _inputs()
        cls.payload = _gate(cls.texts, cls.facts, cls.manifest)

    def test_both_chains_are_reported_with_eight_links(self) -> None:
        self.assertEqual([c["chain_id"] for c in self.payload["chains"]], ["waystation_cache", "a8_quarry"])
        for chain in self.payload["chains"]:
            self.assertEqual(len(chain["links"]), 8)
            self.assertEqual(
                [link["link"] for link in chain["links"]],
                [
                    "L1_ENTRY",
                    "L2_ROUTE",
                    "L3_INTERACTION",
                    "L4_AUTHORIZATION",
                    "L5_COMMIT",
                    "L6_RELOAD",
                    "L7_NO_DUPLICATE",
                    "L8_OUTCOME",
                ],
            )

    def test_static_evidence_never_claims_s4_or_s5(self) -> None:
        for chain in self.payload["chains"]:
            for link in chain["links"]:
                self.assertLessEqual(link["rank"], 3, f"{chain['chain_id']}/{link['link']}")
                self.assertFalse(
                    link["level"] in ("S4_NATIVE_COMMITTED", "S5_FULL_NORMAL_INPUT"),
                    "static inspection cannot prove a native run",
                )
                self.assertTrue(link["statically_verifiable"])

    def test_every_blocked_link_has_an_owner_and_a_next_action(self) -> None:
        self.assertGreater(self.payload["blocked_link_count"], 0)
        for row in self.payload["blocked_links"]:
            self.assertTrue(row["owner"])
            self.assertTrue(row["next_action"])
            self.assertTrue(row["missing"])
            self.assertTrue(row["blocker_id"].startswith("BLK-"), row)

    def test_entry_is_absent_at_the_current_pin(self) -> None:
        entry = self.payload["entry"]
        self.assertEqual(entry["survival_keys"], [])
        self.assertNotIn("survival", " ".join(entry["home_keys"]).lower())

    def test_owner_native_commands_are_concrete(self) -> None:
        for name, commands in self.payload["native_commands_for_owner"].items():
            self.assertTrue(commands, name)
            self.assertTrue(any("godot" in command for command in commands), name)


class GateClosureTests(unittest.TestCase):
    """One simulated owner edit per blocker; the named link must unblock."""

    def setUp(self) -> None:
        self.model, self.texts, self.manifest, self.facts = _inputs()

    def test_blk1_closes_when_a_home_destination_exists(self) -> None:
        payload = _gate(self.texts, self.facts, self.manifest)
        for chain in ("waystation_cache", "a8_quarry"):
            blocked, _ = _blocked(payload, chain, "L1_ENTRY")
            self.assertTrue(blocked, chain)

        facts = copy.deepcopy(self.facts)
        facts["home_function_keys"] = sorted(list(facts["home_function_keys"]) + ["survival_world"])
        facts["home_survival_keys"] = ["survival_world"]
        after = _gate(self.texts, facts, self.manifest)
        for chain in ("waystation_cache", "a8_quarry"):
            blocked, link = _blocked(after, chain, "L1_ENTRY")
            self.assertFalse(blocked, chain)
            self.assertEqual(link["level"], "S3_OWNER_SEAM_UNWIRED")

    def test_blk2_closes_when_a3_adopts_the_a1_binding_without_changing_yields(self) -> None:
        payload = _gate(self.texts, self.facts, self.manifest)
        blocked, link = _blocked(payload, "waystation_cache", "L4_AUTHORIZATION")
        self.assertTrue(blocked)
        adoption = identity.binding_adoption(self.model, payload["contract"])
        self.assertEqual(adoption["adopted_by_a3"], 0)
        self.assertEqual(len(adoption["pending_rebind"]), 3)

        docs = copy.deepcopy(self.model.docs)
        for row in adoption["pending_rebind"]:
            docs["a3.sources"]["sources"][row["source_id"]]["poi_id"] = "poi_crown_waystation"
        patched = type(self.model).from_docs(docs)
        after_adoption = identity.binding_adoption(patched, payload["contract"])
        self.assertEqual(after_adoption["adopted_by_a3"], 3)
        self.assertEqual(after_adoption["pending_rebind"], [])

        # The correction is an id adoption: every quantity A1 authorizes is unchanged.
        for row in after_adoption["rows"]:
            if row["a3_declared_yield"] is not None:
                self.assertEqual(row["a1_authorized_yield"], row["a3_declared_yield"])

    def test_blk2_does_not_close_by_inventing_a_rate(self) -> None:
        payload = _gate(self.texts, self.facts, self.manifest)
        docs = copy.deepcopy(self.model.docs)
        # A plausible-but-wrong "fix": keep the class id and raise the yield.
        docs["a3.sources"]["sources"]["road_scrap"]["yield_per_claim"] = 9
        patched = type(self.model).from_docs(docs)
        adoption = identity.binding_adoption(patched, payload["contract"])
        self.assertEqual(adoption["adopted_by_a3"], 0)
        self.assertFalse(next(r for r in adoption["rows"] if r["source_id"] == "road_scrap")["yield_agrees"])

    def test_blk4_closes_when_a_mounted_path_commits_through_transact_once(self) -> None:
        payload = _gate(self.texts, self.facts, self.manifest)
        self.assertFalse(payload["commit_seam"]["any_poi_calls_transact_once"])
        for link_id in ("L5_COMMIT", "L6_RELOAD", "L7_NO_DUPLICATE"):
            blocked, _ = _blocked(payload, "waystation_cache", link_id)
            self.assertTrue(blocked, link_id)

        texts = dict(self.texts)
        texts["a8.mounted_cache_claim.gd"] = (
            "extends Node\n"
            "func _on_claim() -> void:\n"
            "\tvar transaction := {'transaction_key': 'a1slice:poi_crown_waystation:cache_restock:1'}\n"
            "\tsave_service.transact_once(transaction)\n"
        )
        texts["a8.cache_reload_two_process.gd"] = (
            "extends SceneTree\n"
            "func _init() -> void:\n"
            "\tOS.create_process(OS.get_executable_path(), ['--headless', '--script', 'res://x.gd'])\n"
            "\t# second process reads the committed transaction\n"
        )
        after = _gate(texts, self.facts, self.manifest)
        self.assertTrue(after["commit_seam"]["any_poi_calls_transact_once"])
        self.assertTrue(after["commit_seam"]["two_process_reload_test"])
        for link_id in ("L5_COMMIT", "L6_RELOAD", "L7_NO_DUPLICATE"):
            blocked, _ = _blocked(after, "waystation_cache", link_id)
            self.assertFalse(blocked, link_id)

    def test_same_process_reload_alone_does_not_close_blk4(self) -> None:
        payload = _gate(self.texts, self.facts, self.manifest)
        texts = dict(self.texts)
        texts["a8.mounted_cache_claim.gd"] = "save_service.transact_once(transaction)\n"
        texts["a8.reload_same_process.gd"] = "func _test() -> void:\n\tload_save_document()\n"
        after = _gate(texts, self.facts, self.manifest)
        self.assertTrue(after["commit_seam"]["any_poi_calls_transact_once"])
        self.assertFalse(after["commit_seam"]["two_process_reload_test"])
        for link_id in ("L6_RELOAD", "L7_NO_DUPLICATE"):
            blocked, _ = _blocked(after, "waystation_cache", link_id)
            self.assertTrue(blocked, link_id)


class CommitSeamTests(unittest.TestCase):
    """The seam facts must come from the pinned bytes, not from an assumption."""

    def test_save_service_really_is_idempotent(self) -> None:
        _model, texts, _manifest, _facts = _inputs()
        seam = gate.a0_commit_seam(texts)
        self.assertTrue(seam["transact_once_exists"])
        self.assertTrue(seam["receipt_recorded"])
        self.assertTrue(seam["replay_rejected"])

    def test_a8_authority_is_a_declared_fixture(self) -> None:
        _model, texts, _manifest, _facts = _inputs()
        authority = gate.a8_authority(texts)
        self.assertTrue(authority["fixture_declares_test_only"])
        self.assertTrue(authority["fixture_keeps_state_in_memory"])
        self.assertTrue(authority["harness_only_by_default"])
        self.assertFalse(authority["fixture_uses_save_service"])


class FirstHourBindingTests(unittest.TestCase):
    """A1's numbers are the authority; the tool must read them, not restate them."""

    def test_a1_authorizes_two_renewable_cache_rows(self) -> None:
        model, texts, manifest, facts = _inputs()
        payload = _gate(texts, facts, manifest)
        rows = payload["contract"]["slice_renewable_cache"]
        self.assertEqual([row["source_id"] for row in rows], ["road_scrap", "road_supplies"])
        self.assertTrue(all(row["renewable"] for row in rows))
        self.assertTrue(all(row["cooldown_active_seconds"] == 1800 for row in rows))
        self.assertEqual([row["item_id"] for row in rows], ["iron_scrap", "knowledge_spares"])
        self.assertEqual([row["yield_per_claim"] for row in rows], [3, 2])

    def test_contract_carries_a_duplicate_payload(self) -> None:
        _model, texts, manifest, facts = _inputs()
        payload = _gate(texts, facts, manifest)
        duplicate = payload["contract"]["cache_duplicate"]
        self.assertEqual(duplicate["result"], "ALREADY_APPLIED")
        self.assertEqual(duplicate["transaction_key"], "a1slice:poi_crown_waystation:cache_restock:1")
        self.assertEqual(duplicate["granted_items"], {})

    def test_research_kit_is_a_workbench_recipe(self) -> None:
        model = support.model()
        recipe = model.recipes["research_kit"]
        self.assertEqual(recipe["station"], "workbench")
        self.assertEqual(recipe["inputs"]["knowledge_spares"], 3)

    def test_cache_can_pay_for_the_first_station_kit(self) -> None:
        model, texts, manifest, facts = _inputs()
        payload = _gate(texts, facts, manifest)
        spares = next(
            row for row in payload["contract"]["slice_renewable_cache"] if row["item_id"] == "knowledge_spares"
        )
        per_claim = int(spares["yield_per_claim"])
        needed = int(model.recipes["research_kit"]["inputs"]["knowledge_spares"])
        self.assertEqual(-(-needed // per_claim), 2, "two claims reach the 3 spares the kit needs")
        self.assertGreater(spares["cooldown_active_seconds"], 0)


if __name__ == "__main__":
    unittest.main()
