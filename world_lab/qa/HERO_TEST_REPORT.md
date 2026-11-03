# Argus Great Lens — single hero scene QA

Verdicts: {"hero_scene":"SINGLE_PROVENANCE_BACKED_VISUAL_CANDIDATE_BUILT","donor_proof":"EXACT_SHA_RECT_FRAME_VERIFIED","creator_visual_review":"NOT_REQUESTED_NO_WEAK_ITERATION_APPROVAL","playability":"PLAYABILITY_UNPROVEN","gameplay_integration":"GAMEPLAY_INTEGRATION_BLOCKED","native_godot":"NOT_CLAIMED_NO_GODOT_4_7_SCENE_OR_IMPORT"}

Summary: 12 pass / 0 fail / 12 tests

- **PASS** EXACT_SOURCE_SHA_RECT_FRAME_LEDGER: {"sources":8,"frames":154,"crops":155,"normalized":154,"duplicate_keys":0}
- **PASS** DERIVED_HERO_NEVER_REAL_ASSET_PROOF: {"hero_entries":1,"downsample":8,"notice":true}
- **PASS** TRACKED_SCENE_GRAPH_16PX_GRID: {"rows":23,"cols":40,"tile_placements":920,"mosaic_cells":106,"objects":21,"distinct_kit_ids":149}
- **PASS** REAL_CROP_TILEABLE_TRIM_MAJORITY: {"real_entries":155,"tileable_trim":139,"fraction":0.8968,"tile_placements":920,"mosaic_placements":106,"prop_placements":21}
- **PASS** Y_DEPTH_SORTING_AND_FOCAL_HIERARCHY: {"objects":21,"hero_foot_y":260,"max_foot_y":360}
- **PASS** CONSERVATIVE_CONTACT_SHADOWS: {"max_drop_px":12,"alpha_cap":110,"shadow_objects":16}
- **PASS** SHARED_LIMITED_HUE_SHIFTED_PALETTE: {"palette_size":36,"used_colours":26,"off_palette_pixels":0,"transparent_pixels":0}
- **PASS** NATIVE_640X360_1X_DETERMINISTIC_RENDER: {"sha256":"6b91db3a318650b2a5a1063e4d2063c2c6dd88c9d1b84ca8bd3cb2714f92b40c","dimensions":[640,360],"scale":1,"deterministic":true}
- **PASS** COOL_AMBIENT_PLUS_WARM_LOCAL_LIGHT: {"warm_emitters":4,"cool_emitters":3,"warm_pixels":13633,"cool_pixels":25216}
- **PASS** LEADING_LINES_HARD_EDGES_FUNCTIONAL_SPACES: {"leading_lines":true,"tile_frames_16px":139,"functional_spaces":5}
- **PASS** HONEST_VERDICTS_AND_NO_STALE_APPROVAL: {"visual_candidate":"SINGLE_PROVENANCE_BACKED_SCENE_BUILT","creator_visual_review":"NOT_REQUESTED_NO_WEAK_ITERATION_APPROVAL","playability":"PLAYABILITY_UNPROVEN","gameplay_integration":"GAMEPLAY_INTEGRATION_BLOCKED","native_godot":"NOT_CLAIMED_NO_GODOT_4_7_SCENE_OR_IMPORT","legacy_qa_visual":"LEGACY_TEN_SHOTS_REJECTED_BY_CREATOR"}
- **PASS** LEGACY_TEN_SHOTS_STILL_REJECTED: {"old_shots":10,"new_scene":"argus_great_lens_hero_v1","old_shots_status":"REJECTED_BY_CREATOR"}

## Boundaries

- The PNG is a Node/PNG native 640x360 1x presentation render, not a Godot 4.7 capture.
- No owner A0/A1/A3/A8/Gameplay semantics, no collision export, no player input, no POI interaction.
- No C01-C24 same-SHA proof, no 336h E2, no independent playability test, no creator acceptance.
- The hero prop is AI-derived and explicitly labelled AI_DERIVED_HERO_PROP_NOT_REAL_ASSET; it is never real-asset proof.
- License coverage is partial; see ASSET_LICENSES.md / THIRD_PARTY.md.

- Old 10-shot set remains REJECTED; `paired` Greywater→Argus is a traversal-route thesis only.
