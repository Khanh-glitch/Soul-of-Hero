#!/usr/bin/env python3
"""Find GDScript local `var` declarations the engine will reject.

GDScript locals live in the *block* they are declared in, not the function. Two
consequences, and the difference between them has cost this project several CI runs:

* Two declarations of the same name in the same block, or one inside a block nested
  in the other, is a hard error: "There is already a variable named X declared in
  this scope". The engine will not load the file at all.
* Two declarations in *disjoint sibling* blocks are fine, and common - two `for`
  loops in one function each declaring `payload`.

So the check is not "declared twice in a function" (that flags a hundred legitimate
lines); it is "declared twice in scopes that overlap". Every declaration is tagged
with its path of enclosing blocks, and two paths conflict when one is a prefix of
the other - which covers both the same-block case and the nested case.

Neither gdparse nor any grammar-only parser catches this; it is a semantic check.
It is not a substitute for the engine's own parse gate (which catches type errors
too), it is the two-second local version of it.

Scope: production scripts (`game/overworld`) by default. Test scripts contain
lambdas and multi-line statements that a line-based scanner attributes to the wrong
block, so it produces false positives there; the engine's parse gate in CI covers
`tests/overworld_*.gd` authoritatively, and reports the file and line.

Usage:
    python3 tools/overworld/gd_scope_check.py [paths...]
Exit code 1 on a conflict, so it can gate a build.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

VAR_RE = re.compile(r"^(\s*)var\s+([A-Za-z_][A-Za-z0-9_]*)")
# Lines that open a new block: their bodies are indented deeper.
OPENER_RE = re.compile(r":\s*(#.*)?$")
OPENER_WORDS = ("if ", "elif ", "else", "for ", "while ", "match ", "func ", "static func ")


def _bracket_delta(line: str) -> int:
    """Net bracket depth change for one line, ignoring brackets inside strings."""
    depth = 0
    quote = ""
    for char in line:
        if quote:
            if char == quote:
                quote = ""
            continue
        if char in "\"'":
            quote = char
        elif char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
    return depth


def scan(path: Path) -> list[str]:
    problems: list[str] = []
    # Stack of (indent, block_path). block_path is a tuple of opening line numbers.
    stack: list[tuple[int, tuple[int, ...]]] = []
    # (name) -> (block_path, line)
    declared: dict[str, tuple[tuple[int, ...], int]] = {}

    depth = 0
    stmt_indent = 0
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        body = line.strip()

        if depth == 0:
            # A new logical statement starts here; the block it opens is indented
            # to the statement's first line, not to whichever line happened to end
            # with a colon. `for x in [` ... `]:` is one statement across many lines.
            stmt_indent = indent
            while stack and indent <= stack[-1][0]:
                stack.pop()

        path_now = stack[-1][1] if stack else ()
        delta = _bracket_delta(line)
        closes_block = depth + delta == 0 and body.endswith(":")
        depth = max(0, depth + delta)

        if depth == 0 and body.startswith(("func ", "static func ")):
            declared = {}
            if closes_block:
                stack.append((stmt_indent, path_now + (number,)))
            continue

        if closes_block and (
            body.startswith(OPENER_WORDS) or "func(" in body or body == "else:"
        ):
            stack.append((stmt_indent, path_now + (number,)))
            continue

        match = VAR_RE.match(line)
        if not match:
            continue
        name = match.group(2)
        previous = declared.get(name)
        if previous is not None:
            prev_path, prev_line = previous
            a, b = prev_path, path_now
            # Report when the later declaration sits *inside* the earlier one's
            # block (or in the same block). The reverse - a function-scope
            # declaration appearing after a nested block used the same name - is
            # accepted by the engine and occurs in this repository's green tests,
            # so it is not reported.
            if len(a) <= len(b) and b[: len(a)] == a:
                problems.append(
                    f"{path}:{number}: '{name}' declared again in a scope that "
                    f"overlaps line {prev_line} - the engine rejects this "
                    f"(\"already a variable named {name} declared in this scope\")"
                )
                continue
            declared.setdefault(f"{name}@{number}", (path_now, number))
            continue
        declared[name] = (path_now, number)
    return problems


def main(argv: list[str]) -> int:
    roots = argv[1:] or ["game/overworld"]
    paths: list[Path] = []
    for root in roots:
        p = Path(root)
        if p.is_dir():
            paths.extend(sorted(p.rglob("*.gd")))
        elif p.suffix == ".gd":
            paths.append(p)
    problems: list[str] = []
    for path in paths:
        problems.extend(scan(path))
    for problem in problems:
        print(problem, file=sys.stderr)
    if problems:
        print(f"GD_SCOPE_CHECK FAILED - {len(problems)} conflict(s)", file=sys.stderr)
        return 1
    print(f"gd scope check passed: {len(paths)} scripts, no overlapping locals")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
