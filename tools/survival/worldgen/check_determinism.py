"""Double-compile determinism gate for SURV-050A.

Run: python3 tools/survival/worldgen/check_determinism.py
Compiles the authored plan twice and compares every emitted data artifact hash.
Writes docs/survival/world/determinism_report.json. Not a native gameplay test.
"""
from __future__ import annotations
import contextlib, hashlib, io, json
from pathlib import Path
import compile_plan
import compile_slice
import compile_corridor
import build_world_art
import build_region_art
import compile_world_art
from baseline import ROOT

OUT = ROOT / "data" / "survival" / "world"
DOC = ROOT / "docs" / "survival" / "world"


def tree_hash():
    rows = []
    for p in sorted(OUT.rglob("*.json")):
        rows.append({"path": str(p.relative_to(ROOT)), "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "bytes": p.stat().st_size})
    digest = hashlib.sha256(json.dumps(rows, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return digest, rows


def run():
    with contextlib.redirect_stdout(io.StringIO()):
        compile_plan.compile_all()
        compile_slice.compile_all()
        compile_corridor.compile_all()
        build_region_art.build()
        compile_world_art.compile_all()
    return tree_hash()


if __name__ == "__main__":
    h1, rows1 = run()
    h2, rows2 = run()
    ok = h1 == h2 and rows1 == rows2
    report = {"schema": "soh.world.determinism.v1", "ok": ok, "compile_1_tree_sha256": h1, "compile_2_tree_sha256": h2,
              "artifact_count": len(rows1), "plan_sha256": hashlib.sha256((OUT / "world_plan.v1.json").read_bytes()).hexdigest(),
              "status": "AUTHORED_PLAN_NOT_NATIVE_INTEGRATED", "artifacts": rows1}
    DOC.mkdir(parents=True, exist_ok=True)
    (DOC / "determinism_report.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"ok": ok, "tree_sha256": h1, "artifacts": len(rows1)}))
    raise SystemExit(0 if ok else 1)
