class_name Gold93FamilyRuntime
extends RefCounted

## Base adapter between the unified Gold93 cast API and ONE original engine
## family. The two original engines must never share a renderer, a clock or an
## RNG stream:
##   * Venomwright  -> CPU procedural raster, 600x340 logical, native Ultra k2
##                     1200x680, authored 60 Hz, zero seed stays 0.
##   * ARCANA III   -> PixiJS8 multipass, 480x270 logical, its own per-skill
##                     reseed, zero seed maps to 1.
##
## A family runtime owns every render surface so that teardown is provable, and
## it is the only place where intents reach the injected ports.

var density: int = 2
var canvas_parent: Node = null
var attached: bool = false
var _owned_nodes: Array[Node] = []
var _dispatch_cursors: Dictionary = {}
var dispatched_intents: int = 0


## --- family identity (overridden) ------------------------------------------

func family_id() -> StringName:
	return &""


func logical_size() -> Vector2i:
	return Vector2i(0, 0)


func default_hz() -> float:
	return 60.0


func default_density() -> int:
	return 2


func arcana_zero_seed_policy() -> bool:
	return false


func native_frame_size() -> Vector2i:
	return logical_size() * density


## --- canvas ownership -------------------------------------------------------

func attach(parent: Node, requested_density: int = -1) -> bool:
	if not is_instance_valid(parent):
		return false
	canvas_parent = parent
	density = default_density() if requested_density <= 0 else requested_density
	attached = build_surfaces(parent)
	return attached


func build_surfaces(_parent: Node) -> bool:
	## Overridden per family. Must push every created node into _owned_nodes.
	return false


func detach() -> int:
	var released: int = 0
	for n in _owned_nodes:
		if is_instance_valid(n) and not n.is_queued_for_deletion():
			n.queue_free()
			released += 1
	_owned_nodes.clear()
	attached = false
	canvas_parent = null
	return released


func owns(node: Node) -> void:
	if is_instance_valid(node):
		_owned_nodes.append(node)


func release_cast(_cast_id: StringName) -> int:
	## Overridden: hide/render-empty every surface owned by a finished cast.
	return 0


## --- input envelope ---------------------------------------------------------

func make_aim_record(ctx) -> Dictionary:
	## Projects the user's free 360-degree world aim / drag path into the
	## original source space. The original unidirectional demo geometry is NOT
	## forced: any direction, any path and any target pick is representable.
	var source_to_world: Transform2D = ctx.source_to_world()
	var inverse: Transform2D = source_to_world.inverse()
	var world_origin: Vector2 = ctx.world_origin
	var origin_source: Vector2 = inverse * world_origin
	var aim_source: Vector2 = inverse * ctx.aim_world
	var dir_source: Vector2 = Vector2.ZERO
	if bool(ctx.aim_is_set):
		dir_source = (aim_source - origin_source)
		if dir_source.length_squared() > 0.000001:
			dir_source = dir_source.normalized()
	var drag_source := PackedVector2Array()
	for p in ctx.drag_path:
		drag_source.append(inverse * p)
	return {
		"aim_is_set": bool(ctx.aim_is_set),
		"world_origin": world_origin,
		"world_aim": ctx.aim_world,
		"source_origin": origin_source,
		"source_aim": aim_source,
		"source_direction": dir_source,
		"source_angle": atan2(dir_source.y, dir_source.x) if dir_source.length_squared() > 0.0 else 0.0,
		"drag_source": drag_source,
		"drag_points": ctx.drag_path.size(),
	}


## --- per-tick driver --------------------------------------------------------

func after_tick(module: Gold93SkillModule, _tick: int) -> void:
	dispatch_pending_intents(module)
	render_tick(module, _tick)


func render_tick(_module: Gold93SkillModule, _tick: int) -> void:
	## Overridden per family. No-op while unattached (headless numeric runs).
	pass


## --- intent routing ---------------------------------------------------------

## Routes newly emitted intents to the injected ports exactly once.
## Combat is only forwarded when the host explicitly configured gameplay rules;
## otherwise the intent is recorded as rejected, never invented.
func dispatch_pending_intents(module: Gold93SkillModule) -> int:
	if module == null or module.bus() == null:
		return 0
	# Ports live on the context; the module only holds a back-reference so the
	# VFX itself never reaches into the game.
	var ctx = module.context_ref() if module.has_method("context_ref") else null
	if ctx == null:
		return 0
	var ports = ctx.ports_bundle() if ctx.has_method("ports_bundle") else null
	if ports == null:
		return 0
	var emitted: Array = module.bus().emitted
	var cursor: int = int(_dispatch_cursors.get(module.cast_id(), 0))
	var count: int = 0
	while cursor < emitted.size():
		var intent: Dictionary = emitted[cursor]
		cursor += 1
		_route(ports, intent, module)
		count += 1
	_dispatch_cursors[module.cast_id()] = cursor
	dispatched_intents += count
	return count


func _route(ports, intent: Dictionary, module: Gold93SkillModule) -> void:
	var kind := StringName(intent.get("kind", &""))
	match kind:
		Gold93Intents.KIND_DAMAGE:
			var target_key := String(intent.get("target_key", ""))
			var cursor: int = int(intent.get("source_cursor", -1))
			if not module.admit_hit(&"damage", target_key, cursor):
				return
			var world_hit: Vector2 = intent.get("source_to_world", Transform2D.IDENTITY) * intent.get("source_pos", Vector2.ZERO)
			ports.combat.apply_damage(target_key, float(intent.get("amount", 0.0)),
					world_hit, StringName(intent.get("cue", &"")), intent)
		Gold93Intents.KIND_STATUS:
			var t_key := String(intent.get("target_key", ""))
			if not module.admit_hit(&"status", t_key, int(intent.get("source_cursor", -1))):
				return
			ports.combat.apply_status(t_key, StringName(intent.get("status_id", &"")),
					float(intent.get("duration", 0.0)),
					float(intent.get("magnitude", 0.0)), intent)
		Gold93Intents.KIND_TERRAIN_VISUAL:
			ports.terrain.write_visual(intent.get("source_pos", Vector2.ZERO),
					StringName(intent.get("op", &"")), intent.get("extra", {}))
		Gold93Intents.KIND_SOUND:
			ports.sound.play(StringName(intent.get("cue_id", &"")),
					intent.get("source_pos", Vector2.ZERO), intent.get("extra", {}))
		Gold93Intents.KIND_CAMERA:
			ports.camera.apply(StringName(intent.get("op", &"")),
					float(intent.get("strength", 0.0)),
					float(intent.get("duration", 0.0)), intent.get("extra", {}))
		_:
			pass


func stats() -> Dictionary:
	return {
		"family": String(family_id()),
		"logical_size": logical_size(),
		"density": density,
		"native_frame_size": native_frame_size(),
		"hz": default_hz(),
		"attached": attached,
		"owned_nodes": _owned_nodes.size(),
		"dispatched_intents": dispatched_intents,
		"tracked_casts": _dispatch_cursors.size(),
	}
