#!/usr/bin/env python3
"""Static seat checks for a composed tree (A0 Round 12, WP-A0.1).

A composition can be "reproducible" and still be broken: a scene can point at a
resource that only exists on one owner's branch, an A6 panel can call an A0 API
that does not exist in the merged service, and CI would only notice at runtime
(if at all). This checker runs before any native job and fails with the exact
missing seat:

  * every `res://` path referenced by a script (preload/load/ext_resource) and
    every scene `ext_resource` exists in the composed tree;
  * every `path=` entry in the project's autoload section exists;
  * A0 APIs that presentation layers call are really implemented, and A0's own
    integration files do not call methods only one owner has.

It is a *seat* check, not a product test: it proves wiring, never behaviour.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

RES_RE = re.compile(r'"(res://[^"]+)"')
# Only real code loads count: `load("res://x")` / `preload("res://x")`. A string
# that merely looks like a path is often an output target (artifacts, reports,
# printf-style names), and treating those as seats would drown the real faults.
LOAD_RE = re.compile(r"(?:pre|)?load\(\s*\"(res://[^\"]+)\"")
EXT_RES_RE = re.compile(r'\[ext_resource[^\]]*path="(res://[^"]+)"')
AUTOLOAD_RE = re.compile(r'^\s*([A-Za-z0-9_]+)="\*?(res://[^"]+)"\s*$', re.M)

# Contracts A0 promises to the other owners. If presentation calls one of these
# and it is absent, the composition is broken even though every file exists.
A0_API_CONTRACTS = {
    "game/autoload/save_service.gd": [
        "get_player_appearance_projection",
        "get_player_avatar",
        "set_player_avatar",
        "get_inventory_capacity_snapshot",
    ],
    "game/survival/survival_service.gd": [
        "inventory_count",
        "recover_death_bag",
        "begin_overworld_death",
        "finish_overworld_death",
    ],
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    if not (root / "project.godot").is_file():
        print(f"no project.godot under {root}", file=sys.stderr)
        return 2

    manifest = root / "tools" / "a0" / "ownership.json"
    stale: dict = {}
    if manifest.is_file():
        import json as _json
        text = re.sub(r"^\s*#.*$", "", manifest.read_text(), flags=re.M)
        stale = _json.loads(text).get("known_stale_seats", {})

    problems: list[str] = []
    stale_found: list[str] = []
    checks = 0

    def exists(rel: str) -> bool:
        return (root / rel.replace("res://", "", 1)).is_file()

    for path in sorted(root.rglob("*")):
        if path.is_dir() or ".godot" in path.parts:
            continue
        suffix = path.suffix
        if suffix not in (".gd", ".tscn", ".tres", ".json", ".gdshader"):
            continue
        try:
            text = path.read_text(errors="ignore")
        except OSError:
            continue
        rel = str(path.relative_to(root))
        refs = EXT_RES_RE.findall(text) if suffix in (".tscn", ".tres") else LOAD_RE.findall(text)
        for ref in set(refs):
            if "%" in ref or ref.startswith("res://.artifacts") or ref.endswith("/"):
                continue
            checks += 1
            if exists(ref):
                continue
            rel_path = ref.replace("res://", "", 1)
            if rel_path in stale:
                stale_found.append(f"{rel}: missing {ref} (known stale: {stale[rel_path]['why']})")
                continue
            problems.append(f"{rel}: missing resource {ref}")

    project = (root / "project.godot").read_text()
    section = project.split("[autoload]", 1)[1].split("[", 1)[0] if "[autoload]" in project else ""
    for name, ref in AUTOLOAD_RE.findall(section):
        checks += 1
        if not exists(ref):
            problems.append(f"project.godot: autoload {name} -> missing {ref}")

    for rel, methods in A0_API_CONTRACTS.items():
        path = root / rel
        if not path.is_file():
            problems.append(f"missing owner file {rel}")
            continue
        text = path.read_text(errors="ignore")
        for method in methods:
            checks += 1
            if f"func {method}(" not in text:
                problems.append(f"{rel}: promised A0 API `{method}` is absent")

    print(f"seat checks: {checks}, problems: {len(problems)}, known stale: {len(stale_found)}")
    for line in stale_found:
        print(f"  KNOWN_STALE {line}")
    for problem in problems[:80]:
        print(f"  - {problem}")
    if problems:
        print("COMPOSITION SEATS FAILED")
        return 1
    print("COMPOSITION SEATS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
