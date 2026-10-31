from __future__ import annotations

import hashlib
import json

import pytest

import compile_world_art as cwa
import validate_world_art as vwa


@pytest.fixture(scope="module")
def art():
    cwa.compile_all()
    return {
        "atlas": cwa.load(cwa.ART / "atlas.v1.json"),
        "grammar": cwa.load(cwa.ART / "world_art_grammar.v1.json"),
        "index": cwa.load(cwa.ART / "presentations.v1.json"),
        "contract": cwa.load(cwa.ART / "a8_visual_contract.v1.json"),
        "docs": {e["treatment_id"]: cwa.load(cwa.ROOT / e["path"]) for e in cwa.load(cwa.ART / "presentations.v1.json")["presentations"]},
    }


def test_atlas_is_unscaled_grid_aligned_and_provenance_rich(art):
    atlas = art["atlas"]
    assert atlas["tile_px"] == 16
    assert atlas["perspective"].startswith("top-down three-quarter")
    for sheet in ("terrain", "props"):
        p = cwa.ROOT / "assets/environment/survival_world" / f"{sheet}.png"
        assert hashlib.sha256(p.read_bytes()).hexdigest() == atlas["file_sha256"][sheet]
    for r in atlas["terrain"].values():
        assert r[2:] == [16, 16] and r[0] % 16 == 0 and r[1] % 16 == 0
    assert len(atlas["inherited_frames"]) == 9
    for meta in atlas["inherited_frames"].values():
        assert meta["license"] == "original" and meta["decision"] == "REUSE_UNSCALED"
    assert len(atlas["asset_frames"]) >= 30


def test_real_asset_source_rectangles_match_atlas_pixels_and_roles(art):
    from PIL import Image
    atlas = art["atlas"]
    manifest = cwa.load(cwa.ART / "asset_exploitation.v1.json")
    assert manifest["source_ref"] == atlas["asset_frames"][next(iter(atlas["asset_frames"]))]["source_ref"]
    assert len(manifest["frames"]) == len(atlas["asset_frames"]) >= 30
    assert manifest["unused_sources"] and manifest["catalog_rows_without_committed_pixel_paths_in_scanned_refs"]
    sheets = {kind: Image.open(cwa.ROOT / "assets/environment/survival_world" / f"{kind}.png").convert("RGBA")
              for kind in ("terrain", "props")}
    sources = {}
    for frame, row in manifest["frames"].items():
        assert row["scale"] == 1 and row["palette_or_perspective_rewrite"] is False
        source_path = cwa.ROOT / row["source"]
        assert hashlib.sha256(source_path.read_bytes()).hexdigest() == row["source_sha256"]
        if source_path not in sources:
            sources[source_path] = Image.open(source_path).convert("RGBA")
        x, y, w, h = row["source_rect"]
        source_crop = sources[source_path].crop((x, y, x + w, y + h))
        rect = atlas[row["kind"]][frame]
        assert rect == row["atlas_rect"]
        atlas_crop = sheets[row["kind"]].crop((rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]))
        def visible_bytes(image):
            return b"".join(bytes(pixel) if pixel[3] else b"\0\0\0\0" for pixel in image.get_flattened_data())
        assert visible_bytes(atlas_crop) == visible_bytes(source_crop), frame
        assert atlas_crop.getchannel("A").tobytes() == source_crop.getchannel("A").tobytes(), frame
        assert hashlib.sha256(source_crop.tobytes()).hexdigest() == row["source_raw_rgba_sha256"]
        assert hashlib.sha256(atlas_crop.tobytes()).hexdigest() == row["atlas_raw_rgba_sha256"]
        if row["kind"] == "terrain":
            assert row["source_rect"][2:] == [16, 16]
        else:
            assert frame in art["grammar"]["semantic_roles"][row["semantic_role"]]["frames"]


def test_every_legacy_atlas_frame_keeps_its_rect_and_visible_pixels(art):
    import io
    import subprocess
    from PIL import Image
    ref = "e1e4e9a4d4a0f7f0d38360d638715a0c9f144208"
    old_atlas = json.loads(subprocess.check_output(["git", "show", f"{ref}:data/survival/world/art/atlas.v1.json"]))
    for kind in ("terrain", "props"):
        old_sheet = Image.open(io.BytesIO(subprocess.check_output(
            ["git", "show", f"{ref}:assets/environment/survival_world/{kind}.png"]))).convert("RGBA")
        new_sheet = Image.open(cwa.ROOT / "assets/environment/survival_world" / f"{kind}.png").convert("RGBA")
        for frame, old_rect in old_atlas[kind].items():
            assert art["atlas"][kind][frame] == old_rect, f"legacy rect moved: {kind}/{frame}"
            x, y, w, h = old_rect
            old_crop = old_sheet.crop((x, y, x + w, y + h))
            new_crop = new_sheet.crop((x, y, x + w, y + h))
            def visible(image):
                return b"".join(bytes(pixel) if pixel[3] else b"\0\0\0\0" for pixel in image.get_flattened_data())
            assert visible(new_crop) == visible(old_crop), f"legacy visible pixels changed: {kind}/{frame}"


def test_continent_decor_is_deterministic_bounded_and_clear_of_authority(art):
    import compile_continent_art as cci
    path = cwa.ART / "continent_decor.v1.json"
    before = path.read_bytes()
    cci.compile_all()
    assert path.read_bytes() == before
    doc = json.loads(before)
    plan = cwa.load_plan()
    assert doc["schema"] == "soh.world.continent_decor.v1"
    assert set(doc["chunks"]) == {row["chunk_id"] for row in plan["chunk_manifest"]}
    assert len(doc["chunks"]) == 192 and doc["counts"]["curated_windows_preserved"] == 11
    assert doc["counts"]["nonempty_chunks"] < 192  # bounded clusters, not full-map random fill
    assert doc["counts"]["props"] == sum(len(rows) for rows in doc["chunks"].values())
    assert doc["counts"]["p0"]["p0_quarry_approach"] >= 10
    assert doc["counts"]["p0"]["p0_orchard_approach"] >= 10
    assert doc["counts"]["p0"]["p0_quarry_shell_transition"] >= 4
    assert doc["counts"]["p0"]["p0_orchard_shell_transition"] >= 4
    for pin in doc["pins"]["a8_shell_sources"].values():
        assert hashlib.sha256((cwa.ROOT / pin["path"]).read_bytes()).hexdigest() == pin["sha256"]
    assert "NOT_HAND_PAINTED" in doc["status"]
    spawn = cci._spawn_cells()
    resources = {tuple(row["cell"]) for row in plan["resource_nodes"]}
    route = cwa.load(cwa.WORLD / "corridor/first_hour_route.v1.json")
    route_cells = {tuple(row) for row in route["outbound_cells"] + route["return_cells"]}
    poi_clear = set()
    for poi in plan["pois"]:
        x, y = poi["cell"]
        radius = int(poi["footprint_radius_tiles"]) + 2
        poi_clear.update((xx, yy) for yy in range(y - radius, y + radius + 1)
                         for xx in range(x - radius, x + radius + 1))
    layers = cwa.Layers(plan)
    seen = set()
    for cid, rows in doc["chunks"].items():
        for row in rows:
            cell = tuple(row["cell"])
            assert cell not in seen and cell not in spawn and cell not in resources
            assert cell not in route_cells
            if cell in poi_clear:
                assert row["source"] in {"p0_quarry_shell_transition", "p0_orchard_shell_transition"}
                assert cell not in {(30, 280), (30, 283), (30, 289), (140, 360), (140, 363), (140, 369)}
                assert row["frame"] in {"cainos_stone_small", "cainos_stone_medium", "cainos_tuft_0",
                                        "cainos_tuft_1", "cainos_tuft_2", "cainos_tuft_3"}
            assert row["collision_change"] is False
            assert row["frame"] in art["atlas"]["asset_frames"]
            assert layers.value(list(cell), "road") == 0
            assert layers.value(list(cell), "hazard") == 0
            seen.add(cell)


def test_grammar_separates_supply_harvestable_waystation_scenery_danger(art):
    roles = art["grammar"]["semantic_roles"]
    assert "cache_closed" in roles["supply_cache"]["frames"]
    assert "cache_closed" not in roles["ordinary_harvestable"]["frames"]
    assert "lm_waystation" in roles["major_waystation"]["frames"]
    assert "lm_waystation" not in roles["background_scenery"]["frames"]
    assert "cairn_warning" in roles["physical_danger"]["frames"]
    for spec in roles.values():
        for frame in spec["frames"]:
            assert frame in art["atlas"]["props"]


def test_validator_and_all_region_presentations(art):
    result = vwa.validate()
    assert result["ok"], result["errors"]
    assert result["presentations"] == 11
    assert set(result["profiles"]) == {"ashen_crown", "amberwood", "frost_crown", "mirrormere", "glasswind_coast", "ember_steppe", "saffron_coast", "verdant_fold", "pearl_mangroves", "sunken_orchard", "ashwater_fen"}
    for doc in art["docs"].values():
        assert doc["production_native_playable"] is False
        assert doc["collision_change"] is False and doc["stand_change"] is False and doc["economy_change"] is False
        assert doc["new_poi_count"] == 0


def test_corridor_visual_preserves_canonical_instances_and_route(art):
    doc = art["docs"]["crown_roadside_visual_treatment"]
    corridor = cwa.load(cwa.WORLD / "corridor/crown_roadside.corridor.v1.json")
    assert doc["pins"]["corridor_sha256"] == hashlib.sha256((cwa.WORLD / "corridor/crown_roadside.corridor.v1.json").read_bytes()).hexdigest()
    required = {tuple(c) for c in corridor["route"]["required_nav_cells"]}
    caches = [p for p in doc["props"] if p["role"] == "supply_cache"]
    assert len(caches) == 3
    inst = {i["instance_id"]: i["cell"] for i in corridor["instances"]}
    for p in caches:
        assert inst[p["instance_id"]] == p["cell"]
    for p in doc["props"]:
        if p["role"] != "supply_cache":
            assert tuple(p["cell"]) not in required
    replaced = {p["replaces"] for p in doc["props"] if p["source"] == "corridor_decor"}
    assert len(replaced) >= 1
    assert sum(1 for p in doc["props"] if p["source"] == "corridor_decor") == len(corridor["decor"])


def test_biome_studies_are_genuinely_contrasting_and_canonical(art):
    amber = art["docs"]["amberwood_apothecary_herb_margin"]
    frost = art["docs"]["frost_crown_shrine_skarn"]
    assert amber["biome_profile"] == "amberwood" and frost["biome_profile"] == "frost_crown"
    ag = {f for row in amber["ground"]["rows"] for f in row}
    fg = {f for row in frost["ground"]["rows"] for f in row}
    assert len(ag & fg) / len(ag | fg) < 0.35
    ap = {p["frame"] for p in amber["props"]}
    fp = {p["frame"] for p in frost["props"]}
    assert "tree_amber" in ap and "herb_moonleaf" in ap
    assert "tree_frost" in fp and "ore_skarn" in fp
    assert not (ap & fp)
    plan = cwa.load_plan()
    nodes = {n["node_id"]: n for n in plan["resource_nodes"]}
    for doc in (amber, frost):
        for p in doc["props"]:
            if "node_id" in p:
                assert nodes[p["node_id"]]["cell"] == p["cell"]


def test_a8_visual_contract_is_executable_and_records_divergences(art):
    contract = art["contract"]
    req = contract["requirements"]
    assert req["tile_px"] == art["atlas"]["tile_px"]
    assert req["prop_scale"] == 1.0 and req["integer_scale_only"] is True
    assert req["per_site_palette_swaps_allowed"] is False
    ids = {d["id"] for d in contract["observed_divergences"]}
    assert {"A8-VIS-01", "A8-VIS-02", "A8-VIS-03", "A8-VIS-05"} <= ids
    assert contract["authority_boundary"].startswith("A1 supplies visual/spatial conformance data only")


def test_lighting_and_capture_views(art):
    for doc in art["docs"].values():
        assert doc["ambient_day"] != doc["ambient_night"]
        for view in doc["capture_views"]:
            c = view["center_cell"]
            o = doc["window"]["origin_cell"]
            s = doc["window"]["size_cells"]
            assert o[0] <= c[0] < o[0] + s[0] and o[1] <= c[1] < o[1] + s[1]
    crown = art["docs"]["crown_roadside_visual_treatment"]
    assert crown["lights"] and any(v["id"] == "waystation_night" for v in crown["capture_views"])
    fixture = (cwa.ROOT / "tests/survival/world/world_art_native_test.gd").read_text()
    for token in ("1280", "2560", "3840", "OverworldOcclusion", "zero collision bodies"):
        assert token in fixture


def test_compile_is_deterministic(art):
    before = {e["treatment_id"]: e["sha256"] for e in art["index"]["presentations"]}
    cwa.compile_all()
    after = {e["treatment_id"]: e["sha256"] for e in cwa.load(cwa.ART / "presentations.v1.json")["presentations"]}
    assert before == after


def test_causal_landforms_and_road_overlays(art):
    for doc in art["docs"].values():
        assert doc["terrain_method"] == "AUTHORED_LANDFORMS_ON_SOURCE_SURFACES_NO_NOISE_BOUNDARIES"
        assert doc["landforms"] and all(lf["reason"] and lf["cells"] > 0 for lf in doc["landforms"])
        assert doc["counts"]["road_overlays"] == doc["counts"]["road_cells"]
        assert not any(frame.startswith("road_") for row in doc["ground"]["rows"] for frame in row)
        for overlay in doc["overlays"]:
            assert overlay["layer"] in {"road", "bank", "boardwalk", "bridge", "causeway", "detail"}
            assert overlay["frame"] in art["atlas"]["terrain"]
    compiler = (cwa.ROOT / "tools/survival/worldgen/compile_world_art.py").read_text()
    assert "h01(x // 6" not in compiler and "h01(x // 5" not in compiler


def test_runtime_hardening_and_gold_light_isolation(art):
    runtime = (cwa.ROOT / "game/world_art/world_art_presentation.gd").read_text()
    for token in ("func bind_focus", "func _process", "occlusion.step(delta)", 'set_meta("frame_name"',
                  "WORLD_LIGHT_MASK", "_count_collisions", "return _fail", "func clear"):
        assert token in runtime
    assert '"collision_bodies": 0' not in runtime
    fixture = (cwa.ROOT / "tests/survival/world/world_art_native_test.gd").read_text()
    for token in ("bind_focus", "logical_sha256", "world_sparkle", "inherited VFX keeps default light mask",
                  "rebuild is idempotent", "invalid presentation rejected atomically"):
        assert token in fixture
    corridor_fixture = (cwa.ROOT / "tests/survival/world/corridor_native_test.gd").read_text()
    assert "--world-art" in corridor_fixture and "world-art overlay adds zero collision bodies" in corridor_fixture


def test_a8_shell_visuals_are_compact_shared_and_doorway_clear(art):
    shells = cwa.load(cwa.ART / "a8_shell_visuals.v1.json")
    assert shells["atlas_sha256"] == hashlib.sha256((cwa.ART / "atlas.v1.json").read_bytes()).hexdigest()
    assert {s["poi_id"] for s in shells["sites"]} == {"poi_crown_south_quarry", "poi_crown_south_orchard", "poi_crown_south_mill"}
    for site in shells["sites"]:
        assert site["bounds_px"] == [128, 128] and site["tile_px"] == 16
        assert site["collision_change"] is False and site["new_poi_count"] == 0
        assert len(site["ground_rows"]) == 8 and all(len(r) == 8 for r in site["ground_rows"])
        door = site["doorway_clear_rect_px"]
        for prop in site["props"]:
            assert prop["frame"] in art["atlas"]["props"]
            x, y = prop["local_px"]
            assert not (door[0] <= x < door[0] + door[2] and door[1] <= y < door[1] + door[3])
    assert "A8-VIS-07" in {d["id"] for d in art["contract"]["observed_divergences"]}
    assert art["contract"]["source_review"]["head_sha"] == "5ccf7b3f"


def test_art_compile_does_not_touch_navigation_chunks_or_ten_entrances(art):
    plan_path = cwa.WORLD / "world_plan.v1.json"
    lock_path = cwa.WORLD / "baseline_lock.json"
    plan = cwa.load(plan_path)
    lock = cwa.load(lock_path)
    protected = [plan_path, lock_path] + [cwa.WORLD / m["path"] for m in plan["chunk_manifest"]]
    before = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
    cwa.compile_all()
    after = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
    assert before == after
    assert len(lock["landmarks"]) == 10
    assert all(lm["reachable_closed_shortcuts"] for lm in lock["landmarks"])
    corridor = cwa.load(cwa.WORLD / "corridor/crown_roadside.corridor.v1.json")
    assert corridor["route"]["required_nav_cells"]
    for doc in art["docs"].values():
        assert doc["collision_change"] is False and doc["stand_change"] is False and doc["new_poi_count"] == 0


def test_notes_crate_distinct_from_scrap_cache(art):
    assert "cache_notes" in art["atlas"]["props"]
    assert "cache_notes" in art["grammar"]["semantic_roles"]["supply_cache"]["frames"]
    doc = art["docs"]["crown_roadside_visual_treatment"]
    by_inst = {p["instance_id"]: p["frame"] for p in doc["props"] if "instance_id" in p}
    assert by_inst["si:r_ashen_crown:roadside_supply:01"] == "cache_notes"
    assert by_inst["si:r_ashen_crown:roadside_supply:02"] == "cache_closed"
    assert by_inst["si:r_ashen_crown:roadside_supply:03"] == "cache_closed"
    assert cwa.FRAME_ROLE["cache_notes"] == "supply_cache"


def test_cardinal_shore_transitions_present(art):
    assert any(k.startswith("shore_") for k in art["atlas"]["terrain"])
    used = set()
    for doc in art["docs"].values():
        for row in doc["ground"]["rows"]:
            used.update(f for f in row if f.startswith("shore_"))
    assert used, "no cardinal shore transition used in any treatment"


def test_bind_focus_excludes_focus_subtree(art):
    runtime = (cwa.ROOT / "game/world_art/world_art_presentation.gd").read_text()
    assert "props_root.remove_child(focus)" in runtime
    assert "props_root.add_child(focus)" in runtime


def test_first_hour_route_walkability_proof(art):
    route = cwa.load(cwa.WORLD / "corridor/first_hour_route.v1.json")
    p = route["proof"]
    assert p["base_path_exists"] and p["outbound_contiguous"] and p["all_route_cells_walkable"]
    assert p["no_one_tile_trap"] and p["single_cell_cut_vertices"] == []
    assert p["ten_thresholds_preserved"] and p["body_clearance_margin_px"] >= 2
    assert route["notes_crate_instance"] == "si:r_ashen_crown:roadside_supply:01"
    assert route["waystation_cache_interaction_alias"] == "node_waystation_cache"
    assert {s["id"] for s in route["camera_landmark_states"]} == {"home_first", "explore_first", "return"}


def test_mount_bundle_consumer_validation(art):
    import validate_mount_bundle as vmb
    result = vmb.validate()
    assert result["ok"], result["errors"]
    assert result["treatments"] == 11


def test_avfx_lighting_contract_and_contrast_floor(art):
    contract = cwa.load(cwa.ART / "avfx_lighting_contract.v1.json")
    assert contract["world_light_cull_mask"] == 2 and contract["inherited_vfx_light_mask"] == 1
    assert contract["worst_case"]["contrast_ratio"] >= 1.6
    assert contract["measurements"] and any("Gold" in p or "gold" in p for p in contract["pending"])


def test_region_windows_are_distinct_canonical_and_water_safe(art):
    plan = cwa.load_plan()
    regions = {r["region_id"] for r in plan["regions"]}
    docs = [d for d in art["docs"].values() if d["treatment_id"].endswith("_region_window")]
    assert len(docs) == 8
    assert {d["region_id"] for d in docs} <= regions
    nodes = {n["node_id"]: n for n in plan["resource_nodes"]}
    pois = {p["poi_id"]: p for p in plan["pois"]}
    frame_sets = []
    for d in docs:
        assert d["kind"] == "biome_study"
        assert d["ground_rules"] if "ground_rules" in d else True
        for p in d["props"]:
            if "node_id" in p:
                assert nodes[p["node_id"]]["cell"] == p["cell"]
                assert nodes[p["node_id"]]["region_id"] == d["region_id"]
            if "poi_id" in p:
                assert pois[p["poi_id"]]["cell"] == p["cell"]
        # day and night views exist
        times = [v.get("time_of_day", 0.35) for v in d["capture_views"]]
        assert min(times) < 0.5 and max(times) > 0.7
        frame_sets.append({p["frame"] for p in d["props"]})
    # no two regional windows share the exact prop vocabulary
    for i in range(len(frame_sets)):
        for j in range(i + 1, len(frame_sets)):
            assert frame_sets[i] != frame_sets[j]


def test_r13_first_hour_relock_is_visual_only_and_preserves_bindings(art):
    import subprocess
    keys = ("ground", "overlays", "props", "lights", "capture_views", "ambient_day", "ambient_night")
    for tid in ("crown_roadside_visual_treatment", "amberwood_apothecary_herb_margin", "frost_crown_shrine_skarn"):
        path = f"data/survival/world/art/compiled/{tid}.presentation.v1.json"
        old = json.loads(subprocess.check_output(["git", "show", f"ad39bde6:{path}"]))
        new = art["docs"][tid]
        for key in keys:
            if tid == "crown_roadside_visual_treatment" and key == "props":
                continue
            assert old[key] == new[key], f"{tid} unapproved pixel payload drifted: {key}"
        def bindings(doc):
            return {(key, row[key]): (row["cell"], row["frame"], row["role"])
                    for row in doc["props"] for key in ("instance_id", "node_id", "poi_id") if key in row}
        assert bindings(old) == bindings(new)
    crown = art["docs"]["crown_roadside_visual_treatment"]
    assert sum(row["frame"].startswith(("cainos_", "ocean_")) for row in crown["props"]) >= 20
    assert crown["collision_change"] is False and crown["stand_change"] is False and crown["economy_change"] is False


def test_first_hour_visual_payloads_and_used_crops_are_explicitly_relocked(art):
    from PIL import Image
    lock = cwa.load(cwa.ART / "first_hour_visual_payload_lock.v1.json")
    assert lock["a0_historical_profile_changed"] is False
    assert lock["baseline_payload_hashes"]["crown_roadside_visual_treatment"] != lock["payload_hashes"]["crown_roadside_visual_treatment"]
    assert len(lock["r13_real_asset_frames"]) >= 15
    keys = ["ground", "overlays", "props", "lights", "capture_views", "ambient_day", "ambient_night"]
    for tid, expected in lock["payload_hashes"].items():
        doc = art["docs"][tid]
        payload = {k: doc[k] for k in keys}
        actual = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        assert actual == expected, f"first-hour payload changed: {tid}"
    atlas = art["atlas"]
    for kind in ("terrain", "props"):
        sheet = Image.open(cwa.ROOT / "assets/environment/survival_world" / f"{kind}.png").convert("RGBA")
        for frame, expected in lock["used_crop_hashes"][kind].items():
            r = atlas[kind][frame]
            crop = sheet.crop((r[0], r[1], r[0] + r[2], r[1] + r[3]))
            assert hashlib.sha256(crop.tobytes()).hexdigest() == expected, f"first-hour crop changed: {kind}/{frame}"


def test_a8_used_crops_do_not_require_wholesale_reimport(art):
    from PIL import Image
    lock = cwa.load(cwa.ART / "a8_used_crop_lock.v1.json")
    atlas = art["atlas"]
    for kind in ("terrain", "props"):
        sheet = Image.open(cwa.ROOT / "assets/environment/survival_world" / f"{kind}.png").convert("RGBA")
        assert len(lock["crops"][kind]) == lock["matched_frame_counts"][kind]
        for frame, expected in lock["crops"][kind].items():
            r = atlas[kind][frame]
            crop = sheet.crop((r[0], r[1], r[0] + r[2], r[1] + r[3]))
            assert hashlib.sha256(crop.tobytes()).hexdigest() == expected, f"A8 used crop changed: {kind}/{frame}"


def test_region_piers_are_narrow_and_water_is_not_visually_filled(art):
    plan = cwa.load_plan()
    layers = cwa.Layers(plan)
    for tid in ("pearl_mangroves_region_window", "ashwater_fen_region_window"):
        doc = art["docs"][tid]
        c = doc["counts"]
        assert c["pier_cells"] < c["road_cells"] * 0.20
        assert c["track_cells"] > c["road_cells"] * 0.50
        assert not any(o["frame"] in ("boardwalk_junction", "road_dirt_15") for o in doc["overlays"])
    water_tokens = {"lake", "river", "tidal", "cenote", "brine", "water", "ocean"}
    for doc in art["docs"].values():
        if not doc["treatment_id"].endswith("_region_window"):
            continue
        ox, oy = doc["window"]["origin_cell"]
        for y, row in enumerate(doc["ground"]["rows"]):
            for x, frame in enumerate(row):
                cell = [ox + x, oy + y]
                if layers.surface_name(cell) == "water" and layers.value(cell, "walk") == 0:
                    assert set(frame.split("_")) & water_tokens, (doc["treatment_id"], cell, frame)


def test_region_night_keeps_destination_and_hazard_cues(art):
    for doc in art["docs"].values():
        if not doc["treatment_id"].endswith("_region_window"):
            continue
        assert min(doc["ambient_night"][:3]) >= 0.30
        assert doc["counts"]["lights"] >= 5
        assert any(v.get("time_of_day", 0) > 0.6 for v in doc["capture_views"])
        assert any(p.get("poi_id") for p in doc["props"])


def test_ember_track_has_no_full_crosshatch_carpet(art):
    doc = art["docs"]["ember_steppe_region_window"]
    assert doc["counts"]["track_cells"] == doc["counts"]["road_cells"]
    assert not any(o["frame"].startswith("road_dirt_") for o in doc["overlays"])
    assert all(o["frame"].startswith("track_") for o in doc["overlays"] if o["layer"] == "road")
