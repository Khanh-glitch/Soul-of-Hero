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

SCHEMA = "soh.balance.ci_evidence.v2"

VERIFIED = "VERIFIED"
FAILED = "FAILED"
QUEUED = "QUEUED"
NOT_TESTED = "NOT_TESTED"
STALE_HEAD = "STALE_HEAD"

# Evidence ids the gate asks for, with the assertion phrase that must appear.
REQUIRED: Dict[str, Dict[str, str]] = {
    "a0_normal_entry_home": {
        "workflow": "a0-normal-entry-home-restart.yml",
        "step": "New profile through actual menus and full home journey",
        "phrase": "NORMAL ENTRY HOME RESTART PASSED",
        "proves": "a normal menu route reaches the overworld in native Godot",
    },
    "a0_second_process_restart": {
        "workflow": "a0-normal-entry-home-restart.yml",
        "step": "Independent new Godot process and actual save recovery",
        "phrase": "ENTRY_HOME_SECOND_PROCESS",
        "proves": (
            "an independent second Godot process restores the same save with no duplicates; the step itself "
            "must pass, because a WORKFLOW-level success says nothing about which process printed what"
        ),
    },
    "a0_waystation_player_input": {
        "workflow": "a0-waystation-input-restart.yml",
        "step": "Real Hero input, canonical receipt, and separate process replay",
        "phrase": "A0 WAYSTATION INPUT RESTART PASSED",
        "proves": "real Hero input in the connector earns an A3-authorized receipt which survives a second process",
    },
    "a0_replay_negative": {
        "workflow": "a0-waystation-input-restart.yml",
        "step": "Real Hero input, canonical receipt, and separate process replay",
        "phrase": "independent-process cache replay during cooldown grants nothing",
        "proves": "replaying the same event after a second process existed grants nothing",
    },
    "a3_authority_fixture": {
        "workflow": "a0-waystation-input-restart.yml",
        "step": "A3 V3 authority and anti-replay fixture on real SaveService",
        "phrase": "A0 WAYSTATION AUTHORITY PASSED",
        "proves": (
            "the V3 economy plausibly commits and refuses replays against the real SaveService. It is a "
            "FIXTURE: it funds its own inventory and advances its own clock, so it can never exceed S2"
        ),
    },
    "a0_save_precision": {
        "workflow": "a0-save-precision.yml",
        "step": "Pre- and post-rename faults and independent process",
        "phrase": "A0 SAVE PRECISION PASSED",
        "proves": (
            "the authoritative writer guarantees a float-exact round trip on the pinned sha, including a "
            "pre/post-rename fault and an independent process. The workflow only triggers on the owner's "
            "branch, so a green run has to be cited from it explicitly"
        ),
    },
    "a8_native_poi_contract": {
        "workflow": "a8-world-content-native.yml",
        "step": "Run native physics, intent and persistence contracts",
        "phrase": "PASS",
        "proves": "the native POI scene loads and its intent contract runs",
    },
    "a0_runtime_validation": {
        "workflow": "survival-runtime-validation.yml",
        "phrase": "PASS",
        "proves": "the survival runtime scripts parse and run headless",
    },
}

# S4 is a conjunction, never a single green tick. Each clause names the evidence it
# needs, so "the workflow passed" can never stand in for "a second process restored
# the save and a replay was refused on the same commit".
S4_CLAUSES: Dict[str, Dict[str, object]] = {
    "C1_exact_source_identity": {
        "evidence": [],
        "proves": "every run cited below executed on the pinned head sha, not on an ancestor",
    },
    "C2_normal_entry": {
        "evidence": ["a0_normal_entry_home"],
        "proves": "a normal player-facing route reaches the world",
    },
    "C3_independent_process": {
        "evidence": ["a0_second_process_restart"],
        "proves": "a separate Godot process restored the durable state",
    },
    "C4_authorised_commit": {
        "evidence": ["a0_waystation_player_input"],
        "proves": "real input produced one A3-authorized receipt",
    },
    "C5_negative_replay": {
        "evidence": ["a0_replay_negative"],
        "proves": "repeating the event granted nothing",
    },
}

# Things S4 still does not licence. S5 needs a human and the product gate.
S5_REQUIRES = (
    "a rendered frame set inspected by a human at native resolution",
    "the canonical avatar identity visible on screen (D051: 555940 male, 419402 female)",
    "one useful outcome consumed by a sink a player would recognise",
    "an ordinary player, not injected UI input",
)


def default_path() -> Path:
    return Path(__file__).resolve().parents[4] / "data/survival/balance/evidence/ci_runs.v1.json"


def load(path: Optional[Path] = None) -> Dict[str, object]:
    target = path or default_path()
    if not target.exists():
        return {"schema": SCHEMA, "runs": [], "note": "no evidence file recorded"}
    return json.loads(target.read_text(encoding="utf-8"))


def steps_of(record: Dict[str, object]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for job in record.get("jobs", []) or []:
        for step in job.get("steps", []) or []:
            out[str(step.get("name"))] = str(step.get("conclusion"))
    return out


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
        required_step = spec.get("step", "")
        step_state = steps_of(record).get(required_step, "NOT_RECORDED") if required_step else "NOT_APPLICABLE"
        failed = list(record.get("failed_checks") or [])
        # The step that would prove the claim has to exist and pass. A workflow that
        # exits 0 while skipping, failing or not recording that step is not evidence.
        step_ok = step_state in ("success", "NOT_APPLICABLE")
        if status == "completed" and conclusion == "success" and phrase_found and step_ok and not failed:
            return {
                **best,
                "state": VERIFIED,
                "run_id": record.get("run_id"),
                "head_sha": record_head,
                "phrase_found": True,
                "step_state": step_state,
                "failed_checks": failed,
            }
        if status == "completed" and step_state == "NOT_RECORDED" and not failed:
            if best["state"] != FAILED:
                best.update(
                    {
                        "state": NOT_TESTED,
                        "run_id": record.get("run_id"),
                        "head_sha": record_head,
                        "phrase_found": phrase_found,
                        "step_state": step_state,
                        "note": f"the step that would prove this was not captured: {required_step!r}",
                    }
                )
            continue
        if status == "completed" and (conclusion not in ("success", "") or not step_ok or failed):
            best.update(
                {
                    "state": FAILED,
                    "run_id": record.get("run_id"),
                    "head_sha": record_head,
                    "phrase_found": phrase_found,
                    "step_state": step_state,
                    "failed_checks": failed,
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


FAMILY_FOR = {
    "a0_normal_entry_home": "a0",
    "a0_second_process_restart": "a0",
    "a0_waystation_player_input": "a0",
    "a0_replay_negative": "a0",
    "a3_authority_fixture": "a0",
    "a0_save_precision": "a0",
    "a8_native_poi_contract": "a8",
    "a0_runtime_validation": "a0",
}


def states_for(evidence: Dict[str, object], heads: Dict[str, str]) -> Dict[str, Dict[str, object]]:
    """Resolve every required assertion; ``heads`` maps workflow family -> head sha."""
    return {
        evidence_id: state(evidence, evidence_id, heads.get(FAMILY_FOR[evidence_id], ""))
        for evidence_id in REQUIRED
    }


def s4_clauses(states: Dict[str, Dict[str, object]], heads: Dict[str, str]) -> Dict[str, object]:
    """The conjunction S4 needs. Returns each clause with its own verdict."""
    clauses: Dict[str, object] = {}
    for name, spec in S4_CLAUSES.items():
        ids = list(spec["evidence"])  # type: ignore[arg-type]
        rows = [states[evidence_id] for evidence_id in ids]
        if name == "C1_exact_source_identity":
            # Every cited run must carry the pinned sha. A stale-head green run is
            # not evidence, and this clause makes that explicit rather than implied.
            fresh = [
                (row.get("run_id"), row.get("head_sha"))
                for row in states.values()
                if row.get("state") == VERIFIED
            ]
            ok = bool(fresh) and all(
                str(sha) in (heads.get("a0"), heads.get("a8")) for _, sha in fresh
            )
            clauses[name] = {
                "state": "HOLDS" if ok else "NOT_HOLDS",
                "proves": spec["proves"],
                "verified_runs": fresh,
                "pinned": {"a0": heads.get("a0"), "a8": heads.get("a8")},
            }
            continue
        ok = bool(rows) and all(row.get("state") == VERIFIED for row in rows)
        clauses[name] = {
            "state": "HOLDS" if ok else "NOT_HOLDS",
            "proves": spec["proves"],
            "evidence": [{"evidence_id": row.get("evidence_id"), "state": row.get("state")} for row in rows],
        }
    holds = all(clause["state"] == "HOLDS" for clause in clauses.values())  # type: ignore[index]
    return {
        "clauses": clauses,
        "s4_granted": holds,
        "s5_granted": False,
        "s5_requires": list(S5_REQUIRES),
        "rule": (
            "S4 is a conjunction of five clauses. A green workflow, a passing step, a fixture, an injected "
            "marker or a same-process reload is never sufficient on its own."
        ),
    }


def outcome_ledger(evidence: Dict[str, object]) -> List[Dict[str, object]]:
    """Every completed run, with the labels its own CI printed as failures."""
    rows: List[Dict[str, object]] = []
    for record in evidence.get("runs", []) or []:
        if str(record.get("status")) != "completed":
            continue
        rows.append(
            {
                "run_id": record.get("run_id"),
                "workflow": record.get("workflow"),
                "head_sha": record.get("head_sha"),
                "conclusion": record.get("conclusion") or "",
                "failed_checks": list(record.get("failed_checks") or []),
                "failed_steps": [
                    step.get("name")
                    for job in record.get("jobs", []) or []
                    for step in job.get("steps", []) or []
                    if step.get("conclusion") == "failure"
                ],
            }
        )
    return sorted(rows, key=lambda row: (str(row["workflow"]), int(row["run_id"])))
