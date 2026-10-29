extends RefCounted
## SURV-050A minimal read-only Godot 4.7 chunk/RLE reader.
##
## Consumes authored A1 data only. It does not implement an overworld controller,
## does not touch SaveService, does not place structures, and does not replace
## A0's paid-construction validator. Legacy build=0 is a historical hint; the
## authoritative signal is build_permission=2 -> delegate to A0 validate_cell.

const REQUIRED_LAYERS := [
	"region", "biome", "surface", "walk", "build", "build_permission",
	"hazard", "road", "preserved", "elevation_band",
]
const BINARY_LAYERS := ["walk", "build", "road", "preserved"]
const MUTABLE_OVERLAY_LAYERS := ["walk", "road"]
const CHUNK_SCHEMA := "soh.world.chunk.v1"
const PLAN_SCHEMA := "soh.world.masterplan.v1"

var root_path := ""
var plan: Dictionary = {}
var reader_contract: Dictionary = {}
var manifest_by_id: Dictionary = {}
var cache: Dictionary = {}
var last_error := ""


func configure(world_root: String) -> bool:
	root_path = world_root
	cache.clear()
	manifest_by_id.clear()
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
