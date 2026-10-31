extends SceneTree
## SURV-050A isolated Godot 4.7 reader tests. Run with:
## godot --headless --path tests/survival/world/godot --script res://reader_test.gd -- --world-root=<repo>/data/survival/world
## This fixture never loads the production overworld, SaveService, or A0 build
## system. The A0 delegate is a contract stub; native paid-home integration is a
## separate A0 gate. The legal legacy cell is fixed by the Python baseline oracle.

const ReaderScript = preload("res://chunk_reader.gd")

var checks := 0
var failures: Array[String] = []
var delegate_calls := 0


func _world_root() -> String:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--world-root="):
			return arg.trim_prefix("--world-root=")
	var env := OS.get_environment("A1_WORLD_ROOT")
	if not env.is_empty():
		return env
	return ProjectSettings.globalize_path("res://../../../../data/survival/world")


func _expect(condition: bool, message: String) -> void:
	checks += 1
	if condition:
		print("  ok ", message)
	else:
		failures.append(message)
		print("  FAIL ", message)


func _product_json(root: String, rel: String) -> Dictionary:
	var path := root.path_join(rel)
	if not FileAccess.file_exists(path):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed is Dictionary:
		return parsed as Dictionary
	return {}


func _delegate_allow() -> Dictionary:
	delegate_calls += 1
	return {"ok": true, "reason": ""}


func _delegate_protected() -> Dictionary:
	delegate_calls += 1
	return {"ok": false, "reason": "protected_place"}


func _initialize() -> void:
	print("[a1-reader] configure")
	var reader := ReaderScript.new()
	var root := _world_root()
	_expect(reader.configure(root), "configure reads plan + manifest: " + reader.last_error)
	_expect(reader.manifest_by_id.size() == 192, "192 manifest chunks")
	_expect(reader.plan.get("layer_semantics", {}).get("build_permission", {}).get("legacy_inset_value", -1) == 2,
		"machine-readable legacy build_permission=2")

	print("[a1-reader] adjacent chunks / seams")
	var left := reader.load_chunk("chunk:5:3")
	var right := reader.load_chunk("chunk:6:3")
	_expect(bool(left.get("ok", false)), "load legacy-edge chunk:5:3")
	_expect(bool(right.get("ok", false)), "load adjacent new-land chunk:6:3")
	if bool(left.get("ok", false)) and bool(right.get("ok", false)):
		_expect(String(left["chunk"]["chunk_id"]) == "chunk:5:3", "left chunk identity")
		_expect(String(right["chunk"]["chunk_id"]) == "chunk:6:3", "right chunk identity")
		_expect(String(left["sha256"]) == String(reader.manifest_by_id["chunk:5:3"]["sha256"]), "left chunk hash")
		_expect(String(right["sha256"]) == String(reader.manifest_by_id["chunk:6:3"]["sha256"]), "right chunk hash")
		for layer: String in ReaderScript.REQUIRED_LAYERS:
			_expect((left["layers"] as Dictionary).has(layer), "left has required layer " + layer)
			_expect((right["layers"] as Dictionary).has(layer), "right has required layer " + layer)
			_expect((left["layers"][layer] as PackedInt32Array).size() == 4096, "left RLE length " + layer)
			_expect((right["layers"][layer] as PackedInt32Array).size() == 4096, "right RLE length " + layer)
	var seam_a := reader.cell_layers(Vector2i(383, 200))
	var seam_b := reader.cell_layers(Vector2i(384, 200))
	_expect(bool(seam_a.get("ok", false)) and bool(seam_b.get("ok", false)), "east seam cells resolve across chunks")
	if bool(seam_a.get("ok", false)) and bool(seam_b.get("ok", false)):
		_expect(int(seam_a["values"]["preserved"]) == 1 and int(seam_b["values"]["preserved"]) == 0,
			"east seam preserves legacy/new-land boundary")
		_expect(int(seam_a["values"]["walk"]) == 1 and int(seam_b["values"]["walk"]) == 1, "east seam walk continuity")
		_expect(int(seam_a["values"]["road"]) == 1 and int(seam_b["values"]["road"]) == 1, "east seam road continuity")
	for raw: Variant in reader.plan.get("legacy_seam_carves", []):
		var seam := raw as Dictionary
		var result := reader.check_seam(seam)
		_expect(bool(result.get("ok", false)), "authored seam connected: " + String(seam.get("id", "")))
	var bad_seam := reader.check_seam({"carve": [1020, 760, 1023, 767], "from": [1020, 760], "to": [1023, 767]})
	_expect(not bool(bad_seam.get("ok", false)), "missing/ocean seam fails closed")

	print("[a1-reader] legacy build delegation / home preservation")
	var legal := reader.resolve_cell(Vector2i(54, 222), [], Callable(self, "_delegate_allow"))
	_expect(bool(legal.get("ok", false)), "legal legacy cell resolves")
	if bool(legal.get("ok", false)):
		var values: Dictionary = legal["values"]
		var build: Dictionary = legal["build"]
		_expect(int(values["build"]) == 0, "legacy build hint remains 0")
		_expect(int(values["build_permission"]) == 2, "legacy build_permission delegates to A0")
		_expect(String(build["decision"]) == "allow", "A0 delegate allows legal legacy home cell")
		_expect(delegate_calls == 1, "A0 delegate was actually called")
		var naive_zero_would_deny := int(values["build"]) == 0
		_expect(naive_zero_would_deny and String(build["decision"]) == "allow",
			"negative regression: naive build=0 adapter would deny, reader delegates and allows")
	var missing := reader.resolve_cell(Vector2i(54, 222), [], Callable())
	_expect(bool(missing.get("ok", false)), "legacy cell without delegate still resolves layers")
	if bool(missing.get("ok", false)):
		_expect(String(missing["build"]["decision"]) == "error", "missing delegate is error, not silent deny")
		_expect(String(missing["build"]["reason"]) == "legacy_build_delegate_required", "missing delegate reason")
	var protected := reader.resolve_cell(Vector2i(56, 216), [], Callable(self, "_delegate_protected"))
	_expect(bool(protected.get("ok", false)) and String(protected["build"]["decision"]) == "deny"
		and String(protected["build"]["reason"]) == "protected_place", "A0 protected-place denial is honored")
	var occupied := reader.resolve_cell(Vector2i(54, 222), [], Callable(self, "_delegate_allow"), true)
	_expect(bool(occupied.get("ok", false)) and String(occupied["build"]["decision"]) == "deny"
		and String(occupied["build"]["reason"]) == "dynamic_child_occupancy", "dynamic child occupancy wins over static hint")

	print("[a1-reader] new-land candidates / overlays")
	var candidate := reader.resolve_cell(Vector2i(480, 240), [], Callable())
	_expect(bool(candidate.get("ok", false)) and String(candidate["build"]["decision"]) == "candidate_not_validated",
		"new candidate without A0 is not a paid placement")
	var candidate_ok := reader.resolve_cell(Vector2i(480, 240), [], Callable(self, "_delegate_allow"))
	_expect(bool(candidate_ok.get("ok", false)) and String(candidate_ok["build"]["decision"]) == "allow",
		"new candidate allowed only after A0 delegate")
	var road := reader.resolve_cell(Vector2i(400, 200), [], Callable(self, "_delegate_allow"))
	_expect(bool(road.get("ok", false)) and String(road["build"]["decision"]) == "deny"
		and String(road["build"]["reason"]) == "a1_no_build_candidate", "new road build_permission=0 denies candidate")
	var overlay := {"source_id": "test_repair", "revision": 1, "cell": [480, 240], "layer": "road", "value": 1, "expected_base": 0}
	var overlaid := reader.resolve_cell(Vector2i(480, 240), [overlay], Callable(self, "_delegate_allow"))
	_expect(bool(overlaid.get("ok", false)) and int(overlaid["values"]["road"]) == 1, "walk/road overlay applies")
	_expect(bool(overlaid.get("ok", false)) and int(overlaid["values"]["build_permission"]) == 1,
		"overlay cannot change build_permission")
	_expect(bool(overlaid.get("ok", false)) and String(overlaid["provenance"]["road"]).begins_with("overlay:"),
		"overlay provenance recorded")
	var legacy_overlay := reader.resolve_cell(Vector2i(54, 222),
		[{"source_id": "x", "revision": 1, "cell": [54, 222], "layer": "road", "value": 1, "expected_base": 0}],
		Callable(self, "_delegate_allow"))
	_expect(not bool(legacy_overlay.get("ok", false)) and String(legacy_overlay.get("error", "")) == "legacy_overlay_forbidden",
		"overlay cannot mutate preserved legacy cells")
	var immutable_overlay := reader.resolve_cell(Vector2i(480, 240),
		[{"source_id": "x", "revision": 1, "cell": [480, 240], "layer": "build_permission", "value": 1, "expected_base": 1}],
		Callable(self, "_delegate_allow"))
	_expect(not bool(immutable_overlay.get("ok", false)) and String(immutable_overlay.get("error", "")) == "immutable_overlay_layer",
		"overlay cannot target immutable build_permission")
	var stale_overlay := reader.resolve_cell(Vector2i(480, 240),
		[{"source_id": "x", "revision": 1, "cell": [480, 240], "layer": "road", "value": 1, "expected_base": 1}],
		Callable(self, "_delegate_allow"))
	_expect(not bool(stale_overlay.get("ok", false)) and String(stale_overlay.get("error", "")) == "stale_overlay_base",
		"stale overlay base fails closed")

	print("[a1-reader] malformed RLE / identity / bounds")
	_expect(not bool(ReaderScript.decode_rle([[0, -1]], 4).get("ok", false)), "negative RLE count rejected")
	_expect(not bool(ReaderScript.decode_rle([[0, 5]], 4).get("ok", false)), "overlength RLE rejected")
	_expect(not bool(ReaderScript.decode_rle([[0, 3]], 4).get("ok", false)), "underlength RLE rejected")
	_expect(not bool(ReaderScript.decode_rle([[-1, 4]], 4).get("ok", false)), "negative RLE value rejected")
	_expect(not bool(ReaderScript.decode_rle([[0, 0]], 4).get("ok", false)), "zero RLE count rejected")
	_expect(not bool(ReaderScript.decode_rle([], 4).get("ok", false)), "empty RLE rejected")
	_expect(bool(ReaderScript.decode_rle([[0, 2], [1, 2]], 4).get("ok", false)), "valid RLE decodes")
	if bool(left.get("ok", false)):
		var manifest: Dictionary = reader.manifest_by_id["chunk:5:3"]
		var bad_value: Dictionary = (left["chunk"] as Dictionary).duplicate(true)
		bad_value["layers"]["walk"] = [[2, 4096]]
		_expect(reader.validate_chunk_document(bad_value, manifest).any(func(e: String) -> bool: return e.begins_with("LAYER_VALUE")),
			"unknown walk value rejected")
		var missing_layer: Dictionary = (left["chunk"] as Dictionary).duplicate(true)
		missing_layer["layers"].erase("build_permission")
		_expect(reader.validate_chunk_document(missing_layer, manifest).any(func(e: String) -> bool: return e.begins_with("CHUNK_LAYER_MISSING")),
			"missing required layer rejected")
		var bad_id: Dictionary = (left["chunk"] as Dictionary).duplicate(true)
		bad_id["chunk_id"] = "chunk:99:99"
		_expect(reader.validate_chunk_document(bad_id, manifest).has("CHUNK_IDENTITY"), "chunk identity mismatch rejected")
		var bad_bounds: Dictionary = (left["chunk"] as Dictionary).duplicate(true)
		bad_bounds["origin"] = [1, 0]
		_expect(not reader.validate_chunk_document(bad_bounds, manifest).is_empty(), "unaligned/out-of-bounds chunk rejected")
		var bad_legacy: Dictionary = (left["chunk"] as Dictionary).duplicate(true)
		bad_legacy["layers"]["build_permission"] = [[0, 4096]]
		_expect(reader.validate_chunk_document(bad_legacy, manifest).has("LEGACY_BUILD_AUTHORITY"),
			"legacy build_permission=0 rejected; delegation is mandatory")
		var tmp_dir := ProjectSettings.globalize_path("user://a1_reader_tmp")
		DirAccess.make_dir_recursive_absolute(tmp_dir)
		var tmp_path := tmp_dir.path_join("mutated.json")
		var file := FileAccess.open(tmp_path, FileAccess.WRITE)
		if file != null:
			file.store_string("{\"mutated\":true}")
			file.close()
		var hash_result := reader.load_chunk_file(tmp_path, manifest)
		_expect(not bool(hash_result.get("ok", false)) and String(hash_result.get("error", "")) == "CHUNK_HASH",
			"chunk hash mismatch rejected")
		DirAccess.remove_absolute(tmp_path)
		DirAccess.remove_absolute(tmp_dir)

	print("[a1-reader] product-correction contracts")
	var hazard_damage := _product_json(root, "hazard_damage_contract.json")
	_expect(String(hazard_damage.get("schema", "")) == "soh.world.hazard_damage.v1", "hazard damage contract readable")
	_expect(bool(hazard_damage.get("native_playable", true)) == false, "hazard damage contract is not native playable")
	_expect(int(hazard_damage.get("novice_safe_route", {}).get("max_authored_hazard_tiles", -1)) == 0, "native-readable safe route has zero authored hazard tiles")
	var bootstrap := _product_json(root, "novice_bootstrap_contract.json")
	_expect(String(bootstrap.get("schema", "")) == "soh.world.novice_bootstrap.v1", "novice bootstrap contract readable")
	_expect((bootstrap.get("stages", []) as Array).size() == 3, "novice bootstrap has salvage/power/filter stages")
	var decisions := _product_json(root, "a1_a3_material_decisions.json")
	_expect(String(decisions.get("schema", "")) == "soh.world.a1_a3_material_decisions.v1", "material decision contract readable")
	_expect(int(decisions.get("counts", {}).get("alias_decisions", 0)) == 8, "eight explicit A3 alias decisions")
	_expect(int(decisions.get("counts", {}).get("missing_items", 0)) == 12, "twelve explicit missing A3 items")
	_expect(bool(decisions.get("a3_code_changed_by_a1", true)) == false, "A1 did not change A3 catalog code")
	var waystation := _product_json(root, "poi_authoring/poi_crown_waystation.v1.json")
	var relay := _product_json(root, "poi_authoring/poi_crown_relay_shed.v1.json")
	_expect(String(waystation.get("poi_id", "")) == "poi_crown_waystation", "waystation authoring spec readable")
	_expect(String(relay.get("poi_id", "")) == "poi_crown_relay_shed", "relay authoring spec readable")
	_expect(int(waystation.get("footprint_radius_tiles", 0)) != int(relay.get("footprint_radius_tiles", 0)), "early exemplar footprints are distinct")
	_expect((waystation.get("interface_requirements", []) as Array).size() >= 3 and (relay.get("interface_requirements", []) as Array).size() >= 3, "exemplars publish A0/A3/A6 interface requirements")
	var readiness: Dictionary = reader.plan.get("metrics", {}).get("content_readiness_counts", {})
	_expect(int(readiness.get("INTERACTION_SPEC_AUTHORED_NOT_NATIVE", 0)) == 2, "only two POIs claim authored interaction specs")
	_expect(int(readiness.get("WORLD_SITE_CONTRACT_ONLY", 0)) == 106, "106 POIs remain truthful site-contract-only")

	_finish()


func _finish() -> void:
	if failures.is_empty() and checks >= 50:
		print("SURVIVAL WORLD READER PASSED - %d checks" % checks)
		quit(0)
	else:
		print("SURVIVAL WORLD READER FAILED - %d/%d checks; anti-vacuity minimum 50" % [failures.size(), checks])
		for failure: String in failures:
			print("  failed: ", failure)
		quit(1)
