"""Cross-check A0's whole-file pins against A1 payload/crop hash domains."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "data/survival/world/art"
MANIFEST = ART / "first_hour_asset_provenance.v1.json"
KEYS = ["ground", "overlays", "props", "lights", "capture_views", "ambient_day", "ambient_night"]


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@pytest.fixture(scope="module")
def provenance() -> dict:
    return json.loads(MANIFEST.read_text())


def test_hash_domains_are_explicit_and_discrepancy_is_closed(provenance: dict) -> None:
    d = provenance["discrepancy_resolution"]
    assert d["pixel_drift_found"] is False
    assert d["matched_crop_count"] == d["total_crop_count"] == 181
    assert d["moved_rect_count"] == 8
    assert "different hash domains" in d["cause"]
    assert provenance["a0_repin_policy"]["decision"] == "NO_BLIND_REPIN"


def test_current_whole_file_hashes_match_committed_bytes(provenance: dict) -> None:
    current = provenance["profiles"]["a1_current"]
    for path, row in current["files"].items():
        raw = (ROOT / path).read_bytes()
        assert len(raw) == row["bytes"]
        assert sha(raw) == row["sha256"]
    for row in current["treatments"].values():
        raw = (ROOT / row["path"]).read_bytes()
        assert sha(raw) == row["file_sha256"]


def test_payload_subset_hashes_match_both_lock_domains(provenance: dict) -> None:
    lock = json.loads((ART / "first_hour_visual_payload_lock.v1.json").read_text())
    for profile_name in ("a0_mounted_ad39bde6", "a1_current"):
        profile = provenance["profiles"][profile_name]
        for tid, row in profile["treatments"].items():
            doc = json.loads((ROOT / row["path"]).read_text()) if profile_name == "a1_current" else None
            if doc is not None:
                payload = {k: doc[k] for k in KEYS}
                digest = sha(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode())
                assert digest == row["payload_subset_sha256"]
            assert row["payload_subset_sha256"] == lock["payload_hashes"][tid]
            assert row["file_sha256"] != row["payload_subset_sha256"]


def test_all_first_hour_crops_match_legacy_raw_rgba(provenance: dict) -> None:
    atlas = json.loads((ART / "atlas.v1.json").read_text())
    sheets = {
        kind: Image.open(ROOT / "assets/environment/survival_world" / f"{kind}.png").convert("RGBA")
        for kind in ("terrain", "props")
    }
    seen = 0
    for row in provenance["crop_compatibility"]:
        kind, frame = row["kind"], row["frame"]
        rect = atlas[kind][frame]
        assert rect == row["current_rect"]
        crop = sheets[kind].crop((rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]))
        digest = sha(crop.tobytes())
        assert digest == row["raw_rgba_sha256"]
        assert row["raw_match"] is True
        seen += 1
    assert seen == 181


def test_cache_crop_ids_and_rects_are_preserved(provenance: dict) -> None:
    for frame, rect, digest in (
        ("cache_notes", [304, 2, 26, 24], "13d372fad04e3668c92cfe6c2fffb280e727f9db7a051bcb1856613e95dc25fd"),
        ("cache_closed", [220, 2, 26, 24], "45ca2814847c7dd92e58984196e937c4be3db102efeea6faae5985aef9fa47e4"),
    ):
        row = next(x for x in provenance["crop_compatibility"] if x["kind"] == "props" and x["frame"] == frame)
        assert row["legacy_rect"] == row["current_rect"] == rect
        assert row["raw_rgba_sha256"] == digest
