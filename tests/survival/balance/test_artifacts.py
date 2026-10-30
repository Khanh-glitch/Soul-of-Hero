"""Artifact tests: determinism, schema, honesty labels, and the committed copy."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import _support as support

from sohbalance import report


class ArtifactBuildTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.artifacts = report.build(support.DATA_DIR)

    def test_all_artifacts_present(self) -> None:
        self.assertEqual(sorted(self.artifacts), sorted(report.ARTIFACTS))

    def test_build_is_deterministic(self) -> None:
        again = report.build(support.DATA_DIR)
        for name in report.ARTIFACTS:
            self.assertEqual(
                json.dumps(self.artifacts[name], sort_keys=True),
                json.dumps(again[name], sort_keys=True),
                name,
            )

    def test_summary_assertions_hold(self) -> None:
        summary = self.artifacts["summary.json"]
        self.assertTrue(summary["assertions_all_hold"])
        self.assertTrue(all(assertion["holds"] for assertion in summary["assertions"]))
        self.assertGreaterEqual(len(summary["assertions"]), 12)

    def test_summary_headline_is_honest(self) -> None:
        headline = self.artifacts["summary.json"]["headline"]
        self.assertEqual(headline["pois_authored"], 118)
        self.assertEqual(headline["pois_loot_bearing_in_authored_contract"], 0)
        self.assertEqual(headline["loot_tables_that_can_emit_a_core"], 0)
        self.assertEqual(headline["a3_loot_sources_with_unresolved_a1_poi"], 16)
        self.assertEqual(headline["resource_nodes_authored_not_crates"], 178)

    def test_non_claims_are_recorded(self) -> None:
        non_claims = " ".join(self.artifacts["summary.json"]["explicit_non_claims"])
        self.assertIn("No Core drop rate", non_claims)
        self.assertIn("not a playtest", non_claims)
        self.assertIn("BLOCKED_PENDING_A4", non_claims)

    def test_sensitivity_is_labelled_hypothetical(self) -> None:
        payload = self.artifacts["sensitivity.json"]
        self.assertEqual(payload["labels"]["hypothetical"], "HYPOTHETICAL_NOT_A3_TUNING")
        self.assertEqual(
            payload["core_probability_grid"]["label"], "HYPOTHETICAL_NOT_A3_TUNING"
        )
        self.assertEqual(
            payload["core_capable_sources"]["eligible_roadside_containers_today"], 0
        )

    def test_opportunity_declares_unmodelled_time(self) -> None:
        payload = self.artifacts["opportunity.json"]
        self.assertIn("combat", payload["time_model"]["unmodelled"])
        for pattern in payload["patterns"]:
            self.assertIn("unmodelled_time", pattern)

    def test_provenance_is_reproducible_from_committed_bytes(self) -> None:
        payload = self.artifacts["provenance.json"]
        self.assertEqual(len(payload["snapshots"]), 16)
        for snapshot in payload["snapshots"]:
            self.assertTrue(snapshot["verified"], snapshot["key"])
        # The live upstream comparison is environment-dependent, so the artifact
        # records that fact instead of baking this checkout's ref state into git.
        drift_check = payload["upstream_drift_check"]
        self.assertEqual(drift_check["status"], "ENVIRONMENT_DEPENDENT_NOT_IN_ARTIFACT")
        self.assertIn("--check-upstream", drift_check["command"])

    def test_adversarial_artifact_matches_case_count(self) -> None:
        payload = self.artifacts["adversarial.json"]
        self.assertEqual(payload["cases_total"], 24)
        self.assertEqual(payload["cases_passed"], 24)


class ArtifactWriteTests(unittest.TestCase):
    def test_write_round_trip_and_digest_stability(self) -> None:
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            artifacts = report.build(support.DATA_DIR)
            report.write(artifacts, Path(first))
            report.write(report.build(support.DATA_DIR), Path(second))
            first_digest = json.loads((Path(first) / "digest.json").read_text())
            second_digest = json.loads((Path(second) / "digest.json").read_text())
            self.assertEqual(first_digest, second_digest)
            self.assertEqual(len(first_digest["artifacts"]), len(report.ARTIFACTS))

    def test_committed_artifacts_are_current(self) -> None:
        artifacts = report.build(support.DATA_DIR)
        stale = []
        for name, payload in artifacts.items():
            path = support.RESULTS_DIR / name
            expected = json.dumps(payload, indent=2, sort_keys=True) + "\n"
            if not path.exists() or path.read_text(encoding="utf-8") != expected:
                stale.append(name)
        self.assertEqual(stale, [], "run: python3 tools/survival/balance/run_analysis.py")


if __name__ == "__main__":
    unittest.main()
