# Veyra World Lab — independent QA

Verdicts: {"compiler_and_data":"TECHNICAL_PROVEN_LEGACY_COMPILER_AND_DATA_ONLY","visual":"LEGACY_TEN_SHOTS_REJECTED_BY_CREATOR","hero_scene":"SINGLE_PROVENANCE_BACKED_VISUAL_CANDIDATE_BUILT_SEE_QA_HERO_RESULTS_JSON","playability":"PLAYABILITY_UNPROVEN","gameplay_integration":"GAMEPLAY_INTEGRATION_BLOCKED","creator_visual_review":"NOT_READY_NO_APPROVAL_REQUESTED_FOR_WEAK_OR_REJECTED_ITERATIONS","native_godot":"NOT_CLAIMED_NO_GODOT_4_7_RUNTIME_OR_OWNER_COORDINATION"}

Summary: 10 pass / 0 fail / 10 tests

- **PASS** SOURCE_FINGERPRINT: {"gold_sha":"88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256","bible_sha":"ab02f994af371e7386e9403dff5cdb3673412cd99b0e250f13b2201077d1e8ac","contract_sha":"a16deb29f27ad33a7e1788d52aa5bd7e27d36c0c4ecdcee9a4b76ee990e688d1"}
- **PASS** GOLD_ID_ROUNDTRIP: {"gold_ids":579,"pois":81,"resources":280,"negative_wrong_id":"REJECTED"}
- **PASS** DETERMINISTIC_COMPILE_EXPORT_REIMPORT: {"compiler_base_hash":"31a96586c8f213f4779cafa256b4e2db653faaa4f0a3a641f58c2bb5badd67b2","export_reimport_hash":"52f547c48e9bbe2e45943d9d9ab4db24a9fe1156ea234dd405f8a84f68e619c4","creator_edit_roundtrip":"PASS","locked_regions":0}
- **PASS** ART_INTEGRITY_AND_FOOT_ANCHORS: {"sprites_checked":54,"external_foot_colliders":6,"blob47":47,"capture_missing_sprites":0}
- **PASS** REAL_TERRAIN_WATER_TRANSITIONS: {"material_counts":{"0":112311,"1":3314,"2":676,"3":4475,"4":17159,"5":10036,"6":3388,"7":1911,"8":2886,"9":2224,"10":6269,"11":1190,"12":518,"13":4747,"14":699,"15":597,"16":1867,"17":262,"18":351,"25":120},"land_water_seams":2996,"shore_water_cells":2624,"river_confluences":103,"river_mouths":25,"bridge_approaches":193}
- **PASS** COLLISION_SLIDING_AND_NEGATIVE_APPROACHES: {"tree_approaches":8,"one_tile_passage":"PASS","corner_assist":"PASS","door_open":"PASS","soft_decor_traversable":"PASS","dense_route_steps":126}
- **PASS** NAVIGATION_BRIDGES_RESOURCES_AND_NEGATIVE_PATHS: {"routes":{"po_greywater":13,"po_pumphouse":32,"po_sawaion":22,"po_academy":126,"po_archive":156,"po_observatory":155},"bridge_cells_on_academy_route":3,"paired_segments":4,"negative_water_goal":"REJECTED","early_survival_gaps":[]}
- **PASS** POI_EXTERIOR_INTERIOR_VERTICAL_RETREAT: {"levels":3,"nodes":17,"edges":19,"exterior_to_lens_paths":4,"retreat_paths":4,"alternate_return_after_shaft_removal":4}
- **PASS** RESOURCE_DISTRIBUTION_AND_GOLD_FIDELITY: {"proposals":280,"profiles":{"CRAFTPIX-3Q":1124,"SOH-PROTO-16":8177},"clustered_props":5251,"inaccessible":{"deep_water":112311,"cliff":2224,"lava":518},"shore_access_candidates":[{"source_id":"rs_b","gold_kind":"ore","tile":[122,74],"note":"GOLD coordinate preserved; shore-interaction candidate only"},{"source_id":"rs_y","gold_kind":"herbs","tile":[103,122],"note":"GOLD coordinate preserved; shore-interaction candidate only"},{"source_id":"rs_3r","gold_kind":"food","tile":[400,236],"note":"GOLD coordinate preserved; shore-interaction candidate only"}],"patch_base_materials_preserved":4}
- **PASS** PERFORMANCE_STREAMING_AND_BROWSER_EVIDENCE: {"node_capture_frames":10,"average_ms":24.7,"max_ms":54.9,"visible_tiles_average":1144,"drawables_average":65,"full_grid_cells":175000,"streaming":"visible-tile iteration only","browser_checks":10,"browser_status":"PASS"}

## Explicit boundaries

- Browser authoring tool is a review/authoring surface, not a second gameplay engine.
- No canonical HP, yields, recipe costs, regeneration, loot, gates or unlocks are defined.
- Tests passing does not imply visual acceptance or native playability.
- Godot 4.7 integration is blocked and unclaimed.
