"""Adversary tests: the gate must reject fifteen disguises — and must be able to fail.

Two things are tested, and the second matters more than the first.

* Soundness — every probe in the shipped artifact is rejected, the verdict is
  `NO_KNOWN_SPOOF_SURVIVES`, and each row names the technique and the classifier
  that stopped it.
* Liveness — when a classifier is made to accept the spoof, the module reports
  `GATE_HOLE_FOUND` and names that probe. A test suite that only ever sees
  "rejected" cannot distinguish a working gate from a gate that always says
  "rejected", which is why every hole below is forced open deliberately.
"""
from __future__ import annotations

import json
import unittest
from unittest import mock

import _support as support

from sohbalance import adversary, evidence, gate, product, quality


def _inputs():
    texts, manifest = product.load_snapshot(support.REPO_ROOT)
    model = support.model()
    facts = product.build_facts(
        texts, manifest, loot_tables=sorted(model.loot_tables), station_ids=sorted(model.stations)
    )
    facts.update(product.model_facts(model))
    a3 = product.a3_texts(support.REPO_ROOT)
    heads = {"a0": str(manifest.get("a0_head")), "a8": str(manifest.get("a8_head"))}
    states = evidence.states_for(evidence.load(), heads)
    return texts, manifest, facts, model, a3, states, heads


class ShippedAdversaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        texts, manifest, facts, model, a3, states, heads = _inputs()
        cls.payload = adversary.run(
            texts, manifest, facts, model, a3_texts=a3, native_states=states, heads=heads
        )

    def test_every_known_spoof_is_rejected(self) -> None:
        self.assertEqual(self.payload["verdict"], "NO_KNOWN_SPOOF_SURVIVES")
        self.assertEqual(self.payload["probe_count"], 15)
        self.assertEqual(self.payload["rejected_count"], 15)
        self.assertEqual(self.payload["holes"], [])
        for probe in self.payload["probes"]:
            with self.subTest(probe=probe["probe_id"]):
                self.assertTrue(probe["rejected"])
                self.assertTrue(probe["technique"])
                self.assertTrue(probe["defended_by"])
                self.assertTrue(probe["detail"])

    def test_the_mission_techniques_are_all_present(self) -> None:
        techniques = {probe["technique"] for probe in self.payload["probes"]}
        for required in (
            "comment_mount",
            "test_only_class",
            "stale_vendored_copy",
            "alias_for_instance",
            "phantom_sheet",
            "injected_cooldown",
            "success_without_receipt",
            "wrong_sha_run",
            "empty_artifact",
            "failed_step",
            "mocked_reach",
            "unmounted_scene_content",
            "second_process_absent",
        ):
            self.assertIn(required, techniques)

    def test_the_artifact_never_claims_completeness(self) -> None:
        self.assertIn("does not prove that no disguise exists", self.payload["proves"])

    def test_probe_ids_are_unique_and_ordered(self) -> None:
        ids = [probe["probe_id"] for probe in self.payload["probes"]]
        self.assertEqual(ids, [f"P{index:02d}" for index in range(1, 16)])


class AdversaryLivenessTests(unittest.TestCase):
    """Force a gate open and require the module to say so."""

    def setUp(self) -> None:
        self.texts, self.manifest, self.facts, self.model, self.a3, self.states, self.heads = _inputs()

    def _run(self):
        return adversary.run(
            self.texts,
            self.manifest,
            self.facts,
            self.model,
            a3_texts=self.a3,
            native_states=self.states,
            heads=self.heads,
        )

    def test_a_comment_mount_that_the_gate_accepts_is_reported_as_a_hole(self) -> None:
        fake = {"mounted": True, "mount_state": "MOUNTED", "non_production_references": []}
        with mock.patch.object(gate, "entry_content", return_value=fake):
            payload = self._run()
        self.assertEqual(payload["verdict"], "GATE_HOLE_FOUND")
        self.assertIn("P01", payload["holes"])

    def test_a_conclusion_only_ci_run_is_not_rescued_by_a_second_good_probe(self) -> None:
        # P10 fails only if evidence.state accepts a stale sha; break that and the
        # hole must surface while the other fourteen still hold.
        with mock.patch.object(
            evidence, "state", return_value={"state": evidence.VERIFIED, "evidence_id": "x"}
        ):
            payload = self._run()
        self.assertEqual(payload["verdict"], "GATE_HOLE_FOUND")
        self.assertIn("P10", payload["holes"])
        self.assertIn("P11", payload["holes"])
        self.assertIn("P12", payload["holes"])
        # P08 rides on the same resolver: if every evidence id resolves, S4 stops
        # distinguishing a fixture from a player's receipt, which is the point of it.
        self.assertIn("P08", payload["holes"])
        self.assertEqual(len(payload["holes"]), 4, payload["holes"])


class SpoilerRegressionTests(unittest.TestCase):
    """The two edges this milestone actually had to fix, pinned as tests."""

    def test_the_overclaim_pattern_catches_every_reward_claim_token(self) -> None:
        for token in (
            "SAVE_VERIFIED_OK",
            "PERSISTENCE_VERIFIED",
            "NO_DUPLICATE_VERIFIED",
            "DUPLICATE_PROOF",
            "REWARD_VERIFIED_AND_UNLOCKED",
            "LOOT_VERIFIED",
            "ECONOMY_VERIFIED",
            "GRANT_VERIFIED",
        ):
            with self.subTest(token=token):
                self.assertRegex(token, quality._OVERCLAIM_PATTERN)

    def test_a_reward_claim_inside_a_fixture_fails_q07(self) -> None:
        texts, manifest = product.load_snapshot(support.REPO_ROOT)
        model = support.model()
        facts = product.build_facts(
            texts, manifest, loot_tables=sorted(model.loot_tables), station_ids=sorted(model.stations)
        )
        facts.update(product.model_facts(model))
        spoofed = dict(texts)
        spoofed["a6.acceptance_journeys.gd"] += '\nconst CLAIM := "REWARD_VERIFIED_AND_UNLOCKED"\n'
        check = next(
            check
            for check in quality.run_all(model, spoofed, facts, manifest)
            if check["check_id"] == "Q-07"
        )
        self.assertEqual(check["status"], "FAIL")

    def test_a_perfect_fixture_run_still_cannot_grant_s4(self) -> None:
        states, s4 = adversary._fixture_only_s4()
        self.assertEqual(states["a3_authority_fixture"]["state"], evidence.VERIFIED)
        self.assertEqual(s4["clauses"]["C4_authorised_commit"]["state"], "NOT_HOLDS")
        self.assertFalse(s4["s4_granted"])
        self.assertFalse(s4["s5_granted"])


if __name__ == "__main__":
    unittest.main()
