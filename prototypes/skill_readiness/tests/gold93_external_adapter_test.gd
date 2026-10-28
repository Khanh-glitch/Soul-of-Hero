extends SceneTree

## Host adapter contract (G7 handoff gate).
##
## Proves the reference adapter in
## `prototypes/skill_readiness/integration/external_adapter_sample.gd` really
## runs as a host would use it, without recoding a single line of VFX:
##
##   1. an unknown canonical id is rejected,
##   2. a catalogued id with no source-locked module returns a BLOCKED handle
##      carrying the precise material blocker and never ticks,
##   3. the one source-locked module casts, ticks to completion and emits its
##      authored cues through the adapter,
##   4. while gameplay rules are unconfigured the cast is strictly VFX-only —
##      zero health mutation, every hit rejected by the combat authority,
##   5. a PARTIAL rule packet is refused (no slot may be silently defaulted),
##   6. once the owner supplies a COMPLETE packet AND an approved combat
##      authority, the same VFX applies each authored hit exactly once,
##   7. `handoff_all()` describes all 93 ids with honest per-id readiness.
##
## The complete rule packet below contains NO gameplay numbers: every slot is
## filled with the sentinel string `TEST_ONLY_SENTINEL` so the test exercises
## the GATE, not a balance decision. Damage amounts still come from the ORIGINAL
## authored source cues, never from this file.

const ADAPTER = preload("res://prototypes/skill_readiness/integration/external_adapter_sample.gd")
const PORTS = preload("res://prototypes/skill_readiness/core/gold93_ports.gd")
const PARAMS = preload("res://prototypes/skill_readiness/core/gold93_parameters.gd")

const CASTER_ID := "venomwright:001"
const BLOCKED_ID := "arcana_iii:001"
const SENTINEL := "TEST_ONLY_SENTINEL"

var _failures: Array[String] = []
var _checks: int = 0

var _applied: Array[Dictionary] = []
var _statuses: Array[Dictionary] = []
var _rejected: int = 0


func _check(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error("GOLD93_ADAPTER: " + message)


func _actors() -> Array:
	return [
		{"id": 1, "x": 340.0, "y": 170.0, "r": 7.0, "exists": true, "dying": 0.0},
		{"id": 2, "x": 392.0, "y": 196.0, "r": 6.0, "exists": true, "dying": 0.0},
	]


func _caster() -> Node2D:
	var node := Node2D.new()
	node.name = "Gold93AdapterCaster"
	node.global_position = Vector2(200.0, 170.0)
	root.add_child(node)
	return node


func _complete_rules() -> Dictionary:
	var rules: Dictionary = {}
	for slot in PARAMS.GAMEPLAY_SLOTS:
		rules[String(slot)] = SENTINEL
	return rules


func _partial_rules() -> Dictionary:
	var rules := _complete_rules()
	rules.erase("damage")
	rules.erase("cooldown_seconds")
	rules["mana_cost"] = null
	return rules


func _alive_callable() -> Callable:
	return func(target_key: String) -> bool:
		return target_key.begins_with("source:")


func _damage_callable() -> Callable:
	var sink: Array[Dictionary] = _applied
	return func(_target_key: String, amount: float, hit_world: Vector2,
			cue: StringName, intent: Dictionary) -> bool:
		sink.append({
			"amount": amount,
			"hit_world": hit_world,
			"cue": String(cue),
			"source_cursor": int(intent.get("source_cursor", -1)),
		})
		return true


func _status_callable() -> Callable:
	var sink: Array[Dictionary] = _statuses
	return func(_target_key: String, _status_id: StringName, _duration: float,
			_magnitude: float, _intent: Dictionary) -> bool:
		sink.append({"duration": _duration})
		return true


func _initialize() -> void:
	var adapter = ADAPTER.new()
	_check(adapter != null, "adapter must construct")
	_check(adapter.runtime.catalog.is_valid(),
			"adapter runtime must load the 93-id readiness manifest")

	# --- 1. unknown id -------------------------------------------------------
	_check(adapter.cast("not_a_skill:999", _caster(), Vector2(340.0, 170.0)) == null,
			"an unknown canonical id must be rejected")

	# --- 2. catalogued but source-blocked id ---------------------------------
	var blocked = adapter.cast(BLOCKED_ID, _caster(), Vector2(340.0, 170.0), _actors())
	_check(blocked != null, "a catalogued id must return a handle, not null")
	if blocked != null:
		_check(blocked.is_blocked(), BLOCKED_ID + " must be BLOCKED, not silently cast")
		_check(not blocked.block_reason.is_empty(),
				"the blocker must name a reason, not fail silently")
		_check(blocked.block_reason == adapter.runtime.blocker_for(BLOCKED_ID),
				"the adapter must surface the runtime's real blocker for " + BLOCKED_ID)
		# The original source archive HAS been recovered and verified, so
		# claiming the archive is unavailable would be a lie. The honest
		# blocker for an unported skill is the generator.
		_check(blocked.block_reason.find("ORIGINAL_SOURCE_ARCHIVE_UNAVAILABLE") < 0,
				"the recovered archive must not be blamed for work not yet ported")
		_check(blocked.tick_source(64) == 0,
				"a blocked handle must never advance a source tick")
		_check(blocked.status_name() == "BLOCKED", "blocked handle keeps BLOCKED status")

	# --- 3/4. the source-locked module, gameplay UNCONFIGURED ----------------
	var caster := _caster()
	var vfx_only = adapter.cast(CASTER_ID, caster, Vector2(340.0, 170.0), _actors())
	_check(vfx_only != null and not vfx_only.is_blocked(),
			CASTER_ID + " must cast natively through the adapter")
	if vfx_only == null or vfx_only.is_blocked():
		_finish(1)
		return

	var guard: int = 0
	while vfx_only.status == Gold93SkillHandle.Status.RUNNING and guard < 4096:
		adapter.tick_all(1)
		guard += 1
	var res: Dictionary = vfx_only.result()
	_check(vfx_only.status == Gold93SkillHandle.Status.FINISHED,
			"the cast must reach FINISHED through the adapter")
	_check(int(res.get("source_tick", 0)) > 0, "the cast must advance source ticks")
	_check(bool(res.get("source_locked_generator", false)),
			"the module must report a source-locked generator")
	_check(int((res.get("module", {}) as Dictionary).get("bites", 0)) > 0,
			"the authored bite timeline must run through the adapter")
	var unconfigured_combat: Dictionary = res.get("combat", {})
	_check(int(unconfigured_combat.get("applied", 0)) == 0,
			"unconfigured rules must never mutate health")
	_check(int(unconfigured_combat.get("rejected", 0)) > 0,
			"unconfigured rules must be rejected by the combat authority")
	_check(String((res.get("parameters", {}) as Dictionary).get("provenance", "")) == "VFX_ONLY_UNCONFIGURED",
			"an unconfigured packet must be stamped VFX_ONLY_UNCONFIGURED")

	# --- 5. partial rules are refused ----------------------------------------
	_check(adapter.validate_rules(_partial_rules()).size() == 3,
			"validate_rules must list every empty or null slot")
	_check(not adapter.configure(CASTER_ID, _partial_rules()),
			"a partial rule packet must be refused")
	_check(not adapter.is_configured(CASTER_ID),
			"a refused packet must leave the id unconfigured")

	# --- 6. complete rules + approved authority apply each hit once ----------
	_check(adapter.configure(CASTER_ID, _complete_rules()),
			"a complete rule packet must be accepted")
	_check(adapter.is_configured(CASTER_ID), "configure() must mark the id configured")

	var bundle = PORTS.Bundle.new(true)
	bundle.combat = ADAPTER.CallableCombatPort.new(
			_alive_callable(), _damage_callable(), _status_callable(), true)
	var configured = adapter.cast(CASTER_ID, _caster(), Vector2(340.0, 170.0),
			_actors(), adapter.approved_rules[CASTER_ID], bundle)
	_check(configured != null and not configured.is_blocked(),
			"a configured cast must run")
	if configured != null and not configured.is_blocked():
		guard = 0
		while configured.status == Gold93SkillHandle.Status.RUNNING and guard < 4096:
			adapter.tick_all(1)
			guard += 1
		_check(configured.status == Gold93SkillHandle.Status.FINISHED,
				"the configured cast must finish")
		_check(_applied.size() > 0,
				"an approved combat authority must receive the authored hits")
		var cursors: Dictionary = {}
		var duplicated: bool = false
		for row in _applied:
			var cursor: int = int(row.get("source_cursor", -1))
			if cursors.has(cursor):
				duplicated = true
			cursors[cursor] = true
		_check(not duplicated, "each authored source hit must be admitted exactly once")
		_check(int(bundle.combat.stats().get("duplicates_blocked", 0)) == 0,
				"the once-only gate must never need to block a duplicate")
		_check(_statuses.size() > 0, "authored status cues must reach the authority")

	# --- 7. handoff descriptors ----------------------------------------------
	var handoff: Array = adapter.handoff_all()
	_check(handoff.size() == 93, "handoff must describe all 93 canonical ids")
	var native_count: int = 0
	var blocked_without_reason: int = 0
	for row in handoff:
		if not row is Dictionary:
			continue
		var d: Dictionary = row
		if bool(d.get("native_executable", false)):
			native_count += 1
		elif String(d.get("blocker", "")).is_empty():
			blocked_without_reason += 1
		_check(String(d.get("canonical_id", "")).is_empty() == false,
				"every handoff row must carry a canonical id")
		_check((d.get("controls", {}) is Dictionary)
				and not (d.get("controls", {}) as Dictionary).is_empty(),
				"every handoff row must describe its control envelope")
	_check(native_count == 1, "exactly one id is natively executable today")
	_check(blocked_without_reason == 0, "every non-native id must state its blocker")

	adapter.cancel_all()
	_finish(0)


func _finish(code: int) -> void:
	if code == 0 and not _failures.is_empty():
		code = 1
	if code == 0:
		print("GOLD93_ADAPTER: PASS / %d checks / host adapter casts, gates partial rules, VFX-only by default, once-only combat when approved / 93 handoff descriptors"
				% _checks)
	else:
		for message in _failures:
			print("GOLD93_ADAPTER FAILURE: " + message)
	quit(code)
