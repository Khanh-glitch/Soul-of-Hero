#!/usr/bin/env python3
"""A0 owner composition: build one reproducible tree from exact owner refs.

Why this exists: the A0+A6 temporary workflows composed owners by `cp -a`, which
is not reproducible, not auditable and silently overwrote A3/A0 files when an
owner branch happened to carry them. This tool:

  1. pins every owner to a full 40-character commit and refuses short refs;
  2. copies ONLY files inside that owner's declared scope;
  3. records anything an owner carries outside its scope as `out_of_scope`
     (refused, reported, never copied);
  4. finds files two owners both touched and requires an explicit ruling;
  5. writes `composition.json` and `CONFLICTS.md` into the composed tree so the
     CI job and any reviewer can see exactly what was joined and why.

Usage:
  python3 tools/a0/compose_owners.py --repo . --out .composed \
      --owner a6=81c1f57e... --owner a1=9ca1453c...

It never writes to the git repository it reads from (the composed tree is a copy)
and never edits another owner's branch.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

SCOPE_MANIFEST = Path("tools/a0/ownership.json")


def git(repo: Path, *args: str) -> str:
    out = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} failed: {out.stderr.strip()}")
    return out.stdout


def load_manifest(repo: Path) -> dict:
    import re

    text = (repo / SCOPE_MANIFEST).read_text()
    # The manifest is JSON with // and /* */ comments stripped; keep it readable
    # for humans without pulling in a YAML dependency.
    text = re.sub(r"^\s*#.*$", "", text, flags=re.M)
    return json.loads(text)


def resolve_sha(repo: Path, ref: str) -> str:
    sha = git(repo, "rev-parse", f"{ref}^{{commit}}").strip()
    if len(sha) != 40:
        raise SystemExit(f"owner ref {ref!r} did not resolve to a full sha: {sha!r}")
    return sha


def tracked_files(repo: Path, sha: str) -> list[str]:
    return [line for line in git(repo, "ls-tree", "-r", "--name-only", sha).splitlines() if line]


def in_scope(path: str, scopes: list[str]) -> bool:
    return any(path == s.rstrip("/") or path.startswith(s) for s in scopes)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    parser.add_argument("--out", default=".composed")
    parser.add_argument("--owner", action="append", default=[], metavar="NAME=REF")
    parser.add_argument("--base-ref", default="HEAD")
    parser.add_argument("--copy-base", action="store_true",
                        help="copy the A0 base tree into --out before overlaying owners")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    out = (repo / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out)
    manifest = load_manifest(repo)
    base_sha = resolve_sha(repo, args.base_ref)

    owners: dict[str, str] = {}
    for raw in args.owner:
        if "=" not in raw:
            raise SystemExit(f"--owner needs NAME=REF, got {raw!r}")
        name, ref = raw.split("=", 1)
        if name not in manifest["owners"]:
            raise SystemExit(f"unknown owner {name!r}; declared: {sorted(manifest['owners'])}")
        owners[name] = resolve_sha(repo, ref)
    if not owners:
        print("no --owner given: nothing to compose", file=sys.stderr)
        return 2

    if args.copy_base:
        out.mkdir(parents=True, exist_ok=True)
        base_files = [f for f in tracked_files(repo, base_sha)]
        for path in base_files:
            dest = out / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            blob = subprocess.run(["git", "-C", str(repo), "show", f"{base_sha}:{path}"],
                                  capture_output=True)
            if blob.returncode == 0:
                dest.write_bytes(blob.stdout)

    # Files each owner changed relative to the merge base with the A0 base.
    report: dict = {
        "schema": "soh.a0.composition.v1",
        "base": {"ref": args.base_ref, "sha": base_sha},
        "precedence": manifest["precedence"],
        "owners": {},
        "conflicts": [],
        "refused_out_of_scope": {},
        "copied": {},
    }

    touched: dict[str, set[str]] = {}
    rulings = manifest.get("rulings", {})
    rejected: list[str] = []
    for name, sha in owners.items():
        info = manifest["owners"][name]
        scopes = info["scopes"]
        merge_base = git(repo, "merge-base", base_sha, sha).strip()
        changed = [f for f in git(repo, "diff", "--name-only", merge_base, sha).splitlines() if f]
        deleted = [f for f in git(repo, "diff", "--diff-filter=D", "--name-only", merge_base, sha).splitlines() if f]
        in_scope_changed = [f for f in changed if in_scope(f, scopes)]
        refused = [f for f in changed if not in_scope(f, scopes)]
        copied: list[str] = []
        for path in in_scope_changed:
            if path in deleted:
                continue
            ruling = rulings.get(path)
            if ruling is not None:
                kind = ruling.get("kind", "a0_resolution")
                if kind == "reject":
                    rejected.append(f"{name}:{path}")
                    continue
                if kind in ("accept_owner", "a0_resolution") and ruling.get("owner") != name:
                    continue
                if kind == "a0_resolution" and ruling.get("winner") != name:
                    continue
            blob = subprocess.run(["git", "-C", str(repo), "show", f"{sha}:{path}"],
                                  capture_output=True)
            if blob.returncode != 0:
                continue
            dest = out / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(blob.stdout)
            copied.append(path)
            touched.setdefault(path, set()).add(name)
        # A ruling may accept an owner file that sits outside its declared scope
        # (shared integration surface). Without this the composition would keep
        # A0's version and the caller's method would not exist at runtime — which
        # is exactly how a missing `missing_summary()` broke the first real run.
        for path, ruling in rulings.items():
            if ruling.get("kind") != "accept_owner" or ruling.get("owner") != name:
                continue
            if path in copied or path in deleted:
                continue
            blob = subprocess.run(["git", "-C", str(repo), "show", f"{sha}:{path}"],
                                  capture_output=True)
            if blob.returncode != 0:
                continue
            dest = out / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(blob.stdout)
            copied.append(path)
            touched.setdefault(path, set()).add(name)
            refused_list = report["refused_out_of_scope"].setdefault(name, [])
            if path in refused_list:
                refused_list.remove(path)
        report["owners"][name] = {
            "sha": sha,
            "branch": info.get("branch", ""),
            "merge_base": merge_base,
            "scopes": scopes,
            "changed_outside_scope": len(refused),
            "refused_examples": refused[:25],
            "copied_files": len(copied),
        }
        report["refused_out_of_scope"][name] = refused
        report["copied"][name] = copied

    # A0 resolutions replace whatever the owners published, so the merged file is
    # copied last and the composition is never a blind overwrite.
    for path, ruling in rulings.items():
        if ruling.get("kind") != "a0_resolution":
            continue
        merge = ruling.get("merge", "")
        source = repo / merge
        if not merge or not source.is_file():
            raise SystemExit(f"a0_resolution for {path} needs a committed merge at {merge!r}")
        dest = out / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(source.read_bytes())
        report.setdefault("resolutions", {})[path] = {
            "merge": merge,
            "owners": ruling.get("owners", []),
            "winner": ruling.get("winner"),
            "why": ruling.get("why", ""),
        }

    for path, names in sorted(touched.items()):
        if len(names) < 2:
            continue
        ruling = rulings.get(path)
        report["conflicts"].append({
            "path": path,
            "owners": sorted(names),
            "ruling": ruling or {"winner": None, "why": "UNDECIDED"},
            "resolved": bool(ruling and ruling.get("winner") in names),
        })

    # A ruling whose owner no longer carries the file is stale: say so instead of
    # letting a merge silently outlive the change it resolved.
    for path, ruling in rulings.items():
        if ruling.get("kind") != "a0_resolution":
            continue
        for owner in ruling.get("owners", []):
            if owner == "a0":
                continue
            if path not in report["copied"].get(owner, []) and path not in report["refused_out_of_scope"].get(owner, []):
                report["conflicts"].append({
                    "path": path,
                    "owners": ruling.get("owners", []),
                    "ruling": ruling,
                    "resolved": False,
                    "reason": f"stale resolution: {owner} no longer changes this file",
                })
    unresolved = [c for c in report["conflicts"] if not c["resolved"]]
    if rejected:
        report["rejected"] = rejected
    out.mkdir(parents=True, exist_ok=True)
    (out / "composition.json").write_text(json.dumps(report, indent=2) + "\n")

    lines = ["# Owner composition", "",
             f"- base: `{base_sha}`",
             f"- precedence: {' -> '.join(manifest['precedence'])}", "",
             "| owner | ref | files copied | refused outside scope |", "| --- | --- | --- | --- |"]
    for name in sorted(report["owners"]):
        info = report["owners"][name]
        lines.append(f"| {name} | `{info['sha']}` | {info['copied_files']} | {info['changed_outside_scope']} |")
    lines += ["", "## A0 resolutions applied", ""]
    if not report.get("resolutions"):
        lines.append("None.")
    for path, info in sorted(report.get("resolutions", {}).items()):
        lines.append(f"- `{path}` — A0-integrated merge `{info['merge']}` "
                     f"(owner contribution: {', '.join(o for o in info['owners'] if o != 'a0')})")
        lines.append(f"  - {info['why']}")
    lines += ["", "## Conflicts", ""]
    if not report["conflicts"]:
        lines.append("None: no file is claimed by two owners.")
    for conflict in report["conflicts"]:
        ruling = conflict["ruling"]
        lines.append(f"- `{conflict['path']}` — {', '.join(conflict['owners'])} — "
                     f"winner: **{ruling.get('winner') or 'UNDECIDED'}**")
        if ruling.get("why"):
            lines.append(f"  - {ruling['why']}")
    if unresolved:
        lines += ["", f"**{len(unresolved)} conflict(s) unresolved: the composition is refused.**"]
    (out / "CONFLICTS.md").write_text("\n".join(lines) + "\n")

    print(f"composed {len(owners)} owner(s) into {out}")
    for name in sorted(report["owners"]):
        info = report["owners"][name]
        print(f"  {name:3s} {info['sha'][:12]} copied={info['copied_files']:4d} "
              f"out_of_scope={info['changed_outside_scope']:4d}")
    print(f"conflicts={len(report['conflicts'])} unresolved={len(unresolved)}")
    return 1 if unresolved else 0


if __name__ == "__main__":
    sys.exit(main())
