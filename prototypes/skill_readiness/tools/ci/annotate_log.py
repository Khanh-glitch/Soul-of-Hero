#!/usr/bin/env python3
"""Emit a Godot log as a single GitHub workflow annotation.

Job logs are not downloadable from every sandbox, but check-run annotations
are readable through the REST API. This prints ONE annotation whose message
carries the verdict lines plus the tail of the log, so the evidence survives
even when the raw log cannot be fetched.

usage: annotate_log.py --level {notice,error} --title TITLE --log FILE
                       [--tail N] [--pattern REGEX]...
"""
import argparse
import re
import sys

CHUNK = 3000
MAX_CHUNKS = 10  # GitHub drops workflow-command annotations past 10 per step


def escape(s: str) -> str:
    return s.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", choices=["notice", "error"], required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--log", required=True)
    ap.add_argument("--tail", type=int, default=40)
    ap.add_argument("--pattern", action="append", default=[])
    args = ap.parse_args()
    try:
        lines = open(args.log, encoding="utf-8", errors="replace").read().splitlines()
    except OSError as exc:
        lines = [f"(no log: {exc})"]
    keep = []
    pats = [re.compile(p) for p in args.pattern]
    for line in lines:
        if line.startswith("Godot Engine v"):
            continue
        if any(p.search(line) for p in pats):
            keep.append(line)
    tail = [l for l in lines[-args.tail:] if not l.startswith("Godot Engine v")] if args.tail > 0 else []
    # Verdict/summary lines must land in the FIRST chunks: the platform keeps
    # only the first 10 annotations a step emits, so a flooded match list
    # would otherwise push the summary past the cut.
    prio = re.compile(r"SUM|DIFFERENTIAL|first_|FAIL|PASS")
    keep = [l for l in keep if prio.search(l)] + [l for l in keep if not prio.search(l)]
    # Keep the first matches as well as the last: early markers (setup, first
    # cast) must survive a flood of repeated per-tick SCRIPT ERROR lines.
    if len(keep) > 200:
        keep = keep[:60] + ["== ... repeated matches elided ..."] + keep[-140:]
    items = ["== matched =="] + keep + ["== tail =="] + tail
    items = [it[:400] for it in items]
    # Annotation messages above a few KB are silently dropped by the platform,
    # so the evidence is split into several small annotations.
    chunks, cur = [], ""
    for it in items:
        if len(cur) + len(it) + 1 > CHUNK:
            chunks.append(cur)
            cur = ""
        cur += it + "\n"
    if cur:
        chunks.append(cur)
    for idx, body in enumerate(chunks[:MAX_CHUNKS]):
        title = args.title if idx == 0 else f"{args.title} ({idx + 1}/{len(chunks)})"
        print(f"::{args.level} title={escape(title)}::{escape(body)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
