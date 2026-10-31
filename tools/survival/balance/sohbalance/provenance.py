"""Pinned-snapshot provenance: verify bytes, and detect upstream drift.

The analysis must be reproducible by a reviewer who does not have A1's or A3's
branches checked out. Every upstream file this tool reads is copied verbatim
into data/survival/balance/snapshot/ and pinned by SHA-256 in
data/survival/balance/snapshot_manifest.json.

Two independent checks are supported:

1. ``verify_snapshots``  - local bytes still match the manifest (always runs).
2. ``verify_upstream``   - if the upstream git refs happen to be fetched, the
   blob at that ref still matches the snapshot (best effort, reported as
   SKIPPED when the ref is unavailable rather than silently passing).
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .findings import Finding

REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_DATA_DIR = REPO_ROOT / "data" / "survival" / "balance"


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@dataclass(frozen=True)
class Snapshot:
    key: str
    owner: str
    role: str
    upstream_path: str
    upstream_ref: str
    upstream_commit: str
    sha256: str
    size_bytes: int
    snapshot_path: str

    @property
    def absolute_path(self) -> Path:
        return REPO_ROOT / self.snapshot_path

    def load(self) -> Any:
        return json.loads(self.absolute_path.read_text(encoding="utf-8"))


def load_manifest(data_dir: Path = DEFAULT_DATA_DIR) -> Dict[str, Any]:
    manifest_path = data_dir / "snapshot_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema") != "soh.balance.snapshot_manifest.v1":
        raise ValueError(f"unexpected manifest schema: {manifest.get('schema')}")
    return manifest


def snapshots_from_manifest(manifest: Dict[str, Any]) -> List[Snapshot]:
    return [Snapshot(**entry) for entry in manifest["snapshots"]]


def verify_snapshots(
    data_dir: Path = DEFAULT_DATA_DIR,
) -> Tuple[List[Snapshot], List[Finding]]:
    manifest = load_manifest(data_dir)
    findings: List[Finding] = []
    snapshots: List[Snapshot] = []
    for entry in manifest["snapshots"]:
        snap = Snapshot(**entry)
        path = snap.absolute_path
        if not path.exists():
            findings.append(
                Finding(
                    "SNAPSHOT_MISSING",
                    "BLOCKER",
                    snap.key,
                    f"expected pinned copy at {snap.snapshot_path}",
                    snap.owner,
                )
            )
            continue
        actual = sha256_file(path)
        if actual != snap.sha256:
            findings.append(
                Finding(
                    "SNAPSHOT_HASH_MISMATCH",
                    "BLOCKER",
                    snap.key,
                    f"manifest {snap.sha256[:16]} != file {actual[:16]}",
                    snap.owner,
                )
            )
        snapshots.append(snap)
    return snapshots, findings


def _git(args: List[str]) -> Optional[str]:
    """Run git and return stripped stdout as text (for small metadata lookups)."""
    try:
        completed = subprocess.run(
            ["git", *args],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if completed.returncode != 0:
        return None
    return completed.stdout.strip()


def _git_bytes(args: List[str]) -> Optional[bytes]:
    """Run git and return raw stdout bytes.

    Binary mode matters: ``text=True`` applies universal-newline translation and
    would silently change a file's SHA-256.
    """
    try:
        completed = subprocess.run(
            ["git", *args],
            cwd=REPO_ROOT,
            capture_output=True,
            timeout=60,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if completed.returncode != 0:
        return None
    return completed.stdout


def ref_available(ref: str) -> bool:
    return _git(["rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}"]) is not None


def verify_upstream(
    snapshots: List[Snapshot],
) -> Dict[str, Any]:
    """Best-effort drift check against the upstream refs named in the manifest."""
    per_ref: Dict[str, Dict[str, Any]] = {}
    findings: List[Finding] = []
    for snap in snapshots:
        # The manifest records a git *blob* hash as the upstream identity; the
        # pinned commit is the contract. We check the file content at that commit.
        state = per_ref.setdefault(
            snap.upstream_ref,
            {"ref": snap.upstream_ref, "commit": snap.upstream_commit, "available": False, "checked": []},
        )
        if not state["available"]:
            state["available"] = ref_available(snap.upstream_commit)
        if not state["available"]:
            state["checked"].append({"key": snap.key, "status": "SKIPPED_REF_NOT_FETCHED"})
            continue
        blob = _git_bytes(["cat-file", "-p", f"{snap.upstream_commit}:{snap.upstream_path}"])
        if blob is None:
            state["checked"].append({"key": snap.key, "status": "SKIPPED_PATH_ABSENT_AT_COMMIT"})
            continue
        digest = hashlib.sha256(blob).hexdigest()
        if digest != snap.sha256:
            state["checked"].append(
                {"key": snap.key, "status": "DRIFT", "upstream_sha256": digest}
            )
            findings.append(
                Finding(
                    "UPSTREAM_BLOB_DRIFT",
                    "MAJOR",
                    snap.key,
                    f"upstream {snap.upstream_commit[:10]}:{snap.upstream_path} sha256 {digest[:16]} != pinned {snap.sha256[:16]}",
                    snap.owner,
                )
            )
        else:
            state["checked"].append({"key": snap.key, "status": "MATCH"})
    return {"refs": [per_ref[key] for key in sorted(per_ref)], "findings": findings}


def verify_owner_pins(
    snapshots: List[Snapshot], adoption_contract: Dict[str, Any]
) -> Tuple[List[Dict[str, Any]], List[Finding]]:
    """Compare A3's own pinned A1 hashes against the pinned A1 snapshots.

    A3's adoption contract pins A1 files it consumed. If those pins disagree with
    the snapshot this analysis uses, either A3 is stale or this snapshot is. That
    must be visible, never averaged away.
    """
    by_upstream_path = {snap.upstream_path.rsplit("/", 1)[-1]: snap for snap in snapshots}
    pins = adoption_contract.get("a1_source", {}).get("file_sha256", {})
    rows: List[Dict[str, Any]] = []
    findings: List[Finding] = []
    for filename, pinned in sorted(pins.items()):
        snap = by_upstream_path.get(filename)
        if snap is None:
            rows.append(
                {"file": filename, "status": "NOT_IN_THIS_SNAPSHOT", "pinned_by_a3": pinned}
            )
            continue
        match = pinned == snap.sha256
        rows.append(
            {
                "file": filename,
                "status": "MATCH" if match else "DRIFT",
                "pinned_by_a3": pinned,
                "snapshot_sha256": snap.sha256,
                "snapshot_key": snap.key,
            }
        )
        if not match:
            findings.append(
                Finding(
                    "PIN_DRIFT_VS_ADOPTION_CONTRACT",
                    "MAJOR",
                    snap.key,
                    f"A3 pinned {pinned[:16]} but snapshot is {snap.sha256[:16]}",
                    "A3",
                )
            )
    return rows, findings
