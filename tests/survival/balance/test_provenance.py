"""Provenance tests: the analysis must prove which bytes it read."""
from __future__ import annotations

import unittest

import _support as support

from sohbalance.provenance import (
    load_manifest,
    ref_available,
    verify_owner_pins,
    verify_snapshots,
    verify_upstream,
)


class ProvenanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.snapshots, self.findings = verify_snapshots(support.DATA_DIR)
        self.manifest = load_manifest(support.DATA_DIR)

    def test_manifest_schema_and_size(self) -> None:
        self.assertEqual(self.manifest["schema"], "soh.balance.snapshot_manifest.v1")
        self.assertEqual(len(self.manifest["snapshots"]), 17)

    def test_every_snapshot_hash_matches(self) -> None:
        self.assertEqual([f.as_dict() for f in self.findings], [])
        self.assertEqual(len(self.snapshots), 17)

    def test_every_snapshot_is_readable_json(self) -> None:
        for snapshot in self.snapshots:
            payload = snapshot.load()
            self.assertIsInstance(payload, dict, snapshot.key)

    def test_a3_pins_agree_with_pinned_a1(self) -> None:
        rows, findings = verify_owner_pins(self.snapshots, support.model().adoption)
        self.assertEqual([f.as_dict() for f in findings], [])
        matched = [row for row in rows if row["status"] == "MATCH"]
        # A3 pins seven A1 files; six of them are inside this snapshot set.
        self.assertGreaterEqual(len(matched), 6, rows)

    def test_upstream_check_does_not_claim_a_pass_it_did_not_run(self) -> None:
        report = verify_upstream(self.snapshots)
        for ref in report["refs"]:
            for row in ref["checked"]:
                if not ref["available"]:
                    self.assertEqual(row["status"], "SKIPPED_REF_NOT_FETCHED")
                else:
                    self.assertIn(row["status"], {"MATCH", "DRIFT", "SKIPPED_PATH_ABSENT_AT_COMMIT"})
        self.assertEqual(report["findings"], [])

    def test_ref_availability_helper_is_honest(self) -> None:
        # Either the pinned commit is present locally or the check must say so.
        available = ref_available(support.model().adoption["a1_source"]["commit"])
        self.assertIn(available, (True, False))
        if not available:
            report = verify_upstream(self.snapshots)
            statuses = {row["status"] for ref in report["refs"] for row in ref["checked"]}
            self.assertNotIn("MATCH", statuses)


if __name__ == "__main__":
    unittest.main()
