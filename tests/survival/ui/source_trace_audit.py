#!/usr/bin/env python3
"""Read-only integrity audit of the pinned Atlas/coverage index, not gameplay evidence."""
from collections import Counter
from hashlib import sha256
from pathlib import Path
import json

root = Path(__file__).resolve().parents[3]
trace = json.loads((root / "docs/survival/SOURCE_COVERAGE_TRACE.json").read_text())
source = root / "docs/survival/source_archive/Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md"
raw = source.read_bytes()
atlas = raw.decode("utf-8")
lines = atlas.splitlines(keepends=True)
entries = trace["mechanism_entries"]

def require(condition, detail):
    if not condition:
        raise SystemExit("FAIL: " + detail)

require(sha256(raw).hexdigest() == trace["source_hash_sha256"], "pinned Atlas hash differs")
require(len(lines) == trace["source_lines"] == 1355, "Atlas line count differs")
require(len(entries) == 108 and len({e["id"] for e in entries}) == 108, "coverage IDs/count")
require(Counter(e["type"] for e in entries) == {"SUBSYSTEM": 44, "POI": 21, "DEPENDENCY": 31, "JOURNEY": 12}, "entry type counts")
refs = {s["id"] for s in trace["historical_sources"]}
require(len(refs) == 28 and len(trace["unknown_original_facts"]) == 40, "source/unknown counts")
counts = Counter()
for entry in entries:
    src = entry["source"]
    require(src["path"] == str(source.relative_to(root)), entry["id"] + " source path")
    require(1 <= src["start_line"] <= src["end_line"] <= len(lines), entry["id"] + " line range")
    require(set(src["refs"]) <= refs, entry["id"] + " source reference")
    section = "".join(lines[src["start_line"] - 1:src["end_line"]])
    for key in ("facts", "action", "relationship", "risk", "soh_translation", "acceptance_seed"):
        value = entry[key]
        if value:
            require(value in section, entry["id"] + " " + key + " is not verbatim in source range")
            counts[key] += 1
for item in trace["unknown_original_facts"]:
    require(item["question"] in atlas and item["status"] == "FACT_UNVERIFIED_NOT_DESIGN_STALL", item["id"] + " unknown fact")
for item in trace["historical_sources"]:
    require(item["citation"] in atlas, item["id"] + " citation")
print("SOURCE TRACE AUDIT: 1355 lines; 108 unique entries; 40 unknowns; 28 citations; pinned SHA matches")
print("Nonempty trace semantic fields matched verbatim to reviewed Atlas ranges:", dict(counts))
print("This audit does not establish gameplay implementation or external fact verification.")
