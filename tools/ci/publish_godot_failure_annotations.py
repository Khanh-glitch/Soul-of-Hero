#!/usr/bin/env python3
"""Expose concise Godot test failure context as GitHub Actions annotations."""

from __future__ import annotations

import re
import sys
from pathlib import Path

FAILURE = re.compile(r"(?:SCRIPT ERROR|ERROR:|FAIL(?:ED)?|CRASH|Parse Error)", re.IGNORECASE)
CONTEXT = re.compile(
    r"(?:Godot|version|campaign|level|chapter|test|check|passed|failed|error|warning)",
    re.IGNORECASE,
)


def main() -> int:
    arguments = sys.argv[1:]
    if len(arguments) % 2:
        print("usage: publish_godot_failure_annotations.py LOG TITLE [LOG TITLE ...]", file=sys.stderr)
        return 2

    for index in range(0, len(arguments), 2):
        path = Path(arguments[index])
        title = arguments[index + 1].replace("\r", " ").replace("\n", " ")
        if not path.is_file():
            continue
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        failures = [line for line in lines if FAILURE.search(line)]
        context = [line for line in lines[-240:] if CONTEXT.search(line)]
        selected = list(dict.fromkeys(failures[-20:] + context[-5:]))
        if not selected:
            selected = lines[-12:]
        for line in selected:
            command = "error" if FAILURE.search(line) else "notice"
            message = line.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
            print(f"::{command} title={title}::{message}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
