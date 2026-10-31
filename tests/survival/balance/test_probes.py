"""The Phase-3 native probes: audited here, executed nowhere yet.

A7 cannot run Godot, so the honest claim about a probe is not "it passes". It is:
the probe extends the shipped chain, contains no construct that would fabricate
its own result, and names only symbols that exist in the pinned owner bytes. These
tests hold that claim, and they hold the checker itself to a live standard by
proving every forbidden rule can still fire.
"""
from __future__ import annotations

import json
import re
import tempfile
import unittest
from pathlib import Path

import _support as support

from sohbalance import product, probes


def _texts():
    texts, manifest = product.load_snapshot(support.REPO_ROOT)
    return texts, manifest


class ShippedProbeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.texts, _manifest = _texts()
        self.payload = probes.run(self.texts, support.REPO_ROOT)

    def test_the_three_probes_are_statically_sound(self) -> None:
        self.assertEqual(self.payload["verdict"], "PROBES_STATICALLY_SOUND_NOT_EXECUTED")
        self.assertEqual(self.payload["probe_count"], 3)
        self.assertEqual(
            [Path(row["file"]).name for row in self.payload["probes"]],
            ["avatar_body_probe.gd", "bed_death_bag_probe.gd", "first_hour_route_probe.gd"],
        )
        self.assertEqual(self.payload["defects"], [])
        self.assertEqual(self.payload["undeclared"], [])

    def test_no_probe_claims_to_have_run(self) -> None:
        # The single most dangerous line in this artifact would be a native pass.
        self.assertFalse(self.payload["executed"])
        self.assertEqual(self.payload["evidence_class"], "NATIVE_UNEXECUTED")
        self.assertNotIn("PASSED", self.payload["verdict"])
        self.assertIn("NOT_EXECUTED", self.payload["verdict"])

    def test_every_probe_extends_the_shipped_chain(self) -> None:
        for row in self.payload["probes"]:
            with self.subTest(probe=row["file"]):
                self.assertEqual(row["extends"], probes.CHAIN)
                self.assertTrue(row["extends_shipped_chain"])
                self.assertTrue(Path(support.REPO_ROOT / row["file"]).exists())

    def test_every_declared_symbol_exists_in_the_pinned_bytes(self) -> None:
        for row in self.payload["probes"]:
            with self.subTest(probe=row["file"]):
                self.assertEqual(row["requires_missing"], [])
                self.assertTrue(row["requires_found"])

    def test_each_probe_states_its_expected_outcome_and_the_owner_action(self) -> None:
        for row in self.payload["probes"]:
            with self.subTest(probe=row["file"]):
                self.assertTrue(row["claim"])
                self.assertTrue(row["question"])
                self.assertTrue(row["expected_today"])
                self.assertTrue(row["a0_action"])
                self.assertTrue(row["closes"])

    def test_the_first_hour_probe_expects_to_be_blocked_today(self) -> None:
        row = next(r for r in self.payload["probes"] if r["file"].endswith("first_hour_route_probe.gd"))
        # If A0 mounts the branch this expectation becomes wrong on purpose: the
        # probe then runs and its exit code stops being 2. The assertion is that
        # the expectation is recorded, not that it is permanent.
        self.assertTrue(row["expected_today"].startswith("BLOCKED"))


class ForbiddenConstructTests(unittest.TestCase):
    """Each banned construct, applied to a real-looking probe, must be caught."""

    def _audit(self, body: str) -> dict:
        header = 'extends "%s"\n\nfunc _after_home_continuation() -> void:\n' % probes.CHAIN
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "first_hour_route_probe.gd"
            path.write_text(header + body, encoding="utf-8")
            return probes.audit_probe(path, "\n".join(_texts()[0].values()))

    def test_a_teleported_hero_is_rejected(self) -> None:
        audit = self._audit("\thero.global_position = Vector2(406 * 16, 203 * 16)\n")
        self.assertFalse(audit["sound"])
        self.assertTrue(any("teleports" in row["why"] for row in audit["forbidden"]))

    def test_an_injected_node_is_rejected(self) -> None:
        audit = self._audit("\tadd_child(load(\"res://game/survival/waystation_host.gd\").new())\n")
        self.assertFalse(audit["sound"])
        self.assertTrue(any("inject" in row["why"] for row in audit["forbidden"]))

    def test_a_fabricated_death_is_rejected(self) -> None:
        audit = self._audit("\t_survival().call(&\"begin_overworld_death\", Vector2.ZERO)\n")
        self.assertFalse(audit["sound"])

    def test_a_forced_private_death_is_rejected(self) -> None:
        audit = self._audit('\thero.call(&"_die")\n')
        self.assertFalse(audit["sound"])

    def test_a_granted_reward_is_rejected(self) -> None:
        audit = self._audit('\tinventory_add("iron_scrap", 3)\n')
        self.assertFalse(audit["sound"])

    def test_direct_inventory_write_is_rejected(self) -> None:
        audit = self._audit('\tsave.set(&"inventory", {})\n')
        self.assertFalse(audit["sound"])

    def test_a_probe_that_does_not_extend_the_chain_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "first_hour_route_probe.gd"
            path.write_text('extends Node\n\nfunc _ready() -> void:\n\tquit(0)\n', encoding="utf-8")
            audit = probes.audit_probe(path, "\n".join(_texts()[0].values()))
        self.assertFalse(audit["extends_shipped_chain"])
        self.assertFalse(audit["sound"])

    def test_a_probe_naming_a_symbol_the_owners_do_not_ship_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bed_death_bag_probe.gd"
            path.write_text(
                'extends "%s"\n\nfunc _after_home_continuation() -> void:\n\tpass\n' % probes.CHAIN,
                encoding="utf-8",
            )
            texts = {key: value.replace("pending_death", "pending_doom") for key, value in _texts()[0].items()}
            audit = probes.audit_probe(path, "\n".join(texts.values()))
        self.assertIn("pending_death", audit["requires_missing"])
        self.assertFalse(audit["sound"])


class RuleLivenessTests(unittest.TestCase):
    """No rule in the table may be unreachable; a dead rule guards nothing."""

    EXAMPLES = [
        "\thero.global_position = Vector2(1, 2)\n",
        "\tadd_child(Node2D.new())\n",
        "\tbegin_overworld_death(position)\n",
        '\t_survival().call(&"begin_overworld_death", Vector2.ZERO)\n',
        '\thero.call(&"_die")\n',
        '\tgrant_item("iron_scrap", 3)\n',
        '\tsave.set(&"inventory", {})\n',
    ]

    def test_there_is_one_example_per_rule(self) -> None:
        self.assertEqual(len(self.EXAMPLES), len(probes.FORBIDDEN))

    def test_every_rule_fires_on_its_example(self) -> None:
        for rule, example in zip(probes.FORBIDDEN, self.EXAMPLES):
            with self.subTest(rule=rule["pattern"]):
                haystack = probes._strip_comments(example, blank_strings=not rule["literals"])
                self.assertTrue(re.search(rule["pattern"], haystack), "dead rule: " + rule["pattern"])

    def test_a_comment_naming_a_banned_call_is_not_a_violation(self) -> None:
        # The probes document what they refuse to do; that must stay legal.
        body = "\t# never begin_overworld_death() here: the world must kill the Hero\n\tpass\n"
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "first_hour_route_probe.gd"
            path.write_text('extends "%s"\n\nfunc _after_home_continuation() -> void:\n%s' % (probes.CHAIN, body), encoding="utf-8")
            audit = probes.audit_probe(path, "\n".join(_texts()[0].values()))
        self.assertEqual(audit["forbidden"], [])
        self.assertTrue(audit["sound"])


class DecisionProbeTests(unittest.TestCase):
    """The D055-D061 contract family: same standards, plus the staging bans.

    These probes exist to answer "does the product implement this rule at all".
    They are therefore *expected* to be RED today, and the gate must make that
    expectation explicit and checkable — a D probe that quietly reported PASS
    against a missing feature is the failure mode this class prevents.
    """

    def setUp(self) -> None:
        self.texts, _manifest = _texts()
        self.payload = probes.run(self.texts, support.REPO_ROOT)
        self.rows = self.payload["decision_probes"]

    def test_the_family_is_audited_not_ignored(self) -> None:
        # A second directory that no rule looked at would be worse than no probes.
        self.assertEqual(self.payload["decision_probe_count"], 6)
        self.assertEqual(self.payload["decision_undeclared"], [])
        self.assertEqual(self.payload["decision_defects"], [])
        self.assertTrue(self.payload["decision_harness"]["sound"])

    def test_every_contract_probe_extends_the_contract_harness(self) -> None:
        for row in self.rows:
            with self.subTest(probe=row["file"]):
                self.assertEqual(row["extends"], probes.DECISION_CHAIN)
                self.assertTrue(row["extends_shipped_chain"])

    def test_every_contract_probe_is_sound_and_declares_its_expectation(self) -> None:
        for row in self.rows:
            with self.subTest(probe=row["file"]):
                self.assertTrue(row["sound"], row["forbidden"])
                self.assertTrue(row["claim"])
                self.assertTrue(row["question"])
                self.assertTrue(row["expected_today"])
                self.assertTrue(row["a0_action"])
                self.assertTrue(row["closes"])
                self.assertEqual(row["requires_missing"], [])

    def test_every_contract_probe_names_a_red_expectation_where_the_rule_is_absent(self) -> None:
        for row in self.rows:
            with self.subTest(probe=row["file"]):
                # Either it has measured an absent rule (and expects RED/BLOCKED),
                # or it asserts something that exists and expects a real verdict.
                if row["absent_confirmed"]:
                    self.assertTrue(
                        row["expected_today"].startswith(("RED_NOT_IMPLEMENTED", "BLOCKED")),
                        row["expected_today"],
                    )
                self.assertEqual(row["absent_unexpected"], [], "stale expectation: " + row["file"])

    def test_the_family_confirms_the_absent_symbols_rather_than_assuming_them(self) -> None:
        confirmed = sum(len(row["absent_confirmed"]) for row in self.rows)
        self.assertGreaterEqual(confirmed, 20)

    def test_the_contract_harness_is_the_only_door_to_a_real_world(self) -> None:
        harness = self.payload["decision_harness"]
        self.assertEqual(harness["add_child_count"], 1)
        self.assertEqual(harness["mount_door"], "_mount_world")
        self.assertTrue(harness["world_scene"].startswith("res://game/"))
        self.assertEqual(harness["reasons"], [])


class ContractForbiddenTests(unittest.TestCase):
    """Each staging ban must fire, or it guards nothing."""

    EXAMPLES = [
        "\tvar scene := load(\"res://game/overworld/chapter1_overworld.tscn\") as PackedScene\n\tadd_child(scene.instantiate())\n",
        "\nclass StubSave:\n\tvar bags := {}\n",
        "\tvar fake := load(\"res://tests/fixtures/a0_save_diff.gd\")\n",
    ]

    def _audit(self, body: str) -> dict:
        header = 'extends "%s"\n\nfunc _body() -> void:\n' % probes.DECISION_CHAIN
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "d999_contract_probe.gd"
            path.write_text(header + body, encoding="utf-8")
            return probes.audit_probe(
                path,
                "\n".join(_texts()[0].values()),
                chain=probes.DECISION_CHAIN,
                forbidden=list(probes.FORBIDDEN) + list(probes.FORBIDDEN_CONTRACT),
                metadata=probes.D_PROBES,
            )

    def test_there_is_one_example_per_contract_rule(self) -> None:
        self.assertEqual(len(self.EXAMPLES), len(probes.FORBIDDEN_CONTRACT))

    def test_every_contract_rule_fires_on_its_example(self) -> None:
        for rule, example in zip(probes.FORBIDDEN_CONTRACT, self.EXAMPLES):
            with self.subTest(rule=rule["pattern"]):
                haystack = probes._strip_comments(example, blank_strings=not rule["literals"])
                self.assertTrue(re.search(rule["pattern"], haystack), "dead rule: " + rule["pattern"])

    def test_a_contract_probe_that_stages_a_scene_is_rejected(self) -> None:
        audit = self._audit(self.EXAMPLES[0])
        self.assertFalse(audit["sound"])
        self.assertTrue(any("audited door" in row["why"] for row in audit["forbidden"]))

    def test_a_contract_probe_that_defines_a_double_is_rejected(self) -> None:
        audit = self._audit(self.EXAMPLES[1])
        self.assertFalse(audit["sound"])
        self.assertTrue(any("test double" in row["why"] for row in audit["forbidden"]))

    def test_a_contract_probe_that_loads_a_fixture_is_rejected(self) -> None:
        audit = self._audit(self.EXAMPLES[2])
        self.assertFalse(audit["sound"])
        self.assertTrue(any("production scripts" in row["why"] for row in audit["forbidden"]))

    def test_a_harness_with_a_second_mount_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "d_harness.gd"
            path.write_text(
                'extends SceneTree\n\nconst WORLD_SCENE := "res://game/overworld/chapter1_overworld.tscn"\n\n'
                "func _mount_world() -> Node:\n\troot.add_child(Node.new())\n"
                "func _extra() -> void:\n\troot.add_child(Node.new())\n",
                encoding="utf-8",
            )
            audit = probes.audit_decision_harness(path)
        self.assertFalse(audit["sound"])
        self.assertEqual(audit["add_child_count"], 2)
        self.assertTrue(any("exactly one add_child" in reason for reason in audit["reasons"]))

    def test_a_harness_mounting_a_non_game_scene_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "d_harness.gd"
            path.write_text(
                'extends SceneTree\n\nconst WORLD_SCENE := "res://tests/fixtures/stub_world.tscn"\n\n'
                "func _mount_world() -> Node:\n\troot.add_child(Node.new())\n",
                encoding="utf-8",
            )
            audit = probes.audit_decision_harness(path)
        self.assertFalse(audit["sound"])
        self.assertTrue(any("res://game/" in reason for reason in audit["reasons"]))


class ProbeArtifactTests(unittest.TestCase):
    def test_the_committed_artifact_matches_a_fresh_run(self) -> None:
        committed = json.loads((support.RESULTS_DIR / "native_probes.json").read_text(encoding="utf-8"))
        fresh = probes.run(*_texts()[:1], support.REPO_ROOT)
        self.assertEqual(committed["verdict"], fresh["verdict"])
        self.assertEqual(committed["probe_count"], fresh["probe_count"])
        self.assertEqual(committed["evidence_class"], "NATIVE_UNEXECUTED")

    def test_the_matrix_carries_the_unexecuted_class_forward(self) -> None:
        matrix = json.loads((support.RESULTS_DIR / "matrix.json").read_text(encoding="utf-8"))
        row = next(r for r in matrix["rows"] if r["gap_id"] == "GAP-4")
        self.assertEqual(row["proof"]["probe_evidence_class"], "NATIVE_UNEXECUTED")
        self.assertTrue(row["proof"]["probes"])


if __name__ == "__main__":
    unittest.main()
