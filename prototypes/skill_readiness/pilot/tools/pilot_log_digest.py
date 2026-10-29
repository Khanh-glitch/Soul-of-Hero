#!/usr/bin/env python3
"""Emit one GitHub error annotation summarising a Godot log.

Keeps the first error-like lines and the log tail, encoded with %0A so the
whole digest fits in a single annotation message. Used by the VFX pilot
workflow, where raw job logs are not otherwise readable.
"""
import re
import sys

path, label = sys.argv[1], sys.argv[2]
try:
    lines = open(path, errors="replace").read().splitlines()
except OSError as exc:
    lines = [f"log unreadable: {exc}"]
hits = [l for l in lines if re.search(r"ERROR|error|FAIL|Parse|assert|Assert|GOLD93", l)][:12]
tail = lines[-18:]
msg = "\n".join([f"{label}; log lines={len(lines)}", "--- first error-like lines ---"] + hits + ["--- tail ---"] + tail)
msg = msg[-3500:]
msg = msg.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
print(f"::error title={label}::{msg}")
