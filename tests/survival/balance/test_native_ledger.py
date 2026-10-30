"""The native run ledger: what actually executed, on which bytes, and how it ended.

`native_runs.v1.json` is the only artifact in this repository that may claim a
probe *ran*. Everything else is a static reading. That makes it the most
dangerous file here, so it is held to what it can prove: a real engine build, one
OS process per probe, a verdict that agrees with that process's exit code, and no
pass that the source gate has not already said could happen.

If the file is absent the checkout simply has no engine evidence, and these tests
say so rather than passing vacuously.
"""
from __future__ import annotations

import json
import unittest

import _support as support

RUNS = support.RESULTS_DIR / "native_runs.v1.json"
EXIT_FOR = {"PASS": 0, "FAIL": 1, "BLOCKED": 2, "RED_NOT_IMPLEMENTED": 3}


def _runs() -> dict:
    return json.loads(RUNS.read_text(encoding="utf-8"))


class NativeRunLedgerTests(unittest.TestCase):
    def setUp(self) -> None:
        if not RUNS.exists():
            self.skipTest("no native run ledger in this checkout")
        self.payload = _runs()
        self.results = self.payload["results"]

    def test_the_ledger_records_a_real_engine_and_exact_bytes(self) -> None:
        self.assertEqual(self.payload["schema"], "soh.balance.native_runs.v1")
        self.assertTrue(self.payload["engine"].startswith("4.7."), self.payload["engine"])
        self.assertEqual(len(self.payload["composition"]["sha"]), 40)
        self.assertTrue(self.payload["probe_source"], "a run without probe hashes cannot be reproduced")

    def test_every_recorded_verdict_agrees_with_its_exit_code(self) -> None:
        for row in self.results:
            with self.subTest(probe=row["probe"]):
                self.assertEqual(EXIT_FOR[row["verdict"]], row["exit_code"], row)
                self.assertEqual(row["claimed"], row["verdict"])
                self.assertEqual(row.get("mismatch", ""), "", row.get("mismatch"))

    def test_the_ledger_never_claims_a_pass_the_source_gate_cannot_support(self) -> None:
        """A pass must be an executed probe that asserted something real.

        Round 7 could write `PASS == 0` as a flat assertion because that pin had no
        engine evidence at all. Round 8 ran a real Godot 4.7 build against a pinned
        composition, so a flat zero would now be a false statement in the other
        direction. What is kept is the *rule*, not the number:

        * a pass must carry assertions (`checks > 0`), an empty defect list, a
          matching exit code and a hashed log — a probe that printed PASS after
          crashing on its fourth line is exactly what this refuses;
        * a pass may not appear in the contract families whose symbols the source
          gate still reports as absent. Those are D055-D061 and the round-8 R055 /
          R060 / R062 / R063 probes: if one of them passes, the absence list in
          this ledger is stale and has to be re-audited before the pass is trusted.
        """
        for row in self.results:
            if row["verdict"] != "PASS":
                continue
            with self.subTest(probe=row["probe"]):
                self.assertGreater(row["checks"], 0, row["probe"])
                self.assertEqual(row["failed"], [], row["probe"])
                self.assertEqual(row["missing"], [], row["probe"])
                self.assertEqual(row["exit_code"], EXIT_FOR["PASS"], row["probe"])
                self.assertTrue(row["log_sha256"], row["probe"])
                self.assertTrue(row["engine_lines"], row["probe"])
                if row["family"] == "balance_native_decisions":
                    self.fail(
                        f"{row['probe']} passed in a family whose rules the source gate reports as absent; "
                        "re-audit the absence list before trusting this pass"
                    )
                if row["probe"] in {
                    "r055_season_probe.gd",
                    "r060_offline_time_probe.gd",
                    "r062_stones_probe.gd",
                    "r063_currency_custody_probe.gd",
                }:
                    self.fail(f"{row['probe']} reported missing symbols elsewhere; the ledger is inconsistent")

    def test_a_blocked_probe_is_never_recorded_as_a_pass(self) -> None:
        for row in self.results:
            if row["exit_code"] == 2:
                self.assertEqual(row["verdict"], "BLOCKED")

    def test_the_harness_is_not_counted_as_a_probe(self) -> None:
        names = [row["probe"] for row in self.results]
        self.assertNotIn("d_harness.gd", names)
        self.assertEqual(len(names), len(set(names)))

    def test_the_summary_matches_the_rows(self) -> None:
        for verdict, count in self.payload["summary"].items():
            self.assertEqual(count, sum(1 for row in self.results if row["verdict"] == verdict))

    def test_every_run_names_its_log_and_engine_banner(self) -> None:
        for row in self.results:
            with self.subTest(probe=row["probe"]):
                self.assertTrue(row["log"].endswith(".log"))
                self.assertEqual(len(row["log_sha256"]), 64)
                self.assertTrue(row["engine_lines"], "the engine banner is what proves an engine ran")


if __name__ == "__main__":
    unittest.main()
