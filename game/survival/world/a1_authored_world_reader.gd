extends RefCounted
## A1 Round 12 deterministic, read-only Godot 4.7 continent reader.
##
## Compatible with the original SURV-050A reader calls used by A0's adapter.
## The production-path reader additionally verifies every dependency and all
## 192 chunks, exposes stable named identities/traversal/spawn/A8 transforms,
## and never manufactures cells outside the authored 1024x768 frame.
## A0 owns production mounting, construction, player state and SaveService.

const REQUIRED_LAYERS := [
	"region", "biome", "surface", "walk", "build", "build_permission",
	"hazard", "road", "preserved", "elevation_band",
]
const BINARY_LAYERS := ["walk", "build", "road", "preserved"]
const MUTABLE_OVERLAY_LAYERS := ["walk", "road"]
const CHUNK_SCHEMA := "soh.world.chunk.v1"
const PLAN_SCHEMA := "soh.world.masterplan.v1"
const RUNTIME_SCHEMA := "soh.world.a1_round12_runtime.v1"
const SPAWN_SCHEMA := "soh.world.a1_round12_spawn_index.v1"
const DEFAULT_WORLD_ROOT := "res://data/survival/world"

var root_path := ""
var plan: Dictionary = {}
var reader_contract: Dictionary = {}
var runtime_contract: Dictionary = {}
var spawn_index: Dictionary = {}
var manifest_by_id: Dictionary = {}
var cache: Dictionary = {}
var last_error := ""
var configure_ms := 0.0
var dependency_hashes: Dictionary = {}
var _spawn_chunks: Array = []
var _spawn_by_chunk: Dictionary = {}
var _pois_by_id: Dictionary = {}
var _pois_by_chunk: Dictionary = {}
var _resources_by_id: Dictionary = {}
var _resources_by_chunk: Dictionary = {}
var _roadside_by_chunk: Dictionary = {}
var _physical_sites: Dictionary = {}
var _physical_by_poi: Dictionary = {}


func configure(world_root: String = DEFAULT_WORLD_ROOT) -> bool:
	var started := Time.get_ticks_usec()
	root_path = world_root
	cache.clear()
	manifest_by_id.clear()
	dependency_hashes.clear()
	_spawn_chunks.clear()
	_spawn_by_chunk.clear()
	_pois_by_id.clear()
	_pois_by_chunk.clear()
	_resources_by_id.clear()
	_resources_by_chunk.clear()
	_roadside_by_chunk.clear()
	_physical_sites.clear()
	_physical_by_poi.clear()
	plan = {}
	runtime_contract = {}
	spawn_index = {}
	last_error = ""
	var plan_path := root_path.path_join("world_plan.v1.json")
	if not FileAccess.file_exists(plan_path):
		last_error = "plan_missing"
		return false
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(plan_path))
	if not parsed is Dictionary:
		last_error = "plan_json"
		return false
	plan = parsed as Dictionary
	if String(plan.get("schema", "")) != PLAN_SCHEMA:
		last_error = "plan_schema"
		return false
	var frame: Dictionary = plan.get("frame", {})
	var w := int(frame.get("w", 0))
	var h := int(frame.get("h", 0))
	var chunk_size := int(plan.get("chunk_size", 0))
	if w <= 0 or h <= 0 or chunk_size <= 0:
		last_error = "plan_frame"
		return false
	var semantics: Dictionary = plan.get("layer_semantics", {})
	var bp: Dictionary = semantics.get("build_permission", {})
	if int(bp.get("legacy_inset_value", -1)) != 2:
		last_error = "legacy_build_semantics"
		return false
	var contract_path := root_path.path_join("reader_contract.json")
	if FileAccess.file_exists(contract_path):
		var cp: Variant = JSON.parse_string(FileAccess.get_file_as_string(contract_path))
		if cp is Dictionary:
			reader_contract = cp as Dictionary
	var manifest: Array = plan.get("chunk_manifest", [])
	var cols := int(ceil(float(w) / float(chunk_size)))
	var rows := int(ceil(float(h) / float(chunk_size)))
	if manifest.size() != cols * rows:
		last_error = "manifest_count"
		return false
	var covered := PackedByteArray()
	covered.resize(cols * rows)
	for raw: Variant in manifest:
		if not raw is Dictionary:
			last_error = "manifest_entry"
			return false
		var m := raw as Dictionary
		var origin: Array = m.get("origin", [])
		var dims: Array = m.get("size", [])
		if origin.size() != 2 or dims.size() != 2:
			last_error = "manifest_bounds"
			return false
		var ox := int(origin[0])
		var oy := int(origin[1])
		var cw := int(dims[0])
		var ch := int(dims[1])
		if ox % chunk_size != 0 or oy % chunk_size != 0:
			last_error = "manifest_align"
			return false
		var cx := ox / chunk_size
		var cy := oy / chunk_size
		var expected_id := "chunk:%d:%d" % [cx, cy]
		var expected_path := "chunks/%02d_%02d.json" % [cx, cy]
		if String(m.get("chunk_id", "")) != expected_id or String(m.get("path", "")) != expected_path:
			last_error = "manifest_identity"
			return false
		if ox < 0 or oy < 0 or cw <= 0 or ch <= 0 or cw > chunk_size or ch > chunk_size or ox + cw > w or oy + ch > h:
			last_error = "manifest_bounds"
			return false
		if manifest_by_id.has(expected_id):
			last_error = "manifest_duplicate"
			return false
		var slot := cy * cols + cx
		if covered[slot] != 0:
			last_error = "manifest_overlap"
			return false
		covered[slot] = 1
		manifest_by_id[expected_id] = m
	for value: int in covered:
		if value == 0:
			last_error = "manifest_gap"
			return false
	if not _configure_runtime():
		return false
	for raw: Variant in plan.get("chunk_manifest", []):
		var chunk_id := String((raw as Dictionary).get("chunk_id", ""))
		var loaded := load_chunk(chunk_id)
		if not bool(loaded.get("ok", false)):
			last_error = "source_" + String(loaded.get("error", "chunk_unknown")).to_lower()
			return false
	configure_ms = float(Time.get_ticks_usec() - started) / 1000.0
	return true


static func _int_array_equals(value: Variant, expected: Array) -> bool:
	if not value is Array or (value as Array).size() != expected.size():
		return false
	for index: int in range(expected.size()):
		if int((value as Array)[index]) != int(expected[index]):
			return false
	return true


func _json_object(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed as Dictionary if parsed is Dictionary else {}


func _configure_runtime() -> bool:
	var contract_path := root_path.path_join("a1_round12_runtime_contract.v1.json")
	runtime_contract = _json_object(contract_path)
	if runtime_contract.is_empty() or String(runtime_contract.get("schema", "")) != RUNTIME_SCHEMA:
		last_error = "runtime_contract_schema"
		return false
	var api: Dictionary = runtime_contract.get("reader_api", {})
	var expected_frame: Array = api.get("frame", [])
	var frame: Dictionary = plan.get("frame", {})
	if expected_frame.size() != 2 or int(expected_frame[0]) != 1024 or int(expected_frame[1]) != 768 \
			or int(frame.get("w", 0)) != 1024 or int(frame.get("h", 0)) != 768:
		last_error = "runtime_frame"
		return false
	var pins: Dictionary = runtime_contract.get("source_pins", {})
	var plan_pin: Dictionary = pins.get("world_plan", {})
	var plan_path := root_path.path_join("world_plan.v1.json")
	if FileAccess.get_sha256(plan_path) != String(plan_pin.get("sha256", "")):
		last_error = "runtime_plan_hash"
		return false
	for key: String in pins:
		var raw: Variant = pins[key]
		if not raw is Dictionary:
			continue
		var pin := raw as Dictionary
		if not pin.has("path") or not pin.has("sha256"):
			continue
		var relative := String(pin.path)
		var path := relative if relative.begins_with("res://") else "res://" + relative
		if not FileAccess.file_exists(path):
			last_error = "dependency_missing:" + key
			return false
		var actual := FileAccess.get_sha256(path)
		if actual != String(pin.sha256):
			last_error = "dependency_hash:" + key
			return false
		dependency_hashes[key] = actual
	dependency_hashes["world_plan"] = FileAccess.get_sha256(plan_path)
	dependency_hashes["runtime_contract"] = FileAccess.get_sha256(contract_path)
	var spawn_path := root_path.path_join(String(api.get("spawn_index", "a1_round12_spawn_index.v1.json")))
	spawn_index = _json_object(spawn_path)
	if spawn_index.is_empty() or String(spawn_index.get("schema", "")) != SPAWN_SCHEMA:
		last_error = "spawn_index_schema"
		return false
	if String(spawn_index.get("world_plan_sha256", "")) != dependency_hashes.world_plan \
			or String(spawn_index.get("runtime_contract_sha256", "")) != dependency_hashes.runtime_contract:
		last_error = "spawn_index_stale"
		return false
	_spawn_chunks = spawn_index.get("chunks", [])
	if _spawn_chunks.size() < 18 or int(spawn_index.get("candidate_cells", 0)) < 20000:
		last_error = "spawn_index_not_broad"
		return false
	var total := 0
	for raw: Variant in _spawn_chunks:
		if not raw is Dictionary:
			last_error = "spawn_chunk_type"
			return false
		var entry := raw as Dictionary
		var cid := String(entry.get("chunk_id", ""))
		if not manifest_by_id.has(cid) or _spawn_by_chunk.has(cid):
			last_error = "spawn_chunk_identity"
			return false
		var cells: Array = entry.get("cells", [])
		if cells.is_empty() or int(entry.get("candidate_count", 0)) != cells.size():
			last_error = "spawn_chunk_count"
			return false
		var origin: Array = (manifest_by_id[cid] as Dictionary).origin
		var previous := -1
		for raw_local: Variant in cells:
			var local := int(raw_local)
			if local <= previous or local < 0 or local >= 4096:
				last_error = "spawn_cell_order"
				return false
			previous = local
			var cell := Vector2i(int(origin[0]) + local % 64, int(origin[1]) + floori(float(local) / 64.0))
			var base := cell_layers(cell)
			if not bool(base.get("ok", false)):
				last_error = "spawn_cell_source"
				return false
			var values: Dictionary = base.values
			if int(values.walk) != 1 or int(values.hazard) != 0 or int(values.preserved) != 0:
				last_error = "spawn_cell_unsafe"
				return false
		total += cells.size()
		_spawn_by_chunk[cid] = entry
	if total != int(spawn_index.get("candidate_cells", -1)):
		last_error = "spawn_total"
		return false
	_index_plan_objects()
	if not _compile_physical_sites():
		return false
	if not _index_roadside_sources():
		return false
	return true


func _index_plan_objects() -> void:
	for raw: Variant in plan.get("pois", []):
		var poi := raw as Dictionary
		var pid := String(poi.get("poi_id", ""))
		_pois_by_id[pid] = poi
		var cid := chunk_id_at(Vector2i(int(poi.cell[0]), int(poi.cell[1])))
		if not _pois_by_chunk.has(cid):
			_pois_by_chunk[cid] = []
		(_pois_by_chunk[cid] as Array).append(poi)
	for raw: Variant in plan.get("resource_nodes", []):
		var node := raw as Dictionary
		var nid := String(node.get("node_id", ""))
		_resources_by_id[nid] = node
		var cid := chunk_id_at(Vector2i(int(node.cell[0]), int(node.cell[1])))
		if not _resources_by_chunk.has(cid):
			_resources_by_chunk[cid] = []
		(_resources_by_chunk[cid] as Array).append(node)


func _compile_physical_sites() -> bool:
	var specs: Dictionary = runtime_contract.get("physical_sites", {})
	var pins: Dictionary = runtime_contract.get("source_pins", {})
	for key: String in specs:
		var spec: Dictionary = specs[key]
		var pin: Dictionary = pins.get(String(spec.get("pin", "")), {})
		var source := _json_object("res://" + String(pin.get("path", "")))
		var shell: Dictionary = source.get("overworld_shell", {})
		var cell: Array = spec.get("canonical_cell", [])
		if cell.size() != 2 or source.is_empty() or shell.is_empty():
			last_error = "a8_site_missing:" + key
			return false
		if String((source.get("source", {}) as Dictionary).get("poi_id", "")) != String(spec.poi_id) \
				or (source.get("source", {}) as Dictionary).get("canonical_cell", []) != cell \
				or shell.get("canonical_cell", []) != cell or not _int_array_equals(shell.get("bounds_px", []), [128, 128]) \
				or not _int_array_equals(shell.get("scale", []), [1, 1]) or int(shell.get("rotation_degrees", -1)) != 0:
			last_error = "a8_site_identity:" + key
			return false
		var poi: Dictionary = _pois_by_id.get(String(spec.poi_id), {})
		if poi.is_empty() or poi.get("cell", []) != cell:
			last_error = "a8_poi_anchor:" + key
			return false
		var anchor := Vector2(float(cell[0]) * 16.0 + 8.0, float(cell[1]) * 16.0 + 8.0)
		var origin := anchor - Vector2(64, 64)
		var portal: Array = shell.get("entry_portal", [])
		if portal.size() != 2:
			last_error = "a8_entry:" + key
			return false
		var entry := origin + Vector2(float(portal[0]), float(portal[1]))
		var approach := Vector2i(int(cell[0]), int(cell[1]) + 3)
		var transition: Dictionary = source.get("local_transition", {})
		var return_anchor: Dictionary = transition.get("return_anchor", {})
		if return_anchor.get("canonical_cell", []) != cell \
				or return_anchor.get("shell_local_position", []) != portal \
				or not entry.is_equal_approx(Vector2(float(cell[0]) * 16.0 + 8.0, float(cell[1]) * 16.0 + 52.0)):
			last_error = "a8_return_transform:" + key
			return false
		var bodies: Array = []
		for raw: Variant in shell.get("obstacles_px", []):
			var rect: Array = raw
			if rect.size() != 4:
				last_error = "a8_obstacle:" + key
				return false
			bodies.append({"rect_px": [origin.x + float(rect[0]), origin.y + float(rect[1]), float(rect[2]), float(rect[3])]})
		var doorway: Array = (shell.get("visual_layout", {}) as Dictionary).get("doorway_clear_rect_px", [])
		var site := {
			"site_key": key, "site_id": String(source.get("site_id", "")),
			"poi_id": String(spec.poi_id), "canonical_cell": cell.duplicate(),
			"anchor_world_px": [anchor.x, anchor.y], "shell_origin_world_px": [origin.x, origin.y],
			"shell_scene": String(shell.get("scene", "")),
			"interior_scene": String(transition.get("worksite_scene", "")),
			"shell_bounds_px": (shell.get("bounds_px", []) as Array).duplicate(),
			"interior_bounds_px": (source.get("world_bounds", []) as Array).duplicate(),
			"entry_portal_world_px": [entry.x, entry.y], "return_anchor_world_px": [entry.x, entry.y],
			"approach_cell": [approach.x, approach.y],
			"approach_foot_world_px": [approach.x * 16 + 8, approach.y * 16 + 15],
			"doorway_clear_world_rect_px": [origin.x + float(doorway[0]), origin.y + float(doorway[1]), float(doorway[2]), float(doorway[3])],
			"obstacles": bodies, "outer_requires": (source.get("access", {}) as Dictionary).get("outer_requires", []),
			"inner_requires": (source.get("access", {}) as Dictionary).get("inner_requires", []),
			"source_path": String(pin.path), "source_sha256": String(pin.sha256),
			"source_commit": String(pins.get("a8_commit", "")),
			"visual_layout": (shell.get("visual_layout", {}) as Dictionary).duplicate(true),
			"production_scene_mounted": false, "fixture_proxy_only": true,
		}
		_physical_sites[key] = site
		_physical_by_poi[String(spec.poi_id)] = key
	return _physical_sites.size() == 3


func _index_roadside_sources() -> bool:
	var pins: Dictionary = runtime_contract.get("source_pins", {})
	var corridor_pin: Dictionary = pins.get("roadside_corridor", {})
	var relative := String(corridor_pin.get("path", ""))
	var source := _json_object("res://" + relative)
	var count := 0
	for raw: Variant in source.get("instances", []):
		var instance := raw as Dictionary
		if String((instance.get("poi_binding", {}) as Dictionary).get("kind", "")) != "non_poi_roadside_instance":
			continue
		var cell: Array = instance.get("cell", [])
		var stand: Array = instance.get("stand_cell", [])
		var node_id := String(instance.get("resource_node_id", ""))
		if cell.size() != 2 or stand.size() != 2 or not _resources_by_id.has(node_id):
			last_error = "roadside_identity"
			return false
		var node: Dictionary = _resources_by_id[node_id]
		if node.get("cell", []) != cell or String(node.get("material_key", "")) != "salvage":
			last_error = "roadside_node"
			return false
		if (instance.get("economy_binding", {}) as Dictionary).get("reward_items", null) != null:
			last_error = "roadside_reward_authority"
			return false
		var cid := chunk_id_at(Vector2i(int(cell[0]), int(cell[1])))
		if not _roadside_by_chunk.has(cid):
			_roadside_by_chunk[cid] = []
		(_roadside_by_chunk[cid] as Array).append(instance)
		count += 1
	if count != 3:
		last_error = "roadside_count"
		return false
	return true


static func _as_int(value: Variant) -> Dictionary:
	if typeof(value) == TYPE_INT:
		return {"ok": true, "value": int(value)}
	if typeof(value) == TYPE_FLOAT:
		var f := float(value)
		if f == floor(f) and f >= -2147483648.0 and f <= 2147483647.0:
			return {"ok": true, "value": int(f)}
	return {"ok": false, "value": 0}


static func decode_rle(rle: Variant, total: int) -> Dictionary:
	if not rle is Array or (rle as Array).is_empty():
		return {"ok": false, "error": "RLE_EMPTY", "values": PackedInt32Array()}
	if total <= 0:
		return {"ok": false, "error": "RLE_TOTAL", "values": PackedInt32Array()}
	var out := PackedInt32Array()
	out.resize(total)
	var pos := 0
	for raw_pair: Variant in (rle as Array):
		if not raw_pair is Array or (raw_pair as Array).size() != 2:
			return {"ok": false, "error": "RLE_PAIR", "values": PackedInt32Array()}
		var pair := raw_pair as Array
		var vv := _as_int(pair[0])
		var nn := _as_int(pair[1])
		if not bool(vv["ok"]) or int(vv["value"]) < 0:
			return {"ok": false, "error": "RLE_VALUE", "values": PackedInt32Array()}
		if not bool(nn["ok"]) or int(nn["value"]) <= 0:
			return {"ok": false, "error": "RLE_COUNT", "values": PackedInt32Array()}
		var v := int(vv["value"])
		var n := int(nn["value"])
		if pos + n > total:
			return {"ok": false, "error": "RLE_OVERRUN", "values": PackedInt32Array()}
		for i: int in range(n):
			out[pos] = v
			pos += 1
	if pos != total:
		return {"ok": false, "error": "RLE_UNDERRUN", "values": PackedInt32Array()}
	return {"ok": true, "error": "", "values": out}


func _allowed_values(layer: String, chunk: Dictionary) -> Variant:
	var legend: Dictionary = chunk.get("legend", {})
	if layer in ["region", "biome", "surface"]:
		var names: Array = legend.get(layer, [])
		var allowed := {}
		for i: int in range(names.size()):
			allowed[i + 1] = true
		return allowed
	if layer == "hazard":
		var hz: Array = legend.get("hazard", [])
		var allowed := {}
		for i: int in range(hz.size() + 1):
			allowed[i] = true
		return allowed
	if layer in BINARY_LAYERS:
		return {0: true, 1: true}
	if layer == "build_permission":
		return {0: true, 1: true, 2: true}
	return null


func validate_chunk_document(chunk: Dictionary, manifest: Dictionary) -> Array[String]:
	var errors: Array[String] = []
	if String(chunk.get("schema", "")) != CHUNK_SCHEMA:
		errors.append("CHUNK_SCHEMA")
	var frame: Dictionary = plan.get("frame", {})
	var w := int(frame.get("w", 0))
	var h := int(frame.get("h", 0))
	var chunk_size := int(plan.get("chunk_size", 64))
	var origin: Array = chunk.get("origin", [])
	var dims: Array = chunk.get("size", [])
	if origin.size() != 2 or dims.size() != 2:
		errors.append("CHUNK_BOUNDS")
		return errors
	var ox := int(origin[0])
	var oy := int(origin[1])
	var cw := int(dims[0])
	var ch := int(dims[1])
	if ox % chunk_size != 0 or oy % chunk_size != 0:
		errors.append("CHUNK_ALIGN")
	var cx := ox / chunk_size
	var cy := oy / chunk_size
	if String(chunk.get("chunk_id", "")) != "chunk:%d:%d" % [cx, cy]:
		errors.append("CHUNK_IDENTITY")
	if ox < 0 or oy < 0 or cw <= 0 or ch <= 0 or cw > chunk_size or ch > chunk_size or ox + cw > w or oy + ch > h:
		errors.append("CHUNK_BOUNDS")
	if not manifest.is_empty():
		if String(manifest.get("chunk_id", "")) != String(chunk.get("chunk_id", "")):
			errors.append("CHUNK_MANIFEST_ID")
		if manifest.get("origin", []) != origin or manifest.get("size", []) != dims:
			errors.append("CHUNK_MANIFEST_BOUNDS")
		if String(manifest.get("path", "")) != "chunks/%02d_%02d.json" % [cx, cy]:
			errors.append("CHUNK_PATH")
	var layers: Dictionary = chunk.get("layers", {})
	var total := cw * ch
	var decoded: Dictionary = {}
	for layer: String in REQUIRED_LAYERS:
		if not layers.has(layer):
			errors.append("CHUNK_LAYER_MISSING:" + layer)
			continue
		var result := decode_rle(layers[layer], total)
		if not bool(result["ok"]):
			errors.append(String(result["error"]) + ":" + layer)
			continue
		var values: PackedInt32Array = result["values"]
		decoded[layer] = values
		var allowed: Variant = _allowed_values(layer, chunk)
		if allowed != null:
			for v: int in values:
				if not (allowed as Dictionary).has(v):
					errors.append("LAYER_VALUE:" + layer)
					break
	if decoded.has("preserved") and decoded.has("build_permission"):
		var pres: PackedInt32Array = decoded["preserved"]
		var perm: PackedInt32Array = decoded["build_permission"]
		for i: int in range(pres.size()):
			if pres[i] == 1 and perm[i] != 2:
				errors.append("LEGACY_BUILD_AUTHORITY")
				break
			if pres[i] == 0 and perm[i] == 2:
				errors.append("BUILD_AUTHORITY")
				break
	return errors


func load_chunk_file(path: String, manifest: Dictionary) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {"ok": false, "error": "CHUNK_MISSING"}
	var expected_hash := String(manifest.get("sha256", ""))
	if not expected_hash.is_empty():
		var actual_hash := FileAccess.get_sha256(path)
		if actual_hash != expected_hash:
			return {"ok": false, "error": "CHUNK_HASH"}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not parsed is Dictionary:
		return {"ok": false, "error": "CHUNK_JSON"}
	var chunk := parsed as Dictionary
	var errors := validate_chunk_document(chunk, manifest)
	if not errors.is_empty():
		return {"ok": false, "error": errors[0], "errors": errors}
	var dims: Array = chunk["size"]
	var total := int(dims[0]) * int(dims[1])
	var layers: Dictionary = {}
	for layer: String in REQUIRED_LAYERS:
		var result := decode_rle(chunk["layers"][layer], total)
		if not bool(result["ok"]):
			return {"ok": false, "error": String(result["error"]) + ":" + layer}
		layers[layer] = result["values"]
	return {"ok": true, "error": "", "chunk": chunk, "layers": layers,
		"sha256": FileAccess.get_sha256(path)}


func load_chunk(chunk_id: String) -> Dictionary:
	if cache.has(chunk_id):
		return cache[chunk_id]
	if not manifest_by_id.has(chunk_id):
		return {"ok": false, "error": "CHUNK_UNKNOWN"}
	var manifest: Dictionary = manifest_by_id[chunk_id]
	var rel := String(manifest.get("path", ""))
	if rel.contains("..") or not rel.begins_with("chunks/"):
		return {"ok": false, "error": "CHUNK_PATH"}
	var result := load_chunk_file(root_path.path_join(rel), manifest)
	if bool(result.get("ok", false)):
		cache[chunk_id] = result
	return result


func chunk_id_at(cell: Vector2i) -> String:
	var chunk_size := int(plan.get("chunk_size", 64))
	@warning_ignore("integer_division")
	var cx := cell.x / chunk_size
	@warning_ignore("integer_division")
	var cy := cell.y / chunk_size
	return "chunk:%d:%d" % [cx, cy]


func cell_layers(cell: Vector2i) -> Dictionary:
	var frame: Dictionary = plan.get("frame", {})
	if cell.x < 0 or cell.y < 0 or cell.x >= int(frame.get("w", 0)) or cell.y >= int(frame.get("h", 0)):
		return {"ok": false, "error": "CELL_BOUNDS"}
	var chunk_id := chunk_id_at(cell)
	var loaded := load_chunk(chunk_id)
	if not bool(loaded.get("ok", false)):
		return loaded
	var chunk: Dictionary = loaded["chunk"]
	var origin: Array = chunk["origin"]
	var dims: Array = chunk["size"]
	var lx := cell.x - int(origin[0])
	var ly := cell.y - int(origin[1])
	var index := ly * int(dims[0]) + lx
	var values := {}
	var provenance := {}
	for layer: String in REQUIRED_LAYERS:
		var arr: PackedInt32Array = loaded["layers"][layer]
		values[layer] = arr[index]
		provenance[layer] = "static_chunk"
	return {"ok": true, "error": "", "chunk_id": chunk_id, "values": values,
		"provenance": provenance}


func resolve_build(permission: int, a0_delegate: Callable, dynamic_child_blocked: bool = false) -> Dictionary:
	if permission == 2:
		if not a0_delegate.is_valid():
			return {"ok": false, "decision": "error", "reason": "legacy_build_delegate_required", "authority": "a0"}
		var result: Variant = a0_delegate.call()
		if not result is Dictionary or not (result as Dictionary).has("ok"):
			return {"ok": false, "decision": "error", "reason": "invalid_a0_delegate_result", "authority": "a0"}
		var r := result as Dictionary
		if not bool(r.get("ok", false)):
			return {"ok": false, "decision": "deny", "reason": String(r.get("reason", "a0_rejected")), "authority": "a0"}
		if dynamic_child_blocked:
			return {"ok": false, "decision": "deny", "reason": "dynamic_child_occupancy", "authority": "a0+dynamic_child"}
		return {"ok": true, "decision": "allow", "reason": "", "authority": "a0"}
	if permission == 0:
		return {"ok": false, "decision": "deny", "reason": "a1_no_build_candidate", "authority": "a1"}
	if permission != 1:
		return {"ok": false, "decision": "error", "reason": "unknown_build_permission", "authority": "a1"}
	if dynamic_child_blocked:
		return {"ok": false, "decision": "deny", "reason": "dynamic_child_occupancy", "authority": "dynamic_child"}
	if not a0_delegate.is_valid():
		return {"ok": false, "decision": "candidate_not_validated", "reason": "a0_validation_required", "authority": "a1_candidate"}
	var result2: Variant = a0_delegate.call()
	if not result2 is Dictionary or not (result2 as Dictionary).has("ok"):
		return {"ok": false, "decision": "error", "reason": "invalid_a0_delegate_result", "authority": "a0"}
	var r2 := result2 as Dictionary
	if not bool(r2.get("ok", false)):
		return {"ok": false, "decision": "deny", "reason": String(r2.get("reason", "a0_rejected")), "authority": "a0"}
	return {"ok": true, "decision": "allow", "reason": "", "authority": "a0"}


func resolve_cell(cell: Vector2i, overlays: Array, a0_delegate: Callable, dynamic_child_blocked: bool = false) -> Dictionary:
	var base := cell_layers(cell)
	if not bool(base.get("ok", false)):
		return base
	var values: Dictionary = (base["values"] as Dictionary).duplicate()
	var provenance: Dictionary = (base["provenance"] as Dictionary).duplicate()
	var sorted_overlays := overlays.duplicate()
	sorted_overlays.sort_custom(func(a: Variant, b: Variant) -> bool:
		return int((a as Dictionary).get("revision", 0)) < int((b as Dictionary).get("revision", 0)))
	for raw: Variant in sorted_overlays:
		if not raw is Dictionary:
			return {"ok": false, "error": "overlay_type"}
		var overlay := raw as Dictionary
		var target: Array = overlay.get("cell", [])
		if target.size() != 2 or int(target[0]) != cell.x or int(target[1]) != cell.y:
			continue
		var layer := String(overlay.get("layer", ""))
		if not layer in MUTABLE_OVERLAY_LAYERS:
			return {"ok": false, "error": "immutable_overlay_layer"}
		if int(values.get("preserved", 0)) == 1:
			return {"ok": false, "error": "legacy_overlay_forbidden"}
		var value := int(overlay.get("value", -1))
		if value != 0 and value != 1:
			return {"ok": false, "error": "invalid_overlay_value"}
		if not overlay.has("expected_base") or int(overlay["expected_base"]) != int(values[layer]):
			return {"ok": false, "error": "stale_overlay_base"}
		for key: String in ["source_id", "revision", "cell"]:
			if not overlay.has(key):
				return {"ok": false, "error": "missing_overlay_" + key}
		values[layer] = value
		provenance[layer] = "overlay:" + String(overlay["source_id"])
	var build := resolve_build(int(values.get("build_permission", -1)), a0_delegate, dynamic_child_blocked)
	return {"ok": true, "error": "", "chunk_id": base["chunk_id"], "values": values,
		"provenance": provenance, "build": build}


func check_seam(seam: Dictionary) -> Dictionary:
	var carve: Array = seam.get("carve", [])
	if carve.size() != 4:
		return {"ok": false, "error": "seam_bounds"}
	for y: int in range(int(carve[1]), int(carve[3]) + 1):
		for x: int in range(int(carve[0]), int(carve[2]) + 1):
			var cell := cell_layers(Vector2i(x, y))
			if not bool(cell.get("ok", false)):
				return cell
			var values: Dictionary = cell["values"]
			if int(values.get("walk", 0)) != 1 or int(values.get("road", 0)) != 1:
				return {"ok": false, "error": "SEAM_DISCONNECT"}
	for key: String in ["from", "to"]:
		var endpoint: Array = seam.get(key, [])
		if endpoint.size() != 2:
			return {"ok": false, "error": "seam_endpoint"}
		var cell := cell_layers(Vector2i(int(endpoint[0]), int(endpoint[1])))
		if not bool(cell.get("ok", false)) or int((cell["values"] as Dictionary).get("walk", 0)) != 1:
			return {"ok": false, "error": "SEAM_DISCONNECT"}
	return {"ok": true, "error": ""}


# ---------------------------------------------------------------------------
# Round 12 additive consumer API. Original reader methods above remain intact.
# ---------------------------------------------------------------------------
func is_ready() -> bool:
	return not plan.is_empty() and not runtime_contract.is_empty() and cache.size() == 192


func world_frame() -> Vector2i:
	var frame: Dictionary = plan.get("frame", {})
	return Vector2i(int(frame.get("w", 0)), int(frame.get("h", 0)))


func world_pixels() -> Rect2:
	return Rect2(Vector2.ZERO, Vector2(world_frame() * 16))


func chunk_count() -> int:
	return manifest_by_id.size()


func authored_chunk_manifest() -> Array:
	return (plan.get("chunk_manifest", []) as Array).duplicate(true)


func named_value(cell: Vector2i, layer: String) -> String:
	var base := cell_layers(cell)
	if not bool(base.get("ok", false)):
		return ""
	var values: Dictionary = base.values
	var value := int(values.get(layer, 0))
	if value <= 0:
		return ""
	var chunk: Dictionary = cache[String(base.chunk_id)].chunk
	var legend: Array = (chunk.get("legend", {}) as Dictionary).get(layer, [])
	return String(legend[value - 1]) if value <= legend.size() else ""


func cell_identity(cell: Vector2i) -> Dictionary:
	var base := cell_layers(cell)
	if not bool(base.get("ok", false)):
		return base
	var values: Dictionary = base.values
	var cid := String(base.chunk_id)
	var loaded: Dictionary = cache[cid]
	return {
		"ok": true, "world_id": String(plan.get("world_id", "")), "cell": cell,
		"cell_array": [cell.x, cell.y], "chunk_id": cid, "values": values.duplicate(),
		"region_id": named_value(cell, "region"), "biome_id": named_value(cell, "biome"),
		"surface_id": named_value(cell, "surface"), "hazard_id": named_value(cell, "hazard"),
		"source_path": String((loaded.chunk as Dictionary).get("chunk_id", "")),
		"source_sha256": String(loaded.get("sha256", "")),
		"legacy_inset": int(values.get("preserved", 0)) == 1,
		"out_of_bounds_terrain": false,
	}


func poi_by_id(poi_id: String) -> Dictionary:
	if not _pois_by_id.has(poi_id):
		return {"ok": false, "error": "POI_UNKNOWN"}
	var poi: Dictionary = _pois_by_id[poi_id]
	return {"ok": true, "poi": poi.duplicate(true), "cell": Vector2i(int(poi.cell[0]), int(poi.cell[1])),
		"source": cell_identity(Vector2i(int(poi.cell[0]), int(poi.cell[1])))}


func poi_cells() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for pid: String in _pois_by_id:
		var poi: Dictionary = _pois_by_id[pid]
		out.append({"poi_id": pid, "cell": Vector2i(int(poi.cell[0]), int(poi.cell[1]))})
	out.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return String(a.poi_id) < String(b.poi_id))
	return out


func pois_in_chunk(chunk_id: String) -> Array:
	return (_pois_by_chunk.get(chunk_id, []) as Array).duplicate(true)


func resource_nodes_in_chunk(chunk_id: String) -> Array:
	return (_resources_by_chunk.get(chunk_id, []) as Array).duplicate(true)


func roadside_sources_in_chunk(chunk_id: String) -> Array:
	return (_roadside_by_chunk.get(chunk_id, []) as Array).duplicate(true)


func pois_near(cell: Vector2i, radius_cells: int = 16, capabilities: Array = []) -> Array:
	var rows: Array = []
	for pid: String in _pois_by_id:
		var poi: Dictionary = _pois_by_id[pid]
		var at: Array = poi.cell
		var distance := absi(int(at[0]) - cell.x) + absi(int(at[1]) - cell.y)
		if distance > radius_cells:
			continue
		var required: Array = poi.get("required_capabilities", [])
		var locked := false
		for capability: Variant in required:
			if not capabilities.has(capability):
				locked = true
		rows.append({"poi": poi.duplicate(true), "poi_id": pid, "cell": Vector2i(int(at[0]), int(at[1])),
			"distance_cells": distance, "locked_without_supplied_capabilities": locked})
	rows.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		if int(a.distance_cells) == int(b.distance_cells):
			return String(a.poi_id) < String(b.poi_id)
		return int(a.distance_cells) < int(b.distance_cells))
	return rows


func resource_nodes_near(cell: Vector2i, radius_cells: int = 24) -> Array:
	var rows: Array = []
	for nid: String in _resources_by_id:
		var node: Dictionary = _resources_by_id[nid]
		var at: Array = node.cell
		var distance := absi(int(at[0]) - cell.x) + absi(int(at[1]) - cell.y)
		if distance <= radius_cells:
			rows.append({"node": node.duplicate(true), "node_id": nid, "distance_cells": distance,
				"material_key": String(node.get("material_key", ""))})
	rows.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		if int(a.distance_cells) == int(b.distance_cells):
			return String(a.node_id) < String(b.node_id)
		return int(a.distance_cells) < int(b.distance_cells))
	return rows


func opportunities_near(cell: Vector2i, radius_cells: int = 24) -> Dictionary:
	var resources := resource_nodes_near(cell, radius_cells)
	var pois := pois_near(cell, radius_cells)
	var roadside: Array = []
	for raw: Variant in _roadside_by_chunk.values():
		for entry_raw: Variant in (raw as Array):
			var instance := entry_raw as Dictionary
			var at: Array = instance.cell
			var distance := absi(int(at[0]) - cell.x) + absi(int(at[1]) - cell.y)
			if distance <= radius_cells:
				roadside.append({"instance": instance.duplicate(true), "instance_id": String(instance.instance_id),
					"material_key": "salvage", "distance_cells": distance})
	var materials := {}
	for row: Variant in resources:
		materials[String((row as Dictionary).material_key)] = true
	for row: Variant in pois:
		for material: Variant in ((row as Dictionary).poi as Dictionary).get("material_keys", []):
			materials[String(material)] = true
	for row: Variant in roadside:
		materials[String((row as Dictionary).material_key)] = true
	return {"resource_nodes": resources, "pois": pois, "roadside_sources": roadside,
		"material_keys": materials.keys(), "distance_metric": "MANHATTAN_SPATIAL_NOT_PATH_OR_REWARD_PROOF"}


func physical_site(site_key_or_poi: String) -> Dictionary:
	var key := site_key_or_poi
	if _physical_by_poi.has(site_key_or_poi):
		key = String(_physical_by_poi[site_key_or_poi])
	if not _physical_sites.has(key):
		return {"ok": false, "error": "PHYSICAL_SITE_UNKNOWN"}
	var site: Dictionary = (_physical_sites[key] as Dictionary).duplicate(true)
	site["ok"] = true
	return site


func traversal_profile(cell: Vector2i) -> Dictionary:
	var identity := cell_identity(cell)
	if not bool(identity.get("ok", false)):
		return identity
	var values: Dictionary = identity.values
	var surface := String(identity.surface_id)
	var profiles: Dictionary = (runtime_contract.get("traversal", {}) as Dictionary).get("surface_profiles", {})
	if not profiles.has(surface):
		return {"ok": false, "error": "TRAVERSAL_SURFACE_UNKNOWN", "surface_id": surface}
	var walk := int(values.get("walk", 0)) == 1
	var speed := float(profiles[surface])
	if int(values.get("road", 0)) == 1 and walk:
		speed = 1.0
	var climate: Dictionary = (runtime_contract.get("traversal", {}) as Dictionary).get("climate_channels", {})
	var hazard_id := String(identity.hazard_id)
	var hazard: Dictionary = {}
	for raw: Variant in plan.get("hazards", []):
		if String((raw as Dictionary).get("hazard_id", "")) == hazard_id:
			hazard = (raw as Dictionary).duplicate(true)
			break
	var region_entry: Array = []
	for raw: Variant in plan.get("regions", []):
		if String((raw as Dictionary).get("region_id", "")) == String(identity.region_id):
			region_entry = (raw as Dictionary).get("entry_capabilities", [])
			break
	return {
		"ok": true, "cell": cell, "chunk_id": String(identity.chunk_id),
		"region_id": String(identity.region_id), "biome_id": String(identity.biome_id), "surface_id": surface,
		"walkable": walk, "speed_multiplier_proposal": speed if walk else 0.0,
		"planning_effort_per_cell": (1.0 / speed) if walk and speed > 0.0 else null,
		"climate_channel": "climate:" + String(climate.get(String(identity.region_id), "unknown")),
		"hazard_channel": "hazard:" + hazard_id if not hazard_id.is_empty() else "",
		"hazard_id": hazard_id, "hazard_required_capability": String(hazard.get("requires", "")),
		"hazard_severity_source": int(hazard.get("severity", 0)), "hazard_clue": String(hazard.get("clue", "")),
		"region_entry_capabilities": region_entry.duplicate(), "asynchronous_channels": true,
		"status": "A1_NATIVE_PROPOSAL_A7_MEASUREMENT_A0_ADOPTION_REQUIRED",
		"damage_application": "A0_NOT_APPLIED", "inventory_cost_application": "A3_A0_NOT_APPLIED",
	}


static func _digest_mod(digest: PackedByteArray, offset: int, count: int, modulo: int) -> int:
	var value := 0
	for index: int in range(offset, offset + count):
		value = (value * 256 + int(digest[index])) % modulo
	return value


func _spawn_basic_eligible(cell: Vector2i) -> bool:
	for dy: int in range(-1, 2):
		for dx: int in range(-1, 2):
			var base := cell_layers(cell + Vector2i(dx, dy))
			if not bool(base.get("ok", false)):
				return false
			var values: Dictionary = base.values
			if int(values.walk) != 1 or int(values.hazard) != 0:
				return false
	var center_base := cell_layers(cell)
	if int((center_base.values as Dictionary).preserved) != 0:
		return false
	var region_id := named_value(cell, "region")
	for raw: Variant in plan.get("regions", []):
		var region := raw as Dictionary
		if String(region.region_id) == region_id and not (region.entry_capabilities as Array).is_empty():
			return false
	for raw: Variant in plan.get("pois", []):
		var poi := raw as Dictionary
		var at: Array = poi.cell
		var radius := int(poi.get("footprint_radius_tiles", 4)) + 2
		if absi(int(at[0]) - cell.x) <= radius and absi(int(at[1]) - cell.y) <= radius:
			return false
	var hero_center := Vector2(cell.x * 16 + 8, cell.y * 16 + 7)
	for key: String in _physical_sites:
		for raw: Variant in (_physical_sites[key] as Dictionary).obstacles:
			var rect: Array = raw.rect_px
			var body_center := Vector2(float(rect[0]) + float(rect[2]) * 0.5, float(rect[1]) + float(rect[3]) * 0.5)
			if absf(hero_center.x - body_center.x) < (12.0 + float(rect[2])) * 0.5 \
					and absf(hero_center.y - body_center.y) < (16.0 + float(rect[3])) * 0.5:
				return false
	for raw: Variant in _roadside_by_chunk.values():
		for entry_raw: Variant in (raw as Array):
			var instance := entry_raw as Dictionary
			var at: Array = instance.cell
			var size: Array = instance.collision_size_px
			var offset: Array = instance.collision_offset_px
			var body_center := Vector2(int(at[0]) * 16 + 8 + float(offset[0]), int(at[1]) * 16 + 8 + float(offset[1]))
			if absf(hero_center.x - body_center.x) < (12.0 + float(size[0])) * 0.5 \
					and absf(hero_center.y - body_center.y) < (16.0 + float(size[1])) * 0.5:
				return false
	return true


func spawn_candidates(chunk_id: String) -> Dictionary:
	if not _spawn_by_chunk.has(chunk_id) or not manifest_by_id.has(chunk_id):
		return {"ok": false, "error": "SPAWN_CHUNK_UNKNOWN"}
	var entry: Dictionary = _spawn_by_chunk[chunk_id]
	var origin: Array = (manifest_by_id[chunk_id] as Dictionary).origin
	var cells: Array[Vector2i] = []
	for raw: Variant in entry.cells:
		var local := int(raw)
		cells.append(Vector2i(int(origin[0]) + local % 64, int(origin[1]) + floori(float(local) / 64.0)))
	return {"ok": true, "chunk_id": chunk_id, "cells": cells, "count": cells.size()}


func choose_safe_spawn(run_seed: int) -> Dictionary:
	if _spawn_chunks.is_empty():
		return {"ok": false, "error": "SPAWN_INDEX_NOT_READY"}
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update((String(plan.world_id) + "|" + str(run_seed) + "|round12-spawn-v1").to_utf8_buffer())
	var digest := ctx.finish()
	var chunk_slot := _digest_mod(digest, 0, 8, _spawn_chunks.size())
	var entry: Dictionary = _spawn_chunks[chunk_slot]
	var locals: Array = entry.cells
	var local := int(locals[_digest_mod(digest, 8, 8, locals.size())])
	var cid := String(entry.chunk_id)
	var origin: Array = (manifest_by_id[cid] as Dictionary).origin
	var cell := Vector2i(int(origin[0]) + local % 64, int(origin[1]) + floori(float(local) / 64.0))
	if not _spawn_basic_eligible(cell):
		return {"ok": false, "error": "SPAWN_SELECTED_CELL_UNSAFE", "cell": cell, "run_seed": run_seed}
	return {
		"ok": true, "run_seed": run_seed, "cell": cell, "cell_array": [cell.x, cell.y],
		"chunk_id": cid, "region_id": named_value(cell, "region"),
		"candidate_cells": int(spawn_index.candidate_cells), "candidate_chunks": _spawn_chunks.size(),
		"algorithm": String(spawn_index.algorithm), "source": cell_identity(cell),
		"persistence": "A0_RUN_LOCAL_CELL_REQUIRED", "production_spawn_approval": false,
	}


func source_report() -> Dictionary:
	return {
		"ok": is_ready(), "world_id": String(plan.get("world_id", "")), "frame": [world_frame().x, world_frame().y],
		"chunk_size": int(plan.get("chunk_size", 0)), "verified_chunks": cache.size(),
		"configure_ms": configure_ms, "dependency_sha256": dependency_hashes.duplicate(true),
		"spawn_candidate_cells": int(spawn_index.get("candidate_cells", 0)),
		"spawn_candidate_chunks": _spawn_chunks.size(),
		"spawn_region_counts": (spawn_index.get("region_counts", {}) as Dictionary).duplicate(true),
		"poi_count": _pois_by_id.size(), "resource_node_count": _resources_by_id.size(),
		"physical_site_count": _physical_sites.size(), "roadside_source_count": 3,
		"production_native_playable": false, "scope": "SOURCE_READY_NOT_PRODUCTION_MOUNTED",
	}


func route_graph() -> Dictionary:
	return (plan.get("route_graph", {}) as Dictionary).duplicate(true)


func temporal_context(world_time_seconds: float, run_elapsed_seconds: float) -> Dictionary:
	if not is_finite(world_time_seconds) or not is_finite(run_elapsed_seconds) or world_time_seconds < 0.0 or run_elapsed_seconds < 0.0:
		return {"ok": false, "error": "INVALID_WORLD_TIME"}
	var run_limit := float((runtime_contract.get("world_state", {}) as Dictionary).get("run_reset_hours", 336)) * 3600.0
	return {
		"ok": true, "world_time_seconds": world_time_seconds, "run_elapsed_seconds": run_elapsed_seconds,
		"world_day": floori(world_time_seconds / 86400.0),
		"time_of_day": fposmod(world_time_seconds, 86400.0) / 86400.0,
		"run_hour": run_elapsed_seconds / 3600.0, "reset_required": run_elapsed_seconds >= run_limit,
		"reset_scope": "A0_FULL_RUN_LOCAL_EXCEPT_APPROVED_META", "static_geography_mutation": false,
		"production_online_offline_proof": "NOT_TESTED", "production_ragnarok_projection": "NOT_TESTED",
	}
