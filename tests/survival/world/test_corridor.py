from __future__ import annotations

import copy
import json

import pytest

import compile_corridor as cc
import validate_corridor as vc


@pytest.fixture(scope="module")
def compiled():
    cc.compile_all()
    return (cc.load(cc.OUT / "crown_roadside.corridor.v1.json"),
            cc.load(cc.OUT / "a8_site_transforms.v1.json"))


def test_compile_counts_and_scope(compiled):
    corridor, a8 = compiled
    assert corridor["counts"] == {"source_classes": 2, "physical_instances": 4, "roadside_instances": 3,
                                  "poi_objects": 1, "new_pois": 0, "required_nav_cells": 77,
                                  "detail_cells": 36, "decor_props": 8}
    assert corridor["production_native_playable"] is False
    assert a8["production_mounted"] is False
    assert vc.validate_corridor(corridor) == []
    assert vc.validate_a8(a8) == []


def test_identity_chain_class_region_instance_poi(compiled):
    corridor, _ = compiled
    classes = {c["source_class_id"]: c for c in corridor["source_classes"]}
    roadside = [i for i in corridor["instances"] if i["source_class_id"] == "sc_roadside_supply_cache_v1"]
    assert len(roadside) == 3
    assert len({i["instance_id"] for i in roadside}) == 3
    for inst in corridor["instances"]:
        assert inst["region_id"] == "r_ashen_crown"
        assert inst["source_class_id"] in classes
        assert classes[inst["source_class_id"]]["is_poi"] is False
        if inst["poi_binding"]["kind"] == "non_poi_roadside_instance":
            assert inst["poi_binding"]["canonical_poi_id"] is None
        else:
            assert inst["poi_binding"]["canonical_poi_id"] == "poi_crown_waystation"
            assert inst["poi_binding"]["action_id"] == "cache_restock"


def test_existing_resource_nodes_preserved(compiled):
    corridor, _ = compiled
    plan = cc.load_plan()
    nodes = {n["node_id"]: n for n in plan["resource_nodes"]}
    for inst in corridor["instances"]:
        if inst["resource_node_id"]:
            assert inst["cell"] == nodes[inst["resource_node_id"]]["cell"]
    for nid in corridor["deferred_resource_nodes"]:
        assert nid in nodes
    assert len([p for p in plan["pois"] if not p.get("preserved_legacy")]) == 108


def test_route_is_walkable_returnable_and_avoids_bodies(compiled):
    corridor, _ = compiled
    route = corridor["route"]
    assert route["outbound_cells"][0] == [392, 200]
    assert route["return_cells"][-1] == [392, 200]
    bodies = {tuple(c) for c in route["container_body_cells"]}
    assert not (bodies & {tuple(c) for c in route["required_nav_cells"]})
    chunk = cc.load(cc.WORLD / "chunks/06_03.json")
    for c in route["required_nav_cells"]:
        assert cc.local_value(chunk, "walk", c) == 1
        assert cc.local_value(chunk, "hazard", c) == 0


def test_container_stand_clearance_and_adverse_full_tile(compiled):
    corridor, _ = compiled
    for inst in corridor["instances"]:
        if inst["poi_binding"]["kind"] != "non_poi_roadside_instance":
            continue
        col = inst["collision"]
        repaired = cc.obstacle_box(inst["cell"], col["size_px"], col["offset_px"])
        adverse = cc.obstacle_box(inst["cell"], [16, 16], [0, 0])
        hero = cc.hero_box_at(inst["stand_cell"])
        assert not cc.overlaps(hero, repaired)
        assert cc.overlaps(hero, adverse)
        assert inst["stand_to_node_px"] <= inst["interaction_radius_px"]


def test_a1_does_not_author_roadside_economy(compiled):
    corridor, _ = compiled
    for inst in corridor["instances"]:
        if inst["poi_binding"]["kind"] == "non_poi_roadside_instance":
            econ = inst["economy_binding"]
            assert econ["status"] == "PENDING_A3_INSTANCE_BINDING"
            assert econ["reward_items"] is None
            assert econ["replenishment_seconds"] is None
            assert econ["yield_per_claim"] is None
            assert not (vc.FORBIDDEN_ECONOMY_KEYS & set(inst))


def test_art_is_inherited_original_soh(compiled):
    corridor, _ = compiled
    meta = cc.load(cc.ROOT / "data/overworld/overworld_props.json")["frames"]
    art = cc.load(cc.ROOT / "data/overworld/art_manifest.json")["sheets"]["props"]["index"]
    for inst in corridor["instances"]:
        assert inst["visual_frame"] in meta
        assert art[inst["visual_frame"]]["license"] == "original"
    for d in corridor["decor"]:
        assert d["frame"] in meta
        assert d["license"] == "original"


def test_a8_transform_is_exact_and_rejects_oversized_direct_mount(compiled):
    _, a8 = compiled
    assert len(a8["sites"]) == 3
    for site in a8["sites"]:
        anchor = [site["canonical_cell"][0] * 16 + 8, site["canonical_cell"][1] * 16 + 8]
        root = [anchor[0] - site["local_action_socket"][0], anchor[1] - site["local_action_socket"][1]]
        assert site["canonical_anchor_px"] == anchor
        assert site["transform"]["site_root_position_px"] == root
        assert site["fits_authored_footprint_1_to_1"] is False
        assert site["direct_overworld_mount_decision"] == "REJECT_FOOTPRINT_MISMATCH"
        assert site["capability_review"] == "MATCH"
        assert site["inside_current_connector_annex"] is False


def mutate(corridor, fn):
    doc = copy.deepcopy(corridor)
    fn(doc)
    return vc.validate_corridor(doc)


def test_negative_duplicate_instance(compiled):
    corridor, _ = compiled
    def f(d): d["instances"][1]["instance_id"] = d["instances"][0]["instance_id"]
    assert any("duplicate physical instance" in e for e in mutate(corridor, f))


def test_negative_class_as_poi(compiled):
    corridor, _ = compiled
    def f(d): d["source_classes"][0]["is_poi"] = True
    assert any("source class marked as POI" in e for e in mutate(corridor, f))


def test_negative_moved_container(compiled):
    corridor, _ = compiled
    def f(d): d["instances"][0]["cell"] = [396, 219]
    assert any("resource node cell drift" in e for e in mutate(corridor, f))


def test_negative_stand_inside_container(compiled):
    corridor, _ = compiled
    def f(d): d["instances"][0]["stand_cell"] = d["instances"][0]["cell"]
    errors = mutate(corridor, f)
    assert any("live-shape stand overlap" in e or "required nav cells drift" in e for e in errors)


def test_negative_drop_rate(compiled):
    corridor, _ = compiled
    def f(d): d["instances"][0]["economy_binding"]["replenishment_seconds"] = 1800
    assert any("A1 authored economy field" in e for e in mutate(corridor, f))


def test_negative_unknown_art(compiled):
    corridor, _ = compiled
    def f(d): d["instances"][0]["visual_frame"] = "generic_colored_box"
    assert any("unknown visual frame" in e for e in mutate(corridor, f))


def test_negative_decor_blocks_route(compiled):
    corridor, _ = compiled
    def f(d):
        for decor in d["decor"]:
            if decor["frame"] == "cart":
                decor["cell"] = [392, 205]
    assert any("decor blocks route" in e for e in mutate(corridor, f))


def test_negative_a8_transform_drift(compiled):
    _, a8 = compiled
    doc = copy.deepcopy(a8)
    doc["sites"][0]["transform"]["site_root_position_px"][0] += 1
    assert any("root transform drift" in e for e in vc.validate_a8(doc))


def test_determinism(compiled):
    first = cc.sha(cc.OUT / "crown_roadside.corridor.v1.json")
    second = cc.sha(cc.OUT / "a8_site_transforms.v1.json")
    cc.compile_all()
    assert cc.sha(cc.OUT / "crown_roadside.corridor.v1.json") == first
    assert cc.sha(cc.OUT / "a8_site_transforms.v1.json") == second
