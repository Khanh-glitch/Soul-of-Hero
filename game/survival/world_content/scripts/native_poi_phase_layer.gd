class_name NativePoiPhaseLayer
extends Node2D

## Applies owner-authorized local cues and non-damaging route geometry only.
## It does not compute time, award combat results, or change owner site state.

signal phase_projection_rejected(reason: String)
signal phase_projection_applied(projection: Dictionary)

const CONTEXT_SCRIPT := preload(
	"res://game/survival/world_content/scripts/native_poi_phase_context.gd"
)
const VECTOR_UTIL := preload("res://game/survival/world_content/scripts/native_poi_vectors.gd")
const PHASE_DATA_PATH := "res://data/survival/world_content/site_phase_transformations.v1.json"
const ART_MANIFEST_PATH := "res://data/survival/world_content/a8_art_manifest.v1.json"
const WORLD_LAYER := 1
const PLAYER_LAYER := 2

var _context: NativePoiPhaseContext
var _site: Variant
var _site_profile: Dictionary = {}
var _manifest: Dictionary = {}
var _props_texture: Texture2D
var _configured := false
var _current_profile: Dictionary = {}
var _site_effect_active := false


# gdlint: disable=max-returns
func configure(site: Variant) -> bool:
	_site = site
	_context = CONTEXT_SCRIPT.new() as NativePoiPhaseContext
	if not _context.configure(site.definition):
		return false
	var phase_file := FileAccess.open(PHASE_DATA_PATH, FileAccess.READ)
	if phase_file == null:
		return false
	var phase_document: Variant = JSON.parse_string(phase_file.get_as_text())
	phase_file.close()
	if not phase_document is Dictionary:
		return false
	for profile_value: Variant in phase_document.get("physical_site_profiles", []):
		if not profile_value is Dictionary:
			continue
		if str(profile_value.get("poi_id", "")) == site.get_source_id():
			_site_profile = profile_value
			break
	var manifest_file := FileAccess.open(ART_MANIFEST_PATH, FileAccess.READ)
	if manifest_file == null:
		return false
	var manifest_value: Variant = JSON.parse_string(manifest_file.get_as_text())
	manifest_file.close()
	if not manifest_value is Dictionary:
		return false
	_manifest = manifest_value
	var props_path := str(_manifest.get("textures", {}).get("props", {}).get("path", ""))
	_props_texture = load(props_path) as Texture2D
	if _props_texture == null:
		return false
	_configured = true
	return true


func apply_projection(projection: Dictionary) -> bool:
	if not _configured or not _context.apply_projection(projection):
		phase_projection_rejected.emit("owner_phase_projection_invalid_or_stale")
		return false
	var phase_id := _context.get_phase_id()
	_current_profile = _site_profile.get("phase_profiles", {}).get(phase_id, {})
	var profile_effect := str(_current_profile.get("effect_id", ""))
	_site_effect_active = not profile_effect.is_empty() and _context.has_effect(profile_effect)
	var disabled_choice_blockers: Array = []
	var temporary_blockers: Array = []
	if _site_effect_active:
		disabled_choice_blockers = _current_profile.get("disabled_choice_blockers", [])
		temporary_blockers = _current_profile.get("temporary_blockers", [])
	_site.set_phase_choice_blocker_overrides(disabled_choice_blockers)
	_clear_phase_geometry()
	_build_temporary_blockers(temporary_blockers)
	_build_presentation(_current_profile if _site_effect_active else {})
	_site.set_phase_intents_enabled(_context.permits_mutating_intents())
	phase_projection_applied.emit(_context.get_projection())
	return true


func has_valid_context() -> bool:
	return _configured and _context != null and _context.is_initialized()


func permits_mutating_intents() -> bool:
	return has_valid_context() and _context.permits_mutating_intents()


func get_context() -> Dictionary:
	if not has_valid_context():
		return {}
	return _context.get_run_context()


func get_current_phase_id() -> String:
	return _context.get_phase_id() if has_valid_context() else ""


func get_projection() -> Dictionary:
	return _context.get_projection() if has_valid_context() else {}


func is_site_effect_active() -> bool:
	return _site_effect_active


func get_presentation_key() -> String:
	return str(_current_profile.get("presentation_key", "")) if has_valid_context() else ""


func _clear_phase_geometry() -> void:
	for child: Node in get_children():
		remove_child(child)
		child.queue_free()


func _build_temporary_blockers(blockers: Array) -> void:
	for blocker_value: Variant in blockers:
		if not blocker_value is Dictionary:
			continue
		var rect: Array = blocker_value.get("rect_px", [])
		if rect.size() != 4:
			continue
		var body := StaticBody2D.new()
		body.name = "RagnarokBlocker_%s" % str(blocker_value.get("id", "unnamed"))
		body.collision_layer = WORLD_LAYER
		body.collision_mask = PLAYER_LAYER
		var collision_shape := CollisionShape2D.new()
		var shape := RectangleShape2D.new()
		shape.size = Vector2(float(rect[2]), float(rect[3]))
		collision_shape.shape = shape
		body.add_child(collision_shape)
		body.position = Vector2(
			float(rect[0]) + float(rect[2]) * 0.5, float(rect[1]) + float(rect[3]) * 0.5
		)
		add_child(body)


func _build_presentation(profile: Dictionary) -> void:
	var frame_name := str(profile.get("warning_art_frame", ""))
	if frame_name.is_empty():
		return
	var frames: Dictionary = _manifest.get("props_frames", {})
	var frame: Array = frames.get(frame_name, [])
	if frame.size() != 4:
		return
	var atlas_texture := AtlasTexture.new()
	atlas_texture.atlas = _props_texture
	atlas_texture.region = Rect2(float(frame[0]), float(frame[1]), float(frame[2]), float(frame[3]))
	var warning := Sprite2D.new()
	warning.name = "RagnarokWarningCue_%s" % frame_name
	warning.texture = atlas_texture
	warning.position = VECTOR_UTIL.from_pair(profile.get("warning_position_px", [0, 0]))
	warning.scale = Vector2(2.0, 2.0)
	warning.z_index = 30
	warning.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	warning.set_meta("presentation_key", str(profile.get("presentation_key", "")))
	add_child(warning)
