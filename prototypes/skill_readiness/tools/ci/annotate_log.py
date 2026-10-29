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

MAX_CHARS = 60000


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
    tail = [l for l in lines[-args.tail:] if not l.startswith("Godot Engine v")]
    body = "\n".join(
        ["== matched =="] + keep[-200:] + ["== tail =="] + tail
    )
    if len(body) > MAX_CHARS:
        body = body[-MAX_CHARS:]
    print(f"::{args.level} title={escape(args.title)}::{escape(body)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
