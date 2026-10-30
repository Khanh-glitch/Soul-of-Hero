"""Quality tests: each check must fail for the defect it names and pass without it.

A check that only ever returns PASS is decoration. Each test below builds the
defective input by hand and requires the verdict to move, so the suite is a
detector rather than a status board.
"""
from __future__ import annotations

import copy
import json
import unittest

import _support as support

from sohbalance import product, quality


def _inputs():
    texts, manifest = product.load_snapshot(support.REPO_ROOT)
    model = support.model()
    facts = product.build_facts(
        texts, manifest, loot_tables=sorted(model.loot_tables), station_ids=sorted(model.stations)
    )
    facts.update(product.model_facts(model))
    return model, texts, manifest, facts


def _by_id(checks, check_id):
    return next(check for check in checks if check["check_id"] == check_id)


class QualityPinTests(unittest.TestCase):
    """What the pinned owner bytes actually say at this commit."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.model, cls.texts, cls.manifest, cls.facts = _inputs()
        cls.checks = quality.run_all(cls.model, cls.texts, cls.facts, cls.manifest)

    def test_seven_checks_run(self) -> None:
        self.assertEqual(
            [check["check_id"] for check in self.checks],
            ["Q-01", "Q-02", "Q-03", "Q-04", "Q-05", "Q-06", "Q-07"],
        )

    def test_two_checks_fail_at_this_pin(self) -> None:
        failing = [check["check_id"] for check in self.checks if check["status"] == "FAIL"]
        # Q-03 (A0's stale mirror) is a real second failure at this pin; it is
        # reported as BLK-2, not folded into the avatar blocker.
        self.assertEqual(failing, ["Q-03", "Q-04"])

    def test_every_verdict_names_an_owner_and_a_closure_signal(self) -> None:
        for check in self.checks:
            self.assertIn(check["status"], {"PASS", "FAIL", "WARN", "UNKNOWN"})
            self.assertTrue(check["owner"], check["check_id"])
            self.assertTrue(check["closure_signal"], check["check_id"])
            self.assertTrue(check["evidence"], check["check_id"])

    def test_no_check_claims_a_native_pass(self) -> None:
        banned = ("verified in game", "verified at runtime", "proven in play")
        for check in self.checks:
            haystack = (check["player_impact"] + " " + check["closure_signal"]).lower()
            for phrase in banned:
                self.assertNotIn(phrase, haystack, check["check_id"])
            # Evidence must be plain data so it can be diffed between commits.
            json.dumps(check["evidence"], sort_keys=True)


class QualityClosureTests(unittest.TestCase):
    """Reconstruct each defect and require the verdict to flip."""

    def setUp(self) -> None:
        self.model, self.texts, self.manifest, self.facts = _inputs()

    def _status(self, checks, check_id):
        return _by_id(checks, check_id)["status"]

    # ---------------------------------------------------------------- Q-04
    def test_blk3_closes_when_the_mounted_body_and_grade0_sheet_are_canonical(self) -> None:
        self.assertEqual(self._status(quality.run_all(self.model, self.texts, self.facts, self.manifest), "Q-04"), "FAIL")

        texts = dict(self.texts)
        manifest = json.loads(texts["a6.avatar_art_manifest.json"])
        gender = "female"
        manifest["characters"][gender]["armor_grades"]["0"]["idle_sheet"] = (
            f"res://art/characters/{manifest['characters'][gender]['craftpix_id']}/idle.png"
        )
        texts["a6.avatar_art_manifest.json"] = json.dumps(manifest)
        facts = copy.deepcopy(self.facts)
        # Round-4 rule: a sheet string only counts if the file is in the pinned
        # tree, so the simulation installs the bytes rather than the path alone.
        installed = manifest["characters"][gender]["armor_grades"]["0"]["idle_sheet"][len("res://") :]
        patched_manifest = copy.deepcopy(self.manifest)
        patched_manifest["_tree"] = list(patched_manifest.get("_tree", [])) + [["a6", installed]]
        facts["mounted_player_scene"] = (
            f"game/characters/{manifest['characters'][gender]['craftpix_id']}/adventurer_female.tscn"
        )
        self.assertEqual(
            self._status(quality.run_all(self.model, texts, facts, patched_manifest), "Q-04"), "PASS"
        )

    def test_blk3_does_not_close_with_a_swordsman_or_knight_body(self) -> None:
        texts = dict(self.texts)
        manifest = json.loads(texts["a6.avatar_art_manifest.json"])
        manifest["characters"]["male"]["armor_grades"]["0"]["idle_sheet"] = "res://art/male_idle.png"
        texts["a6.avatar_art_manifest.json"] = json.dumps(manifest)
        for wrong in (
            "game/characters/swordsman_180537/swordsman.tscn",
            "game/characters/knight/knight.tscn",
        ):
            facts = copy.deepcopy(self.facts)
            facts["mounted_player_scene"] = wrong
            self.assertEqual(
                self._status(quality.run_all(self.model, texts, facts, self.manifest), "Q-04"),
                "FAIL",
                wrong,
            )

    def test_blk3_fails_when_the_adapter_silently_falls_back(self) -> None:
        texts = dict(self.texts)
        texts["a6.avatar_appearance_adapter.gd"] += "\n# fallback: knight\n"
        checks = quality.run_all(self.model, texts, self.facts, self.manifest)
        self.assertEqual(self._status(checks, "Q-04"), "FAIL")

    # ---------------------------------------------------------------- Q-03
    def test_blk2_closes_when_the_a0_mirror_matches_a3(self) -> None:
        checks = quality.run_all(self.model, self.texts, self.facts, self.manifest)
        self.assertEqual(self._status(checks, "Q-03"), "FAIL")
        drift = quality.mirror_drift(self.model, self.texts)
        self.assertEqual(drift["status"], "DRIFT")
        self.assertEqual(drift["divergent"], ["road_scrap", "road_supplies"])

        # The owner's smallest safe fix: re-sync the two drifted rows. No quantity
        # moves, because A1's yields and A3's yields already agree.
        texts = dict(self.texts)
        mirror = json.loads(texts["a0.sources.json"])
        for source_id in drift["divergent"]:
            mirror["sources"][source_id] = self.model.sources[source_id]
        texts["a0.sources.json"] = json.dumps(mirror)
        self.assertEqual(quality.mirror_drift(self.model, texts)["status"], "MATCH")
        self.assertEqual(self._status(quality.run_all(self.model, texts, self.facts, self.manifest), "Q-03"), "PASS")

    def test_blk2_does_not_close_when_only_the_poi_id_is_renamed(self) -> None:
        # Renaming the poi key without adopting the bound instance would leave the
        # mirror disagreeing in a new way; the check compares whole rows.
        texts = dict(self.texts)
        mirror = json.loads(texts["a0.sources.json"])
        row = mirror["sources"]["road_scrap"]
        row["poi"] = "poi_crown_waystation"
        texts["a0.sources.json"] = json.dumps(mirror)
        self.assertEqual(quality.mirror_drift(self.model, texts)["status"], "DRIFT")

    # ---------------------------------------------------------------- Q-02
    def test_q02_fails_when_two_scripts_own_the_same_hud_job(self) -> None:
        texts = dict(self.texts)
        texts["a6.player_first_hud.gd"] += "\n# draws the health bar too\n"
        original = dict(quality.HUD_JOBS)
        patched = dict(original)
        patched["a6.player_first_hud.gd"] = list(patched["a6.player_first_hud.gd"]) + ["health"]
        try:
            quality.HUD_JOBS.clear()
            quality.HUD_JOBS.update(patched)
            checks = quality.run_all(self.model, texts, self.facts, self.manifest)
            self.assertEqual(self._status(checks, "Q-02"), "FAIL")
        finally:
            quality.HUD_JOBS.clear()
            quality.HUD_JOBS.update(original)

    def test_q02_warns_when_developer_diagnostics_defaults_on(self) -> None:
        texts = dict(self.texts)
        texts["a6.player_first_hud.gd"] = texts["a6.player_first_hud.gd"].replace(
            "var _developer_diagnostics := false", "var _developer_diagnostics := true"
        )
        checks = quality.run_all(self.model, texts, self.facts, self.manifest)
        self.assertEqual(self._status(checks, "Q-02"), "WARN")

    # ---------------------------------------------------------------- Q-07
    def test_q07_fails_when_a_claim_is_asserted_without_a_commit(self) -> None:
        texts = dict(self.texts)
        texts["a8.poi_pilot.gd"] += '\nconst CLAIM := "SAVE_VERIFIED_NO_DUPLICATE"\n'
        checks = quality.run_all(self.model, texts, self.facts, self.manifest)
        self.assertEqual(self._status(checks, "Q-07"), "FAIL")

    # ---------------------------------------------------------------- Q-06
    def test_q06_fails_when_a_button_has_no_action_host(self) -> None:
        texts = dict(self.texts)
        texts["a6.expedition_planner.gd"] = texts["a6.expedition_planner.gd"].replace(
            "_has_action_host()", "true"
        )
        checks = quality.run_all(self.model, texts, self.facts, self.manifest)
        self.assertEqual(self._status(checks, "Q-06"), "FAIL")


if __name__ == "__main__":
    unittest.main()
