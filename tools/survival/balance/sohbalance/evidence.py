"""Native evidence: the only thing that may lift a link above S3.

A7 does not run Godot, so it cannot manufacture native proof. What it can do is
record, from GitHub, exactly which owner workflow ran on exactly which commit and
what the engine actually printed. This module reads that recording.

Rules that keep the file honest:

* a record only counts for the commit it ran on (`head_sha` must equal the pinned
  head); a green run on an older commit is `STALE_HEAD`, not evidence;
* `queued`/`in_progress` is `QUEUED`, never "probably fine";
* `conclusion != success` is `FAILED` and blocks;
* a required log phrase must be present in the captured log, so a workflow that
  merely exits 0 without running the assertion does not count.

The recorder (`tools/survival/balance/record_ci_evidence.py`) writes the file. The
gate only reads it, which keeps artifacts deterministic.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

SCHEMA = "soh.balance.ci_evidence.v1"

VERIFIED = "VERIFIED"
FAILED = "FAILED"
QUEUED = "QUEUED"
NOT_TESTED = "NOT_TESTED"
STALE_HEAD = "STALE_HEAD"

# Evidence ids the gate asks for, with the assertion phrase that must appear.
REQUIRED: Dict[str, Dict[str, str]] = {
    "a0_normal_entry_home": {
        "workflow": "a0-normal-entry-home-restart.yml",
        "phrase": "NORMAL ENTRY HOME RESTART PASSED",
        "proves": "a normal menu route reaches the overworld in native Godot",
    },
    "a0_two_process_reload": {
        "workflow": "a0-normal-entry-home-restart.yml",
        "phrase": "NORMAL ENTRY HOME RESTART PASSED",
        "job": "native-entry-restart",
        "proves": "an independent second Godot process restores the same save with no duplicates",
    },
    "a8_native_poi_contract": {
        "workflow": "a8-world-content-native.yml",
        "phrase": "PASS",
        "proves": "the native POI scene loads and its intent contract runs",
    },
    "a0_runtime_validation": {
        "workflow": "survival-runtime-validation.yml",
        "phrase": "PASS",
        "proves": "the survival runtime scripts parse and run headless",
    },
}


def default_path() -> Path:
    return Path(__file__).resolve().parents[4] / "data/survival/balance/evidence/ci_runs.v1.json"


def load(path: Optional[Path] = None) -> Dict[str, object]:
    target = path or default_path()
    if not target.exists():
        return {"schema": SCHEMA, "runs": [], "note": "no evidence file recorded"}
    return json.loads(target.read_text(encoding="utf-8"))


def _matches(record: Dict[str, object], spec: Dict[str, str]) -> bool:
    if str(record.get("workflow")) != spec["workflow"]:
        return False
    job = spec.get("job")
    if job and not any(str(entry.get("name")) == job for entry in record.get("jobs", []) or []):
        return False
    return True


def state(evidence: Dict[str, object], evidence_id: str, head_sha: str) -> Dict[str, object]:
    """Resolve one required native assertion against the recorded runs."""
    spec = REQUIRED.get(evidence_id)
    if spec is None:
        raise KeyError(evidence_id)
    best: Dict[str, object] = {
        "evidence_id": evidence_id,
        "state": NOT_TESTED,
        "run_id": None,
        "head_sha": None,
        "phrase_found": False,
        "other_commit_runs": [],
        "proves": spec["proves"],
    }
    for record in evidence.get("runs", []) or []:
        if not _matches(record, spec):
            continue
        record_head = str(record.get("head_sha") or "")
        if record_head != head_sha:
            # A run on another commit says nothing about this one. Record it, so a
            # reader sees the queued/green run id without being able to spend it.
            best["other_commit_runs"].append(  # type: ignore[union-attr]
                {
                    "run_id": record.get("run_id"),
                    "head_sha": record_head,
                    "status": record.get("status"),
                    "conclusion": record.get("conclusion") or "",
                }
            )
            if best["state"] == NOT_TESTED:
                best["state"] = STALE_HEAD
            continue
        status = str(record.get("status") or "")
        conclusion = str(record.get("conclusion") or "")
        phrases: List[str] = list(record.get("log_phrases") or [])
        phrase_found = any(spec["phrase"] in phrase for phrase in phrases)
        if status == "completed" and conclusion == "success" and phrase_found:
            return {
                **best,
                "state": VERIFIED,
                "run_id": record.get("run_id"),
                "head_sha": record_head,
                "phrase_found": True,
            }
        if status == "completed" and conclusion not in ("success", ""):
            best.update(
                {
                    "state": FAILED,
                    "run_id": record.get("run_id"),
                    "head_sha": record_head,
                    "phrase_found": phrase_found,
                }
            )
        elif status in ("queued", "in_progress", "requested", "waiting", "pending"):
            if best["state"] != FAILED:
                best.update(
                    {
                        "state": QUEUED,
                        "run_id": record.get("run_id"),
                        "head_sha": record_head,
                        "phrase_found": phrase_found,
                    }
                )
        elif status == "completed" and conclusion == "success" and not phrase_found:
            best.update(
                {
                    "state": NOT_TESTED,
                    "run_id": record.get("run_id"),
                    "head_sha": record_head,
                    "phrase_found": False,
                    "note": "workflow succeeded but the required assertion phrase was not captured",
                }
            )
    return best


def states_for(evidence: Dict[str, object], heads: Dict[str, str]) -> Dict[str, Dict[str, object]]:
    """Resolve every required assertion; ``heads`` maps workflow family -> head sha."""
    family_for = {
        "a0_normal_entry_home": "a0",
        "a0_two_process_reload": "a0",
        "a8_native_poi_contract": "a8",
        "a0_runtime_validation": "a0",
    }
    return {
        evidence_id: state(evidence, evidence_id, heads.get(family_for[evidence_id], ""))
        for evidence_id in REQUIRED
    }
