"""SURV-050A chunk/RLE/identity/seam negative tests (static data gate)."""
from __future__ import annotations

import copy
import hashlib
import json

import pytest

from build_contract import REQUIRED_LAYERS
from validate_world import OUT, decode_rle, validate, validate_chunk_document


@pytest.fixture(scope="module")
def chunk_5_3():
    return json.loads((OUT / "chunks/05_03.json").read_text())


@pytest.fixture(scope="module")
def manifest_5_3(plan):
    return next(m for m in plan["chunk_manifest"] if m["chunk_id"] == "chunk:5:3")


@pytest.mark.parametrize("rle,total", [
    ([[0, -1]], 4),
    ([[0, 0]], 4),
    ([[0, 5]], 4),
    ([[0, 3]], 4),
    ([[-1, 4]], 4),
    ([], 4),
    ([[0, 1, 2]], 4),
    ([[True, 4]], 4),
    ([[0, True]], 4),
    ([[0.5, 4]], 4),
])
def test_malformed_rle_rejected(rle, total):
    with pytest.raises(ValueError):
        decode_rle(rle, total)


def test_valid_rle_roundtrip():
    assert decode_rle([[0, 2], [1, 2]], 4) == [0, 0, 1, 1]


def test_adjacent_chunks_identity_hash_layers(plan, chunk_5_3, manifest_5_3):
    assert validate_chunk_document(chunk_5_3, plan, manifest_5_3) == []
    path = OUT / manifest_5_3["path"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == manifest_5_3["sha256"]
    right = json.loads((OUT / "chunks/06_03.json").read_text())
    mr = next(m for m in plan["chunk_manifest"] if m["chunk_id"] == "chunk:6:3")
    assert validate_chunk_document(right, plan, mr) == []
    assert chunk_5_3["origin"] == [320, 192] and right["origin"] == [384, 192]
    for layer in REQUIRED_LAYERS:
        assert layer in chunk_5_3["layers"] and layer in right["layers"]
        assert len(decode_rle(chunk_5_3["layers"][layer], 4096)) == 4096
        assert len(decode_rle(right["layers"][layer], 4096)) == 4096


def test_chunk_identity_bounds_path_and_missing_layer_fail(plan, chunk_5_3, manifest_5_3):
    bad = copy.deepcopy(chunk_5_3)
    bad["chunk_id"] = "chunk:99:99"
    assert "CHUNK_IDENTITY" in {e["code"] for e in validate_chunk_document(bad, plan, manifest_5_3)}
    bad = copy.deepcopy(chunk_5_3)
    bad["origin"] = [1, 0]
    assert {e["code"] for e in validate_chunk_document(bad, plan, manifest_5_3)} & {"CHUNK_ALIGN", "CHUNK_BOUNDS", "CHUNK_IDENTITY"}
    bad = copy.deepcopy(chunk_5_3)
    del bad["layers"]["build_permission"]
    assert "CHUNK_LAYER_MISSING" in {e["code"] for e in validate_chunk_document(bad, plan, manifest_5_3)}
    bad_manifest = dict(manifest_5_3, path="chunks/99_99.json")
    assert "CHUNK_PATH" in {e["code"] for e in validate_chunk_document(chunk_5_3, plan, bad_manifest)}


def test_unknown_layer_value_and_legacy_authority_fail(plan, chunk_5_3, manifest_5_3):
    bad = copy.deepcopy(chunk_5_3)
    bad["layers"]["walk"] = [[2, 4096]]
    assert "LAYER_VALUE" in {e["code"] for e in validate_chunk_document(bad, plan, manifest_5_3)}
    bad = copy.deepcopy(chunk_5_3)
    bad["layers"]["build_permission"] = [[0, 4096]]
    assert "LEGACY_BUILD_AUTHORITY" in {e["code"] for e in validate_chunk_document(bad, plan, manifest_5_3)}
    bad = copy.deepcopy(chunk_5_3)
    bad["layers"]["build_permission"] = [[3, 4096]]
    assert "LAYER_VALUE" in {e["code"] for e in validate_chunk_document(bad, plan, manifest_5_3)}


def test_missing_seam_connection_fails_closed(plan):
    p = copy.deepcopy(plan)
    p["legacy_seam_carves"][0]["carve"] = [1020, 760, 1023, 767]
    p["legacy_seam_carves"][0]["from"] = [1020, 760]
    p["legacy_seam_carves"][0]["to"] = [1023, 767]
    report = validate(p, check_files=False, check_chunks=True)
    assert not report["ok"]
    assert "SEAM_DISCONNECT" in {e["code"] for e in report["errors"]}


def test_all_chunks_preserve_legacy_build_delegation(plan):
    for m in plan["chunk_manifest"]:
        chunk = json.loads((OUT / m["path"]).read_text())
        errors = validate_chunk_document(chunk, plan, m)
        assert errors == [], (m["chunk_id"], errors)
