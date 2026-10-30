"""D055-D061 are not accepted, and this file makes that hard to misread.

The matrix artifact is generated from a composition checkout outside this
repository, so the checks here are about *shape and honesty* rather than
re-deriving bytes that are not in this checkout: no row may be IMPLEMENTED while
its prose promises a pass, a guard may never add to a score, every satisfied rule
may carry evidence, and every rejected near-miss must still be present in the tree
it was rejected from. The generation command is recorded in the artifact itself.
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path

import _support as support

DECISIONS = support.RESULTS_DIR / "decisions.v1.json"
PROBES = support.RESULTS_DIR / "native_probes.json"


def _decisions() -> dict:
    return json.loads(DECISIONS.read_text(encoding="utf-8"))


class DecisionsMatrixTests(unittest.TestCase):
    def setUp(self) -> None:
        self.payload = _decisions()
        self.rows = {row["decision"]: row for row in self.payload["rows"]}

    def test_the_series_is_audited_by_decision(self) -> None:
        self.assertEqual(self.payload["schema"], "soh.balance.decisions.v1")
        self.assertEqual(
            [row["decision"] for row in self.payload["rows"]],
            ["D055", "D056", "D057", "D058", "D059", "D060", "D061"],
        )
        self.assertEqual(self.payload["counts"]["IMPLEMENTED"], 0)

    def test_no_row_is_claimed_acceptable(self) -> None:
        self.assertEqual(self.payload["verdict"], "D_SERIES_NOT_ACCEPTABLE")
        for name, row in self.rows.items():
            with self.subTest(decision=name):
                self.assertIn(row["state"], ("ABSENT", "PARTIAL"))
                self.assertNotIn("accept", row["claim_allowed"].lower().split("no ")[0])
                self.assertTrue(row["missing"], "an incomplete row must name what is missing")

    def test_a_guard_can_only_subtract(self) -> None:
        # D061 has zero implemented rules and one clean guard. If the guard were
        # counted as progress the row would look a third done for doing nothing.
        row = self.rows["D061"]
        self.assertEqual(row["guards_checked"], 1)
        self.assertEqual(row["guards_violated"], [])
        self.assertEqual(row["satisfied"], 0)

    def test_every_satisfied_rule_carries_a_file_and_line(self) -> None:
        for name, row in self.rows.items():
            for check in row["checks"]:
                if not check["ok"] or check["forbidden"]:
                    continue
                with self.subTest(decision=name, rule=check["id"]):
                    self.assertTrue(check["hits"], "a satisfied rule with no evidence is a guess")
                    for hit in check["hits"]:
                        path, _, line = hit.rpartition(":")
                        self.assertTrue(path.startswith("game/"), hit)
                        self.assertTrue(line.isdigit(), hit)

    def test_every_rejected_near_miss_is_still_in_the_tree_it_was_rejected_from(self) -> None:
        spoofs = self.payload["spoofs"]
        self.assertEqual(len(spoofs), 8)
        for spoof in spoofs:
            with self.subTest(spoof=spoof["id"]):
                self.assertEqual(spoof["token_present"], "yes", "stale ledger: " + spoof["path"])
                self.assertEqual(spoof["counts_as_satisfied"], "never")
                self.assertEqual(spoof["verdict"], "REJECTED")
                self.assertTrue(spoof["reason"])

    def test_the_matrix_carries_the_bytes_it_read(self) -> None:
        scanned = self.payload["scanned"]
        self.assertGreaterEqual(scanned["file_count"], 300)
        self.assertEqual(len(scanned["digest"]), 64)
        self.assertEqual(len(scanned["files"]), scanned["file_count"])
        self.assertIn("decisions_matrix.py", self.payload["reproduce"])
        self.assertEqual(self.payload["sha"], "f3556747219a14b2c53867fbc08d0e611aedcefc")


class DecisionsAgreeWithTheProbesTests(unittest.TestCase):
    """The contract matrix and the probes must tell the same story."""

    def setUp(self) -> None:
        self.decisions = {row["decision"]: row for row in _decisions()["rows"]}
        payload = json.loads(PROBES.read_text(encoding="utf-8"))
        self.claims: dict = {}
        for row in payload["decision_probes"]:
            for decision in row["closes"]:
                self.claims.setdefault(decision, []).append(row)

    def test_every_decision_has_a_probe_that_closes_it(self) -> None:
        for name in ("D055", "D056", "D057", "D058", "D059", "D060", "D061"):
            with self.subTest(decision=name):
                self.assertIn(name, self.claims)

    def test_a_row_that_is_not_implemented_has_a_probe_expecting_red(self) -> None:
        for name, row in self.decisions.items():
            with self.subTest(decision=name):
                expectations = [probe["expected_today"] for probe in self.claims[name]]
                self.assertTrue(
                    any(text.startswith(("RED_NOT_IMPLEMENTED", "BLOCKED")) for text in expectations),
                    expectations,
                )

    def test_the_probes_confirm_the_absent_symbols_the_matrix_names(self) -> None:
        confirmed = {
            symbol
            for probes in self.claims.values()
            for probe in probes
            for symbol in probe["absent_confirmed"]
        }
        self.assertGreaterEqual(len(confirmed), 20)
        # The two clearest D055/D059 symbols must be measured, not assumed.
        self.assertIn("run_history", confirmed)
        self.assertIn("last_seen_at", confirmed)


if __name__ == "__main__":
    unittest.main()
