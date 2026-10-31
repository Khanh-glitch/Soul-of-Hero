"""The native runner's classification, proven without an engine.

The dangerous line in a native runner is not "the probe failed". It is "the probe
exited 2 and the runner recorded a pass", because that converts a blocked journey
into acceptance. `run_native.classify` is a pure function so this can be attacked
directly: a claimed verdict, the process exit code and the recorded outcome must
agree, and the weaker outcome always wins.

No Godot binary is required and none is implied. These are tests of the runner.
"""
from __future__ import annotations

import importlib.util
import unittest

import _support as support

TOOL = support.REPO_ROOT / "tools" / "survival" / "balance" / "run_native.py"


def _tool():
    spec = importlib.util.spec_from_file_location("run_native", TOOL)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def classify(output: str, code: int, timed_out: bool = False):
    verdict, details = _tool().classify(output, code, timed_out, 60)
    return verdict, details


class RunnerClassificationTests(unittest.TestCase):
    def test_an_honest_pass_is_a_pass(self) -> None:
        verdict, details = classify("A7 D058 PASS - broad starts: 12 checks, 0 failed, 0 missing\n", 0)
        self.assertEqual(verdict, "PASS")
        self.assertEqual(details["checks"], 12)
        self.assertNotIn("mismatch", details)

    def test_a_blocked_probe_is_never_a_pass(self) -> None:
        verdict, details = classify("A7 D061 BLOCKED the overworld scene is absent\n", 2)
        self.assertEqual(verdict, "BLOCKED")
        self.assertEqual(details["blocked_reason"], "the overworld scene is absent")

    def test_a_claimed_pass_with_a_blocked_exit_becomes_blocked(self) -> None:
        # The exact spoof this exists to stop: the line says PASS, the process
        # says "I could not run".
        verdict, details = classify("A7 D058 PASS - broad starts: 1 check\n", 2)
        self.assertEqual(verdict, "BLOCKED")
        self.assertIn("claimed PASS but exited 2", details["mismatch"])

    def test_a_claimed_pass_that_also_reported_a_missing_symbol_is_red(self) -> None:
        output = (
            "A7 D055 MISSING run_started_at (expected in save_service.gd)\n"
            "A7 D055 PASS - season closure: 3 checks, 0 failed, 1 missing\n"
        )
        verdict, details = classify(output, 0)
        self.assertEqual(verdict, "RED_NOT_IMPLEMENTED")
        self.assertIn("claimed PASS while reporting a missing symbol", details["mismatch"])

    def test_a_claimed_pass_with_a_blocked_line_is_blocked(self) -> None:
        output = (
            "A7 D061 BLOCKED the production overworld did not become ready\n"
            "A7 D061 PASS - trail: 2 checks\n"
        )
        verdict, _details = classify(output, 0)
        self.assertEqual(verdict, "BLOCKED")

    def test_no_verdict_line_is_blocked_with_a_reason(self) -> None:
        verdict, details = classify("Godot Engine v4.7.stable.official\nERROR: Failed to load script\n", 0)
        self.assertEqual(verdict, "BLOCKED")
        self.assertIn("could not load", details["blocked_reason"])

    def test_an_empty_process_is_blocked_and_says_why(self) -> None:
        verdict, details = classify("", 0)
        self.assertEqual(verdict, "BLOCKED")
        self.assertEqual(details["mismatch"], "no verdict line")

    def test_a_timeout_is_blocked_not_failed(self) -> None:
        verdict, details = classify("A7 D059 PASS - hunger: 4 checks\n", -1, timed_out=True)
        self.assertEqual(verdict, "BLOCKED")
        self.assertIn("exceeded 60s", details["blocked_reason"])

    def test_an_honest_red_is_red(self) -> None:
        output = "A7 D057 MISSING quest state (expected in survival_service.gd)\nA7 D057 RED_NOT_IMPLEMENTED - guide chain: 2 checks, 0 failed, 1 missing\n"
        verdict, details = classify(output, 3)
        self.assertEqual(verdict, "RED_NOT_IMPLEMENTED")
        self.assertEqual(details["missing"], ["quest state (expected in survival_service.gd)"])

    def test_a_red_that_exits_zero_is_not_accepted(self) -> None:
        output = "A7 D057 RED_NOT_IMPLEMENTED - guide chain: 1 check, 0 failed, 0 missing\n"
        verdict, details = classify(output, 0)
        self.assertEqual(verdict, "FAIL")
        self.assertIn("claimed RED_NOT_IMPLEMENTED but exited 0", details["mismatch"])

    def test_every_verdict_needs_its_own_exit_code(self) -> None:
        tool = _tool()
        self.assertEqual(tool.EXIT_FOR["PASS"], 0)
        self.assertEqual(tool.EXIT_FOR["FAIL"], 1)
        self.assertEqual(tool.EXIT_FOR["BLOCKED"], 2)
        self.assertEqual(tool.EXIT_FOR["RED_NOT_IMPLEMENTED"], 3)

    def test_the_runner_never_writes_a_result_without_an_engine(self) -> None:
        # `--godot /nonexistent` exits 2 before touching git or the results file.
        import subprocess
        import sys

        proc = subprocess.run(
            [sys.executable, str(TOOL), "--godot", "/nonexistent/godot", "--write"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("nothing was run", proc.stderr)


if __name__ == "__main__":
    unittest.main()
