class_name Gold93ExternalAdapter
extends RefCounted

## Reference host adapter (G7 handoff contract).
##
## Consumes ANY of the 93 canonical ids without recoding or rewriting a single
## line of VFX. The host only supplies:
##   * a caster anchor and a free 360-degree aim / drag path / target pick,
##   * live actors through a TargetResolver,
##   * optionally an approved gameplay rule packet,
##   * optionally a real combat authority (e.g. SOH CombatDamage) behind a port.
##
## Nothing here decides balance. Every gameplay field is nullable and the adapter
## refuses to apply damage while any required slot is unconfigured.

const RUNTIME = preload("res://prototypes/skill_readiness/core/gold93_runtime.gd")
const CONTEXT = preload("res://prototypes/skill_readiness/core/gold_cast_context.gd")
const PARAMS = preload("res://prototypes/skill_readiness/core/gold93_parameters.gd")
const PORTS = preload("res://prototypes/skill_readiness/core/gold93_ports.gd")
const INTENTS = preload("res://prototypes/skill_readiness/core/gold93_intents.gd")

## Host-supplied combat authority. `apply_damage` / `apply_status` receive
## already deduplicated, once-only hit intents.
class CallableCombatPort extends Gold93Ports.CombatPort:
	var _alive: Callable
	var _damage: Callable
	var _status: Callable
	var _configured: bool = false

	func _init(alive: Callable, damage: Callable, status: Callable,
			configured: bool = false) -> void:
		_alive = alive
		_damage = damage
		_status = status
		_configured = configured

	func is_alive(target_key: String) -> bool:
		return _alive.is_valid() and bool(_alive.call(target_key))

	func is_configured() -> bool:
		return _configured

	func apply_damage(target_key: String, amount: float, hit_world: Vector2,
			cue: StringName, intent: Dictionary) -> bool:
		if not _configured or not _damage.is_valid():
			return false
		return bool(_damage.call(target_key, amount, hit_world, cue, intent))

	func apply_status(target_key: String, status_id: StringName, duration: float,
			magnitude: float, intent: Dictionary) -> bool:
		if not _configured or not _status.is_valid():
			return false
		return bool(_status.call(target_key, status_id, duration, magnitude, intent))


var runtime
## Approved rule packets, keyed by canonical id. Until the project owner fills
## one in, every cast stays VFX-only.
var approved_rules: Dictionary = {}
var _active: Array = []


func _init() -> void:
	runtime = RUNTIME.new()


## --- configuration (owner-owned, never invented) --------------------------------

## Returns the empty slot names. A packet is only accepted when every slot the
## schema requires is present and non-null.
func validate_rules(rules: Dictionary) -> PackedStringArray:
	var missing := PackedStringArray()
	for slot in PARAMS.GAMEPLAY_SLOTS:
		if not rules.has(slot) or rules[slot] == null:
			missing.append(slot)
	return missing


func configure(canonical_id: String, rules: Dictionary) -> bool:
	if not runtime.catalog.has_skill(canonical_id):
		push_error("Gold93ExternalAdapter: unknown canonical id " + canonical_id)
		return false
	var missing := validate_rules(rules)
	if not missing.is_empty():
		push_error("Gold93ExternalAdapter: incomplete rules for %s, missing %s"
				% [canonical_id, str(Array(missing))])
		return false
	approved_rules[canonical_id] = rules.duplicate(true)
	return true


func is_configured(canonical_id: String) -> bool:
	return approved_rules.has(canonical_id)


## --- casting ---------------------------------------------------------------------

## `ports` may be omitted; a recording (no-op) bundle is used by default so the
## VFX runs without touching any game system.
func cast(canonical_id: String, caster: Node2D, aim_world: Vector2,
		targets: Array = [], rules: Dictionary = {},
		ports = null, drag_path: PackedVector2Array = PackedVector2Array()):
	if not runtime.catalog.has_skill(canonical_id):
		push_error("Gold93ExternalAdapter: unknown canonical id " + canonical_id)
		return null
	var ctx := CONTEXT.new()
	ctx.initialize(caster, caster.global_position, _seed_for(canonical_id),
			not approved_rules.has(canonical_id))
	ctx.set_world_aim(aim_world)
	if drag_path.size() >= 2:
		ctx.set_drag_path(drag_path)

	var bundle = ports
	if bundle == null:
		bundle = PORTS.Bundle.new(true)
		bundle.targets.set_actors(targets)
	elif bundle.targets != null and not targets.is_empty():
		bundle.targets.set_actors(targets)
	ctx.set_ports(bundle)

	var params := PARAMS.new(true)
	if rules.is_empty() and approved_rules.has(canonical_id):
		rules = approved_rules[canonical_id]
	if not rules.is_empty():
		if not params.set_gameplay(rules, true):
			push_error("Gold93ExternalAdapter: refusing partial rules for " + canonical_id)
	else:
		params.provenance = "VFX_ONLY_UNCONFIGURED"

	var handle = runtime.cast(StringName(canonical_id), ctx, params)
	if handle.is_blocked():
		push_warning("Gold93ExternalAdapter: %s is not castable yet — %s"
				% [canonical_id, handle.block_reason])
		return handle
	handle.start()
	_active.append(handle)
	return handle


func tick_all(steps: int = 1) -> void:
	for i in range(_active.size() - 1, -1, -1):
		var h = _active[i]
		h.tick_source(steps)
		if h.status in [Gold93SkillHandle.Status.FINISHED,
				Gold93SkillHandle.Status.CANCELLED,
				Gold93SkillHandle.Status.DISPOSED]:
			_active.remove_at(i)


func cancel_all() -> void:
	for h in _active:
		h.cancel()
	_active.clear()


func _seed_for(_canonical_id: String) -> int:
	# Host-owned policy: the adapter never invents a gameplay seed either.
	return 0


## --- handoff helpers ---------------------------------------------------------------

## Everything a future overworld integration PR needs to know about one id.
func handoff_descriptor(canonical_id: String) -> Dictionary:
	var entry: Dictionary = runtime.catalog.skill(canonical_id)
	if entry.is_empty():
		return {}
	return {
		"canonical_id": canonical_id,
		"original_name": String(entry.get("original_name", "")),
		"family": String(entry.get("family", "")),
		"target_semantics": String(entry.get("source_target_class", "")),
		"module_path": runtime.module_path_for(canonical_id),
		"native_executable": runtime.can_cast(canonical_id),
		"blocker": runtime.catalog.blocker(canonical_id),
		"controls": runtime.catalog.supported_controls(canonical_id),
		"dependencies": Array(runtime.catalog.dependency_graph(canonical_id)),
		"configurable_slots": PARAMS.GAMEPLAY_SLOTS,
		"configured": is_configured(canonical_id),
		"integration_touch_points": [
			"CombatPort.apply_damage / apply_status (once-only admission)",
			"TerrainPort.write_visual (cosmetic ground marks)",
			"SoundPort.play (Gold-authored cues only)",
			"CameraPort.apply (shake / shock / framing)",
			"TargetResolver.resolve (live actors -> source actor shape)",
		],
	}


func handoff_all() -> Array:
	var out: Array = []
	for id in runtime.catalog.ids():
		out.append(handoff_descriptor(id))
	return out
