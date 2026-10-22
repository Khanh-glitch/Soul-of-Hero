#!/usr/bin/env python3
"""Expose concise Godot test summaries and failure context as Actions annotations."""

from __future__ import annotations

import re
import sys
from pathlib import Path

FAILURE = re.compile(r"(?:SCRIPT ERROR|ERROR:|FAIL(?:ED)?|CRASH|Parse Error)", re.IGNORECASE)
SUMMARY = re.compile(
    r"(?:\b(?:PASSED|FAILED)\b|\b\d+/\d+ checks? failed\b|\bexit code:\s*\d+)",
    re.IGNORECASE,
)
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
        summaries = [line for line in lines if SUMMARY.search(line)]
        population_details = [
            line for line in lines if "CAMPAIGN_ENTRY_POPULATION_DETAIL" in line
        ]
        root_details = [
            line for line in lines if "CAMPAIGN_ENTRY_ENTITY_ROOT_DETAIL" in line
        ]
        campaign_failures = [
            line for line in lines if "CAMPAIGN_ENTRY_FAILURE_DETAILS" in line
        ]
        failures = [
            line
            for line in lines
            if FAILURE.search(line) and not line.lstrip().startswith("PASS")
        ]
        # Prioritize exact counts, compact assertion lists, and focused runtime
        # diagnostics; use individual failures only when no compact list exists.
        selected = list(dict.fromkeys(
            summaries[-1:]
            + campaign_failures[-1:]
            + population_details[-1:]
            + root_details[-1:]
            + ([] if campaign_failures else failures[-3:])
        ))[:5]
        if not selected:
            context = [line for line in lines[-240:] if CONTEXT.search(line)]
            selected = context[-3:] or lines[-3:]
        for line in selected:
            is_failure = FAILURE.search(line) and not line.lstrip().startswith("PASS")
            command = "error" if is_failure else "notice"
            message = line.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
            print(f"::{command} title={title}::{message}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
