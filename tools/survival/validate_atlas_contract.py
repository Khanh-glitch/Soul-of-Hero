#!/usr/bin/env python3
"""Verify immutable user research source and full named-coverage of the SOH atlas.

This is a *documentation/source-integrity* check; it never claims Godot gameplay passes.
"""
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "docs" / "survival"
SOURCE = BASE / "source_archive" / "Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md"
TRACE = BASE / "SOURCE_COVERAGE_TRACE.json"
EXPECTED_SHA256 = "b958de0fc413cc200b35b0938760228c2ebd3a8ef4aa2f52c1051c52cca59157"
EXPECTED_COUNTS = {"SUBSYSTEM": 44, "POI": 21, "DEPENDENCY": 31, "JOURNEY": 12}
errors = []

if not SOURCE.exists() or not TRACE.exists():
    errors.append("missing user-source or indexed trace")
else:
    raw = SOURCE.read_bytes()
    actual = hashlib.sha256(raw).hexdigest()
    if actual != EXPECTED_SHA256:
        errors.append(f"original research text was altered: {actual}")
    source = raw.decode("utf-8")
    lines = source.splitlines()
    trace = json.loads(TRACE.read_text(encoding="utf-8"))
    if trace.get("source_hash_sha256") != EXPECTED_SHA256:
        errors.append("coverage trace has wrong source SHA")
    entries = trace.get("mechanism_entries", [])
    ids = [r.get("id") for r in entries]
    if len(ids) != len(set(ids)):
        errors.append("duplicate atlas IDs")
    counts = {key: sum(r.get("type") == key for r in entries) for key in EXPECTED_COUNTS}
    if counts != EXPECTED_COUNTS:
        errors.append(f"unexpected trace coverage: {counts}")
    for r in entries:
        anchor = r.get("source", {})
        start = anchor.get("start_line", 0)
        if not isinstance(start, int) or start < 1 or start > len(lines):
            errors.append(f"invalid source anchor for {r.get('id')}")
        elif not lines[start - 1].startswith("### "):
            errors.append(f"source anchor is not heading: {r.get('id')}")
        if not str(r.get("owner", "")).startswith("A"):
            errors.append(f"unassigned agent: {r.get('id')}")
        if not r.get("disposition"):
            errors.append(f"missing gate decision: {r.get('id')}")
        if r.get("implementation") not in ("NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED_UNVERIFIED", "VERIFIED", "NOT_APPLICABLE", "FAILED"):
            errors.append(f"illegal runtime truth status: {r.get('id')}")
        if r.get("implementation") == "VERIFIED" and not r.get("implementation_evidence"):
            errors.append(f"claimed verified without runtime proof: {r.get('id')}")
    queries = trace.get("unknown_original_facts", [])
    if len(queries) != 40 or len({x.get("id") for x in queries}) != 40:
        errors.append("the 40 original-game uncertainties are incomplete")
    sources = trace.get("historical_sources", [])
    if len(sources) != 28 or len({x.get("id") for x in sources}) != 28:
        errors.append("not all 28 research references retained")
    for n in range(2, 46):
        if f"SYS-{n:02d}" not in ids:
            errors.append(f"missing SYS-{n:02d}")
    for typ, maximum in (("POI", 21), ("DEP", 31), ("JOURNEY", 12)):
        for n in range(1, maximum + 1):
            if f"{typ}-{n:02d}" not in ids:
                errors.append(f"missing {typ}-{n:02d}")
    # Coverage is intentionally comprehensive, but historical facts require version tags.
    if re.search(r"(?i)all original recipes exactly \d+", SOURCE.read_text(encoding="utf-8")):
        errors.append("unverified universal recipe count inserted into immutable source")
    required = (
        "SYSTEM_FUSION_BLUEPRINT.md",
        "ATLAS_RECONCILIATION_AND_DECISIONS.md",
        "MULTI_AGENT_EXECUTION.md",
        "ECONOMY_AND_14DAY_REPLAY_BALANCE.md",
    )
    for name in required:
        if not (BASE / name).exists():
            errors.append(f"missing system companion: {name}")
if errors:
    for msg in errors:
        print("FAIL:", msg)
    raise SystemExit(1)
print(
    f"PASS: source SHA256 {EXPECTED_SHA256}; 44 subsystems, "
    "21 POIs, 31 dependencies, 12 journeys, 40 uncertainties, "
    "28 sources; all 108 entries assigned owner/gate."
)
