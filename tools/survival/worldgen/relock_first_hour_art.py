#!/usr/bin/env python3
"""Explicit A1 visual relock; never rewrites A0's historical profile.

The R13 art directive intentionally opens Crown decorative pixels. This tool
proves that all other first-hour payload keys and canonical cache/landmark
bindings remain stable, then records current hashes alongside the ad39 baseline.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "data/survival/world/art"
BASE = "ad39bde6780c92169032246898c145c568f36e6e"
TIDS = ("crown_roadside_visual_treatment", "amberwood_apothecary_herb_margin", "frost_crown_shrine_skarn")
KEYS = ("ground", "overlays", "props", "lights", "capture_views", "ambient_day", "ambient_night")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_sha(path: Path) -> str:
    return sha(path.read_bytes())


def payload(doc: dict) -> dict:
    return {key: doc[key] for key in KEYS}


def payload_sha(doc: dict) -> str:
    return sha(json.dumps(payload(doc), sort_keys=True, separators=(",", ":")).encode())


def path_for(tid: str) -> Path:
    return ART / "compiled" / f"{tid}.presentation.v1.json"


def baseline(tid: str) -> dict:
    rel = path_for(tid).relative_to(ROOT).as_posix()
    return json.loads(subprocess.check_output(["git", "show", f"{BASE}:{rel}"]))


def used_frames(docs: dict[str, dict]) -> dict[str, set[str]]:
    used = {"terrain": set(), "props": set()}
    for doc in docs.values():
        for row in doc["ground"]["rows"]:
            used["terrain"].update(row)
        used["terrain"].update(row["frame"] for row in doc["overlays"])
        used["props"].update(row["frame"] for row in doc["props"])
    return used


def main() -> None:
    atlas = json.loads((ART / "atlas.v1.json").read_text())
    docs = {tid: json.loads(path_for(tid).read_text()) for tid in TIDS}
    old = {tid: baseline(tid) for tid in TIDS}
    for tid in TIDS:
        for key in KEYS:
            if tid == "crown_roadside_visual_treatment" and key == "props":
                continue
            if docs[tid][key] != old[tid][key]:
                raise ValueError(f"unapproved first-hour payload drift: {tid}:{key}")
        for flag in ("collision_change", "stand_change", "economy_change"):
            if docs[tid].get(flag) is not False:
                raise ValueError(f"authority flag changed: {tid}:{flag}")
    # Canonical interaction/instance identities are not decorative relock scope.
    def bindings(doc: dict) -> dict[str, tuple]:
        result = {}
        for row in doc["props"]:
            for key in ("instance_id", "node_id", "poi_id"):
                if key in row:
                    result[f"{key}:{row[key]}"] = (row["cell"], row["frame"], row["role"])
        return result
    if bindings(docs[TIDS[0]]) != bindings(old[TIDS[0]]):
        raise ValueError("Crown canonical instance/POI binding drift")
    old_lm = next(row for row in old[TIDS[0]]["props"] if row["frame"] == "lm_waystation")
    new_lm = next(row for row in docs[TIDS[0]]["props"] if row["frame"] == "lm_waystation")
    if old_lm["cell"] != new_lm["cell"]:
        raise ValueError("Waystation anchor drift")

    lock_path = ART / "first_hour_visual_payload_lock.v1.json"
    lock = json.loads(lock_path.read_text())
    lock["baseline_payload_hashes"] = {tid: payload_sha(old[tid]) for tid in TIDS}
    lock["payload_hashes"] = {tid: payload_sha(docs[tid]) for tid in TIDS}
    lock["baseline_source_commit"] = BASE
    lock["relock_scope"] = "R13_A1_CROWN_DECORATIVE_PROPS_ONLY_AMBER_FROST_AND_ALL_AUTHORITY_BINDINGS_PRESERVED"
    lock["a0_historical_profile_changed"] = False
    used = used_frames(docs)
    sheets = {kind: Image.open(ROOT / "assets/environment/survival_world" / f"{kind}.png").convert("RGBA")
              for kind in ("terrain", "props")}
    for kind in ("terrain", "props"):
        crops = lock["used_crop_hashes"].setdefault(kind, {})
        for frame in sorted(used[kind]):
            rect = atlas[kind][frame]
            crop = sheets[kind].crop((rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]))
            crops[frame] = sha(crop.tobytes())
        lock["used_crop_hashes"][kind] = dict(sorted(crops.items()))
    lock["r13_real_asset_frames"] = sorted(frame for frame in used["props"] if frame.startswith(("cainos_", "ocean_")))
    lock_path.write_text(json.dumps(lock, indent=2, sort_keys=True) + "\n")

    provenance_path = ART / "first_hour_asset_provenance.v1.json"
    provenance = json.loads(provenance_path.read_text())
    a0 = provenance["profiles"]["a0_mounted_ad39bde6"]
    # Refresh from the immutable Git baseline only if fields are absent; never
    # change the historical consumer ref or repin it to current atlas files.
    for tid in TIDS:
        row = a0["treatments"][tid]
        if row["payload_subset_sha256"] != lock["baseline_payload_hashes"][tid]:
            raise ValueError(f"A0 historical payload changed: {tid}")
    current = provenance["profiles"]["a1_current"]
    current["revision_label"] = "R13_MAP_ART_ESCALATION_EXPLICIT_VISUAL_RELOCK"
    for relative, row in current["files"].items():
        path = ROOT / relative
        row["bytes"] = path.stat().st_size
        row["sha256"] = file_sha(path)
    for tid, row in current["treatments"].items():
        path = path_for(tid)
        row["path"] = path.relative_to(ROOT).as_posix()
        row["file_sha256"] = file_sha(path)
        row["payload_subset_sha256"] = payload_sha(docs[tid])
    for kind in ("terrain", "props"):
        crops = current["crops"].setdefault(kind, {})
        for frame in sorted(used[kind]):
            rect = atlas[kind][frame]
            crop = sheets[kind].crop((rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]))
            crops[frame] = {"rect": rect, "size": rect[2:], "raw_rgba_sha256": sha(crop.tobytes()),
                            "matches_first_hour_lock": True}
    provenance["r13_visual_relock"] = {
        "baseline_source_commit": BASE, "changed_treatment": TIDS[0],
        "before_payload_sha256": payload_sha(old[TIDS[0]]), "after_payload_sha256": payload_sha(docs[TIDS[0]]),
        "allowed_payload_key": "props", "canonical_bindings_preserved": True,
        "a0_historical_profile_changed": False,
        "real_asset_manifest": "data/survival/world/art/asset_exploitation.v1.json",
        "real_asset_manifest_sha256": file_sha(ART / "asset_exploitation.v1.json"),
        "policy": "EXPLICIT_A1_VISUAL_RELOCK_NOT_NO_BLIND_REPIN_OF_A0",
    }
    provenance_path.write_text(json.dumps(provenance, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"ok": True, "baseline": BASE, "relocked": TIDS[0],
                      "before": payload_sha(old[TIDS[0]]), "after": payload_sha(docs[TIDS[0]]),
                      "real_asset_frames": len(lock["r13_real_asset_frames"])}, sort_keys=True))


if __name__ == "__main__":
    main()
