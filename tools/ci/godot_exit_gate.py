#!/usr/bin/env python3
"""Require a real Godot exit code of 0 and classify shutdown accounting.

    godot_exit_gate.py --phase "<label>" --rc <int> [--log <godot log>]

Why this exists
---------------
`gate_log.sh` answers "did the log look clean and say it passed?". It cannot
answer "did the process actually exit 0?", because the shell that captured `$?`
is the only place that number exists. Before this gate, every R13 step turned a
non-zero engine exit into an `::warning::`, so a run could be green while the
engine had reported a failure on the way out.

Two separate facts are now required, and they are never conflated:

  * the log gate (`gate_log.sh`) must pass  ->  PASS marker present, no
    unclassified `SCRIPT ERROR` / `Parse Error` / `^ERROR:` line;
  * the process must exit 0                ->  this script.

Exit-code classes
-----------------
  0                     CLEAN
  124 / 137             TIMEOUT          the `timeout ...` wrapper fired or killed
  anything else where   SHUTDOWN_ONLY    every engine complaint found in the log is
  every engine line is                   Godot's own shutdown accounting
  shutdown accounting                    (`ObjectDB instances were leaked`,
                                         `resources still in use at exit`,
                                         `Leaked instance: ...`); still FATAL,
                                         but named as its own class so nobody
                                         mistakes a leak for a test failure
  anything else         ABNORMAL         real non-zero exit with engine errors
                                        
Only classes 0 passes. The shutdown class is *classified*, never tolerated: the
whole point of the correction round is that a leaky shutdown must not be able to
hide behind a green step, and must not be reported as a failed assertion either.
Engine errors are never filtered globally - a non-shutdown error line forces
ABNORMAL even when the shutdown lines are also present.
"""

from __future__ import annotations

import argparse
import os
import re
import sys

SHUTDOWN_PATTERNS = (
    re.compile(r"ObjectDB instances were leaked"),
    re.compile(r"resources still in use at exit"),
    re.compile(r"^\s*Leaked instance:"),
    re.compile(r"RID allocations of type .* were leaked"),
    re.compile(r"^\s*Resource still in use:"),
)
ENGINE_ERROR_PATTERNS = (
    re.compile(r"SCRIPT ERROR"),
    re.compile(r"Parse Error"),
    re.compile(r"^ERROR:", re.MULTILINE),
)
TIMEOUT_CODES = (124, 137)


def classify(rc: int, lines: list[str]) -> tuple[str, list[str], list[str]]:
    shutdown = [line for line in lines if any(p.search(line) for p in SHUTDOWN_PATTERNS)]
    errors = [
        line
        for line in lines
        if any(p.search(line) for p in ENGINE_ERROR_PATTERNS)
        and not any(p.search(line) for p in SHUTDOWN_PATTERNS)
    ]
    if rc == 0:
        return "CLEAN", shutdown, errors
    if rc in TIMEOUT_CODES:
        return "TIMEOUT", shutdown, errors
    if shutdown and not errors:
        return "SHUTDOWN_ONLY", shutdown, errors
    return "ABNORMAL", shutdown, errors


def annotate(level: str, title: str, message: str) -> None:
    safe = message.replace("%", "%25").replace("\r", "").replace("\n", "~")
    print(f"::{level} title={title}::{safe}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", required=True)
    parser.add_argument("--rc", required=True, type=int)
    parser.add_argument("--log", default="")
    args = parser.parse_args(argv)

    lines: list[str] = []
    log_missing = False
    if args.log:
        if os.path.isfile(args.log):
            with open(args.log, "r", encoding="utf-8", errors="replace") as handle:
                lines = handle.read().splitlines()
        else:
            log_missing = True

    kind, shutdown, errors = classify(args.rc, lines)
    print(f"{args.phase}: engine exit class={kind} rc={args.rc} "
          f"shutdown_lines={len(shutdown)} engine_error_lines={len(errors)}")
    if log_missing:
        annotate("warning", f"{args.phase} exit gate",
                 f"log not readable at {args.log}; classification is exit-code only")

    if kind == "CLEAN":
        suffix = (
            f"; {len(shutdown)} non-fatal shutdown notice line(s) were also logged"
            if shutdown
            else ""
        )
        annotate("notice", f"{args.phase} engine exit", f"engine exited 0 (clean shutdown{suffix})")
        print(f"{args.phase}: GODOT EXIT 0 ACCEPTED")
        return 0

    if kind == "TIMEOUT":
        annotate("error", f"{args.phase} engine exit",
                 f"godot was killed by the timeout wrapper (rc={args.rc}); the phase never "
                 "reached its own exit, so this is not a pass")
        print(f"{args.phase}: GODOT EXIT TIMEOUT rc={args.rc}")
        return 1

    if kind == "SHUTDOWN_ONLY":
        detail = " ~ ".join(line.strip() for line in shutdown[:4])
        annotate("error", f"{args.phase} shutdown leak",
                 f"engine exited {args.rc} and every engine complaint is shutdown accounting "
                 f"({len(shutdown)} line(s)) - the suite's writes completed, but the process "
                 f"was not clean: {detail}")
        print(f"{args.phase}: GODOT EXIT {args.rc} ENGINE_SHUTDOWN_LEAK "
              f"shutdown_lines={len(shutdown)}")
        for line in shutdown[:5]:
            print(f"  shutdown: {line.strip()}")
        return 1

    detail = " ~ ".join(line.strip() for line in errors[:4]) or "no engine error line captured"
    annotate("error", f"{args.phase} engine exit",
             f"engine exited {args.rc} with {len(errors)} unclassified engine error line(s): {detail}")
    print(f"{args.phase}: GODOT EXIT {args.rc} ENGINE_ABNORMAL")
    for line in errors[:5]:
        print(f"  error: {line.strip()}")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
