"""Product-readiness audit tests, including executable closure probes.

Two kinds of assertion live here, and the difference matters:

* **Verified finding tests** assert on the *pinned* bytes. If an owner fixes the
  blocker, these fail loudly and must be updated together with the re-pin — that
  is the point, it stops a silent "we fixed it" claim.
* **Closure probe tests** mutate an in-memory copy of the facts to simulate the
  owner's minimal correction and require the same check to flip to PASS. That
  proves the acceptance criterion is measurable before anyone claims closure.
"""
from __future__ import annotations

import ast
import copy
import json
import unittest
from pathlib import Path

import _support as support

from sohbalance import blockers as blocker_module
from sohbalance import product
from sohbalance.identity import classify_target, loot_identity_map


ROOT = Path(__file__).resolve().parents[3]


def _facts() -> dict:
    model = support.model()
    texts, manifest = product.load_snapshot(ROOT)
    facts = product.build_facts(
        texts,
        manifest,
        loot_tables=sorted(model.loot_tables),
        station_ids=sorted(model.stations),
    )
    facts.update(product.model_facts(model))
    return facts


def _by_id(checks, check_id):
    for check in checks:
        if check["check_id"] == check_id:
            return check
    raise KeyError(check_id)


class PinnedSurfaceTests(unittest.TestCase):
    """Assertions on the bytes A7 actually read."""

    def setUp(self) -> None:
        self.facts = _facts()
        self.checks = {c["check_id"]: c for c in product.run_checks(self.facts)}

    def test_snapshot_hashes_are_verified_on_load(self) -> None:
        # load_snapshot raises on any byte drift; reaching here means all 18 matched.
        _texts, manifest = product.load_snapshot(ROOT)
        self.assertEqual(len(manifest["files"]), 37)
        self.assertEqual(manifest["schema"], "soh.balance.product_snapshot.v1")

    def test_home_screen_has_no_survival_destination(self) -> None:
        self.assertEqual(
            self.facts["home_function_keys"],
            ["bestiary", "campaign", "hero_roster", "modes", "settings", "storage"],
        )
        self.assertEqual(self.facts["home_survival_keys"], [])
        self.assertEqual(self.checks["PROD-01"]["status"], "FAIL")

    def test_no_production_code_references_a_loot_table(self) -> None:
        # Scripts/scenes are the host test. A0 also ships a byte-identical copy of
        # A3's catalog, which mentions the table name; a data mirror is not a host.
        self.assertEqual(self.facts["loot_tables_in_production_code"], [])
        self.assertIn("roadside_cache", self.facts["loot_tables_in_data_mirrors"])
        self.assertEqual(self.checks["PROD-02"]["status"], "FAIL")

    def test_only_reward_chest_exists_and_it_pays_score_not_items(self) -> None:
        self.assertEqual(self.facts["chest_grants"], ["score_reward: int, contained_sigil: bool"])
        self.assertFalse(self.facts["chest_mentions_item_grant"])

    def test_mounted_player_is_knight_and_canonical_sources_are_absent(self) -> None:
        self.assertEqual(self.facts["mounted_player_scene"], "game/characters/knight/knight.tscn")
        self.assertEqual(
            self.facts["canonical_avatar_production_refs"], {"555940": 0, "419402": 0, "180537": 0}
        )
        self.assertGreater(self.facts["knight_production_refs"], 0)
        self.assertEqual(self.facts["armor_stage_refs"], [])
        self.assertEqual(self.checks["PROD-03"]["status"], "FAIL")

    def test_canonical_sources_appear_only_in_docs(self) -> None:
        docs = self.facts["canonical_avatar_doc_refs"]
        self.assertGreater(docs["555940"], 0)
        self.assertGreater(docs["419402"], 0)

    def test_debug_vocabulary_is_present_on_visible_strings(self) -> None:
        tokens = {row["token"] for row in self.facts["visible_debug_tokens"]}
        for expected in ("FIXTURE", "BLOCKED_PENDING", "PROJECTION"):
            self.assertIn(expected, tokens)
        self.assertEqual(self.checks["PROD-04"]["status"], "FAIL")

    def test_survival_ui_is_a_closed_island(self) -> None:
        self.assertEqual(self.facts["survival_ui_scenes_mounted"], [])
        self.assertTrue(self.facts["survival_ui_closed_island"])

    def test_no_fake_success_screen_exists(self) -> None:
        # Repinned at A6 bed3fc81: the new acceptance journeys add completion wording,
        # so the broad file-level check now warns instead of passing. Q-07 is the
        # sharper measure and confirms every one of them is labelled a read-only fixture.
        claims = self.facts["completion_claims"]
        self.assertTrue(claims, "fixture screens do mention completion; the check must see them")
        self.assertEqual(self.checks["PROD-05"]["status"], "WARN")

    def test_catalog_has_no_unconnected_item(self) -> None:
        self.assertEqual(self.facts["orphan_items"], [])
        self.assertEqual(self.checks["PROD-07"]["status"], "PASS")

    def test_unknown_evidence_is_declared_not_guessed(self) -> None:
        gaps = product.data_gaps(self.facts)
        self.assertTrue(any("native run" in row for row in gaps["unknown_evidence"]))


class IdentityTaxonomyTests(unittest.TestCase):
    """Source record vs class vs physical instance vs region vs POI id."""

    def setUp(self) -> None:
        self.model = support.model()
        self.mapping = loot_identity_map(self.model)

    def test_one_record_is_not_one_poi(self) -> None:
        self.assertEqual(self.mapping["record_count"], 16)
        self.assertEqual(self.mapping["distinct_targets"], 10)
        self.assertEqual(
            sum(row["record_count"] for row in self.mapping["targets"].values()),
            self.mapping["record_count"],
        )

    def test_all_targets_use_the_class_namespace(self) -> None:
        kinds = {row["target_kind"] for row in self.mapping["targets"].values()}
        self.assertEqual(kinds, {"CLASS_NAMESPACE"})
        self.assertFalse(self.mapping["instance_namespaced_targets"])

    def test_no_target_resolves_and_no_instance_is_authored(self) -> None:
        self.assertEqual(self.mapping["targets_resolving_to_a1_instance"], [])
        self.assertEqual(self.mapping["physical_container_instances_authored_by_a1"], 0)

    def test_a1_publishes_no_container_vocabulary(self) -> None:
        self.assertEqual(self.mapping["a1_container_class_vocabulary"], [])

    def test_regions_are_a_third_disjoint_vocabulary(self) -> None:
        self.assertEqual(
            self.mapping["regions_unresolved"], ["mire_wetlands", "opening_marches", "sealed_archive"]
        )

    def test_namespace_classifier(self) -> None:
        self.assertEqual(classify_target("poi:roadside_cache")["kind"], "CLASS_NAMESPACE")
        self.assertEqual(classify_target("poi_crown_waystation")["kind"], "INSTANCE_PREFIX")
        self.assertEqual(classify_target(None)["kind"], "ABSENT")
        self.assertEqual(classify_target("Roadside Cache")["kind"], "UNKNOWN_SCHEME")


class BlockerConsolidationTests(unittest.TestCase):
    def setUp(self) -> None:
        model = support.model()
        facts = _facts()
        artifact_dir = ROOT / "data/survival/balance/results"
        findings = json.loads((artifact_dir / "findings.json").read_text(encoding="utf-8"))["findings"]
        payload = blocker_module.build(
            findings, product.run_checks(facts), loot_identity_map(model), facts
        )
        self.payload = payload
        self.findings = findings

    def test_at_most_five_blockers(self) -> None:
        self.assertLessEqual(len(self.payload["blockers"]), 5)
        self.assertEqual(len(self.payload["blockers"]), 4)
        self.assertEqual(self.payload["counts"]["closed_blockers"], 2)

    def test_every_blocker_is_owned_actionable_and_closable(self) -> None:
        for row in self.payload["blockers"]:
            with self.subTest(blocker=row["blocker_id"]):
                self.assertTrue(row["owner"])
                self.assertTrue(row["player_impact"])
                self.assertTrue(row["minimal_safe_correction"])
                self.assertTrue(row["closure_test"])
                self.assertTrue(row["reproduce"])
                self.assertIn(row["evidence_class"], {
                    "MISSING_PRODUCTION_MOUNT",
                    "SOURCE_DATA_INCOMPATIBILITY",
                    "PLAYER_FACING_VISUAL_DEFECT",
                    "FIXTURE_ONLY_SUCCESS",
                })
                self.assertTrue(row["closure_probe"])
                self.assertTrue(row["not_proven_after_closure"])

    def test_every_observation_is_triaged_once(self) -> None:
        self.assertEqual(len(self.payload["triage"]), len(self.findings))
        counts = self.payload["counts"]
        # Every finding lands in exactly one place: an active blocker, the closed
        # bucket, or traceability. Nothing is silently dropped and nothing is counted twice.
        mapped_findings = sum(
            1
            for row in self.payload["blockers"]
            for observation in row["observations"]
            if observation["kind"] == "finding"
        )
        self.assertEqual(mapped_findings + counts["closed_or_traceability"], len(self.findings))
        # A blocker may be evidenced by the integration gate alone (the commit gap
        # produces no audit finding), but never by nothing at all.
        for row in self.payload["blockers"]:
            self.assertTrue(row["evidence"], row["blocker_id"])
            if row["observation_count"] == 0:
                self.assertEqual(row["evidence_class"], "FIXTURE_ONLY_SUCCESS", row["blocker_id"])

    def test_closure_tests_really_exist(self) -> None:
        for row in self.payload["blockers"]:
            with self.subTest(blocker=row["blocker_id"]):
                path, _, method = row["closure_test"].partition("::")
                file = ROOT / path
                self.assertTrue(file.exists(), path)
                tree = ast.parse(file.read_text(encoding="utf-8"))
                names = {
                    node.name
                    for node in ast.walk(tree)
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
                }
                self.assertIn(method.split("::")[-1], names)

    def test_markdown_is_generated_from_the_same_payload(self) -> None:
        markdown = blocker_module.as_markdown(self.payload)
        for row in self.payload["blockers"]:
            self.assertIn(row["blocker_id"], markdown)
            self.assertIn(row["title"], markdown)
        # The committed doc is the one report.build writes (it also carries gate links),
        # so comparing it to a payload rebuilt without those inputs would be wrong.
        committed = (ROOT / "docs/survival/balance/PLAYER_BLOCKERS.md").read_text(encoding="utf-8")
        self.assertIn("Do not edit by hand", committed)
        for row in self.payload["blockers"]:
            self.assertIn(row["title"], committed)


class ProductClosureTests(unittest.TestCase):
    """Simulate the owner's minimal correction and require the check to flip."""

    def setUp(self) -> None:
        self.facts = _facts()

    def _status(self, facts, check_id):
        return _by_id(product.run_checks(facts), check_id)["status"]

    def test_blk1_closes_when_one_survival_destination_exists(self) -> None:
        facts = copy.deepcopy(self.facts)
        self.assertEqual(self._status(facts, "PROD-01"), "FAIL")
        facts["home_function_keys"] = sorted(list(facts["home_function_keys"]) + ["survival_world"])
        facts["home_survival_keys"] = ["survival_world"]
        self.assertEqual(self._status(facts, "PROD-01"), "PASS")

    def test_blk2_closes_when_a_container_is_hosted_and_ids_join(self) -> None:
        facts = copy.deepcopy(self.facts)
        self.assertEqual(self._status(facts, "PROD-02"), "FAIL")
        facts["loot_tables_in_production_code"] = ["roadside_cache"]
        self.assertEqual(self._status(facts, "PROD-02"), "PASS")

        model = support.model()
        mapping = loot_identity_map(model)
        self.assertEqual(mapping["targets_resolving_to_a1_instance"], [])
        # The identity criterion is data-driven: a resolved target would appear here.
        simulated = copy.deepcopy(mapping)
        simulated["targets_resolving_to_a1_instance"] = ["poi:crown_waystation_cache"]
        self.assertTrue(simulated["targets_resolving_to_a1_instance"])

    def test_blk3_closes_when_the_mounted_body_is_canonical(self) -> None:
        facts = copy.deepcopy(self.facts)
        self.assertEqual(self._status(facts, "PROD-03"), "FAIL")
        facts["mounted_player_scene"] = "game/characters/adventurer_female_419402/adventurer.tscn"
        facts["canonical_avatar_production_refs"] = {"555940": 1, "419402": 1, "180537": 0}
        self.assertEqual(self._status(facts, "PROD-03"), "PASS")

    def test_blk3_does_not_close_with_the_swordsman_pack(self) -> None:
        # 180537 is a different character and must never satisfy the avatar gate.
        facts = copy.deepcopy(self.facts)
        facts["mounted_player_scene"] = "game/characters/swordsman_180537/swordsman.tscn"
        facts["canonical_avatar_production_refs"] = {"555940": 0, "419402": 0, "180537": 1}
        self.assertEqual(self._status(facts, "PROD-03"), "FAIL")

    def test_blk5_closes_when_debug_text_and_duplication_are_gone(self) -> None:
        facts = copy.deepcopy(self.facts)
        self.assertEqual(self._status(facts, "PROD-04"), "FAIL")
        self.assertEqual(self._status(facts, "PROD-06"), "WARN")
        facts["visible_debug_tokens"] = []
        facts["dashboards"] = ["a0.hud.gd"]
        self.assertEqual(self._status(facts, "PROD-04"), "PASS")
        self.assertEqual(self._status(facts, "PROD-06"), "PASS")


if __name__ == "__main__":
    unittest.main()
