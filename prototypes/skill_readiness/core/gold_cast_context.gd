class_name Gold93CastContext
extends RefCounted

## A reusable input envelope for native Gold source spells.
## This is NOT a gameplay decision: resources, cast mode, damage and cooldown
## stay unset until the user supplies approved CombatRules/InputRules.
##
## The envelope is engine-neutral and supports the full future control space:
## tap, hold, drag-release, target pick, free 360-degree aim vector, trajectory
## path and multi-stage casts. The original unidirectional demo geometry is
## never forced on the host.

var caster_ref: WeakRef
var world_origin: Vector2 = Vector2.ZERO
var aim_world: Vector2 = Vector2.ZERO
var aim_direction: Vector2 = Vector2.ZERO
var aim_is_set: bool = false
var drag_path: PackedVector2Array = PackedVector2Array()
var target_refs: Array[WeakRef] = []
var original_source_seed: int = 0
var fixed_source_tick: int = 0
var world_to_screen: Transform2D = Transform2D.IDENTITY
var gameplay_rules: Dictionary = {}
var user_input_rules: Dictionary = {}
var ports: Dictionary = {}
var is_diagnostic_lab: bool = true

## Placement of the ORIGINAL source logical space inside the host world.
## Scale carries the family's native pixel budget (Venom 600x340 logical at
## Ultra k2, ARCANA 480x270), never an upscaled 1x frame.
var source_to_world_t: Transform2D = Transform2D.IDENTITY

## Optional camera/zoom transform recorded for post, shake and framing cues.
var camera_zoom: float = 1.0
var camera_offset: Vector2 = Vector2.ZERO

## Map occupancy read interface (read-only) supplied by the host.
var map_occupancy: Callable = Callable()

var _ports_bundle = null


func initialize(caster: Node2D, origin: Vector2, source_seed: int,
		diagnostic_lab: bool = true) -> void:
	caster_ref = weakref(caster) if is_instance_valid(caster) else null
	world_origin = origin
	original_source_seed = source_seed
	fixed_source_tick = 0
	aim_is_set = false
	aim_direction = Vector2.ZERO
	aim_world = origin
	drag_path = PackedVector2Array()
	target_refs.clear()
	gameplay_rules.clear()
	user_input_rules.clear()
	ports.clear()
	source_to_world_t = Transform2D.IDENTITY.translated(origin)
	camera_zoom = 1.0
	camera_offset = Vector2.ZERO
	is_diagnostic_lab = diagnostic_lab
	_ports_bundle = null


## --- source <-> world transform ---------------------------------------------

func set_source_to_world(xform: Transform2D) -> void:
	source_to_world_t = xform


func source_to_world() -> Transform2D:
	return source_to_world_t


func source_from_world(point: Vector2) -> Vector2:
	return source_to_world_t.inverse() * point


func world_from_source(point: Vector2) -> Vector2:
	return source_to_world_t * point


func caster_source_position() -> Vector2:
	return source_to_world_t.inverse() * world_origin


## --- aim / input envelope ----------------------------------------------------

func set_world_aim(point: Vector2) -> bool:
	var diff: Vector2 = point - world_origin
	if diff.length_squared() < 0.000001:
		return false
	aim_world = point
	aim_direction = diff.normalized()
	aim_is_set = true
	return true


func set_aim_direction(direction: Vector2) -> bool:
	if direction.length_squared() < 0.000001:
		return false
	aim_direction = direction.normalized()
	aim_world = world_origin + aim_direction * 100.0
	aim_is_set = true
	return true


func set_drag_path(points: PackedVector2Array) -> bool:
	if points.size() < 2:
		return false
	drag_path = points.duplicate()
	return set_world_aim(points[points.size() - 1])


func clear_aim() -> void:
	aim_is_set = false
	aim_direction = Vector2.ZERO
	aim_world = world_origin
	drag_path = PackedVector2Array()


## --- targets ------------------------------------------------------------------

func bind_target(target: Node2D) -> void:
	if is_instance_valid(target):
		target_refs.append(weakref(target))


func targets_alive() -> Array[Node2D]:
	var out: Array[Node2D] = []
	for record in target_refs:
		var obj: Node = record.get_ref() as Node
		if is_instance_valid(obj) and obj is Node2D and not obj.is_queued_for_deletion():
			out.append(obj as Node2D)
	return out


func target_key_for_source(source_id: int) -> String:
	## The host resolver owns the mapping from original source actor ids to real
	## game actors; without one the VFX key stays source-local and no gameplay is
	## touched.
	if _ports_bundle != null and _ports_bundle.targets != null:
		var key: String = _ports_bundle.targets.target_key_for(source_id)
		if not key.is_empty():
			return key
	return ""


## --- ports --------------------------------------------------------------------

func set_ports(bundle) -> void:
	_ports_bundle = bundle


func ensure_ports() -> void:
	if _ports_bundle == null:
		_ports_bundle = load(
			"res://prototypes/skill_readiness/core/gold93_ports.gd").Bundle.new(true)


func ports_bundle():
	return _ports_bundle


func bind_port(key: StringName, port: Callable) -> void:
	if port.is_valid():
		ports[key] = port


## --- map occupancy --------------------------------------------------------------

func set_map_occupancy(callable: Callable) -> void:
	map_occupancy = callable


func is_world_solid(point: Vector2) -> bool:
	if map_occupancy.is_valid():
		return bool(map_occupancy.call(point))
	return false


func is_source_solid(source_point: Vector2) -> bool:
	return is_world_solid(world_from_source(source_point))


## --- rules ------------------------------------------------------------------------

func has_production_rules() -> bool:
	if is_diagnostic_lab:
		return false
	# The rule schema is user-authored. A native cast is not gameplay-ready
	# until an explicitly approved rule packet is attached.
	return bool(gameplay_rules.get("user_approved", false)) and bool(
		user_input_rules.get("user_approved", false))


func to_diagnostic_row() -> Dictionary:
	return {
		"source_seed": original_source_seed,
		"tick": fixed_source_tick,
		"aim_is_set": aim_is_set,
		"aim_direction": aim_direction,
		"drag_points": drag_path.size(),
		"living_targets": targets_alive().size(),
		"production_rules_ready": has_production_rules(),
		"diagnostic_lab": is_diagnostic_lab,
		"source_to_world": source_to_world_t,
		"camera_zoom": camera_zoom,
	}
