class_name Gold93SkillHandle
extends RefCounted

## Live lifecycle owner for one native Gold cast.
##
## Guarantees required by the epic:
##  * deterministic `tick_source` at the family's ORIGINAL fixed clock,
##  * free 360-degree re-aim / drag-path retarget while the cast is running,
##  * hard cancellation with no stale intents emitted afterwards,
##  * provable release of every texture / node / audio / shader resource,
##  * identical result hash when replayed with the same seed, aim and targets.

enum Status {
	BLOCKED,
	READY,
	RUNNING,
	FINISHED,
	CANCELLED,
	DISPOSED,
}

const STATUS_NAMES: Array[String] = [
	"BLOCKED", "READY", "RUNNING", "FINISHED", "CANCELLED", "DISPOSED",
]

var canonical_id: StringName = &""
var cast_id: StringName = &""
var status: int = Status.BLOCKED
var block_reason: String = ""

var module: Gold93SkillModule
var family_runtime = null
var context = null
var parameters: Gold93SkillParameters
var bus = null

var source_tick: int = 0
var started: bool = false
var _owned_nodes: Array[Node] = []
var _released: bool = false


func _init(id: StringName, module_instance: Gold93SkillModule, family: Variant,
		ctx: Variant, params: Gold93SkillParameters, intent_bus: Variant) -> void:
	canonical_id = id
	cast_id = StringName("%s#%d" % [id, randi() & 0x7FFFFFFF])
	module = module_instance
	family_runtime = family
	context = ctx
	parameters = params
	bus = intent_bus
	if module == null or family_runtime == null or bus == null:
		status = Status.BLOCKED
		if block_reason.is_empty():
			block_reason = "NO_SOURCE_LOCKED_MODULE"
	else:
		status = Status.READY
		module.begin(cast_id, bus, params)


func is_blocked() -> bool:
	return status == Status.BLOCKED


func status_name() -> String:
	return STATUS_NAMES[clampi(status, 0, STATUS_NAMES.size() - 1)]


## ---------------------------------------------------------------------------
## Lifecycle
## ---------------------------------------------------------------------------

func start() -> bool:
	if status != Status.READY:
		return false
	status = Status.RUNNING
	started = true
	source_tick = 0
	return true


func tick_source(steps: int = 1) -> int:
	## Advances N ORIGINAL fixed source ticks. Safe to call after completion:
	## a finished or cancelled cast never emits another intent.
	if status != Status.RUNNING:
		return source_tick
	for _i in range(maxi(0, steps)):
		var targets := _resolve_targets()
		var aim := _aim_record()
		module.step_source_tick(targets, aim)
		source_tick += 1
		if family_runtime != null and family_runtime.has_method("after_tick"):
			family_runtime.after_tick(module, source_tick)
		if bool(module.is_finished()):
			status = Status.FINISHED
			break
	return source_tick


func run_to_completion(max_ticks: int = 4096) -> int:
	if status == Status.READY:
		start()
	var guard: int = 0
	while status == Status.RUNNING and guard < max_ticks:
		tick_source(1)
		guard += 1
	return source_tick


func update_aim(world_point: Vector2) -> bool:
	## Free 360-degree re-aim: the original demo's fixed direction is NOT forced.
	if status != Status.RUNNING and status != Status.READY:
		return false
	if context == null:
		return false
	if not context.set_world_aim(world_point):
		return false
	module.update_aim(_aim_record())
	return true


func set_drag_path(world_points: PackedVector2Array) -> bool:
	if status != Status.RUNNING and status != Status.READY:
		return false
	if context == null or not context.set_drag_path(world_points):
		return false
	module.update_aim(_aim_record())
	return true


func cancel() -> bool:
	if status == Status.DISPOSED:
		return false
	if status == Status.BLOCKED:
		status = Status.CANCELLED
		return true
	if status in [Status.FINISHED, Status.CANCELLED]:
		return false
	status = Status.CANCELLED
	if module != null:
		module.cancel()
	release_resources()
	return true


func dispose() -> void:
	if status == Status.DISPOSED:
		return
	if module != null:
		module.cancel()
		module.dispose()
	release_resources()
	status = Status.DISPOSED
	module = null


## Releases every resource the cast owns: render surfaces, terrain marks,
## audio cues, camera ops. Returns the number of released items so tests can
## assert teardown actually happened.
func release_resources() -> int:
	var released: int = 0
	if family_runtime != null and family_runtime.has_method("release_cast"):
		released += int(family_runtime.release_cast(cast_id))
	if context != null and context.has_method("ports_bundle"):
		var bundle = context.ports_bundle()
		if bundle != null:
			if bundle.terrain != null:
				released += bundle.terrain.clear_visuals(cast_id)
			if bundle.sound != null:
				released += bundle.sound.stop_all(cast_id)
	for n in _owned_nodes:
		if is_instance_valid(n) and not n.is_queued_for_deletion():
			n.queue_free()
			released += 1
	_owned_nodes.clear()
	_released = true
	return released


func owns(node: Node) -> void:
	if is_instance_valid(node):
		_owned_nodes.append(node)


## ---------------------------------------------------------------------------
## Results / evidence
## ---------------------------------------------------------------------------

func result() -> Dictionary:
	var bus_stats: Dictionary = bus.stats() if bus != null else {}
	var module_stats: Dictionary = module.stats() if module != null else {}
	var terrain_stats: Dictionary = {}
	var combat_stats: Dictionary = {}
	if context != null and context.has_method("ports_bundle"):
		var bundle = context.ports_bundle()
		if bundle != null:
			terrain_stats = bundle.terrain.stats()
			combat_stats = bundle.combat.stats()
	return {
		"canonical_id": String(canonical_id),
		"cast_id": String(cast_id),
		"status": status_name(),
		"block_reason": block_reason,
		"source_tick": source_tick,
		"source_locked_generator": bool(module_stats.get("source_locked_generator", false)),
		"module": module_stats,
		"intents": bus_stats,
		"terrain": terrain_stats,
		"combat": combat_stats,
		"released": _released,
		"parameters": parameters.to_diagnostic_row() if parameters != null else {},
	}


func trace_digest() -> String:
	return bus.trace_digest() if bus != null else ""


func intents_by_kind(kind: StringName) -> Array[Dictionary]:
	return bus.by_kind(kind) if bus != null else []


## ---------------------------------------------------------------------------
## Internal
## ---------------------------------------------------------------------------

func _resolve_targets() -> Array:
	if context == null:
		return []
	var bundle = context.ports_bundle() if context.has_method("ports_bundle") else null
	if bundle == null or bundle.targets == null:
		return []
	var source_to_world: Transform2D = context.source_to_world()
	var caster_source: Vector2 = context.caster_source_position()
	return bundle.targets.resolve(source_to_world.inverse(), caster_source)


func _aim_record() -> Dictionary:
	if context == null:
		return {}
	if family_runtime != null and family_runtime.has_method("make_aim_record"):
		return family_runtime.make_aim_record(context)
	return {
		"aim_is_set": bool(context.aim_is_set),
		"source_aim": context.source_to_world().inverse() * context.aim_world,
		"source_direction": context.aim_direction,
		"drag_points": context.drag_path.size(),
	}
