#!/usr/bin/env python3
"""A1 native-evidence fallback for sandboxes that cannot reach Actions blob storage.

Creates Git blobs (not commits/branches/tags) for small native reports/logs/PNGs
and emits one GitHub notice annotation containing a path -> blob SHA manifest.
The blobs are fetchable through api.github.com/repos/.../git/blobs/{sha}.
This does not alter the tested source tree or publish a branch/PR.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.github.com"
ALLOWED = {".png", ".json", ".log", ".txt"}
MAX_FILE_BYTES = 16 * 1024 * 1024
MAX_TOTAL_BYTES = 64 * 1024 * 1024


def request(method: str, path: str, token: str, payload: dict | None = None) -> dict:
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(
        API + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "a1-native-evidence-mirror",
            "Content-Type": "application/json",
        },
    )
    last: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code not in (500, 502, 503, 504) or attempt == 3:
                raise
            time.sleep(2 ** attempt)
    raise last if last else RuntimeError("request failed")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", action="append", required=True)
    args = ap.parse_args()
    token = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    if not token or not repo:
        print("::warning::native evidence mirror skipped: GITHUB_TOKEN/GITHUB_REPOSITORY missing")
        return 0
    files: list[Path] = []
    for root in args.root:
        p = Path(root)
        if p.is_dir():
            files.extend(sorted(x for x in p.rglob("*") if x.is_file() and not x.name.startswith("bad_") and (x.suffix in ALLOWED or x.name.endswith("exit-code"))))
    manifest: dict[str, dict] = {}
    total = 0
    for path in files:
        size = path.stat().st_size
        if size > MAX_FILE_BYTES or total + size > MAX_TOTAL_BYTES:
            print(f"::warning::native evidence mirror skipped large file {path} ({size} bytes)")
            continue
        total += size
        rel = path.as_posix()
        try:
            blob = request("POST", f"/repos/{repo}/git/blobs", token, {
                "content": base64.b64encode(path.read_bytes()).decode("ascii"),
                "encoding": "base64",
            })
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            print(f"::warning::native evidence mirror failed for {rel}: {exc}")
            continue
        manifest[rel] = {"sha": blob["sha"], "bytes": size}
    payload = {
        "schema": "soh.a1.native_evidence_blob_manifest.v1",
        "repository": repo,
        "run_id": os.environ.get("GITHUB_RUN_ID", ""),
        "head_sha": os.environ.get("GITHUB_SHA", ""),
        "files": manifest,
        "scope": "GIT_BLOB_FALLBACK_NOT_A_BRANCH_OR_PRODUCTION_CLAIM",
    }
    text = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    # Individual GitHub annotation messages are truncated well below the full
    # manifest size. Store the manifest itself as a Git blob and announce only
    # its SHA; reviewers can fetch every file through api.github.com.
    try:
        manifest_blob = request("POST", f"/repos/{repo}/git/blobs", token, {
            "content": base64.b64encode(text.encode()).decode("ascii"),
            "encoding": "base64",
        })
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"::warning::native evidence manifest blob failed: {exc}")
        return 0
    notice = {
        "schema": "soh.a1.native_evidence_manifest_pointer.v1",
        "manifest_sha": manifest_blob["sha"],
        "files": len(manifest),
        "bytes": total,
        "run_id": payload["run_id"],
        "head_sha": payload["head_sha"],
    }
    print("::notice::A1_NATIVE_EVIDENCE_MANIFEST_BLOB " + json.dumps(notice, sort_keys=True, separators=(",", ":")))
    print(f"native evidence mirrored: {len(manifest)} files, {total} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
