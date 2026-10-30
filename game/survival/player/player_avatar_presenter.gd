extends Node2D
class_name PlayerAvatarPresenter

## Bridges A0's authored actor (Knight physics, combat, animation state, VFX,
## death and respawn) to the A6 CraftPix avatar art pipeline.
##
## A0 owns identity: this node only reads `SaveService.get_player_appearance_projection()`.
## It never writes identity, never picks a default character, never grants items,
## and never substitutes the Knight once an identity exists but its licensed art
## is missing — that case fails closed with a visible diagnostic instead of
## pretending a different character is the player.

signal avatar_presentation_changed(state: Dictionary)

const PIPELINE := preload("res://game/survival/ui/avatar_sprite_pipeline.gd")
const PUBLIC_MANIFEST_PATH := "res://game/survival/ui/avatar_art_manifest.json"
const PRIVATE_MANIFEST_PATH := "res://private_art/a6_avatar/avatar_art_private_runtime.json"
const SAVE_SERVICE_PATH := "/root/SaveService"

## Staged sheets are 64x64 cells on a four-row directional grid. The measured
## opaque foot row is 43, so the cell is offset to plant those feet exactly on
## the host actor's own visual foot line instead of on the cell box.
const SOURCE_FRAME_SIZE := 64.0
const SOURCE_FOOT_ANCHOR_Y := 43.0
## CraftPix freebie characters are authored on a 64px cell and read slightly
## small beside A0's 120x80 Knight art; this keeps the silhouette consistent.
const ACTOR_SCALE := 1.25
const MOVING_EPSILON := 6.0
const RUN_SPEED_THRESHOLD := 120.0
const DIAGNOSTIC_TEXT := "NHÂN VẬT CHƯA CÀI ART (PRIVATE STAGING)"

const STATUS_NO_SAVE := "NO_SAVE_SERVICE"
const STATUS_NO_IDENTITY := "NO_IDENTITY"
const STATUS_READY := "READY"
const STATUS_SOURCE_BLOCKED := "SOURCE_BLOCKED"

## Y of the host's own visual foot line, in host-local space. Knight art is
## 120x80 with the character standing on the last row, drawn from y=-31.
@export var host_visual_feet_y := 9.0

var _host: Node2D
var _host_sprite: AnimatedSprite2D
var _avatar_sprite: AnimatedSprite2D
var _diagnostic_label: Label
var _appearance: Dictionary = {}
var _status := STATUS_NO_IDENTITY
var _gender := ""
var _armor_grade := 0
var _reason := ""
var _action := "idle"
var _direction := "front"
var _last_direction := "front"
var _last_host_animation := &""
var _last_host_frame := -1
var _pipeline_ready := false


func _ready() -> void:
	_host = get_parent() as Node2D
	_host_sprite = _find_host_sprite()
	position = Vector2.ZERO
	if _host_sprite == null:
		_status = STATUS_SOURCE_BLOCKED
		_reason = "Host actor has no AnimatedSprite2D to present."
		push_warning("PlayerAvatarPresenter: %s" % _reason)
		return
	refresh()
	var save_service := get_node_or_null(SAVE_SERVICE_PATH)
	if save_service != null and save_service.has_signal(&"player_avatar_changed"):
		var avatar_changed := Callable(self, "refresh")
		if not save_service.is_connected(&"player_avatar_changed", avatar_changed):
			save_service.connect(&"player_avatar_changed", avatar_changed)
	if save_service != null and save_service.has_signal(&"save_loaded"):
		var save_loaded := Callable(self, "refresh")
		if not save_service.is_connected(&"save_loaded", save_loaded):
			save_service.connect(&"save_loaded", save_loaded)


func _exit_tree() -> void:
	_teardown_avatar_sprite()


## Re-resolves A0 identity and the licensed art record. Safe to call at any time;
## a blocked result removes the avatar rather than inventing one.
func refresh() -> void:
	if _host_sprite == null:
		return
	var save_service := get_node_or_null(SAVE_SERVICE_PATH)
	if save_service == null or not save_service.has_method(&"get_player_appearance_projection"):
		_apply_blocked(STATUS_NO_SAVE, "", 0, "A0 SaveService is unavailable.")
		return
	var projection: Dictionary = save_service.call(&"get_player_appearance_projection")
	var gender := String(projection.get("gender", ""))
	if gender.is_empty():
		# No identity chosen yet: the authored A0 actor stays visible because
		# nothing has been claimed about the player's character.
		_teardown_avatar_sprite()
		_remove_diagnostic()
		_status = STATUS_NO_IDENTITY
		_gender = ""
		_armor_grade = 0
		_reason = "No player identity has been chosen yet."
		_action = "idle"
		_direction = _last_direction
		_host_sprite.visible = true
		_emit_state()
		return
	var manifest := _load_manifest()
	var resolved: Dictionary = PIPELINE.resolve_owner_appearance(projection, manifest)
	if String(resolved.get("status", "")) != "READY":
		_apply_blocked(
			STATUS_SOURCE_BLOCKED,
			gender,
			int(projection.get("armor_grade", 0)),
			String(resolved.get("reason", "Avatar art resolution failed.")),
		)
		return
	_appearance = resolved
	_pipeline_ready = true
	_status = STATUS_READY
	_gender = gender
	_armor_grade = int(resolved.get("armor_grade", 0))
	_reason = ""
	_mount_avatar_sprite()
	_host_sprite.visible = false
	_remove_diagnostic()
	_emit_state()
	_present_now(true)


func is_avatar_active() -> bool:
	return _status == STATUS_READY and is_instance_valid(_avatar_sprite)


func get_presentation_state() -> Dictionary:
	return {
		"status": _status,
		"gender": _gender,
		"armor_grade": _armor_grade,
		"reason": _reason,
		"action": _action,
		"direction": _direction,
		"private_art": _has_private_manifest(),
		"has_avatar_sprite": is_instance_valid(_avatar_sprite),
	}


func get_presented_action() -> String:
	return _action


func get_presented_direction() -> String:
	return _direction


func get_avatar_sprite() -> AnimatedSprite2D:
	return _avatar_sprite


func _process(_delta: float) -> void:
	if _status != STATUS_READY or not is_instance_valid(_avatar_sprite):
		return
	_present_now(false)


func _present_now(force: bool) -> void:
	if not _pipeline_ready or not is_instance_valid(_avatar_sprite) or _host_sprite == null:
		return
	var host_animation := String(_host_sprite.animation)
	var host_speed := _host_speed()
	var moving := host_speed > MOVING_EPSILON
	var action := _action_for_host(host_animation, moving, host_speed)
	var direction := _direction_for(_host_velocity())
	var host_frame := _host_sprite.frame
	var restart := force or _detect_host_restart(_host_sprite.animation, host_frame)
	_last_host_animation = _host_sprite.animation
	_last_host_frame = host_frame
	var presented := PIPELINE.present(_avatar_sprite, _appearance, action, direction, 1.0, restart)
	if not presented:
		# The pipeline refused this clip (missing row/action): fail closed rather
		# than silently showing an unrelated animation.
		_apply_blocked(
			STATUS_SOURCE_BLOCKED,
			_gender,
			_armor_grade,
			"Licensed avatar clip '%s/%s' is unavailable." % [action, direction],
		)
		return
	_last_direction = direction
	if _action != action or _direction != direction:
		_action = action
		_direction = direction
		_emit_state()


func _action_for_host(host_animation: String, moving: bool, host_speed: float) -> String:
	var animation_name := host_animation.to_lower()
	if animation_name.contains("death"):
		return "death"
	if animation_name.contains("hit") or animation_name.contains("hurt"):
		return "hurt"
	if animation_name.contains("attack"):
		if moving:
			return "run_attack" if host_speed >= RUN_SPEED_THRESHOLD else "walk_attack"
		return "attack"
	if animation_name == "run":
		return "run"
	if animation_name.contains("walk") or animation_name.contains("slide") \
			or animation_name.contains("roll") or animation_name.contains("dash") \
			or animation_name.contains("crouch") or animation_name.contains("jump") \
			or animation_name.contains("fall"):
		return "walk"
	if moving:
		return "run" if host_speed >= RUN_SPEED_THRESHOLD else "walk"
	return "idle"


func _direction_for(velocity: Vector2) -> String:
	# The Knight retains a facing direction even while standing still or locked
	# into an attack; preferring it keeps a swing facing the direction the player
	# aimed instead of snapping back to the last walk direction.
	if _host != null and _host.has_method(&"get_facing_direction"):
		var facing_value: Variant = _host.call(&"get_facing_direction")
		if facing_value is Vector2 and (facing_value as Vector2).length() > 0.01:
			return _direction_from_vector(facing_value)
	if velocity.length() <= MOVING_EPSILON:
		return _last_direction
	return _direction_from_vector(velocity)


func _direction_from_vector(direction: Vector2) -> String:
	if absf(direction.x) >= absf(direction.y):
		return "side_right" if direction.x > 0.0 else "side_left"
	return "front" if direction.y > 0.0 else "back"


## The host keeps playing its own (hidden) animation, so a frame counter that
## moves backwards means a fresh attack/hurt was triggered and the avatar clip
## must restart exactly once. Otherwise the clip is never rewound, which is what
## removes the per-frame flicker seen in the previous A6 attempt.
func _detect_host_restart(host_animation: StringName, host_frame: int) -> bool:
	if host_animation != _last_host_animation:
		return false
	if _last_host_frame < 0:
		return false
	return host_frame < _last_host_frame


func _host_velocity() -> Vector2:
	if _host is CharacterBody2D:
		return (_host as CharacterBody2D).velocity
	return Vector2.ZERO


func _host_speed() -> float:
	return _host_velocity().length()


func _find_host_sprite() -> AnimatedSprite2D:
	if _host == null:
		return null
	var candidate := _host.get_node_or_null(^"Sprite") as AnimatedSprite2D
	if candidate != null:
		return candidate
	for child: Node in _host.get_children():
		if child is AnimatedSprite2D:
			return child as AnimatedSprite2D
	return null


func _mount_avatar_sprite() -> void:
	if _avatar_sprite == null or not is_instance_valid(_avatar_sprite):
		_avatar_sprite = AnimatedSprite2D.new()
		_avatar_sprite.name = "AvatarSprite"
		_avatar_sprite.centered = true
		add_child(_avatar_sprite)
	_avatar_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_avatar_sprite.visible = true
	_avatar_sprite.z_index = 0
	_avatar_sprite.scale = Vector2(ACTOR_SCALE, ACTOR_SCALE)
	# Plant the source foot row on the host actor's own foot line, not the box.
	_avatar_sprite.position = Vector2(
		0.0,
		host_visual_feet_y - (SOURCE_FOOT_ANCHOR_Y - SOURCE_FRAME_SIZE * 0.5) * ACTOR_SCALE
	)


func _teardown_avatar_sprite() -> void:
	_pipeline_ready = false
	if is_instance_valid(_avatar_sprite):
		_avatar_sprite.queue_free()
	_avatar_sprite = null
	_appearance = {}


func _apply_blocked(status: String, gender: String, grade: int, reason: String) -> void:
	_teardown_avatar_sprite()
	_status = status
	_gender = gender
	_armor_grade = grade
	_reason = reason
	if _host_sprite != null:
		# No Knight/Swordsman stand-in once an identity has been claimed.
		_host_sprite.visible = false
	_show_diagnostic()
	push_warning("PlayerAvatarPresenter: %s" % reason)
	_emit_state()


func _show_diagnostic() -> void:
	if _diagnostic_label != null and is_instance_valid(_diagnostic_label):
		return
	_diagnostic_label = Label.new()
	_diagnostic_label.name = "AvatarUnavailable"
	_diagnostic_label.text = DIAGNOSTIC_TEXT
	_diagnostic_label.position = Vector2(-96, -62)
	_diagnostic_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_diagnostic_label.add_theme_font_size_override("font_size", 8)
	_diagnostic_label.add_theme_color_override("font_color", Color(1.0, 0.42, 0.62, 1.0))
	add_child(_diagnostic_label)


func _remove_diagnostic() -> void:
	if _diagnostic_label != null and is_instance_valid(_diagnostic_label):
		_diagnostic_label.queue_free()
	_diagnostic_label = null


func _emit_state() -> void:
	avatar_presentation_changed.emit(get_presentation_state())


func _has_private_manifest() -> bool:
	return FileAccess.file_exists(PRIVATE_MANIFEST_PATH)


## Private staged art wins when present; the public manifest stays source-blocked
## by design, so a clean clone of this repository shows the honest gate instead
## of unlicensed or substitute sprites.
func _load_manifest() -> Dictionary:
	for path: String in [PRIVATE_MANIFEST_PATH, PUBLIC_MANIFEST_PATH]:
		if not FileAccess.file_exists(path):
			continue
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
		if parsed is Dictionary:
			return parsed
	return {}
