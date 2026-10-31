#!/usr/bin/env python3
"""Re-pin only A1 visual inputs after the explicit R13 art relock.

This is not a blanket source refresh. Every allowed key is enumerated; all
world geography, route, owner-scene, placement and gameplay pins remain bytes
unchanged. A0's historical mounted profile is handled by relock_first_hour_art.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WORLD = ROOT / "data/survival/world"
ALLOWED = {
    WORLD / "a1_round12_runtime_contract.v1.json": {"atlas", "art_grammar", "presentations", "terrain", "props"},
    WORLD / "a1_round11_continuity_contract.v1.json": {"atlas", "asset_provenance", "terrain", "props", "a8_shell_visuals"},
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    results = {}
    for contract_path, allowed in ALLOWED.items():
        before = contract_path.read_bytes()
        doc = json.loads(before)
        pins = doc["source_pins"]
        unchanged = {key: json.dumps(value, sort_keys=True) for key, value in pins.items() if key not in allowed}
        changed = {}
        for key in sorted(allowed):
            row = pins[key]
            path = ROOT / row["path"]
            if not path.is_file():
                raise ValueError(f"missing visual pin target: {key}:{path}")
            old = row["sha256"]
            new = sha(path)
            row["sha256"] = new
            changed[key] = {"before": old, "after": new, "path": row["path"]}
        for key, serialized in unchanged.items():
            if json.dumps(pins[key], sort_keys=True) != serialized:
                raise ValueError(f"non-visual pin changed: {key}")
        contract_path.write_text(json.dumps(doc, indent=2) + "\n")
        results[contract_path.name] = changed
    print(json.dumps({"ok": True, "scope": "A1_VISUAL_PINS_ONLY", "contracts": results}, sort_keys=True))


if __name__ == "__main__":
    main()
