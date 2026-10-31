#!/usr/bin/env python3
"""CT pilot: fail closed when two purported-current A0 workflows pin different owners.

READ-ONLY static provenance gate; never claims gameplay or CI acceptance.
Usage:
  python3 tools/survival/ct_pin_guard.py \
    --pin a1=FULL_SHA --pin a3=FULL_SHA --pin a6=FULL_SHA --pin a8=FULL_SHA \
    .github/workflows/a0-connected-journey.yml \
    .github/workflows/a0-round12-composition.yml

Frozen workflows must say HISTORICAL in their name and be passed via --historical.
Caller must independently verify actual A0 checkout, composition SHA, and CI.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

OWNERS = ("a1", "a3", "a6", "a8")
PIN_RE = re.compile(r"^\s*(A[1368])_SHA\s*:\s*([0-9a-fA-F]{40})(?:\s*#.*)?\s*$")
ANY_PIN_RE = re.compile(r"^\s*(A[1368])_SHA\s*:")
NAME_RE = re.compile(r"^name:\s*(.*)\s*$", re.IGNORECASE)
HEX40 = re.compile(r"[0-9a-f]{40}\Z")


def read_workflow(path: Path) -> dict:
    """Parse only the four literal owner env declarations; never evaluate YAML/Jinja."""
    found: dict[str, str] = {}
    errors: list[str] = []
    title = ""
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not title:
            name = NAME_RE.match(line)
            if name:
                title = name.group(1).strip(' "\'')
        if not ANY_PIN_RE.match(line):
            continue
        m = PIN_RE.match(line)
        if not m:
            errors.append(f"{path}:{line_number}: invalid or dynamic owner SHA")
            continue
        owner = m.group(1).lower()
        if owner in found:
            errors.append(f"{path}:{line_number}: duplicate {owner} SHA")
        else:
            found[owner] = m.group(2).lower()
    for owner in OWNERS:
        if owner not in found:
            errors.append(f"{path}: missing {owner} SHA")
    return {"path": str(path), "name": title, "pins": found, "errors": errors}


def assess(current: list[dict], historical: list[dict], expected: dict[str, str]) -> dict:
    errors: list[str] = []
    for w in current:
        errors.extend(w["errors"])
        if "historical" in w["name"].lower():
            errors.append(f"{w['path']}: HISTORICAL-labelled workflow submitted as current")
        for owner in OWNERS:
            actual = w["pins"].get(owner)
            if actual and actual != expected[owner]:
                errors.append(
                    f"{w['path']}: STALE_PIN {owner} expected={expected[owner]} actual={actual}"
                )
    for w in historical:
        errors.extend(w["errors"])
        if "historical" not in w["name"].lower():
            errors.append(f"{w['path']}: historical workflow must be labelled HISTORICAL in name")
    if not current:
        errors.append("no CURRENT workflows supplied")
    for owner in OWNERS:
        seen = {w["pins"].get(owner) for w in current}
        if len(seen) > 1:
            errors.append(f"CURRENT_WORKFLOW_SPLIT {owner}: {sorted(str(s) for s in seen)}")
    return {
        "schema": "soh.ct.workflow_pin_guard.v1",
        "verdict": "PASS_STATIC_PIN_ALIGNMENT" if not errors else "FAIL_CLOSED",
        "scope": "SOURCE_WORKFLOW_PINS_ONLY_NOT_PRODUCTION_ACCEPTANCE",
        "expected": expected,
        "current": current,
        "historical": historical,
        "errors": errors,
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("workflows", nargs="*", type=Path, help="workflows claimed CURRENT")
    p.add_argument("--historical", action="append", default=[], type=Path)
    p.add_argument("--pin", action="append", required=True, help="owner=full 40-character SHA")
    p.add_argument("--json-out", type=Path)
    args = p.parse_args()
    expected: dict[str, str] = {}
    for item in args.pin:
        if "=" not in item:
            p.error(f"--pin {item!r} must be owner=sha")
        owner, sha = item.split("=", 1)
        if owner not in OWNERS or not HEX40.fullmatch(sha.lower()) or owner in expected:
            p.error(f"invalid, unknown or duplicate owner pin: {item!r}")
        expected[owner] = sha.lower()
    if set(expected) != set(OWNERS):
        p.error(f"exactly these owners required: {', '.join(OWNERS)}")
    if len(set(args.workflows + args.historical)) != len(args.workflows + args.historical):
        p.error("the same workflow was supplied more than once")
    for path in args.workflows + args.historical:
        if not path.is_file():
            p.error(f"no workflow file {path}")
    result = assess([read_workflow(x) for x in args.workflows],
                    [read_workflow(x) for x in args.historical], expected)
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.json_out:
        args.json_out.write_text(encoded, encoding="utf-8")
    print(encoded, end="")
    return 0 if not result["errors"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
