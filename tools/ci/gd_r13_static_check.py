#!/usr/bin/env python3
"""Fail-closed static gate for the R13 A3 GDScript files.

The audited CI run 41228370691 failed with nine Godot 4.7 warnings-as-errors in
`tests/survival/a3_value_economy_test.gd` (``:=`` inferring ``Variant``), and
Process 2 never ran because a shell variable leaked between workflow steps.

This checker does not replace the engine. It removes the *specific* class of
defect that repeatedly reached CI, before the engine is started:

  1. ``var x := <Variant-returning expression>`` in the R13 files,
  2. GDScript-3 leftovers (``Int``/``Float``/``bool(`` misuse, ``//``, ``--``),
  3. an R13 file that owns a second queue/clock/knowledge store again
     (``a3_station_jobs``, ``set_time_source``, ``a3_learned_recipes``),
  4. a workflow whose second two-process step depends on a shell variable
     created in the first step.

Exit code 0 = clean. Any finding is printed as ``::error::`` so it survives in
the GitHub annotation surface even when the raw log is unavailable.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

R13_FILES = [
    "game/survival/economy/a3_economy_service.gd",
    "tests/survival/a3_value_economy_test.gd",
]

# Expressions whose static type is Variant, so `:=` on them is an
# INFERRED_DECLARATION warning that Godot 4.7 promotes to an error.
VARIANT_CALL = re.compile(
    r"^(?:[A-Za-z_][\w\.\[\]\(\)\"]*\.)?(call|get|duplicate|front|back|pop_front|pop_back)\("
)
VARIANT_INDEX = re.compile(r"^[A-Za-z_][\w\.]*\s*\[")
VARIANT_JSON = re.compile(r"^JSON\.(parse_string|parse)\(")

# A typed constructor on the right-hand side pins the type, so `:=` is safe.
SAFE_PREFIXES = (
    "String(", "str(", "int(", "float(", "bool(", "not ", "mini(", "maxi(",
    "min(", "max(", "abs(", "round(", "floor(", "ceil(", "clampi(", "wrapi(",
    "Vector2", "NodePath(", "StringName(", "nameof(", "func(", "Array(",
    "Dictionary(", "Callable(", "PackedStringArray(", "range(", "len(",
    "is_instance_valid(", "is_equal_approx(", "sign(", "pow(",
)

FORBIDDEN_AUTHORITY = [
    (re.compile(r"\ba3_station_jobs\b"), "second A3 station queue (canonical EconomyService owns the queue)"),
    (re.compile(r"\bset_time_source\b"), "caller-supplied A3 clock (A0 active-tick receipt is the only clock)"),
    (re.compile(r"\ba3_learned_recipes\b"), "second learned-recipe store (survival.knowledge.recipes is canonical)"),
    (re.compile(r"\ba3_job_counter\b"), "second job counter (canonical state.counter is canonical)"),
    (re.compile(r'\bowner_domain\b'), "owner-string source authentication"),
]

GDSCRIPT3 = [
    (re.compile(r"\bvar\s+\w+\s*:?=\s*Int\("), "GDScript 3 `Int(` constructor"),
    (re.compile(r"\bQueue\b(?!\.)"), "GDScript 3 `Queue` type"),
    (re.compile(r"(?<![/*])//(?![/*])"), "GDScript 3 floor division `//`"),
]


def strip_line(line: str) -> str:
    """Remove a trailing comment while respecting simple string literals."""
    out = []
    quote = None
    escaped = False
    for ch in line:
        if escaped:
            out.append(ch)
            escaped = False
            continue
        if ch == "\\":
            out.append(ch)
            escaped = True
            continue
        if quote:
            out.append(ch)
            if ch == quote:
                quote = None
            continue
        if ch in "\"'":
            quote = ch
            out.append(ch)
            continue
        if ch == "#":
            break
        out.append(ch)
    return "".join(out)


def code_only(line: str) -> str:
    """Drop string literal contents so `res://` is not read as floor division."""
    out = []
    quote = None
    escaped = False
    for ch in line:
        if escaped:
            escaped = False
            out.append(" ")
            continue
        if ch == "\\":
            escaped = True
            continue
        if quote:
            if ch == quote:
                quote = None
            out.append(" ")
            continue
        if ch in "\"'":
            quote = ch
            out.append(" ")
            continue
        out.append(ch)
    return "".join(out)


def declared_type(rhs: str) -> bool:
    return rhs.lstrip().startswith(SAFE_PREFIXES)


def check_file(path: Path, findings: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    # The service must not own a second authority. The test file legitimately
    # names the ghost keys to assert their ABSENCE, so only a re-introduced
    # clock API is banned there.
    authority_patterns = FORBIDDEN_AUTHORITY if path.name == "a3_economy_service.gd" else [
        (re.compile(r"\bfunc\s+set_time_source\b"), "re-introduced caller-supplied A3 clock"),
    ]
    for number, raw in enumerate(text.splitlines(), start=1):
        line = strip_line(raw)
        if not line.strip():
            continue
        if ":=" in line:
            rhs = line.split(":=", 1)[1]
            if not declared_type(rhs):
                for pattern, label in (
                    (VARIANT_CALL, "`:=` infers Variant from a .call()/.get()/.duplicate() result"),
                    (VARIANT_INDEX, "`:=` infers Variant from a dictionary/index read"),
                    (VARIANT_JSON, "`:=` infers Variant from JSON parsing"),
                ):
                    if pattern.search(rhs.strip()):
                        findings.append(f"{path}:{number}: {label}: {raw.strip()}")
        for pattern, label in authority_patterns:
            if pattern.search(line):
                findings.append(f"{path}:{number}: {label}: {raw.strip()}")
        # Authority bans apply to code, but the test file legitimately asserts
        # that these names are ABSENT. Skip assertion strings there.
        for pattern, label in GDSCRIPT3:
            if pattern.search(code_only(line)) and not line.strip().startswith("#"):
                findings.append(f"{path}:{number}: {label}: {raw.strip()}")


def r13_job_slice(text: str) -> str:
    """Return only the r13-value-economy job block.

    The V5-V7 adapter steps legitimately use rc1/rc2 inside a *single* step;
    only the R13 job must keep every process in its own step.
    """
    lines = text.splitlines()
    start = None
    for index, line in enumerate(lines):
        if re.match(r"^  r13-value-economy:\s*$", line):
            start = index
            break
    if start is None:
        return ""
    end = len(lines)
    for index in range(start + 1, len(lines)):
        if re.match(r"^  [A-Za-z0-9_-]+:\s*$", lines[index]):
            end = index
            break
    return "\n".join(lines[start:end])


FUNC_START = re.compile(r"^(?:static\s+)?func\s+(\w+)")
VAR_DECL = re.compile(r"^\s*var\s+(\w+)\s*[:=]")


def check_duplicate_vars(path: Path, findings: list[str]) -> None:
    """Godot 4.7 rejects a second `var` of the same name in a nested block.

    Observed in run 41230670691 follow-up: `There is already a variable named
    "core" declared in this scope.` For-loop bindings are naturally reusable, so
    only `var` declarations are compared.
    """
    current = ""
    seen: dict[str, int] = {}
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        match = FUNC_START.match(raw)
        if match:
            current = match.group(1)
            seen = {}
            continue
        decl = VAR_DECL.match(raw)
        if decl and current:
            name = decl.group(1)
            if name in seen:
                findings.append(
                    f"{path}:{number}: duplicate `var {name}` in {current}() "
                    f"(first declared line {seen[name]}); Godot 4.7 rejects nested re-declaration"
                )
            else:
                seen[name] = number


def check_workflow(path: Path, findings: list[str]) -> None:
    """Two-process steps must not share shell state."""
    text = path.read_text(encoding="utf-8")
    work = re.sub(r"#[^\n]*", "", r13_job_slice(text))
    if not work:
        findings.append(f"{path}: r13-value-economy job missing")
        return
    shared = re.findall(r"\$\{?rc[0-9]\}?", work)
    if shared:
        findings.append(
            f"{path}: cross-step shell variable(s) {sorted(set(shared))} - "
            "GitHub Actions steps do not share shell state; gate each process in its own step"
        )
    if "verify_r13_receipts.py" not in work:
        findings.append(f"{path}: missing machine-readable two-process receipt verification step")
    if "gd_r13_static_check.py" not in work:
        findings.append(f"{path}: missing static hazard gate step")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="repository root")
    parser.add_argument("--workflow", default=".github/workflows/survival-a3-economy.yml")
    args = parser.parse_args()
    root = Path(args.root)
    findings: list[str] = []
    for relative in R13_FILES:
        path = root / relative
        if not path.exists():
            findings.append(f"{path}: missing required R13 file")
            continue
        check_file(path, findings)
        check_duplicate_vars(path, findings)
    workflow = root / args.workflow
    if workflow.exists():
        check_workflow(workflow, findings)
    if findings:
        for finding in findings:
            print(f"::error::R13 static gate: {finding}")
        print(f"R13 STATIC GATE FAILED - {len(findings)} finding(s)")
        return 1
    print(f"R13 STATIC GATE PASSED - {len(R13_FILES)} file(s), 1 workflow checked")
    return 0


if __name__ == "__main__":
    sys.exit(main())
