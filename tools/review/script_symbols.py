#!/usr/bin/env python3
"""Catch the failure a parser cannot see: a call to a function that does not exist.

gdtoolkit proves a file is syntactically valid. It does not resolve identifiers, so a
script can parse cleanly and still fail to compile:

    SCRIPT ERROR: Parse Error: Function "_fail()" not found in base self.

When that happens to a headless test scene, Godot loads no script at all, the scene
sits there with nothing to do, and CI reports a timeout instead of a mistake. That
round trip costs five minutes and names nothing. This check takes a second.

It is deliberately conservative: a name counts as defined if any script in the project
declares it, because inheritance, autoloads and engine callbacks all legitimately call
methods declared elsewhere. The point is to catch typos and dropped helpers inside a
file, not to reimplement GDScript's type checker.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

FUNC = re.compile(r"^\s*(?:static\s+)?func\s+(\w+)", re.M)
CALL = re.compile(r"(?<![\w.$])([a-z_]\w*)\s*\(")
GODOT_CALLBACKS = {
    "_init", "_ready", "_enter_tree", "_exit_tree", "_process", "_physics_process",
    "_input", "_unhandled_input", "_unhandled_key_input", "_shortcut_input",
    "_notification", "_draw", "_gui_input", "_get", "_set", "_to_string",
    "_get_property_list", "_property_can_revert", "_property_get_revert",
    "_integrate_forces", "_on_", "_enter", "_exit",
}
KEYWORDS = {
    "if", "for", "while", "match", "return", "print", "printerr", "assert", "and", "or",
    "not", "in", "is", "as", "await", "func", "var", "const", "elif", "else", "signal",
    "class_name", "extends", "true", "false", "null", "super", "self", "pass", "break",
    "continue", "push_error", "push_warning", "preload", "load", "range", "str", "int",
    "float", "bool", "String", "Vector2", "Vector2i", "Rect2", "Color", "Array",
}


def declared_names(paths: list[Path]) -> set[str]:
    names: set[str] = set()
    for path in paths:
        names.update(FUNC.findall(path.read_text(encoding="utf-8", errors="replace")))
    return names


INNER_CLASS = re.compile(r"^class\s+(\w+)\s*:", re.M)
# A type annotation is `name: Type` or `-> Type`. The colon must not be part of `::`,
# and prose inside a comment is not code, so comments are stripped before matching -
# otherwise strings like "A6 -> A0" and "::error::..." produce nonsense.
BASELINE_PATH = Path(__file__).with_name("known_types.txt")
DECLARATION = re.compile(r"^\s*(?:@\w+\s+)?(?:static\s+)?(?:var|func|const)\s")
ANNOTATION = re.compile(r"(?<!:):\s*([A-Z]\w*)\b")
RETURN_TYPE = re.compile(r"->\s*([A-Z]\w*)\b")


STRING_LITERAL = re.compile(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'')


def _code_only(text: str) -> str:
    out: list[str] = []
    for line in text.splitlines():
        hash_at = line.find("#")
        code = line if hash_at < 0 else line[:hash_at]
        out.append(STRING_LITERAL.sub('""', code))
    return "\n".join(out)


def declared_class_names(paths: list[Path]) -> set[str]:
    names: set[str] = set()
    for path in paths:
        for match in re.finditer(r"^class_name\s+(\w+)",
                                 path.read_text(encoding="utf-8", errors="replace"), re.M):
            names.add(match.group(1))
    return names


def collect_types(paths: list[Path]) -> dict[str, list[str]]:
    """Every type name used on a declaration line, mapped to where it was seen.

    A dictionary literal `{"key": VALUE}` looks exactly like an annotation
    `var x: Type`, and prose that survives comment stripping looks like a return type,
    so only declaration lines are read.
    """
    found: dict[str, list[str]] = {}
    for path in paths:
        text = _code_only(path.read_text(encoding="utf-8", errors="replace"))
        for line_number, line in enumerate(text.splitlines(), start=1):
            if not DECLARATION.match(line):
                continue
            for pattern in (ANNOTATION, RETURN_TYPE):
                for match in pattern.finditer(line):
                    found.setdefault(match.group(1), []).append(f"{path}:{line_number}")
    return found


def load_baseline() -> set[str]:
    if not BASELINE_PATH.exists():
        return set()
    return {
        line.strip()
        for line in BASELINE_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    }


def main(argv: list[str]) -> int:
    roots = [Path(arg) for arg in argv] or [Path("game"), Path("tests")]
    files = [p for root in roots for p in root.rglob("*.gd")]
    known = declared_names(files) | declared_class_names(files)

    failures: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        own = set(FUNC.findall(text))
        for match in CALL.finditer(text):
            name = match.group(1)
            if name in own or name in known or name in KEYWORDS:
                continue
            if name.startswith("__") or any(name.startswith(c) for c in ("_on_",)):
                continue
            line = text.count("\n", 0, match.start()) + 1
            source_line = text.splitlines()[line - 1].strip()
            # Only names that look like a local helper are interesting; a bare
            # identifier call on another object would have a dot and is excluded.
            if not name.startswith("_"):
                continue
            failures.append(f"{path}:{line}: calls '{name}()' but no script declares it\n    {source_line[:140]}")

    # Types that the tree already uses are not this check's business: the engine, the
    # project's own class_name registry and every autoload live outside these files, and
    # re-deriving that list here would mean maintaining an allow-list forever. What
    # matters is a NEW unresolved name - the shape of a class deleted while its
    # annotations stayed behind.
    declared_anywhere = set()
    for path in files:
        raw = path.read_text(encoding="utf-8", errors="replace")
        declared_anywhere.update(INNER_CLASS.findall(raw))
    declared_anywhere |= declared_class_names(files) | known
    baseline = load_baseline()
    for name, sites in sorted(collect_types(files).items()):
        if name in declared_anywhere or name in baseline:
            continue
        for site in sites:
            failures.append(f"{site}: uses undeclared type '{name}'")

    for failure in failures:
        print("FAIL " + failure)
    print(f"symbol check: {len(files)} scripts, {len(failures)} unresolved symbols")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
