#!/usr/bin/env python3
"""Validate durable handoff and basic progress integrity (stdlib only)."""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = ROOT / "docs" / "survival"
REQUIRED = [
    ROOT / "AGENTS.md",
    BASE / "START_HERE.md",
    BASE / "STATE.json",
    BASE / "DECISIONS.md",
    BASE / "CONTRACTS.md",
    BASE / "SOURCES.md",
    BASE / "ACCEPTANCE.md",
    BASE / "WORKLOG.md",
    BASE / "CHANGE_PROTOCOL.md",
]
VALID = {"not_started", "in_progress", "blocked", "implemented_unverified", "verified"}
errors = []

for path in REQUIRED:
    if not path.is_file():
        errors.append(f"missing: {path.relative_to(ROOT)}")
        continue
    if path.stat().st_size < 80:
        errors.append(f"unexpectedly short: {path.relative_to(ROOT)}")

state_path = BASE / "STATE.json"
if state_path.is_file():
    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"invalid STATE.json: {exc}")
    else:
        if state.get("schema_version") != 1:
            errors.append("schema_version must be 1")
        if state.get("branch") != "feature/survival-rpg-foundation-20261029":
            errors.append("unexpected owner branch")
        if not re.fullmatch(r"[a-f0-9]{40}", str(state.get("immutable_fork_sha", ""))):
            errors.append("fork SHA must be full 40-hex")
        tasks = state.get("tasks", [])
        ids = [task.get("id") for task in tasks if isinstance(task, dict)]
        if len(ids) != len(set(ids)) or not ids:
            errors.append("tasks must have unique, nonempty identifiers")
        if len(tasks) < 4:
            errors.append("not enough task coverage")
        for task in tasks:
            if task.get("status") not in VALID:
                errors.append(f"invalid task status: {task.get('id')}")
            if task.get("status") == "verified" and not task.get("evidence"):
                errors.append(f"verified task without evidence: {task.get('id')}")
        next_id = state.get("next_action", {}).get("task_id")
        if next_id not in ids:
            errors.append("next_action task_id must match task")
        claims = state.get("code_claims", {})
        for key in ("survival_system_integrated", "freeform_construction_integrated", "gold_core_combat_integrated", "native_playtest_passed", "web_playtest_passed"):
            if not isinstance(claims.get(key), bool):
                errors.append(f"code_claims.{key} must be boolean")
        if "github.com/Khanh-glitch/Soul-of-Hero/issues/" not in state.get("issue", ""):
            errors.append("issue link missing")
        if not (ROOT / "AGENTS.md").read_text(encoding="utf-8").find("docs/survival/STATE.json") >= 0:
            errors.append("AGENTS.md must link state machine")

if errors:
    for error in errors:
        print("FAIL:", error)
    sys.exit(1)
print(f"PASS: handoff files={len(REQUIRED)}; tracked tasks={len(state['tasks'])}; next={next_id}")
