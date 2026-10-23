#!/usr/bin/env python3
"""Expose concise Godot test summaries and failure context as Actions annotations."""

from __future__ import annotations

import json
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
        report_details: list[str] = []
        report_name = {
            "gameplay-smoke.log": "smoke_report.json",
            "chapter-1-level-5-miniboss.log": "chapter_1_level_5_miniboss_report.json",
            "level_5_archer_pickup_test.log": "level_5_archer_pickup_report.json",
            "chapter_1_level_6_promotion_route_test.log": "chapter_1_level_6_promotion_route_report.json",
            "chapter_1_level_8_fresh_route_test.log": "chapter_1_level_8_fresh_route_report.json",
            "chapter_1_level_9_fresh_route_test.log": "chapter_1_level_9_fresh_route_report.json",
            "chapter_1_level_10_fresh_route_test.log": "chapter_1_level_10_fresh_route_report.json",
        }.get(path.name)
        report_path = path.with_name(report_name) if report_name else None
        if report_path is not None and report_path.is_file():
            try:
                report = json.loads(report_path.read_text(encoding="utf-8"))
                report_failures = report.get("failures", [])
                if isinstance(report_failures, list) and report_failures:
                    report_details = [
                        "GODOT_FAILURE_REPORT " + json.dumps(report_failures, ensure_ascii=False)
                    ]
            except (OSError, json.JSONDecodeError):
                report_details = []
        failures = [
            line
            for line in lines
            if FAILURE.search(line) and not line.lstrip().startswith("PASS")
        ]
        engine_context: list[str] = []
        for index, line in enumerate(lines):
            if "absolute paths from outside the active scene tree" not in line:
                continue
            for candidate in reversed(lines[max(0, index - 40):index]):
                if "LEVEL 9 ROUTE TRACE:" in candidate:
                    engine_context.append(candidate)
                    break
            for candidate in lines[index + 1:index + 8]:
                if ".gd:" in candidate or candidate.lstrip().startswith("at:"):
                    engine_context.append(candidate)
        # Prioritize exact counts, compact assertion lists, and focused runtime
        # diagnostics; use individual failures only when no compact list exists.
        selected = list(dict.fromkeys(
            summaries[-1:]
            + campaign_failures[-1:]
            + report_details[-1:]
            + population_details[-1:]
            + root_details[-1:]
            + engine_context[-2:]
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
