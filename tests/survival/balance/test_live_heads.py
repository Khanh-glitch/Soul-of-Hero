"""The pinned snapshot is not the owners' live branches, and this says by how much.

The gate reads sha256-pinned copies of other agents' files. That makes the audit
reproducible, but it also makes it easy to read a composition capture from one
morning as "the current branch". `live_heads.v1.json` measures the distance, and
these tests keep the measurement honest: a DIVERGED verdict must be reflected in
the artifact, a stale file must name its path, and no row may claim a live head it
did not resolve.

The live refs are fetched in the A7 checkout and are absent in a shallow CI clone,
so the recomputation check skips rather than inventing a result.
"""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

import _support as support

LIVE = support.RESULTS_DIR / "live_heads.v1.json"
TOOL = support.REPO_ROOT / "tools" / "survival" / "balance" / "refresh_live_heads.py"


def _load_tool():
    spec = importlib.util.spec_from_file_location("refresh_live_heads", TOOL)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class LiveHeadTests(unittest.TestCase):
    def setUp(self) -> None:
        self.payload = json.loads(LIVE.read_text(encoding="utf-8"))

    def test_the_artifact_measures_every_captured_file(self) -> None:
        manifest = json.loads(
            (support.REPO_ROOT / "data" / "survival" / "balance" / "snapshot" / "product_manifest.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(self.payload["schema"], "soh.balance.live_heads.v1")
        self.assertEqual(len(self.payload["files"]), len(manifest["files"]))
        self.assertEqual(len(self.payload["owners"]), 5)
        for row in self.payload["files"]:
            self.assertIn(row["state"], ("SAME", "CHANGED", "MISSING_AT_LIVE_HEAD"))
            if row["state"] == "SAME":
                self.assertEqual(row["pinned_sha256"], row["live_sha256"])
            elif row["state"] == "CHANGED":
                self.assertNotEqual(row["pinned_sha256"], row["live_sha256"])
            else:
                self.assertIsNone(row["live_sha256"])

    def test_a_diverged_pin_cannot_be_reported_as_current(self) -> None:
        owners = {owner["owner"]: owner for owner in self.payload["owners"]}
        diverged = [name for name, owner in owners.items() if owner["history"] == "DIVERGED"]
        stale = [
            name
            for name, owner in owners.items()
            if owner["file_counts"]["CHANGED"] + owner["file_counts"]["MISSING_AT_LIVE_HEAD"] > 0
        ]
        if diverged:
            self.assertEqual(self.payload["verdict"], "PIN_BRANCH_DIVERGED")
            self.assertTrue(stale, "a diverged pin with identical bytes everywhere is not what was measured")
        elif stale:
            self.assertEqual(self.payload["verdict"], "PIN_STALE")
        else:
            self.assertEqual(self.payload["verdict"], "PIN_CURRENT")

    def test_every_owner_records_both_heads(self) -> None:
        for owner in self.payload["owners"]:
            with self.subTest(owner=owner["owner"]):
                self.assertEqual(len(owner["pinned_head"]), 40)
                self.assertEqual(len(owner["live_head"]), 40)
                self.assertIn(owner["history"], ("SAME_COMMIT", "PINNED_IS_ANCESTOR", "DIVERGED"))

    def test_the_counts_agree_with_the_rows(self) -> None:
        for state, count in self.payload["counts"].items():
            self.assertEqual(count, sum(1 for row in self.payload["files"] if row["state"] == state))

    def test_the_measurement_recomputes_when_the_live_refs_are_present(self) -> None:
        tool = _load_tool()
        manifest = json.loads(
            (support.REPO_ROOT / "data" / "survival" / "balance" / "snapshot" / "product_manifest.json").read_text(
                encoding="utf-8"
            )
        )
        for ref in ("refs/a0", "refs/a1", "refs/a3", "refs/a6", "refs/a8"):
            if tool.git("rev-parse", ref).returncode != 0:
                self.skipTest("live owner refs are not fetched in this checkout")
        fresh = tool.compare(manifest, {"a0": "refs/a0", "a1": "refs/a1", "a3": "refs/a3", "a6": "refs/a6", "a8": "refs/a8"})
        self.assertEqual(fresh["verdict"], self.payload["verdict"])
        self.assertEqual(fresh["counts"], self.payload["counts"])


if __name__ == "__main__":
    unittest.main()
