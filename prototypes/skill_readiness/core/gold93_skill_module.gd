class_name Gold93SkillModule
extends RefCounted

## Contract every native Gold skill module implements.
##
## A module owns exactly one original skill's authored timeline. It is driven by
## the family runtime at the family's ORIGINAL fixed clock and emits typed
## intents; it never touches the game directly and never allocates scene nodes
## itself (the family runtime owns the render surfaces so cleanup is provable).

## Stable canonical id, e.g. `venomwright:001`.
var canonical_id: StringName = &""
var original_skill_id: int = 0
var family: StringName = &""

## Per-cast state -----------------------------------------------------------
var _cast_id: StringName = &""
var _bus = null
var _params: Gold93SkillParameters
var _source_tick: int = 0
var _cursor: int = 0
var _finished: bool = false


## --- metadata (overridden per skill) ---------------------------------------

func original_name() -> String:
	return ""


func source_variant() -> String:
	return ""


func registry_source_path() -> String:
	return ""


## One of: target, ground, cone, path, dir, multi, self, drag, mixed.
func target_semantics() -> String:
	return "target"


## Whether the original source supports re-aiming after the cast started.
func supports_retarget() -> bool:
	return false


## Whether the original source supports holding/drag path input.
func supports_drag_path() -> bool:
	return false


## Original authored source clock in Hz (Venom 60, ARCANA per-skill verified).
func source_hz() -> float:
	return 60.0


## Native raster density relative to the family logical resolution.
func native_raster_density() -> int:
	return 2


## Total authored cast length in source seconds; -1 while unknown.
func authored_duration_seconds() -> float:
	return -1.0


## Dependency ids this module needs from the family runtime.
func required_components() -> PackedStringArray:
	return PackedStringArray()


## False when the ORIGINAL authored generator could not be source-locked (for
## example because the original archive bytes are unavailable). A module that
## returns false must refuse to render instead of approximating Gold.
func has_source_locked_generator() -> bool:
	return false


## Explicit, human-readable blocker when the generator is not source-locked.
func source_material_blocker() -> String:
	return ""


## --- lifecycle --------------------------------------------------------------

func begin(cast_id: StringName, bus, params: Gold93SkillParameters) -> void:
	_cast_id = cast_id
	_bus = bus
	_params = params
	_source_tick = 0
	_cursor = 0
	_finished = false


func cast_id() -> StringName:
	return _cast_id


func bus():
	return _bus


func params() -> Gold93SkillParameters:
	return _params


func next_cursor() -> int:
	_cursor += 1
	return _cursor


func emit(intent: Dictionary) -> Dictionary:
	if _bus == null:
		return intent
	return _bus.emit(intent)


func admit_hit(kind: StringName, target_key: String, source_cursor: int) -> bool:
	if _bus == null:
		return false
	return _bus.admit_hit(kind, source_cursor, target_key)


func source_tick() -> int:
	return _source_tick


func is_finished() -> bool:
	return _finished


## Advance exactly one ORIGINAL fixed source tick.
## `targets` is in original source actor shape; `aim` is a source-space aim
## record produced by the family runtime from the CastContext 360-degree input.
func step_source_tick(_targets: Array, _aim: Dictionary) -> void:
	_source_tick += 1


func update_aim(_aim: Dictionary) -> void:
	pass


## Visual/environment payload the family runtime rasterises this tick.
func frame_payload() -> Dictionary:
	return {}


## The live ORIGINAL source runtime object this module drives (family-specific).
## Null for modules that do not expose one. Used by the family renderer and by
## headless numeric tests.
func source_runtime():
	return null


## Back-reference to the CastContext, used by the family runtime to reach the
## injected ports without the module touching the game itself.
func context_ref():
	return _context_ref


func bind_context(ctx) -> void:
	_context_ref = ctx


var _context_ref = null


func cancel() -> void:
	_finished = true


func dispose() -> void:
	_bus = null
	_params = null


func stats() -> Dictionary:
	return {
		"canonical_id": String(canonical_id),
		"source_tick": _source_tick,
		"cursor": _cursor,
		"finished": _finished,
		"source_locked_generator": has_source_locked_generator(),
	}
