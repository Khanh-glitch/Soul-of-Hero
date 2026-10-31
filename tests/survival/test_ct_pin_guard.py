"""Negative-oracle controls for the CT static pin-guard pilot."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from importlib.util import module_from_spec, spec_from_file_location

SCRIPT = Path(__file__).resolve().parents[2] / "tools" / "survival" / "ct_pin_guard.py"
spec = spec_from_file_location("ct_pin_guard", SCRIPT)
module = module_from_spec(spec)
spec.loader.exec_module(module)

PINS = {"a1": "a" * 40, "a3": "b" * 40, "a6": "c" * 40, "a8": "d" * 40}


def content(name="Current", pins=PINS):
    rows = [f"name: {name}", "env:"]
    rows += [f"  {o.upper()}_SHA: {sha}" for o, sha in pins.items()]
    return "\n".join(rows) + "\n"


class PinGuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def wf(self, name, text):
        path = self.root / name
        path.write_text(text)
        return module.read_workflow(path)

    def test_two_current_workflows_on_exact_matrix_pass(self):
        ws = [self.wf("a.yml", content()), self.wf("b.yml", content())]
        self.assertEqual(module.assess(ws, [], PINS)["verdict"], "PASS_STATIC_PIN_ALIGNMENT")

    def test_one_stale_owner_fails_even_when_workflows_agree(self):
        old = dict(PINS, a1="e" * 40)
        ws = [self.wf("a.yml", content(pins=old)), self.wf("b.yml", content(pins=old))]
        self.assertTrue(any("STALE_PIN" in x for x in module.assess(ws, [], PINS)["errors"]))

    def test_workflows_split_fails(self):
        old = dict(PINS, a6="f" * 40)
        ws = [self.wf("a.yml", content()), self.wf("b.yml", content(pins=old))]
        errors = module.assess(ws, [], PINS)["errors"]
        self.assertTrue(any("CURRENT_WORKFLOW_SPLIT a6" in x for x in errors))

    def test_missing_and_dynamic_owner_fails(self):
        for name, text in [("missing.yml", content(pins={k: v for k, v in PINS.items() if k != "a8"})),
                           ("dynamic.yml", content().replace("d" * 40, "DYNAMIC_SHA_REFERENCE"))]:
            w = self.wf(name, text)
            self.assertEqual(module.assess([w], [], PINS)["verdict"], "FAIL_CLOSED")

    def test_duplicate_declared_owner_fails(self):
        w = self.wf("duplicate.yml", content() + f"  A1_SHA: {'a' * 40}\n")
        self.assertTrue(any("duplicate" in e for e in module.assess([w], [], PINS)["errors"]))

    def test_historical_label_required_but_not_matched_to_current_matrix(self):
        old = dict(PINS, a1="e" * 40)
        good = self.wf("current.yml", content())
        historical = self.wf("old.yml", content("HISTORICAL - frozen reproduction", old))
        self.assertEqual(module.assess([good], [historical], PINS)["verdict"], "PASS_STATIC_PIN_ALIGNMENT")
        mislabeled = self.wf("bad.yml", content("Round12 older snapshot", old))
        self.assertEqual(module.assess([good], [mislabeled], PINS)["verdict"], "FAIL_CLOSED")

    def test_no_current_rejected(self):
        self.assertEqual(module.assess([], [], PINS)["verdict"], "FAIL_CLOSED")


if __name__ == "__main__":
    unittest.main()
